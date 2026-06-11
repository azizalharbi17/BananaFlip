import type { CompareResult, RankedCoin } from "./types";

/**
 * The flip math: what the challenger would be worth at the target's
 * market cap, and how many ×'s away that is.
 * impliedPrice = priceA × (mcapB / mcapA)
 */
export function compareCoins(challenger: RankedCoin, target: RankedCoin): CompareResult {
  const multiplier = target.marketCap / challenger.marketCap;
  return {
    challenger,
    target,
    multiplier,
    impliedPrice: challenger.price * multiplier,
    capGap: target.marketCap - challenger.marketCap,
    alreadyFlipped: multiplier < 1,
  };
}
