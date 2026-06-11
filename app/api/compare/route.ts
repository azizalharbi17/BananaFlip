import { NextRequest, NextResponse } from "next/server";
import { getCoinBySlug } from "@/lib/coins";
import { compareCoins } from "@/lib/compare";

export const dynamic = "force-dynamic";

/**
 * GET /api/compare?challenger=pepe&target=doge
 * → the flip verdict: implied price, multiplier, cap gap.
 */
export async function GET(request: NextRequest) {
  const challengerSlug = request.nextUrl.searchParams.get("challenger");
  const targetSlug = request.nextUrl.searchParams.get("target");

  if (!challengerSlug || !targetSlug) {
    return NextResponse.json(
      { error: "Required query params: challenger, target" },
      { status: 400 }
    );
  }

  const [challenger, target] = await Promise.all([
    getCoinBySlug(challengerSlug),
    getCoinBySlug(targetSlug),
  ]);

  if (!challenger || !target) {
    return NextResponse.json(
      { error: `Unknown coin: ${!challenger ? challengerSlug : targetSlug}` },
      { status: 404 }
    );
  }

  return NextResponse.json(compareCoins(challenger, target));
}
