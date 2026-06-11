/* Comparison-pair slugs: /pepe-flip-doge ⇄ { challengerId: "pepe", targetId: "doge" } */

export interface PairIds {
  challengerId: string;
  targetId: string;
}

export const DEFAULT_PAIR: PairIds = { challengerId: "pepe", targetId: "doge" };

/** Curated pairs for the "Hot flips" table, from design-reference.html. */
export const HOT_PAIRS: PairIds[] = [
  { challengerId: "pepe", targetId: "doge" },
  { challengerId: "doge", targetId: "btc" },
  { challengerId: "sol", targetId: "eth" },
  { challengerId: "shib", targetId: "pepe" },
  { challengerId: "wif", targetId: "bonk" },
  { challengerId: "xrp", targetId: "eth" },
  { challengerId: "sui", targetId: "sol" },
];

export function pairSlug({ challengerId, targetId }: PairIds): string {
  return `${challengerId}-flip-${targetId}`;
}

/**
 * Parse "pepe-flip-doge" → ids. Returns null when the slug is malformed;
 * the caller decides whether the ids actually exist in the dataset.
 */
export function parsePairSlug(slug: string): PairIds | null {
  const parts = slug.toLowerCase().split("-flip-");
  if (parts.length !== 2) return null;
  const [challengerId, targetId] = parts;
  if (!challengerId || !targetId || challengerId === targetId) return null;
  if (!/^[a-z0-9]+$/.test(challengerId) || !/^[a-z0-9]+$/.test(targetId)) return null;
  return { challengerId, targetId };
}
