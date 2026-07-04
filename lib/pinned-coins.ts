/**
 * Coins pinned into BananaFlip by contract/id rather than discovered via
 * the coinpaprika→Binance pipeline — e.g. Solana Pump.fun tokens that
 * aren't on Binance. Their current values come from CoinGecko (in the
 * refresh route) and their history from CoinGecko market_chart (in the
 * history route). Pinning lives here, in code, so the exact asset is
 * fixed by id + contract and never matched by ticker (many copycats
 * share a memecoin's symbol).
 */
export interface PinnedCoin {
  /** coins-table primary key. No dash → Disc renders the monogram, not a
   *  coinpaprika logo lookup. */
  id: string;
  /** URL key / picker slug. */
  slug: string;
  symbol: string;
  name: string;
  /** CoinGecko coin id — the source of truth for this asset. */
  coingeckoId: string;
  /** On-chain contract, recorded so the id can be re-verified. */
  contract: string;
  /** Disc color. */
  color: string;
  /** Self-hosted logo path (public/), overriding the CoinGecko image URL.
   *  Hotlinking their CDN broke on mobile: rapid flips re-request the
   *  image and intermittent failures stuck the monogram fallback. */
  logo?: string;
}

export const PINNED_COINS: PinnedCoin[] = [
  {
    id: "ansem",
    slug: "ansem",
    symbol: "ANSEM",
    name: "ANSEM (The Black Bull)",
    coingeckoId: "the-black-bull",
    contract: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
    color: "#c0392b",
    logo: "/logos/ansem.jpg",
  },
];

/** symbol (upper) → pinned coin, for the history route's source branch. */
export const PINNED_BY_SYMBOL: Record<string, PinnedCoin> = Object.fromEntries(
  PINNED_COINS.map((c) => [c.symbol.toUpperCase(), c])
);

export const PINNED_SLUGS = new Set(PINNED_COINS.map((c) => c.slug));
