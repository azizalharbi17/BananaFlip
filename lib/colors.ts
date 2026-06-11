import seed from "@/data/coins.json";

/** Hand-picked disc colors for the original demo coins, keyed by slug. */
export const DEMO_COLORS: Record<string, string> = Object.fromEntries(
  seed.coins.map((c) => [c.id, c.color])
);

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Stable, readable disc color from a symbol hash. Saturation 55–84% and
 * lightness 42–58% keep it away from near-black/near-white so the disc
 * reads on any background.
 */
export function colorForSymbol(symbol: string): string {
  let h = 2166136261; // FNV-1a
  for (const ch of symbol.toUpperCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const hue = h % 360;
  const sat = 55 + ((h >>> 9) % 30);
  const light = 42 + ((h >>> 17) % 17);
  return hslToHex(hue, sat, light);
}

/** Demo coins keep their hand-picked color; everything else is hashed. */
export function colorForCoin(slug: string, symbol: string): string {
  return DEMO_COLORS[slug] ?? colorForSymbol(symbol);
}
