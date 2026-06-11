import { NextResponse } from "next/server";
import { getCoinById } from "@/lib/coins";

export const dynamic = "force-dynamic";

/** GET /api/coin/:id → a single coin with its market-cap rank. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const coin = await getCoinById(params.id);
  if (!coin) {
    return NextResponse.json(
      { error: `Unknown coin id: ${params.id}` },
      { status: 404 }
    );
  }
  return NextResponse.json({ coin });
}
