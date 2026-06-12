"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtPct, fmtPrice, fmtUsdWhole } from "@/lib/format";
import { loadDetail, type HistoryDetail } from "@/lib/history-client";
import type { RankedCoin } from "@/lib/types";

/* Backward-looking DCA: what a fixed schedule of real buys at real
   daily closes added up to. History only — nothing here predicts. */

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FREQS = [
  { key: "daily", label: "Daily", phrase: "every day", stepDays: 1 },
  { key: "weekly", label: "Weekly", phrase: "every week", stepDays: 7 },
  { key: "biweekly", label: "Biweekly", phrase: "every 2 weeks", stepDays: 14 },
  { key: "monthly", label: "Monthly", phrase: "every month", stepDays: 0 },
] as const;
type FreqKey = (typeof FREQS)[number]["key"];

const FIRST_PICKABLE_YEAR = 2011;

/** First index with T[i] >= ts (T ascending). */
function lowerBound(T: number[], ts: number): number {
  let lo = 0;
  let hi = T.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (T[mid] < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface DcaOutcome {
  qty: number;
  buys: number;
  invested: number;
  worth: number;
  startIdx: number;
}

/**
 * Execute the schedule against a daily-close series: buy `amt` at the
 * first close on/after each scheduled date, from `startTs` to today.
 * Time-stepped (daily/weekly/biweekly) or first close of each calendar
 * month (monthly).
 */
function runDca(
  T: number[],
  C: number[],
  startTs: number,
  freq: FreqKey,
  amt: number,
  currentPrice: number
): DcaOutcome | null {
  const startIdx = lowerBound(T, startTs);
  if (startIdx >= T.length) return null;
  let qty = 0;
  let buys = 0;
  if (freq === "monthly") {
    const d = new Date(T[startIdx] * 1000);
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth();
    let target = T[startIdx];
    for (;;) {
      const idx = lowerBound(T, target);
      if (idx >= T.length) break;
      qty += amt / C[idx];
      buys += 1;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      target = Date.UTC(y, m, 1) / 1000;
    }
  } else {
    const step = FREQS.find((f) => f.key === freq)!.stepDays * 86400;
    for (let t = T[startIdx]; ; t += step) {
      const idx = lowerBound(T, t);
      if (idx >= T.length) break;
      qty += amt / C[idx];
      buys += 1;
    }
  }
  return { qty, buys, invested: buys * amt, worth: qty * currentPrice, startIdx };
}

/** 0.42 / 5,400 / 5.4B — coin quantities without a currency sign. */
function fmtQty(v: number): string {
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
  ];
  for (const [u, s] of units) {
    if (v >= u) return (v / u).toFixed(v / u >= 10 ? 1 : 2) + s;
  }
  if (v >= 1000) return Math.round(v).toLocaleString("en-US");
  if (v >= 1) return v.toFixed(2).replace(/\.?0+$/, "");
  return v.toPrecision(3);
}

interface DcaTimeMachineProps {
  coins: RankedCoin[];
  isDemoData: boolean;
}

export default function DcaTimeMachine({ coins, isDemoData }: DcaTimeMachineProps) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const [amount, setAmount] = useState("");
  const [freq, setFreq] = useState<FreqKey>("weekly");
  const [coinSlug, setCoinSlug] = useState(
    coins.some((c) => c.slug === "btc") ? "btc" : coins[0]?.slug ?? ""
  );
  const [year, setYear] = useState(currentYear - 2);
  const [month, setMonth] = useState(1);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [btcDetail, setBtcDetail] = useState<HistoryDetail | null>(null);

  const coin = useMemo(
    () => coins.find((c) => c.slug === coinSlug),
    [coins, coinSlug]
  );
  const btc = useMemo(() => coins.find((c) => c.slug === "btc"), [coins]);

  // Cached fetches only: the coin's history plus BTC's for the benchmark
  // line. Every input change afterwards is local arithmetic.
  useEffect(() => {
    if (!coin || isDemoData) {
      setDetail(null);
      return;
    }
    let alive = true;
    loadDetail(coin.symbol).then((d) => {
      if (alive) setDetail(d);
    });
    return () => {
      alive = false;
    };
  }, [coin, isDemoData]);

  useEffect(() => {
    if (!btc || isDemoData) return;
    let alive = true;
    loadDetail(btc.symbol).then((d) => {
      if (alive) setBtcDetail(d);
    });
    return () => {
      alive = false;
    };
  }, [btc, isDemoData]);

  const amt = Number(amount) > 0 ? Number(amount) : 100; // default $100
  const startTs = Date.UTC(year, month - 1, 1) / 1000;

  const result = useMemo(() => {
    if (!coin || !detail || !detail.seriesT?.length) return null;
    const dca = runDca(detail.seriesT, detail.seriesC, startTs, freq, amt, coin.price);
    if (!dca || dca.buys === 0) return null;

    const actualStartTs = detail.seriesT[dca.startIdx];
    const clamped = actualStartTs - startTs > 32 * 86400; // > a month late
    const startDate = new Date(actualStartTs * 1000);
    const startLabel = `${MONTH_LABELS[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`;

    const lumpWorth =
      (dca.invested / detail.seriesC[dca.startIdx]) * coin.price;

    let btcWorth: number | null = null;
    if (coin.slug !== "btc" && btc && btcDetail?.seriesT?.length) {
      const bench = runDca(
        btcDetail.seriesT,
        btcDetail.seriesC,
        actualStartTs,
        freq,
        amt,
        btc.price
      );
      btcWorth = bench ? bench.worth : null;
    }

    return { ...dca, clamped, startLabel, lumpWorth, btcWorth };
  }, [coin, detail, btc, btcDetail, startTs, freq, amt]);

  const freqDef = FREQS.find((f) => f.key === freq)!;
  const profit = result ? result.worth - result.invested : 0;
  const profitPct = result ? (profit / result.invested) * 100 : 0;
  const gain = profit >= 0;
  const sign = gain ? "+" : "−";

  const years: number[] = [];
  for (let y = FIRST_PICKABLE_YEAR; y <= currentYear; y++) years.push(y);

  return (
    <>
      <div className="section-h" id="dca">
        <h2>DCA time machine</h2>
        <span>what regular buys would&apos;ve done · real prices</span>
      </div>
      <div className="roi">
        <div className="card">
          <div className="f-row">
            <label htmlFor="dcaAmt">Per buy (USD)</label>
            <input
              id="dcaAmt"
              type="number"
              min={1}
              inputMode="decimal"
              placeholder="Amount in USD"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="f-row">
            <label>How often</label>
            <div className="chips moon-chips">
              {FREQS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`chip${freq === f.key ? " active" : ""}`}
                  onClick={() => setFreq(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="f-row">
            <label htmlFor="dcaCoin">Into</label>
            <select
              id="dcaCoin"
              value={coinSlug}
              onChange={(e) => setCoinSlug(e.target.value)}
            >
              {coins.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
          <div className="f-row">
            <label htmlFor="dcaMonth">Since</label>
            <div className="f-split">
              <select
                id="dcaMonth"
                aria-label="Start month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                id="dcaYear"
                aria-label="Start year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="card r-out">
          {result && coin ? (
            <>
              <div className="r-total">
                <div className="lbl">
                  ${amt.toLocaleString("en-US")} {freqDef.phrase} into {coin.symbol}{" "}
                  {result.clamped
                    ? `since launch (${result.startLabel})`
                    : `since ${result.startLabel}`}
                </div>
                <div className={`val ${gain ? "gain" : "loss"}`}>
                  {fmtUsdWhole(result.worth)}
                </div>
              </div>
              <div className="moon-story">
                <p className="m-line">
                  You&apos;d have put in <b>{fmtUsdWhole(result.invested)}</b> total (
                  {result.buys.toLocaleString("en-US")} buys)
                </p>
                <p className="m-line">
                  Profit:{" "}
                  <b className={gain ? "up" : "down"}>
                    {sign}
                    {fmtUsdWhole(Math.abs(profit))} ({sign}
                    {fmtPct(Math.abs(profitPct))})
                  </b>
                </p>
                <p className="m-line">
                  You&apos;d own <b>{fmtQty(result.qty)} {coin.symbol}</b> · avg cost{" "}
                  <b>{fmtPrice(result.invested / result.qty)}</b> — today&apos;s price{" "}
                  <b>{fmtPrice(coin.price)}</b>
                </p>
                <div className="dca-vs">
                  <p className="m-also">
                    VS LUMP SUM: investing the whole {fmtUsdWhole(result.invested)} on
                    day one instead: <b>{fmtUsdWhole(result.lumpWorth)}</b> today
                  </p>
                  {result.btcWorth !== null && (
                    <p className="m-also">
                      VS JUST BUYING BTC: the same schedule into BTC:{" "}
                      <b>{fmtUsdWhole(result.btcWorth)}</b> today
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="r-unavail">historical data unavailable for this coin</div>
          )}
          <div className="r-note">
            REAL DAILY CLOSES · CRYPTOCOMPARE · PAST ONLY, NOT A FORECAST
          </div>
        </div>
      </div>
    </>
  );
}
