"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtPrice, fmtX } from "@/lib/format";
import type { RankedCoin } from "@/lib/types";

/** Static demo-mode years (the seeded math works for any year). */
const DEMO_YEARS = ["2021", "2022", "2023", "2024", "2025", "2026"];

/**
 * Demo-mode multiplier from the reference — hashes coin + year into a
 * stable "price then" fraction. Only used when the whole site runs on
 * the demo seed; live mode fetches real yearly closes via /api/history.
 */
function seeded(slug: string, year: string): number {
  let h = 0;
  const s = slug + year;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 0.06 + ((h % 1000) / 1000) * 0.85;
}

type RoiResult =
  | { kind: "ok"; then: number; now: number; out: number; gain: boolean }
  | { kind: "unavailable" };

interface RoiCalculatorProps {
  coins: RankedCoin[];
  isDemoData: boolean;
}

export default function RoiCalculator({ coins, isDemoData }: RoiCalculatorProps) {
  const currentYear = String(new Date().getFullYear());
  const [amount, setAmount] = useState("");
  const [coinSlug, setCoinSlug] = useState(
    coins.some((c) => c.slug === "sol") ? "sol" : coins[0]?.slug ?? ""
  );
  const [years, setYears] = useState<string[]>(isDemoData ? DEMO_YEARS : [currentYear]);
  const [year, setYear] = useState(isDemoData ? "2023" : currentYear);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [result, setResult] = useState<RoiResult | null>(null);
  const [running, setRunning] = useState(false);

  const coin = useMemo(
    () => coins.find((c) => c.slug === coinSlug),
    [coins, coinSlug]
  );

  // Live mode: each coin's year range comes from its first available
  // data point (one cached /api/history call per coin) — BTC offers
  // 2011+, SOL 2021+, PEPE 2023+.
  useEffect(() => {
    if (isDemoData || !coin) return;
    const ctrl = new AbortController();
    setYearsLoading(true); // hold "Run it" until the range matches the coin
    fetch(`/api/history?symbol=${encodeURIComponent(coin.symbol)}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { available: boolean; firstYear?: number; lastYear?: number } | null) => {
        if (!data?.available || !data.firstYear) {
          setYears([currentYear]); // run() will surface "unavailable"
          setYear(currentYear);
          return;
        }
        const last = Math.max(data.lastYear ?? data.firstYear, Number(currentYear));
        const range: string[] = [];
        for (let y = data.firstYear; y <= last; y++) range.push(String(y));
        setYears(range);
        setYear((prev) => (range.includes(prev) ? prev : range[range.length - 1]));
      })
      .catch(() => {
        /* aborted or offline — keep the current list */
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setYearsLoading(false);
      });
    return () => ctrl.abort();
  }, [coin, isDemoData, currentYear]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return; // nothing typed yet
    setRunning(true);
    try {
      let current = coin;

      if (isDemoData) {
        // Demo: deterministic synthetic history, as in the reference.
        try {
          const r = await fetch(`/api/coin/${coinSlug}`);
          if (r.ok) current = ((await r.json()) as { coin: RankedCoin }).coin;
        } catch {
          /* offline — use what we have */
        }
        if (current) {
          const then = current.price * seeded(current.slug, year);
          const out = amt * (current.price / then);
          setResult({ kind: "ok", then, now: current.price, out, gain: out >= amt });
        }
        return;
      }

      // Live: real first-close-of-year from our history API.
      const [coinRes, histRes] = await Promise.all([
        fetch(`/api/coin/${coinSlug}`).catch(() => null),
        fetch(
          `/api/history?symbol=${encodeURIComponent(current?.symbol ?? "")}&year=${year}`
        ).catch(() => null),
      ]);
      if (coinRes?.ok) {
        current = ((await coinRes.json()) as { coin: RankedCoin }).coin;
      }
      const hist = histRes?.ok
        ? ((await histRes.json()) as { available: boolean; price?: number })
        : null;

      if (!current || !hist?.available || !hist.price) {
        setResult({ kind: "unavailable" });
        return;
      }
      const out = amt * (current.price / hist.price);
      setResult({ kind: "ok", then: hist.price, now: current.price, out, gain: out >= amt });
    } finally {
      setRunning(false);
    }
  }

  const ok = result?.kind === "ok" ? result : null;

  return (
    <>
      <div className="section-h" id="roi">
        <h2>ROI time machine</h2>
        <span>{isDemoData ? "demo figures" : "first close of each year"}</span>
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
            <label htmlFor="roiYear">Back in</label>
            <select id="roiYear" value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <button className="go" type="submit" disabled={running || yearsLoading}>
            {running ? "Running…" : "Run it"}
          </button>
        </form>
        <div className="card r-out">
          <div className="r-line">
            <span>Price then</span>
            <span>{ok ? fmtPrice(ok.then) : "—"}</span>
          </div>
          <div className="r-line">
            <span>Price now</span>
            <span>{ok ? fmtPrice(ok.now) : "—"}</span>
          </div>
          <div className="r-line">
            <span>Multiple</span>
            <span>{ok ? fmtX(ok.now / ok.then) : "—"}</span>
          </div>
          <div className="r-total">
            <div className="lbl">Worth today</div>
            <div className={`val${ok ? (ok.gain ? " gain" : " loss") : ""}`}>
              {ok
                ? "$" + ok.out.toLocaleString("en-US", { maximumFractionDigits: 0 })
                : "—"}
            </div>
          </div>
          {result?.kind === "unavailable" && (
            <div className="r-unavail">historical data unavailable for this range</div>
          )}
          <div className="r-note">
            {isDemoData
              ? "DEMO FIGURES · PROTOTYPE ONLY · NOT FINANCIAL ADVICE"
              : "PRICE THEN = FIRST CLOSE OF THAT YEAR · CRYPTOCOMPARE · NOT FINANCIAL ADVICE"}
          </div>
        </div>
      </div>
    </>
  );
}
