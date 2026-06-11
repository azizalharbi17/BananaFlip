import type { Coin } from "./types";

/**
 * Deterministic synthetic price history.
 *
 * The seed table only carries spot prices, so the ROI calculator builds a
 * plausible daily series per coin: a geometric random walk, seeded from the
 * coin id, walked *backwards* from today's real spot price. Identical input
 * → identical series, across builds and server instances.
 *
 * When the live provider lands, this module is the swap point: replace
 * `getDailySeries` with a provider-backed `/market_chart` lookup and the ROI
 * API keeps working unchanged.
 */

const MEME_IDS = new Set(["dogecoin", "shiba-inu", "pepe", "dogwifhat", "bonk", "floki"]);
const STABLE_IDS = new Set(["tether", "usd-coin"]);
const MS_PER_DAY = 86_400_000;

export interface HistoryPoint {
  /** ISO date YYYY-MM-DD (UTC) */
  date: string;
  price: number;
}

/* ---------- deterministic randomness ---------- */

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller: uniform → standard normal */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---------- series generation ---------- */

function volatilityFor(coin: Coin): { vol: number; drift: number } {
  if (STABLE_IDS.has(coin.id)) return { vol: 0.0004, drift: 0 };
  if (MEME_IDS.has(coin.id)) return { vol: 0.058, drift: 0.0016 };
  if (coin.rank <= 2) return { vol: 0.018, drift: 0.0008 };
  if (coin.rank <= 10) return { vol: 0.026, drift: 0.001 };
  if (coin.rank <= 25) return { vol: 0.034, drift: 0.0011 };
  return { vol: 0.042, drift: 0.0012 };
}

function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function toIso(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

const cache = new Map<string, HistoryPoint[]>();

/** Full daily series from the coin's listing date through today. */
export function getDailySeries(coin: Coin): HistoryPoint[] {
  const cached = cache.get(coin.id);
  if (cached && cached[cached.length - 1]?.date === toIso(todayUtc())) return cached;

  const end = todayUtc();
  const start = Math.max(
    Date.parse(`${coin.listed}T00:00:00Z`),
    end - 365 * 6 * MS_PER_DAY, // cap at 6 years of history
  );
  const days = Math.max(1, Math.round((end - start) / MS_PER_DAY));

  const { vol, drift } = volatilityFor(coin);
  const rng = mulberry32(fnv1a(coin.id));

  // Walk backwards from the known spot price so "today" always matches.
  const prices = new Array<number>(days + 1);
  prices[days] = coin.price;
  for (let i = days; i > 0; i--) {
    const factor = Math.exp(drift + vol * gaussian(rng));
    prices[i - 1] = prices[i] / factor;
  }

  const series: HistoryPoint[] = new Array(days + 1);
  for (let i = 0; i <= days; i++) {
    series[i] = { date: toIso(start + i * MS_PER_DAY), price: prices[i] };
  }
  cache.set(coin.id, series);
  return series;
}

/** Price on a given ISO date, snapped to the nearest available day. */
export function getPriceOn(coin: Coin, isoDate: string): HistoryPoint | null {
  const series = getDailySeries(coin);
  const target = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  const first = Date.parse(`${series[0].date}T00:00:00Z`);
  const idx = Math.round((target - first) / MS_PER_DAY);
  const clamped = Math.min(Math.max(idx, 0), series.length - 1);
  return series[clamped];
}

/** Series from a given date through today, downsampled to ≤ maxPoints. */
export function getSeriesSince(coin: Coin, isoDate: string, maxPoints = 120): HistoryPoint[] {
  const series = getDailySeries(coin);
  const startIdx = series.findIndex((p) => p.date >= isoDate);
  const slice = startIdx === -1 ? series.slice(-2) : series.slice(startIdx);
  if (slice.length <= maxPoints) return slice;
  const step = (slice.length - 1) / (maxPoints - 1);
  const out: HistoryPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(slice[Math.round(i * step)]);
  }
  return out;
}
