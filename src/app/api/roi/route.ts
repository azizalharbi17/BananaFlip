import { NextRequest, NextResponse } from "next/server";
import { getCoin } from "@/lib/store";
import { getPriceOn, getSeriesSince } from "@/lib/history";
import type { RoiResult } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 1_000_000_000_000;

/**
 * GET /api/roi?coin=bitcoin&amount=1000&date=2024-06-01
 * "If you invested $X in coin Y on date Z, you'd have..."
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const coinId = params.get("coin");
  const amount = Number(params.get("amount"));
  const date = params.get("date");

  if (!coinId || !date || !Number.isFinite(amount)) {
    return NextResponse.json(
      { error: "Required: ?coin=<id>&amount=<usd>&date=<YYYY-MM-DD>" },
      { status: 400 },
    );
  }
  if (amount <= 0 || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: "Amount must be between $0 and $1T. Even whales have limits." },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
  }

  const coin = await getCoin(coinId);
  if (!coin) {
    return NextResponse.json({ error: `Unknown coin "${coinId}".` }, { status: 404 });
  }
  if (date < coin.listed) {
    return NextResponse.json(
      { error: `${coin.symbol} wasn't around yet — it listed on ${coin.listed}.` },
      { status: 400 },
    );
  }

  const then = getPriceOn(coin, date);
  if (!then) {
    return NextResponse.json({ error: "No price data for that date." }, { status: 400 });
  }

  const coinsBought = amount / then.price;
  const valueNow = coinsBought * coin.price;
  const series = getSeriesSince(coin, then.date).map((p) => ({
    date: p.date,
    value: coinsBought * p.price,
  }));

  const result: RoiResult = {
    coin,
    invested: amount,
    date: then.date,
    priceThen: then.price,
    priceNow: coin.price,
    coinsBought,
    valueNow,
    profit: valueNow - amount,
    roiPct: ((valueNow - amount) / amount) * 100,
    multiplier: valueNow / amount,
    series,
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
  });
}
