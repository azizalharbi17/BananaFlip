/**
 * Curated "people keep asking" pairs shown on the homepage and
 * pre-rendered as static flip pages for SEO.
 *
 * With a live provider this list can be replaced by real query analytics;
 * everything downstream just consumes [aId, bId] tuples.
 */
export const TRENDING_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["pepe", "dogecoin"],
  ["ethereum", "bitcoin"],
  ["solana", "ethereum"],
  ["shiba-inu", "dogecoin"],
  ["dogwifhat", "pepe"],
  ["dogecoin", "bitcoin"],
  ["bonk", "shiba-inu"],
  ["xrp", "ethereum"],
  ["sui", "solana"],
  ["floki", "pepe"],
  ["cardano", "solana"],
  ["kaspa", "litecoin"],
];
