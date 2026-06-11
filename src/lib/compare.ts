import type { Coin, CompareResult } from "./types";
import { pairToSlug } from "./slug";

/**
 * The whole site in one function:
 * what would Coin A cost if it had Coin B's market cap?
 *
 *   priceA × (mcapB / mcapA)
 *
 * Pure and isomorphic — used by API routes, server-rendered flip pages and
 * the client comparator (for instant optimistic flips).
 */
export function compareCoins(a: Coin, b: Coin): CompareResult {
  const multiplier = b.market_cap / a.market_cap;
  return {
    a,
    b,
    multiplier,
    hypotheticalPrice: a.price * multiplier,
    alreadyFlipped: multiplier <= 1,
    gapUsd: b.market_cap - a.market_cap,
    slug: pairToSlug(a.id, b.id),
  };
}
