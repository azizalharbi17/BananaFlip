import { NextRequest, NextResponse } from "next/server";
import { getCoinById } from "@/lib/coins";
import { compareCoins } from "@/lib/compare";

export const dynamic = "force-dynamic";

/**
 * GET /api/compare?challenger=pepe&target=doge
 * → the flip verdict: implied price, multiplier, cap gap.
 */
export async function GET(request: NextRequest) {
  const challengerId = request.nextUrl.searchParams.get("challenger");
  const targetId = request.nextUrl.searchParams.get("target");

  if (!challengerId || !targetId) {
    return NextResponse.json(
      { error: "Required query params: challenger, target" },
      { status: 400 }
    );
  }

  const [challenger, target] = await Promise.all([
    getCoinById(challengerId),
    getCoinById(targetId),
  ]);

  if (!challenger || !target) {
    return NextResponse.json(
      { error: `Unknown coin id: ${!challenger ? challengerId : targetId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(compareCoins(challenger, target));
}
