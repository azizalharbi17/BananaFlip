import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ROI history backed by CryptoCompare daily data (histoday, symbol vs
 * USD, allData=true → full history back to coin inception).
 *
 * Free-tier status, checked live (June 2026): every min-api endpoint now
 * returns 401 "API key required" without a key — the keyless tier was
 * retired when CryptoCompare merged into the CoinDesk developer platform
 * (developers.coindesk.com). Free keys exist after registration; the
 * documented free allowance is generous (~100k calls/month) and one call
 * here serves a coin's ENTIRE history, which we then cache in memory.
 * The key is read from CRYPTOCOMPARE_API_KEY; without one this route
 * degrades to {available:false} and the UI shows its unavailable state.
 *
 * GET /api/history?symbol=BTC            → {available, firstYear, lastYear}
 * GET /api/history?symbol=BTC&year=2017  → {available, price, date}
 *
 * "Price then" for a year is the first daily close of that calendar
 * year — Jan 1 for an established coin, the inception-day close for the
 * launch year (Jan 1 closes are immutable, hence the indefinite cache).
 */

interface CoinHistory {
  firstYear: number;
  lastYear: number;
  /** First close of each calendar year, keyed by year. */
  closes: Record<number, { price: number; date: string }>;
}

/** symbol → history (or null when CryptoCompare has no data). Promises
 *  are cached to dedupe concurrent fetches; failures are evicted so a
 *  transient error doesn't stick. */
const historyCache = new Map<string, Promise<CoinHistory | null>>();

const SYMBOL_RE = /^[A-Z0-9]{1,15}$/;

async function fetchHistory(symbol: string): Promise<CoinHistory | null> {
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
    Data?: { Data?: { time: number; close: number }[] };
  };
  const points = body?.Data?.Data;
  // "Error" + no points = unknown symbol — a final answer, cache it.
  if (!Array.isArray(points) || points.length === 0) return null;

  const valid = points.filter((p) => p.close > 0); // drop inception padding
  if (valid.length === 0) return null;

  // Asset-splice guard: symbol-keyed series sometimes graft a different
  // asset's past onto the current coin (CC's "PEPE" is PepeCoin until
  // mid-2023, then the meme coin — a 100,000× one-day cliff). No real
  // market moves 1000× in a day, so treat any such jump as a splice or
  // redenomination and only trust data after the last one.
  let start = 0;
  for (let i = 1; i < valid.length; i++) {
    if (Math.abs(Math.log10(valid[i].close / valid[i - 1].close)) >= 3) {
      start = i;
    }
  }

  const closes: CoinHistory["closes"] = {};
  let firstYear = 0;
  let lastYear = 0;
  for (const p of valid.slice(start)) {
    const d = new Date(p.time * 1000);
    const year = d.getUTCFullYear();
    if (!closes[year]) {
      closes[year] = { price: p.close, date: d.toISOString().slice(0, 10) };
    }
    if (!firstYear) firstYear = year;
    lastYear = year;
  }
  if (!firstYear) return null;
  return { firstYear, lastYear, closes };
}

function getHistory(symbol: string): Promise<CoinHistory | null> {
  let cached = historyCache.get(symbol);
  if (!cached) {
    cached = fetchHistory(symbol).catch((err) => {
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

  if (yearParam === null) {
    return NextResponse.json({
      available: true,
      firstYear: history.firstYear,
      lastYear: history.lastYear,
    });
  }

  const entry = history.closes[Number(yearParam)];
  if (!entry) {
    return NextResponse.json({ available: false, reason: "out-of-range" });
  }
  return NextResponse.json({ available: true, price: entry.price, date: entry.date });
}
