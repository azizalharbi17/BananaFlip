import seed from "@/data/coins.json";
import type { Coin, RankedCoin } from "./types";

/**
 * Single data-access point for coin data. Server-side only (API routes,
 * server components, sitemap) — the client talks to /api/* instead.
 *
 * Today this reads the demo seed in data/coins.json. To go live, replace
 * the body with a read from the real store (e.g. Supabase kept fresh by a
 * cron job) — every consumer goes through here, so nothing else changes.
 */
export async function getCoins(): Promise<Coin[]> {
  return seed.coins;
}

/** Coins sorted by market cap (desc) with their rank attached. */
export async function getRankedCoins(): Promise<RankedCoin[]> {
  const coins = await getCoins();
  return [...coins]
    .sort((a, b) => b.marketCap - a.marketCap)
    .map((coin, i) => ({ ...coin, rank: i + 1 }));
}

export async function getCoinById(id: string): Promise<RankedCoin | undefined> {
  const ranked = await getRankedCoins();
  return ranked.find((c) => c.id === id.toLowerCase());
}

/** Case-insensitive name/symbol match, ranked by market cap. */
export async function searchCoins(query: string): Promise<RankedCoin[]> {
  const ranked = await getRankedCoins();
  const q = query.trim().toLowerCase();
  if (!q) return ranked;
  return ranked.filter(
    (c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
  );
}
