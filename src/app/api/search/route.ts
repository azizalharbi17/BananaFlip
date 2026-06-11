import { NextRequest, NextResponse } from "next/server";
import { searchCoins } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=pep&limit=8
 * Autocomplete endpoint. Empty query returns the top coins by market cap.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 8, 1), 25);
  const results = await searchCoins(q, limit);
  return NextResponse.json(
    { query: q, results },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
