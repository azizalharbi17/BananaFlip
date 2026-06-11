import { NextResponse } from "next/server";
import { getCoin } from "@/lib/store";

/**
 * GET /api/coin/:id
 * Full record for a single coin from the cached table.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const coin = await getCoin(params.id);
  if (!coin) {
    return NextResponse.json(
      { error: `Unknown coin "${params.id}". This one slipped on a peel.` },
      { status: 404 },
    );
  }
  return NextResponse.json(coin, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
