/**
 * Share URLs look like /pepe-flip-dogecoin.
 * Coin ids may themselves contain hyphens (shiba-inu), so the literal
 * "-flip-" token is the only safe separator.
 */
const SEPARATOR = "-flip-";

export function pairToSlug(aId: string, bId: string): string {
  return `${aId}${SEPARATOR}${bId}`;
}

export function parseSlug(slug: string): { aId: string; bId: string } | null {
  const decoded = decodeURIComponent(slug).toLowerCase();
  const idx = decoded.indexOf(SEPARATOR);
  if (idx <= 0) return null;
  const aId = decoded.slice(0, idx);
  const bId = decoded.slice(idx + SEPARATOR.length);
  if (!aId || !bId || bId.includes(SEPARATOR)) return null;
  return { aId, bId };
}
