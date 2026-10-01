/* Comparison-pair slugs: /pepe-flip-doge ⇄ { challengerSlug: "pepe", targetSlug: "doge" } */

export interface PairSlugs {
  challengerSlug: string;
  targetSlug: string;
}

export const DEFAULT_PAIR: PairSlugs = { challengerSlug: "pepe", targetSlug: "doge" };

/** Curated pairs for the "Hot flips" table, from design-reference.html. */
export const HOT_PAIRS: PairSlugs[] = [
  { challengerSlug: "pepe", targetSlug: "doge" },
  { challengerSlug: "doge", targetSlug: "btc" },
  { challengerSlug: "sol", targetSlug: "eth" },
  { challengerSlug: "shib", targetSlug: "pepe" },
  { challengerSlug: "wif", targetSlug: "bonk" },
  { challengerSlug: "xrp", targetSlug: "eth" },
  { challengerSlug: "sui", targetSlug: "sol" },
];

/**
 * Targets for auto-discovered trending tokens in "Hot flips" (see
 * lib/hot-flips.ts): the big memecoins, then the majors. Sorted by live
 * cap at render time; a trending coin targets the smallest rung above it.
 */
export const TRENDING_TARGET_LADDER = [
  "bonk",
  "wif",
  "floki",
  "pepe",
  "shib",
  "doge",
  "sol",
  "eth",
  "btc",
];

export function pairSlug({ challengerSlug, targetSlug }: PairSlugs): string {
  return `${challengerSlug}-flip-${targetSlug}`;
}

/**
 * Coin slugs are lowercase alphanumerics with inner hyphens. They never
 * contain "-flip-" or end in "-flip" (lib/slugs.ts guarantees it), which
 * keeps the pair separator unambiguous.
 */
const COIN_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Parse "pepe-flip-doge" → slugs. Returns null when the URL is malformed;
 * the caller decides whether the slugs actually exist in the dataset.
 */
export function parsePairSlug(slug: string): PairSlugs | null {
  const parts = slug.toLowerCase().split("-flip-");
  if (parts.length !== 2) return null;
  const [challengerSlug, targetSlug] = parts;
  if (!challengerSlug || !targetSlug || challengerSlug === targetSlug) return null;
  if (!COIN_SLUG_RE.test(challengerSlug) || !COIN_SLUG_RE.test(targetSlug)) return null;
  return { challengerSlug, targetSlug };
}
