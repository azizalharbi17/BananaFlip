import { NextRequest, NextResponse } from "next/server";
import { searchCoins } from "@/lib/coins";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=do[&limit=20] → coins matching name or symbol,
 * best rank first. Backed by Supabase with automatic demo fallback.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;

  const results = await searchCoins(q, limit);
  return NextResponse.json({ query: q, results });
}
