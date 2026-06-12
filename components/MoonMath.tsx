"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtBig, fmtPrice, fmtX } from "@/lib/format";
import {
  firstEntryOf,
  loadDetail,
  type HistoryDetail,
} from "@/lib/history-client";
import type { RankedCoin } from "@/lib/types";

/* Moon math is arithmetic on the current snapshot — what the numbers
   would have to be, never what they will be. No prediction logic. */

const TARGET_CHIPS = [
  { label: "$100K", value: 100_000 },
  { label: "$250K", value: 250_000 },
  { label: "$500K", value: 500_000 },
  { label: "$1M", value: 1_000_000 },
];

/** Hardcoded reality anchors, deliberately approximate. */
const APPROX_ANCHORS = [
  { label: "GOLD", cap: 23e12 },
  { label: "APPLE", cap: 3.7e12 },
];

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** Compound rate per year for a total multiple over a span, as text. */
function fmtPace(multiple: number, years: number): string {
  const pct = (Math.pow(multiple, 1 / years) - 1) * 100;
  const digits = Math.abs(pct) >= 100 ? 0 : 1;
  return `${pct.toFixed(digits)}%/yr`;
}

interface Pace {
  text: string;
  /** Set when the coin is younger than the horizon. */
  sinceLaunchYears: number | null;
}

/**
 * The coin's actual compound growth over the horizon, from the cached
 * daily-close payload: entry = the first close of the month `years` ago
 * (or the first close ever, when the coin is younger — labeled so).
 */
function historicalPace(
  detail: HistoryDetail,
  currentPrice: number,
  years: number
): Pace | null {
  const now = Date.now();
  const first = firstEntryOf(detail);
  if (!first) return null;
  const firstMs = Date.parse(`${first.date}T00:00:00Z`);
  const youngerThanHorizon = now - firstMs < years * MS_PER_YEAR;

  let then = first;
  if (!youngerThanHorizon) {
    const d = new Date(now);
    const ty = d.getUTCFullYear() - years;
    const tm = d.getUTCMonth() + 1;
    const months = detail.years[ty]?.months;
    const candidate =
      months?.[tm] ??
      (months ? months[Math.min(...Object.keys(months).map(Number))] : undefined);
    if (!candidate) return null;
    then = candidate;
  }

  const span = (now - Date.parse(`${then.date}T00:00:00Z`)) / MS_PER_YEAR;
  if (span < 0.1 || then.price <= 0) return null;
  return {
    text: fmtPace(currentPrice / then.price, span),
    sinceLaunchYears: youngerThanHorizon ? span : null,
  };
}

interface MoonMathProps {
  coins: RankedCoin[];
  isDemoData: boolean;
}

export default function MoonMath({ coins, isDemoData }: MoonMathProps) {
  const [amount, setAmount] = useState("");
  const [coinSlug, setCoinSlug] = useState(
    coins.some((c) => c.slug === "btc") ? "btc" : coins[0]?.slug ?? ""
  );
  const [target, setTarget] = useState("1000000");
  const [years, setYears] = useState(10);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);

  const coin = useMemo(
    () => coins.find((c) => c.slug === coinSlug),
    [coins, coinSlug]
  );
  const btc = useMemo(() => coins.find((c) => c.slug === "btc"), [coins]);
  const eth = useMemo(() => coins.find((c) => c.slug === "eth"), [coins]);

  // The pace row reuses the ROI's cached history fetch — one call per
  // coin per session, nothing per interaction. Demo mode has no real
  // history, so the row simply hides.
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

  const amt = Number(amount) > 0 ? Number(amount) : 1000; // default $1000
  const targetNum = Number(target) > 0 ? Number(target) : 0;
  const alreadyThere = targetNum > 0 && targetNum <= amt;

  const multiple = targetNum / amt;
  const requiredPrice = coin ? coin.price * multiple : 0;
  const supply = coin?.circulatingSupply ?? null;
  const impliedCap = supply ? requiredPrice * supply : null;

  const anchors = impliedCap
    ? [
        ...(btc ? [{ label: "BTC", cap: btc.marketCap }] : []),
        ...(eth ? [{ label: "ETH", cap: eth.marketCap }] : []),
        ...APPROX_ANCHORS,
      ].map((a) => `${fmtX(impliedCap / a.cap)} ${a.label}`)
    : null;

  const pace =
    detail && coin && !alreadyThere && multiple > 1
      ? historicalPace(detail, coin.price, years)
      : null;

  return (
    <>
      <div className="section-h" id="moon">
        <h2>Moon math</h2>
        <span>no predictions · just arithmetic</span>
      </div>
      <div className="roi">
        <div className="card">
          <div className="f-row">
            <label htmlFor="moonAmt">If you&apos;d put in (USD)</label>
            <input
              id="moonAmt"
              type="number"
              min={1}
              inputMode="decimal"
              placeholder="Amount in USD"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="f-row">
            <label htmlFor="moonCoin">Into</label>
            <select
              id="moonCoin"
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
            <label htmlFor="moonTarget">Target</label>
            <div className="chips moon-chips">
              {TARGET_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={`chip${targetNum === c.value ? " active" : ""}`}
                  onClick={() => setTarget(String(c.value))}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <input
              id="moonTarget"
              type="number"
              min={1}
              inputMode="decimal"
              placeholder="Custom target (USD)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div className="f-row">
            <label htmlFor="moonYears">Over {years} years</label>
            <input
              id="moonYears"
              className="moon-years"
              type="range"
              min={1}
              max={30}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="card r-out">
          {alreadyThere ? (
            <>
              <div className="r-total">
                <div className="lbl">Verdict</div>
                <div className="moon-head">Already there 🍌</div>
              </div>
              <div className="r-unavail">
                the target is covered by the amount — nothing left to compute
              </div>
            </>
          ) : targetNum > 0 && coin ? (
            <>
              <div className="r-total">
                <div className="lbl">
                  ${amt.toLocaleString("en-US")} → ${targetNum.toLocaleString("en-US")}
                </div>
                <div className="moon-head">Needs a {fmtX(multiple)}</div>
              </div>
              <div className="r-line">
                <span>Required {coin.symbol} price</span>
                <span>{fmtPrice(requiredPrice)}</span>
              </div>
              {impliedCap !== null && (
                <div className="r-line">
                  <span>Implied market cap</span>
                  <span>{fmtBig(impliedCap)}</span>
                </div>
              )}
              {anchors && (
                <div className="r-line">
                  <span>Vs reality</span>
                  <span>= {anchors.join(" · ")}</span>
                </div>
              )}
              {pace && (
                <div className="spread">
                  <div className="s-row two">
                    <span className="s-lbl">Required pace</span>
                    <span className="s-worth">{fmtPace(multiple, years)}</span>
                  </div>
                  <div className="s-row two">
                    <span className="s-lbl">
                      {pace.sinceLaunchYears
                        ? `Historical · since launch (${pace.sinceLaunchYears.toFixed(1)}y)`
                        : `Historical pace (${years}y)`}
                    </span>
                    <span className="s-worth">{pace.text}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="r-unavail">enter a target to run the arithmetic</div>
          )}
          <div className="r-note">
            {`GOLD ~$23T · APPLE ~$3.7T · APPROX · ARITHMETIC ONLY, NOT A FORECAST`}
          </div>
        </div>
      </div>
    </>
  );
}
