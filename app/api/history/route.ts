import { NextRequest, NextResponse } from "next/server";
import { fetchCgDailyCloses } from "@/lib/coingecko";
import { PINNED_BY_SYMBOL } from "@/lib/pinned-coins";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * ROI/DCA daily price history.
 *
 * Primary source is Binance public klines (free, no key, no monthly cap,
 * full daily history back to each USDT pair's listing). Fallback is
 * CryptoCompare histoday for coins Binance doesn't list — its free key
 * (CRYPTOCOMPARE_API_KEY) is only ~100 calls/MONTH, so it must stay off
 * the common path. We learned this the hard way: the route used to fetch
 * CC-only, the monthly quota blew (421/100), and the Supabase cache
 * couldn't bootstrap because it shipped after the quota was already
 * dead — ROI/DCA returned {available:false,reason:"upstream"} for days.
 *
 * Every payload is persisted in Supabase (see resolveHistory) so the
 * upstream is touched roughly once per coin; without Supabase or any
 * upstream the route degrades to {available:false}.
 *
 * GET /api/history?symbol=BTC → the coin's full ROI detail in one shot:
 *   per year: highest/lowest daily close (+ the best later sell for
 *   each), and per month: the first daily close plus the highest close
 *   from that day onward ("sold the top"). Everything the ROI time
 *   machine needs derives from this single cached payload — month
 *   changes, the timing spread and the exit toggle cost no further
 *   upstream calls.
 * GET /api/history?symbol=BTC&year=2017 → legacy: that year's first
 *   close, kept for compatibility.
 */

interface PricePoint {
  price: number;
  date: string;
  /** Highest daily close from this day onward ("sold the top" exit). */
  sellTop: number;
}

interface MonthEntry extends PricePoint {
  /** Highest daily close from the entry date to today. */
  worst: PricePoint;
  /** Lowest daily close from the entry date to today. */
  best: PricePoint;
}

interface YearDetail {
  months: Record<number, MonthEntry>;
}

interface CoinHistory {
  firstYear: number;
  lastYear: number;
  firstDate: string;
  years: Record<number, YearDetail>;
  /** Compact daily series (post-splice): unix seconds / closes, parallel
   *  arrays. Powers the DCA time machine without further fetches. */
  seriesT: number[];
  seriesC: number[];
}

/** symbol → history (or null when CryptoCompare has no data). Promises
 *  are cached to dedupe concurrent fetches; failures are evicted so a
 *  transient error doesn't stick. */
const historyCache = new Map<string, Promise<CoinHistory | null>>();

const SYMBOL_RE = /^[A-Z0-9]{1,15}$/;

/** A stored payload older than this is refreshed — but only when the
 *  upstream call succeeds; stale always beats none. Daily closes barely
 *  change, so a weekly top-up keeps the metered CC fallback in budget. */
const REFRESH_AFTER_MS = 7 * 24 * 3600 * 1000;

/**
 * Persisted layer: the free CryptoCompare quota (~100 calls/month) can't
 * survive the in-memory cache resetting on every deploy or restart, so
 * computed payloads live in the Supabase coin_history table and the
 * upstream is hit once per coin, plus a daily top-up for new closes.
 */
async function readStored(
  symbol: string
): Promise<{ history: CoinHistory; fresh: boolean } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("coin_history")
      .select("payload,fetched_at")
      .eq("symbol", symbol)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return {
      history: data.payload as CoinHistory,
      fresh: Date.now() - Date.parse(data.fetched_at) < REFRESH_AFTER_MS,
    };
  } catch {
    return null;
  }
}

async function writeStored(symbol: string, history: CoinHistory): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from("coin_history")
      .upsert({ symbol, payload: history, fetched_at: new Date().toISOString() });
  } catch {
    /* persisting is best-effort — memory still has it */
  }
}

/** Read-through: memory (caller) → Supabase → upstream (Binance/CC). */
async function resolveHistory(symbol: string): Promise<CoinHistory | null> {
  const stored = await readStored(symbol);
  if (stored?.fresh) return stored.history;
  try {
    const fetched = await fetchUpstream(symbol);
    if (fetched) {
      void writeStored(symbol, fetched);
      return fetched;
    }
    // Upstream says no-data; a previously stored payload still wins
    // (delistings shouldn't erase working history).
    return stored ? stored.history : null;
  } catch (err) {
    if (stored) return stored.history; // stale beats none
    throw err; // transient with nothing stored — caller evicts and retries
  }
}

interface RawPoint {
  time: number; // unix seconds
  close: number;
}

/**
 * Primary source: Binance public klines — free, no key, no monthly cap,
 * full daily history back to each pair's USDT listing. Paginated at
 * 1000 rows/page. Returns null when the pair isn't listed (a definitive
 * "not here", error -1121); throws on transient network/5xx so the
 * caller can fall back or retry.
 *
 * Uses the data-api.binance.vision mirror, not api.binance.com: same
 * public market data, but it isn't geo-blocked, so it works from US
 * Vercel regions where api.binance.com returns HTTP 451.
 */
async function binancePoints(symbol: string): Promise<RawPoint[] | null> {
  const pair = `${symbol}USDT`;
  const points: RawPoint[] = [];
  let startTime = 0;
  for (let page = 0; page < 25; page++) {
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(
      pair
    )}&interval=1d&startTime=${startTime}&limit=1000`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      if (text.includes("-1121")) return points.length ? points : null; // not listed
      throw new Error(`binance responded ${res.status}`);
    }
    const rows = (await res.json()) as [number, string, string, string, string][];
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      const close = Number(r[4]);
      if (close > 0) points.push({ time: Math.floor(r[0] / 1000), close });
    }
    if (rows.length < 1000) break;
    startTime = rows[rows.length - 1][0] + 86_400_000; // day after last open
  }
  return points.length ? points : null;
}

/**
 * Fallback source: CryptoCompare full history (reaches deeper than a
 * coin's Binance listing, and covers coins Binance doesn't pair). The
 * free key is capped at ~100 calls/month, so this is only reached when
 * Binance has nothing — keeping the common path off the metered key.
 */
async function cryptoComparePoints(symbol: string): Promise<RawPoint[] | null> {
  const key = process.env.CRYPTOCOMPARE_API_KEY;
  if (!key) return null;

  const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${encodeURIComponent(
    symbol
  )}&tsym=USD&allData=true`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { authorization: `Apikey ${key}` },
  });
  if (!res.ok && res.status !== 400) {
    // 401/403/5xx — auth or upstream trouble, worth retrying later
    throw new Error(`cryptocompare responded ${res.status}`);
  }
  const body = (await res.json()) as {
    Response?: string;
    Message?: string;
    Data?: { Data?: { time: number; close: number }[] };
  };
  const points = body?.Data?.Data;
  if (!Array.isArray(points) || points.length === 0) {
    // Only an explicit "market does not exist" is a final answer; rate
    // limits and hiccups must throw so the caller doesn't cache them.
    const message = body?.Message ?? "";
    if (/does not exist|invalid/i.test(message)) return null;
    throw new Error(`cryptocompare empty response: ${message.slice(0, 80)}`);
  }
  return points
    .filter((p) => p.close > 0)
    .map((p) => ({ time: p.time, close: p.close }));
}

/**
 * Try Binance first (free, full history, no cap), then CryptoCompare for
 * coins Binance doesn't list. Binance transients fall through to CC; a
 * CC transient with no Binance data propagates so resolveHistory can
 * serve a stored payload instead.
 */
async function fetchUpstream(symbol: string): Promise<CoinHistory | null> {
  // Pinned CoinGecko coins (e.g. $ANSEM) aren't on Binance — their daily
  // closes come from CoinGecko market_chart, capped to the listing date.
  const pinned = PINNED_BY_SYMBOL[symbol.toUpperCase()];
  if (pinned) {
    const cgPoints = await fetchCgDailyCloses(pinned.coingeckoId);
    return cgPoints ? buildHistory(cgPoints) : null;
  }

  let points: RawPoint[] | null = null;
  try {
    points = await binancePoints(symbol);
  } catch {
    /* Binance unreachable — fall through to CryptoCompare */
  }
  if (!points) {
    points = await cryptoComparePoints(symbol);
  }
  return points ? buildHistory(points) : null;
}

/** Derive the rich ROI/DCA payload from a daily close series. */
function buildHistory(rawPoints: RawPoint[]): CoinHistory | null {
  if (rawPoints.length === 0) return null;

  // Asset-splice guard: symbol-keyed series sometimes graft a different
  // asset's past onto the current coin (CC's "PEPE" is PepeCoin until
  // mid-2023, then the meme coin — a 100,000× one-day cliff). No real
  // market moves 1000× in a day, so treat any such jump as a splice or
  // redenomination and only trust data after the last one.
  let start = 0;
  for (let i = 1; i < rawPoints.length; i++) {
    if (Math.abs(Math.log10(rawPoints[i].close / rawPoints[i - 1].close)) >= 3) {
      start = i;
    }
  }
  const series = rawPoints.slice(start);

  // One backward pass: for every day, the highest close from there to
  // today (sold-the-top exits) plus the indices of the forward-window
  // high and low (>=/<= keep the earliest date on ties). The spread for
  // any entry month then reads straight off the entry's index — worst
  // buy = the window high (whose own sellTop is itself, so buying the
  // absolute top sells at ~1.0×), best buy = the window low.
  const n = series.length;
  const suffixMax = new Array<number>(n);
  const suffixHighIdx = new Array<number>(n);
  const suffixLowIdx = new Array<number>(n);
  let hi = -Infinity;
  let hiIdx = n - 1;
  let lo = Infinity;
  let loIdx = n - 1;
  for (let i = n - 1; i >= 0; i--) {
    if (series[i].close >= hi) {
      hi = series[i].close;
      hiIdx = i;
    }
    if (series[i].close <= lo) {
      lo = series[i].close;
      loIdx = i;
    }
    suffixMax[i] = hi;
    suffixHighIdx[i] = hiIdx;
    suffixLowIdx[i] = loIdx;
  }
  const pointAt = (i: number): PricePoint => ({
    price: series[i].close,
    date: new Date(series[i].time * 1000).toISOString().slice(0, 10),
    sellTop: suffixMax[i],
  });

  const years: Record<number, YearDetail> = {};
  series.forEach((p, i) => {
    const d = new Date(p.time * 1000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    let yd = years[y];
    if (!yd) yd = years[y] = { months: {} };
    if (!yd.months[m]) {
      yd.months[m] = {
        ...pointAt(i),
        worst: pointAt(suffixHighIdx[i]),
        best: pointAt(suffixLowIdx[i]),
      };
    }
  });

  const yearKeys = Object.keys(years).map(Number);
  if (yearKeys.length === 0) return null;
  return {
    firstYear: Math.min(...yearKeys),
    lastYear: Math.max(...yearKeys),
    firstDate: new Date(series[0].time * 1000).toISOString().slice(0, 10),
    years,
    seriesT: series.map((p) => p.time),
    seriesC: series.map((p) => p.close),
  };
}

function getHistory(symbol: string): Promise<CoinHistory | null> {
  let cached = historyCache.get(symbol);
  if (!cached) {
    cached = resolveHistory(symbol).catch((err) => {
      historyCache.delete(symbol); // don't cache transient failures
      throw err;
    });
    historyCache.set(symbol, cached);
  }
  return cached;
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  const yearParam = request.nextUrl.searchParams.get("year");

  if (!SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "Required query param: symbol" }, { status: 400 });
  }
  if (yearParam !== null && !/^20\d{2}$|^201[0-9]$|^200[0-9]$/.test(yearParam)) {
    return NextResponse.json({ error: "year must be YYYY" }, { status: 400 });
  }

  let history: CoinHistory | null = null;
  try {
    history = await getHistory(symbol);
  } catch {
    return NextResponse.json({ available: false, reason: "upstream" });
  }

  if (!history) {
    return NextResponse.json({ available: false, reason: "no-data" });
  }

  if (yearParam !== null) {
    // Legacy mode: the year's first close.
    const yd = history.years[Number(yearParam)];
    const firstMonth = yd
      ? Math.min(...Object.keys(yd.months).map(Number))
      : NaN;
    const entry = yd?.months[firstMonth];
    if (!entry) {
      return NextResponse.json({ available: false, reason: "out-of-range" });
    }
    return NextResponse.json({ available: true, price: entry.price, date: entry.date });
  }

  return NextResponse.json({
    available: true,
    firstYear: history.firstYear,
    lastYear: history.lastYear,
    firstDate: history.firstDate,
    years: history.years,
    seriesT: history.seriesT,
    seriesC: history.seriesC,
  });
}
