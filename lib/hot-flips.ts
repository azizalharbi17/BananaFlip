import { TRENDING_TARGET_LADDER } from "./pairs";
import type { RankedCoin } from "./types";

/* Hot Flips rows from the auto-discovered trending set. Each trending
   token is the challenger; its target is the smallest rung of the
   memecoin → majors ladder that is still bigger than it, so every row
   reads as a plausible "X flips? Y" with a real multiple to go. */

export interface TrendingHotRow {
  challenger: RankedCoin;
  target: RankedCoin;
}

export function buildTrendingRows(
  trending: RankedCoin[],
  bySlug: Map<string, RankedCoin>,
  /** The full ranked list — its top coin is the last-resort target. */
  coins: RankedCoin[]
): TrendingHotRow[] {
  const ladder = TRENDING_TARGET_LADDER.map((slug) => bySlug.get(slug))
    .filter((c): c is RankedCoin => Boolean(c))
    .sort((a, b) => a.marketCap - b.marketCap);
  const biggest = coins[0];

  return trending.flatMap((challenger) => {
    const target =
      ladder.find((t) => t.marketCap > challenger.marketCap && t.slug !== challenger.slug) ??
      (biggest && biggest.slug !== challenger.slug && biggest.marketCap > challenger.marketCap
        ? biggest
        : undefined);
    return target ? [{ challenger, target }] : [];
  });
}
