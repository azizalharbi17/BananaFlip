import { NextRequest, NextResponse } from "next/server";
import { searchCoins } from "@/lib/coins";

export const dynamic = "force-dynamic";

/** GET /api/search?q=do[&limit=8] → coins matching name or symbol, ranked. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  const results = await searchCoins(q);
  return NextResponse.json({
    query: q,
    results: limit ? results.slice(0, limit) : results,
  });
}
