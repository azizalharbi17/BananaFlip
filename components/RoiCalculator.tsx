"use client";

import { useState } from "react";
import { fmtPrice, fmtX } from "@/lib/format";
import type { RankedCoin } from "@/lib/types";

const YEARS = ["2021", "2022", "2023", "2024", "2025", "2026"];

/**
 * Demo-mode multiplier from the reference — hashes coin + year into a
 * stable "price then" fraction. Only used when the whole site runs on
 * the demo seed; live mode fetches real Jan 1 prices via /api/history.
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
  const [amount, setAmount] = useState("");
  const [coinSlug, setCoinSlug] = useState(
    coins.some((c) => c.slug === "sol") ? "sol" : coins[0]?.slug ?? ""
  );
  // Coinpaprika's free plan only reaches ~1 year back, so default to the
  // newest year in live mode; the demo keeps the reference's 2023.
  const [year, setYear] = useState(isDemoData ? "2023" : YEARS[YEARS.length - 1]);
  const [result, setResult] = useState<RoiResult | null>(null);
  const [running, setRunning] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return; // nothing typed yet
    setRunning(true);
    try {
      let coin = coins.find((c) => c.slug === coinSlug);

      if (isDemoData) {
        // Demo: deterministic synthetic history, as in the reference.
        try {
          const r = await fetch(`/api/coin/${coinSlug}`);
          if (r.ok) coin = ((await r.json()) as { coin: RankedCoin }).coin;
        } catch {
          /* offline — use what we have */
        }
        if (coin) {
          const then = coin.price * seeded(coin.slug, year);
          const out = amt * (coin.price / then);
          setResult({ kind: "ok", then, now: coin.price, out, gain: out >= amt });
        }
        return;
      }

      // Live: real Jan 1 close from our history API (cached server-side).
      const [coinRes, histRes] = await Promise.all([
        fetch(`/api/coin/${coinSlug}`).catch(() => null),
        fetch(`/api/history/${coinSlug}?year=${year}`).catch(() => null),
      ]);
      if (coinRes?.ok) {
        coin = ((await coinRes.json()) as { coin: RankedCoin }).coin;
      }
      const hist = histRes?.ok
        ? ((await histRes.json()) as { available: boolean; price?: number })
        : null;

      if (!coin || !hist?.available || !hist.price) {
        setResult({ kind: "unavailable" });
        return;
      }
      const out = amt * (coin.price / hist.price);
      setResult({ kind: "ok", then: hist.price, now: coin.price, out, gain: out >= amt });
    } finally {
      setRunning(false);
    }
  }

  const ok = result?.kind === "ok" ? result : null;

  return (
    <>
      <div className="section-h" id="roi">
        <h2>ROI time machine</h2>
        <span>{isDemoData ? "demo figures" : "jan 1 price anchors"}</span>
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
              {YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <button className="go" type="submit" disabled={running}>
            Run it
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
              : "PRICE THEN = JAN 1 CLOSE · DATA BY COINPAPRIKA · NOT FINANCIAL ADVICE"}
          </div>
        </div>
      </div>
    </>
  );
}
