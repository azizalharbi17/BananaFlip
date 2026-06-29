export interface Coin {
  /** Provider id (coinpaprika), e.g. "btc-bitcoin". Demo seed uses the slug. */
  id: string;
  /** URL key, e.g. "btc". Unique and stable across refreshes. */
  slug: string;
  name: string;
  symbol: string;
  /** Current price in USD. */
  price: number;
  /** Market capitalization in USD. */
  marketCap: number;
  /** Circulating supply (derived as marketCap/price for the demo seed). */
  circulatingSupply?: number | null;
  /** All-time-high price in USD; null when the provider has none. */
  athPrice?: number | null;
  /** Brand color used for the coin disc. */
  color: string;
  /** Where this coin's data comes from. Defaults to "binance". */
  source?: "binance" | "coingecko";
  /** CoinGecko id for source="coingecko" coins (e.g. "the-black-bull"). */
  coingeckoId?: string | null;
}

/** A coin plus its market-cap rank (1 = largest). */
export interface RankedCoin extends Coin {
  rank: number;
}

/** What getCoins() serves: the ranked list plus where it came from. */
export interface CoinDataset {
  coins: RankedCoin[];
  /** True when serving the bundled seed (Supabase unreachable or empty). */
  isDemoData: boolean;
}

export interface CompareResult {
  challenger: RankedCoin;
  target: RankedCoin;
  /** target mcap / challenger mcap — the "×'s away" number. */
  multiplier: number;
  /** Challenger's price if it had the target's market cap. */
  impliedPrice: number;
  /** Absolute market-cap gap in USD (target − challenger). */
  capGap: number;
  /** True when the challenger's market cap already exceeds the target's. */
  alreadyFlipped: boolean;
}
