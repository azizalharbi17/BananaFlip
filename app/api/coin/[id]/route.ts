import { NextResponse } from "next/server";
import { getCoinBySlug } from "@/lib/coins";

export const dynamic = "force-dynamic";

/** GET /api/coin/:slug → a single coin with its market-cap rank. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const coin = await getCoinBySlug(params.id);
  if (!coin) {
    return NextResponse.json(
      { error: `Unknown coin: ${params.id}` },
      { status: 404 }
    );
  }
  return NextResponse.json({ coin });
}
