"use client";

import { useState } from "react";
import { fmtPrice, fmtX } from "@/lib/format";
import type { RankedCoin } from "@/lib/types";

const YEARS = ["2021", "2022", "2023", "2024", "2025"];

/**
 * Deterministic demo multiplier from the reference — hashes coin + year
 * into a stable "price then" fraction (0.06–0.91 of today's price).
 */
function seeded(id: string, year: string): number {
  let h = 0;
  const s = id + year;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 0.06 + ((h % 1000) / 1000) * 0.85;
}

interface RoiResult {
  then: number;
  now: number;
  out: number;
  gain: boolean;
}

export default function RoiCalculator({ coins }: { coins: RankedCoin[] }) {
  const [amount, setAmount] = useState("100");
  const [coinId, setCoinId] = useState("sol");
  const [year, setYear] = useState("2023");
  const [result, setResult] = useState<RoiResult | null>(null);
  const [running, setRunning] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    setRunning(true);

    const amt = Math.max(1, Number(amount) || 0);
    // Current price comes from the internal coin API (falls back to the
    // server-rendered list if the request fails).
    let coin = coins.find((c) => c.id === coinId);
    try {
      const r = await fetch(`/api/coin/${coinId}`);
      if (r.ok) coin = ((await r.json()) as { coin: RankedCoin }).coin;
    } catch {
      /* offline — use what we have */
    }
    if (coin) {
      const then = coin.price * seeded(coin.id, year);
      const out = amt * (coin.price / then);
      setResult({ then, now: coin.price, out, gain: out >= amt });
    }
    setRunning(false);
  }

  return (
    <>
      <div className="section-h" id="roi">
        <h2>ROI time machine</h2>
        <span>demo figures</span>
      </div>
      <div className="roi">
        <form className="card" onSubmit={run}>
          <div className="f-row">
            <label htmlFor="roiAmt">If you&apos;d put in (USD)</label>
            <input
              id="roiAmt"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="f-row">
            <label htmlFor="roiCoin">Into</label>
            <select id="roiCoin" value={coinId} onChange={(e) => setCoinId(e.target.value)}>
              {coins.map((c) => (
                <option key={c.id} value={c.id}>
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
            <span>{result ? fmtPrice(result.then) : "—"}</span>
          </div>
          <div className="r-line">
            <span>Price now</span>
            <span>{result ? fmtPrice(result.now) : "—"}</span>
          </div>
          <div className="r-line">
            <span>Multiple</span>
            <span>{result ? fmtX(result.now / result.then) : "—"}</span>
          </div>
          <div className="r-total">
            <div className="lbl">Worth today</div>
            <div className={`val${result ? (result.gain ? " gain" : " loss") : ""}`}>
              {result
                ? "$" + result.out.toLocaleString("en-US", { maximumFractionDigits: 0 })
                : "—"}
            </div>
          </div>
          <div className="r-note">DEMO FIGURES · PROTOTYPE ONLY · NOT FINANCIAL ADVICE</div>
        </div>
      </div>
    </>
  );
}
