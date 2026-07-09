import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Our own resolved-token id: "dex-<chain>-<address>", safe chars only. */
const ID_RE = /^dex-[a-zA-Z0-9_-]{3,120}$/;
const BUCKET = "token-logos";

/**
 * GET /api/token-logo/:id — same-origin proxy for a resolved token's
 * self-hosted logo (stored in Supabase Storage at resolve time). Serving
 * it from our own domain keeps the browser off third-party CDNs entirely,
 * so the canvas legibility check stays clean and the image never flakes
 * on a flip re-render (the ANSEM lesson).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = decodeURIComponent(params.id);
  if (!ID_RE.test(id)) return new NextResponse(null, { status: 400 });

  const supabase = getSupabase();
  if (!supabase) return new NextResponse(null, { status: 404 });

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(id);

  const upstream = await fetch(publicUrl, { next: { revalidate: 604800 } });
  if (!upstream.ok) return new NextResponse(null, { status: 404 });

  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
