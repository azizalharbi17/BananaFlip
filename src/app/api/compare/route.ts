import { NextRequest, NextResponse } from "next/server";
import { getCoin } from "@/lib/store";
import { compareCoins } from "@/lib/compare";

export const dynamic = "force-dynamic";

/**
 * GET /api/compare?a=pepe&b=dogecoin
 * The core flip math: what would A's price be with B's market cap?
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const aId = params.get("a");
  const bId = params.get("b");

  if (!aId || !bId) {
    return NextResponse.json(
      { error: "Both ?a= and ?b= coin ids are required." },
      { status: 400 },
    );
  }
  if (aId.trim().toLowerCase() === bId.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "A banana can't flip itself. Pick two different coins." },
      { status: 400 },
    );
  }

  const [a, b] = await Promise.all([getCoin(aId), getCoin(bId)]);
  if (!a || !b) {
    const missing = !a ? aId : bId;
    return NextResponse.json({ error: `Unknown coin "${missing}".` }, { status: 404 });
  }

  return NextResponse.json(compareCoins(a, b), {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
