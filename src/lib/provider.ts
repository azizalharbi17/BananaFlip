import type { Coin } from "./types";
import seed from "@/data/seed-coins.json";

/**
 * A CoinProvider is the single integration point with the outside world.
 *
 * The rest of the app (store, API routes, pages) only ever talks to the
 * in-memory store, which is hydrated through a provider. Swapping the seed
 * JSON for a real market-data vendor means writing one new class that
 * implements this interface and pointing `getProvider()` at it — nothing
 * else changes. A cron route (`/api/cron/refresh`) already exists to drive
 * scheduled refreshes.
 */
export interface CoinProvider {
  readonly name: string;
  /** Fetch the full coin table, sorted by market cap descending. */
  fetchCoins(): Promise<{ coins: Coin[]; fetchedAt: Date }>;
}

/** Reads the bundled JSON snapshot. Zero latency, fully deterministic. */
export class SeedProvider implements CoinProvider {
  readonly name = "seed";

  async fetchCoins(): Promise<{ coins: Coin[]; fetchedAt: Date }> {
    const coins = (seed.coins as Coin[])
      .slice()
      .sort((a, b) => b.market_cap - a.market_cap)
      .map((coin, i) => ({ ...coin, rank: i + 1 }));
    return { coins, fetchedAt: new Date(seed.updated_at) };
  }
}

/*
 * Future live provider — sketch of the planned swap:
 *
 * export class CoinGeckoProvider implements CoinProvider {
 *   readonly name = "coingecko";
 *   async fetchCoins() {
 *     const res = await fetch(
 *       "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250",
 *       { headers: { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY! } },
 *     );
 *     const rows = await res.json();
 *     return { coins: rows.map(mapToCoin), fetchedAt: new Date() };
 *   }
 * }
 */

export function getProvider(): CoinProvider {
  switch (process.env.COIN_PROVIDER) {
    // case "coingecko": return new CoinGeckoProvider();
    default:
      return new SeedProvider();
  }
}
