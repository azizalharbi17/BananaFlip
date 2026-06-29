/**
 * Minimal CoinGecko client for pinned coins (server-side only).
 *
 * Uses the public API; if COINGECKO_API_KEY (a free "demo" key) is set it
 * is sent as the demo header for extra rate-limit headroom. Volume is low
 * by design — current values are refreshed by the cron (~once / 10 min)
 * and history is persisted in coin_history — so the free tier suffices.
 */
const BASE = "https://api.coingecko.com/api/v3";

function headers(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  const h: Record<string, string> = { accept: "application/json" };
  if (key) h["x-cg-demo-api-key"] = key;
  return h;
}

export interface CgMarket {
  price: number;
  /** Circulating market cap — NOT fully-diluted valuation. */
  marketCap: number;
  fdv: number | null;
  circulatingSupply: number | null;
  ath: number | null;
  /** Logo image URL (CoinGecko's "large" variant). */
  image: string | null;
}

/** Current market snapshot for a coin id, or null if the id is unknown. */
export async function fetchCgMarket(id: string): Promise<CgMarket | null> {
  const url = `${BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}`;
  const res = await fetch(url, { cache: "no-store", headers: headers() });
  if (!res.ok) throw new Error(`coingecko markets ${res.status}`);
  const arr = (await res.json()) as
    | {
        current_price: number;
        market_cap: number;
        fully_diluted_valuation: number | null;
        circulating_supply: number | null;
        ath: number | null;
        image: string | null;
      }[]
    | { status?: unknown };
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const r = arr[0];
  return {
    price: r.current_price,
    marketCap: r.market_cap, // circulating, by CoinGecko's definition
    fdv: r.fully_diluted_valuation ?? null,
    circulatingSupply: r.circulating_supply ?? null,
    ath: r.ath ?? null,
    image: r.image ?? null,
  };
}

/**
 * Daily closes for a coin id, newest-capped to the listing date.
 * `days=365` is the free tier's accepted ceiling and returns daily
 * granularity; younger coins simply return fewer points. Hourly data
 * (shorter ranges) is collapsed to one close per UTC day defensively.
 * Returns null when CoinGecko has no usable series.
 */
export async function fetchCgDailyCloses(
  id: string
): Promise<{ time: number; close: number }[] | null> {
  const url = `${BASE}/coins/${encodeURIComponent(
    id
  )}/market_chart?vs_currency=usd&days=365`;
  const res = await fetch(url, { cache: "no-store", headers: headers() });
  if (res.status === 404) return null; // unknown id — a final answer
  if (!res.ok) throw new Error(`coingecko market_chart ${res.status}`);
  const body = (await res.json()) as { prices?: [number, number][] };
  const prices = body?.prices;
  if (!Array.isArray(prices) || prices.length === 0) return null;

  // One close per UTC day = the last sample of that day.
  const byDay = new Map<string, number>();
  for (const [ms, price] of prices) {
    if (!(price > 0)) continue;
    byDay.set(new Date(ms).toISOString().slice(0, 10), price);
  }
  const points = [...byDay.entries()]
    .map(([day, close]) => ({
      time: Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000),
      close,
    }))
    .sort((a, b) => a.time - b.time);
  return points.length ? points : null;
}
