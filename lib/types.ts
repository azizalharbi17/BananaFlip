export interface Coin {
  id: string;
  name: string;
  symbol: string;
  /** Current price in USD. */
  price: number;
  /** Market capitalization in USD. */
  marketCap: number;
  /** Brand color used for the coin disc. */
  color: string;
}

/** A coin plus its market-cap rank within the dataset (1 = largest). */
export interface RankedCoin extends Coin {
  rank: number;
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
