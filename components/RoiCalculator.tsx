"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtPrice, fmtX } from "@/lib/format";
import {
  firstMonthOf,
  loadDetail,
  type HistoryDetail,
  type MonthEntry,
  type PricePoint,
  type YearDetail,
} from "@/lib/history-client";
import type { RankedCoin } from "@/lib/types";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Scenario chips: coin + entry year (first available month of it). */
const PRESETS = [
  { label: "BTC 2013", slug: "btc", year: 2013 },
  { label: "ETH 2016", slug: "eth", year: 2016 },
  { label: "XRP 2018", slug: "xrp", year: 2018 },
  { label: "DOGE 2020", slug: "doge", year: 2020 },
  { label: "SOL 2020", slug: "sol", year: 2020 },
  { label: "SHIB 2021", slug: "shib", year: 2021 },
  { label: "PEPE 2023", slug: "pepe", year: 2023 },
];

/** Demo-mode multiplier from the reference — hashes coin + key into a
 *  stable fraction. Demo mode synthesizes a full detail payload from it
 *  so the month/spread/exit UI works identically, labeled DEMO FIGURES. */
function seeded(slug: string, key: string): number {
  let h = 0;
  const s = slug + key;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 0.06 + ((h % 1000) / 1000) * 0.85;
}

function buildDemoDetail(coin: RankedCoin): HistoryDetail {
  const lastYear = new Date().getFullYear();
  const firstYear = 2013;
  const years: HistoryDetail["years"] = {};
  for (let y = firstYear; y <= lastYear; y++) {
    const monthPrices: number[] = [];
    for (let m = 1; m <= 12; m++) {
      monthPrices.push(coin.price * seeded(coin.slug, `${y}-${m}`));
    }
    const months: YearDetail["months"] = {};
    for (let m = 1; m <= 12; m++) {
      const window = monthPrices.slice(m - 1);
      const worstPrice = Math.max(...window) * 1.12;
      const bestPrice = Math.min(...window) * 0.88;
      const date = (mm: number) => `${y}-${String(mm).padStart(2, "0")}-01`;
      months[m] = {
        price: monthPrices[m - 1],
        date: date(m),
        sellTop: Math.max(monthPrices[m - 1], worstPrice),
        worst: { price: worstPrice, date: date(m), sellTop: worstPrice },
        best: { price: bestPrice, date: date(m), sellTop: worstPrice },
      };
    }
    years[y] = { months };
  }
  // No synthetic daily series — demo mode hides daily-derived features.
  return { firstYear, lastYear, years, seriesT: [], seriesC: [] };
}

interface RoiRun {
  amt: number;
  current: number;
  entry: MonthEntry;
  /** "Nov 2024" — frozen at run time for the spread row labels. */
  sinceLabel: string;
}

type RoiResult = { kind: "ok"; run: RoiRun } | { kind: "unavailable" };

interface RoiCalculatorProps {
  coins: RankedCoin[];
  isDemoData: boolean;
}

export default function RoiCalculator({ coins, isDemoData }: RoiCalculatorProps) {
  const currentYear = new Date().getFullYear();
  const [amount, setAmount] = useState("");
  const [coinSlug, setCoinSlug] = useState(
    coins.some((c) => c.slug === "sol") ? "sol" : coins[0]?.slug ?? ""
  );
  const [year, setYear] = useState(isDemoData ? 2023 : currentYear);
  const [month, setMonth] = useState(1);
  const [soldTop, setSoldTop] = useState(false);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  /** Which coin slug `detail` belongs to — guards races on coin switches. */
  const [detailFor, setDetailFor] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [result, setResult] = useState<RoiResult | null>(null);
  const [running, setRunning] = useState(false);
  const pendingPreset = useRef<{ slug: string; year: number } | null>(null);

  const coin = useMemo(
    () => coins.find((c) => c.slug === coinSlug),
    [coins, coinSlug]
  );


  // One cached detail fetch per coin; everything else is local math.
  useEffect(() => {
    if (!coin) return;
    let alive = true;
    setDetailLoading(true);
    const source = isDemoData
      ? Promise.resolve(buildDemoDetail(coin))
      : loadDetail(coin.symbol);
    source.then((d) => {
      if (!alive) return;
      setDetail(d);
      setDetailFor(coin.slug);
      setDetailLoading(false);
      if (d) {
        setYear((prev) => {
          const next = d.years[prev] ? prev : d.lastYear;
          setMonth((pm) => firstMonthOf(d, next, pm));
          return next;
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [coin, isDemoData]);

  async function executeRun(amt: number, runYear: number, runMonth: number, d: HistoryDetail | null) {
    if (running) return;
    setRunning(true);
    try {
      let current = coin;
      try {
        const r = await fetch(`/api/coin/${coinSlug}`);
        if (r.ok) current = ((await r.json()) as { coin: RankedCoin }).coin;
      } catch {
        /* offline — use the server-rendered price */
      }
      const entry = d?.years[runYear]?.months[runMonth];
      if (!current || !entry) {
        setResult({ kind: "unavailable" });
        return;
      }
      setResult({
        kind: "ok",
        run: {
          amt,
          current: current.price,
          entry,
          sinceLabel: `${MONTH_LABELS[runMonth - 1]} ${runYear}`,
        },
      });
    } finally {
      setRunning(false);
    }
  }

  function run(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return; // nothing typed yet
    void executeRun(amt, year, month, detail);
  }

  // Preset chips: select the coin, jump to that year (its first
  // available month), and run with the current — or default — amount.
  function applyPreset(slug: string, presetYear: number) {
    if (!coins.some((c) => c.slug === slug)) return;
    if (!amount || Number(amount) <= 0) setAmount("1000");
    pendingPreset.current = { slug, year: presetYear };
    setCoinSlug(slug); // the detail effect picks it up from here
  }

  useEffect(() => {
    const pending = pendingPreset.current;
    if (!pending || !coin || coin.slug !== pending.slug) return;
    if (!detail || detailLoading || detailFor !== pending.slug) return;
    pendingPreset.current = null;
    const y = detail.years[pending.year] ? pending.year : detail.lastYear;
    const m = firstMonthOf(detail, y);
    setYear(y);
    setMonth(m);
    const amt = Number(amount) > 0 ? Number(amount) : 1000;
    void executeRun(amt, y, m, detail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, detailFor, detailLoading, coin]);

  const run_ = result?.kind === "ok" ? result.run : null;
  const sellFor = (e: PricePoint) => (soldTop ? e.sellTop : run_?.current ?? 0);
  const worthOf = (e: PricePoint) => (run_ ? (run_.amt * sellFor(e)) / e.price : 0);

  const yearOptions = detail
    ? Object.keys(detail.years)
        .map(Number)
        .sort((a, b) => a - b)
    : [year];

  return (
    <>
      <div className="section-h" id="roi">
        <h2>ROI time machine</h2>
        <span>{isDemoData ? "demo figures" : "month entry · daily closes"}</span>
      </div>
      <div className="chips" role="group" aria-label="Preset scenarios">
        {PRESETS.filter((p) => coins.some((c) => c.slug === p.slug)).map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            onClick={() => applyPreset(p.slug, p.year)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="roi">
        <form className="card" onSubmit={run}>
          <div className="f-row">
            <label htmlFor="roiAmt">If you&apos;d put in (USD)</label>
            <input
              id="roiAmt"
              type="number"
              min={1}
              inputMode="decimal"
              placeholder="Amount in USD"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="f-row">
            <label htmlFor="roiCoin">Into</label>
            <select
              id="roiCoin"
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
            <label htmlFor="roiMonth">Back in</label>
            <div className="f-split">
              <select
                id="roiMonth"
                aria-label="Entry month"
                value={month}
                disabled={detailLoading}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_LABELS.map((label, i) => (
                  <option
                    key={label}
                    value={i + 1}
                    disabled={!detail?.years[year]?.months[i + 1]}
                  >
                    {label}
                  </option>
                ))}
              </select>
              <select
                id="roiYear"
                aria-label="Entry year"
                value={year}
                disabled={detailLoading}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y);
                  if (detail) setMonth((pm) => firstMonthOf(detail, y, pm));
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="go" type="submit" disabled={running || detailLoading}>
            {running ? "Running…" : "Run it"}
          </button>
        </form>
        <div className="card r-out">
          <div
            className="mode-toggle exit-toggle"
            role="group"
            aria-label="Exit strategy"
          >
            <button
              type="button"
              className={soldTop ? "" : "active"}
              aria-pressed={!soldTop}
              onClick={() => setSoldTop(false)}
            >
              Still holding
            </button>
            <button
              type="button"
              className={soldTop ? "active" : ""}
              aria-pressed={soldTop}
              onClick={() => setSoldTop(true)}
            >
              Sold the top
            </button>
          </div>
          <div className="r-line">
            <span>Price then</span>
            <span>{run_ ? fmtPrice(run_.entry.price) : "—"}</span>
          </div>
          <div className="r-line">
            <span>{soldTop ? "Sold at" : "Price now"}</span>
            <span>{run_ ? fmtPrice(sellFor(run_.entry)) : "—"}</span>
          </div>
          <div className="r-line">
            <span>Multiple</span>
            <span>{run_ ? fmtX(sellFor(run_.entry) / run_.entry.price) : "—"}</span>
          </div>
          <div className="r-total">
            <div className="lbl">Worth today</div>
            <div
              className={`val${run_ ? (worthOf(run_.entry) >= run_.amt ? " gain" : " loss") : ""}`}
            >
              {run_
                ? "$" +
                  worthOf(run_.entry).toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })
                : "—"}
            </div>
          </div>
          {run_ && (
            <div className="spread">
              {(
                [
                  [`Worst buy since ${run_.sinceLabel}`, run_.entry.worst],
                  ["Your entry", run_.entry],
                  [`Best buy since ${run_.sinceLabel}`, run_.entry.best],
                ] as const
              ).map(([label, point]) => (
                <div className="s-row" key={label}>
                  <span className="s-lbl">{label}</span>
                  <span className="s-entry">{fmtPrice(point.price)}</span>
                  <span
                    className={`s-worth ${worthOf(point) >= run_.amt ? "gain" : "loss"}`}
                  >
                    $
                    {worthOf(point).toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
          {result?.kind === "unavailable" && (
            <div className="r-unavail">historical data unavailable for this range</div>
          )}
          <div className="r-note">
            {isDemoData
              ? "DEMO FIGURES · PROTOTYPE ONLY · NOT FINANCIAL ADVICE"
              : "ENTRY = FIRST CLOSE OF THAT MONTH · CRYPTOCOMPARE · NOT FINANCIAL ADVICE"}
          </div>
        </div>
      </div>
    </>
  );
}
