/**
 * Slug assignment for the refresh pipeline.
 *
 * Rules:
 * - Clean lowercase symbol is the preferred slug ("btc", "pepe").
 * - On symbol collisions the lowest-rank coin keeps the clean slug; the
 *   rest get "<symbol>-<name>" (then the provider id as a last resort).
 * - Slugs are assigned once per coin id and never change afterwards —
 *   the refresh route passes in the already-taken set from the DB.
 * - "-flip-" is the pair-URL separator, so no slug may contain it or end
 *   in "-flip"; sanitize() collapses those hyphens away.
 */

export function sanitizeSlugPart(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  while (s.includes("-flip-")) s = s.replace(/-flip-/g, "-flip");
  if (s.endsWith("-flip")) s = `${s.slice(0, -5)}flip`;
  return s;
}

interface SluggableCoin {
  id: string;
  symbol: string;
  name: string;
}

/**
 * Pick a slug for a new coin, avoiding everything in `taken`.
 * Call in rank order (best rank first) so collisions resolve correctly;
 * the caller adds the result to `taken`.
 */
export function assignSlug(coin: SluggableCoin, taken: Set<string>): string {
  const candidates = [
    sanitizeSlugPart(coin.symbol),
    sanitizeSlugPart(`${coin.symbol}-${coin.name}`),
    sanitizeSlugPart(coin.id),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!taken.has(candidate)) return candidate;
  }
  // Same symbol, name and id-collision — disambiguate deterministically.
  const base = candidates[candidates.length - 1] || "coin";
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
