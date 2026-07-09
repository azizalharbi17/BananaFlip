import { NextRequest, NextResponse } from "next/server";
import { isContractAddress } from "@/lib/dexscreener";
import { resolveAndCacheToken } from "@/lib/token-resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/resolve?address=0x… — resolve any on-chain token live via
 * DexScreener (GeckoTerminal fallback), self-host its logo, cache it in
 * the coins table, and return the full coin. 404 when nothing resolves.
 */
export async function GET(request: NextRequest) {
  const address = (request.nextUrl.searchParams.get("address") ?? "").trim();
  if (!isContractAddress(address)) {
    return NextResponse.json(
      { error: "Not a valid contract address" },
      { status: 400 }
    );
  }
  try {
    const coin = await resolveAndCacheToken(address);
    if (!coin) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    return NextResponse.json({ coin });
  } catch {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
}
