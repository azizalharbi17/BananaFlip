"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtPrice, fmtX } from "@/lib/format";
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

/** Approximate constants, labeled as such in the footnote. */
const GOLD_CAP = 23e12;
const APPLE_CAP = 3.7e12;

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** Multiples: 3,333× / 12.4× / 1.3× / 0.4× — commas past 100. */
function fmtMultiple(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString("en-US") + "×";
  return fmtX(v);
}

/** Compact dollars: $4,252T / $212.1M / $104.4K / $0.0095. */
function fmtCompact(v: number): string {
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [u, s] of units) {
    if (v >= u) {
      const x = v / u;
      const str =
        x >= 1000
          ? Math.round(x).toLocaleString("en-US")
          : x.toFixed(x >= 10 ? 1 : 2);
      return `$${str}${s}`;
    }
  }
  return fmtPrice(v);
}

/** Percentages: 5,674% / 16.8% / −3%. */
function fmtPct(pct: number): string {
  if (Math.abs(pct) >= 100) {
    return Math.round(pct).toLocaleString("en-US") + "%";
  }
  return pct.toFixed(1).replace(/\.0$/, "") + "%";
}

interface Pace {
  pct: number;
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
    pct: (Math.pow(currentPrice / then.price, 1 / span) - 1) * 100,
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

  // The historical line reuses the ROI's cached history fetch — one call
  // per coin per session, nothing per interaction. Demo mode has no real
  // history, so that line simply hides.
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

  // Anchor sentences: gold, Apple, and whichever of BTC/ETH isn't the
  // selected coin. The headline anchor is the ratio closest to 1× (in
  // log space) — the most relatable comparison; the rest go on a tiny
  // "also:" line.
  const anchors = useMemo(() => {
    if (!impliedCap || !coin) return null;
    const candidates: {
      tag: string;
      before: string;
      value: string;
      after: string;
      ratio: number;
    }[] = [];
    const push = (tag: string, cap: number, before: string, after: string) => {
      const ratio = impliedCap / cap;
      candidates.push({
        tag: `${fmtMultiple(ratio)} ${tag}`,
        before: `${coin.name} would be ${before}`,
        value: fmtMultiple(ratio),
        after,
        ratio,
      });
    };
    push("gold", GOLD_CAP, "worth ", " all the gold on Earth");
    push("Apple", APPLE_CAP, "", " Apple");
    if (coin.slug !== "btc" && btc) {
      push("BTC", btc.marketCap, "", " Bitcoin's market cap today");
    } else if (eth) {
      push("ETH", eth.marketCap, "", " Ethereum's market cap today");
    }
    candidates.sort(
      (a, b) => Math.abs(Math.log10(a.ratio)) - Math.abs(Math.log10(b.ratio))
    );
    return { main: candidates[0], rest: candidates.slice(1) };
  }, [impliedCap, coin, btc, eth]);

  const requiredPacePct =
    multiple > 1 ? (Math.pow(multiple, 1 / years) - 1) * 100 : null;
  const pace =
    detail && coin && !alreadyThere && multiple > 1
      ? historicalPace(detail, coin.price, years)
      : null;
  const yearsWord = (n: number) => (n === 1 ? "1 year" : `${n} years`);

  return (
    <>
      <div className="section-h" id="moon">
        <h2>Moon math</h2>
        <span>no predictions · just arithmetic</span>
      </div>
      <div className="roi">
        <div className="card">
          <div className="f-row">
            <label htmlFor="moonAmt">You put in (USD)</label>
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
            <label htmlFor="moonTarget">You want</label>
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
                <div className="moon-head">
                  {coin.symbol} needs a {fmtMultiple(multiple)}
                </div>
              </div>
              <div className="moon-story">
                <p className="m-line">
                  1 {coin.symbol} would cost <b>{fmtCompact(requiredPrice)}</b> —
                  today it&apos;s <b>{fmtCompact(coin.price)}</b>
                </p>
                {anchors && (
                  <>
                    <p className="m-line">
                      {anchors.main.before}
                      <b>{anchors.main.value}</b>
                      {anchors.main.after}
                    </p>
                    <p className="m-also">
                      also: {anchors.rest.map((a) => a.tag).join(" · ")}
                    </p>
                  </>
                )}
                {requiredPacePct !== null && (
                  <p className="m-line">
                    Needs <b>{fmtPct(requiredPacePct)}</b> per year for{" "}
                    {yearsWord(years)}
                  </p>
                )}
                {pace && (
                  <p className="m-line">
                    {coin.symbol}&apos;s actual{" "}
                    {pace.sinceLaunchYears
                      ? `since launch (${pace.sinceLaunchYears.toFixed(1)}y)`
                      : `last ${yearsWord(years)}`}
                    : <b>{fmtPct(pace.pct)}</b> per year
                  </p>
                )}
              </div>
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
