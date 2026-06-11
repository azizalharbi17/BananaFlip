/**
 * Generates the local coin logo set (public/logos/*.svg) from the seed table.
 *
 * BananaFlip never hotlinks third-party assets, so each coin gets a crisp
 * monogram disc in its brand-ish color. Re-run with `npm run generate:logos`
 * whenever seed-coins.json changes. Output is committed.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seed = JSON.parse(readFileSync(join(root, "src/data/seed-coins.json"), "utf8"));
const outDir = join(root, "public/logos");
mkdirSync(outDir, { recursive: true });

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex, target, amount) {
  const [r, g, b] = hexToRgb(hex);
  const m = (c, t) => Math.round(c + (t - c) * amount);
  return `#${[m(r, target), m(g, target), m(b, target)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

for (const coin of seed.coins) {
  const { id, symbol, color } = coin;
  const light = mix(color, 255, 0.32);
  const dark = mix(color, 0, 0.18);
  const text = luminance(color) > 0.45 ? "#231A0E" : "#FFFFFF";
  const label = symbol.slice(0, 5);
  const fontSize = label.length <= 3 ? 30 : label.length === 4 ? 25 : 21;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${coin.name} logo">
  <defs>
    <radialGradient id="g" cx="32%" cy="26%" r="85%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
  </defs>
  <circle cx="48" cy="48" r="45" fill="url(#g)"/>
  <circle cx="48" cy="48" r="45" fill="none" stroke="rgba(35,26,14,0.25)" stroke-width="3"/>
  <text x="48" y="49" dy="0.36em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="0.5" fill="${text}">${label}</text>
</svg>
`;
  writeFileSync(join(outDir, `${id}.svg`), svg);
}

console.log(`Generated ${seed.coins.length} logos in public/logos/`);
