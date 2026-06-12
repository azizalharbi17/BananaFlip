import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCoinBySlug } from "@/lib/coins";

export const dynamic = "force-dynamic";

const YEAR_RE = /^20\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * Probed live: coinpaprika's free plan serves daily historical data only
 * for the trailing 365 days (HTTP 402 for anything older). Checking the
 * window locally avoids burning quota on requests that will be refused.
 */
function withinFreeWindow(anchorMs: number): boolean {
  const now = Date.now();
  return anchorMs <= now && now - anchorMs < 364 * DAY_MS;
}

interface HistoryResult {
  available: boolean;
  price?: number;
  date?: string;
}

/**
 * Historical closes are immutable, so successful (and plan-refused)
 * lookups are cached for 30 days — repeat queries never re-hit
 * coinpaprika. Transient upstream errors throw and are NOT cached.
 */
const fetchHistorical = unstable_cache(
  async (paprikaId: string, isoDate: string): Promise<HistoryResult> => {
    const url = `https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(
      paprikaId
    )}/historical?start=${isoDate}&interval=1d&limit=1`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (res.status === 402 || res.status === 400 || res.status === 404) {
      return { available: false }; // plan limit or no data — a final answer
    }
    if (!res.ok) throw new Error(`coinpaprika responded ${res.status}`);
    const rows = (await res.json()) as { timestamp: string; price: number }[];
    if (!Array.isArray(rows) || typeof rows[0]?.price !== "number") {
      return { available: false };
    }
    return { available: true, price: rows[0].price, date: rows[0].timestamp };
  },
  ["coin-history"],
  { revalidate: 60 * 60 * 24 * 30 }
);

/**
 * GET /api/history/:slug?year=2026 → the coin's price on Jan 1 of that
 * year, from coinpaprika via our server (the browser never calls them).
 * Always 200 with {available:false} when the data can't be served.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const year = request.nextUrl.searchParams.get("year") ?? "";
  if (!YEAR_RE.test(year)) {
    return NextResponse.json({ error: "Required query param: year=YYYY" }, { status: 400 });
  }

  const coin = await getCoinBySlug(params.slug);
  if (!coin) {
    return NextResponse.json({ error: `Unknown coin: ${params.slug}` }, { status: 404 });
  }

  // Demo-seed ids aren't coinpaprika ids — no historical source exists.
  if (!coin.id.includes("-")) {
    return NextResponse.json({ available: false, reason: "demo" });
  }

  const anchor = `${year}-01-01`;
  if (!withinFreeWindow(Date.parse(`${anchor}T00:00:00Z`))) {
    return NextResponse.json({ available: false, reason: "plan-window" });
  }

  try {
    const result = await fetchHistorical(coin.id, anchor);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ available: false, reason: "upstream" });
  }
}
