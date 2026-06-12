import { NextResponse } from "next/server";

const ID_RE = /^[a-z0-9-]{1,80}$/;

/**
 * GET /api/logo/:paprikaId — same-origin proxy for coinpaprika logos.
 * The CDN sends no CORS headers, so serving them from our origin is what
 * lets the client analyze logo pixels on a canvas (Disc.tsx) without
 * tainting it. Aggressively cached: upstream for a day, CDN for a week.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!ID_RE.test(params.id)) {
    return new NextResponse(null, { status: 400 });
  }

  const upstream = await fetch(
    `https://static.coinpaprika.com/coin/${params.id}/logo.png`,
    { next: { revalidate: 86400 } }
  );
  if (!upstream.ok) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
