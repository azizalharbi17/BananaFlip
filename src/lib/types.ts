export interface Coin {
  /** Stable slug-safe identifier, e.g. "shiba-inu" */
  id: string;
  /** Ticker symbol, e.g. "SHIB" */
  symbol: string;
  name: string;
  /** Path to the logo asset (always served from this origin) */
  logo: string;
  /** Brand-ish accent color used for logos and charts */
  color: string;
  /** Current price in USD */
  price: number;
  /** Current market capitalization in USD */
  market_cap: number;
  /** 24h change, percent (e.g. 7.4 means +7.4%) */
  change_24h: number;
  /** Market cap rank at last refresh */
  rank: number;
  /** First listing date (ISO), used as the lower bound for ROI lookups */
  listed: string;
}

export interface CompareResult {
  a: Coin;
  b: Coin;
  /** mcapB / mcapA — how many times Coin A must grow to flip Coin B */
  multiplier: number;
  /** priceA × (mcapB / mcapA) */
  hypotheticalPrice: number;
  /** true when Coin A already has the larger market cap */
  alreadyFlipped: boolean;
  /** Absolute market cap gap in USD (mcapB − mcapA) */
  gapUsd: number;
  /** Canonical share slug, e.g. "pepe-flip-dogecoin" */
  slug: string;
}

export interface RoiPoint {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Portfolio value in USD on that day */
  value: number;
}

export interface RoiResult {
  coin: Coin;
  invested: number;
  /** ISO purchase date actually used (snapped to available history) */
  date: string;
  priceThen: number;
  priceNow: number;
  coinsBought: number;
  valueNow: number;
  profit: number;
  roiPct: number;
  multiplier: number;
  /** Downsampled portfolio value series from purchase date to now */
  series: RoiPoint[];
}
