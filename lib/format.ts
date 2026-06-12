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

/** Compact dollars: $4,252T / $212.1M / $104.4K / $0.0095. */
export function fmtCompact(v: number): string {
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [u, s] of units) {
    if (v >= u) {
      const x = v / u;
      const str =
        x >= 1000
          ? Math.round(x).toLocaleString("en-US")
          : x.toFixed(x >= 10 ? 1 : 2);
      return `$${str}${s}`;
    }
  }
  return fmtPrice(v);
}

/** Percentages: 5,674% / 16.8% / -3%. */
export function fmtPct(pct: number): string {
  if (Math.abs(pct) >= 100) {
    return Math.round(pct).toLocaleString("en-US") + "%";
  }
  return pct.toFixed(1).replace(/\.0$/, "") + "%";
}

/** Whole dollars with separators, compact past $1M: $24,532 / $31.2M. */
export function fmtUsdWhole(v: number): string {
  if (v >= 1e6) return fmtCompact(v);
  return "$" + Math.round(v).toLocaleString("en-US");
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
