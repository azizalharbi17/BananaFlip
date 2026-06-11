"use client";

import { useCountUp } from "./useCountUp";
import { compareCoins } from "@/lib/compare";
import { fmtBig, fmtPrice, fmtX } from "@/lib/format";
import type { RankedCoin } from "@/lib/types";

interface VerdictProps {
  a: RankedCoin;
  b: RankedCoin;
  /** Full list — fixes the log-scale endpoints of the distance track. */
  coins: RankedCoin[];
  /** Bumped by the dashboard whenever the price should count up. */
  pulse: number;
}

export default function Verdict({ a, b, coins, pulse }: VerdictProps) {
  const { multiplier, impliedPrice, capGap, alreadyFlipped } = compareCoins(a, b);
  const priceText = useCountUp(impliedPrice, fmtPrice, pulse);

  // Log-scale positions across the whole dataset, as in the reference.
  const lo = Math.log10(Math.min(...coins.map((c) => c.marketCap))) - 0.15;
  const hi = Math.log10(Math.max(...coins.map((c) => c.marketCap))) + 0.15;
  const pos = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;
  const pa = pos(a.marketCap);
  const pb = pos(b.marketCap);

  return (
    <div className="verdict">
      <div className={`x-pill${alreadyFlipped ? " down" : ""}`}>
        <span>{fmtX(multiplier)}</span>
        <small>{alreadyFlipped ? "already flipped" : "to flip"}</small>
      </div>
      <div className="eyebrow">Verdict</div>
      <div className="v-line">
        <span className="sym">{a.symbol}</span>
        <span>at</span>
        <span className="sym">{b.symbol}</span>
        <span>&apos;s market cap</span>
      </div>
      <div className="big-price">{priceText}</div>
      {alreadyFlipped ? (
        <p className="v-sub">
          <b className="down">Already flipped.</b> {a.symbol}&apos;s market cap is{" "}
          {fmtX(1 / multiplier)} the size of {b.symbol}&apos;s.
        </p>
      ) : (
        <p className="v-sub">
          {a.symbol} needs <b className="up">{fmtX(multiplier)}</b> — that&apos;s{" "}
          {fmtBig(capGap)} more market cap to flip {b.symbol}.
        </p>
      )}

      <div className="distance">
        <div className="d-lbl">
          <span>Market-cap distance</span>
          <span>log scale</span>
        </div>
        <div className="track">
          <div
            className="fill"
            style={{
              left: `${Math.min(pa, pb)}%`,
              width: `${Math.abs(pb - pa)}%`,
            }}
          />
          <div className="peg" style={{ left: `${pa}%` }}>
            {a.symbol}
          </div>
          <div className="peg" style={{ left: `${pb}%` }}>
            {b.symbol}
          </div>
        </div>
        <div className="track-note">
          {a.symbol} {fmtBig(a.marketCap)} → {b.symbol} {fmtBig(b.marketCap)}
        </div>
      </div>
    </div>
  );
}
