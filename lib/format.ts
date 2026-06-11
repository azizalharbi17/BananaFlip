/* Number formatting ported 1:1 from design-reference.html. */

/** Market caps: $2.06T / $28.40B / $970.0M / $12,345. */
export function fmtBig(v: number): string {
  if (v >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  return "$" + Math.round(v).toLocaleString("en-US");
}

/** Prices: $104,350 / $2.41 / $0.192 / $0.00000940. */
export function fmtPrice(v: number): string {
  if (v >= 1000) return "$" + Math.round(v).toLocaleString("en-US");
  if (v >= 1) return "$" + v.toFixed(2);
  if (v >= 0.01) return "$" + v.toFixed(3);
  return "$" + v.toPrecision(3);
}

/** Multipliers: 217× / 10.4× / 7.1× / 1.35×. */
export function fmtX(v: number): string {
  if (v >= 100) return Math.round(v) + "×";
  if (v >= 10) return v.toFixed(1) + "×";
  return v.toFixed(2).replace(/0$/, "") + "×";
}

/** Relative luminance of a hex color — picks the disc text color. */
export function lum(hex: string): number {
  const x = hex.replace("#", "");
  const r = parseInt(x.slice(0, 2), 16) / 255;
  const g = parseInt(x.slice(2, 4), 16) / 255;
  const b = parseInt(x.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function discTextColor(hex: string): string {
  return lum(hex) > 0.55 ? "#14130B" : "#fff";
}
