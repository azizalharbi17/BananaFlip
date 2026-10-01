import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const ID_RE = /^[a-z0-9-]{1,80}$/;
const BUCKET = "token-logos";

/**
 * GET /api/logo/:paprikaId — same-origin coin logo, served from OUR
 * Supabase Storage mirror (`paprika-<id>` in the token-logos bucket,
 * backfilled by scripts/mirror-coin-logos.mjs).
 *
 * History: this used to proxy static.coinpaprika.com live, until they
 * enabled hotlink protection (403 without a coinpaprika.com referer) and
 * every logo broke at once. Storage is now the serving path; upstream is
 * touched at most ONCE per coin — a mirror-on-miss with the referer
 * workaround — after which the stored copy serves forever. Same-origin
 * also keeps the Disc canvas legibility check untainted.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!ID_RE.test(params.id)) {
    return new NextResponse(null, { status: 400 });
  }

  const supabase = getSupabase();
  const key = `paprika-${params.id}`;

  // 1) Serving path: our own storage mirror. No third party involved.
  if (supabase) {
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const stored = await fetch(publicUrl, { next: { revalidate: 604800 } });
    if (stored.ok) {
      return new NextResponse(await stored.arrayBuffer(), {
        headers: {
          "Content-Type": stored.headers.get("content-type") ?? "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
          "X-Logo-Source": "storage",
        },
      });
    }
  }

  // 2) Mirror-on-miss, once: fetch upstream with the referer workaround
  //    (their hotlink protection allows only coinpaprika.com referers),
  //    store it, serve it. Next's data cache remembers failures for a
  //    day so logo-less coins don't hammer upstream on every view.
  const upstream = await fetch(
    `https://static.coinpaprika.com/coin/${params.id}/logo.png`,
    {
      next: { revalidate: 86400 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Referer: "https://coinpaprika.com/",
      },
    }
  );
  if (!upstream.ok) {
    // Genuinely no logo (or upstream fully closed) → monogram fallback.
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (supabase && contentType.startsWith("image/") && bytes.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .upload(key, bytes, { contentType, upsert: true })
      .catch(() => {}); // best-effort — storage has it next time or not
  }

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Logo-Source": "mirror",
    },
  });
}
