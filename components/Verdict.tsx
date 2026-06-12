"use client";

import { useEffect, useRef, useState } from "react";
import { useCountUp } from "./useCountUp";
import { fmtBig, fmtPrice, fmtX } from "@/lib/format";
import type { RankedCoin } from "@/lib/types";

type VerdictMode = "now" | "ath";

interface VerdictProps {
  a: RankedCoin;
  b: RankedCoin;
  /** Top coins — fixes the log-scale endpoints of the distance track. */
  coins: RankedCoin[];
  /** Bumped by the dashboard whenever the price should count up. */
  pulse: number;
}

export default function Verdict({ a, b, coins, pulse }: VerdictProps) {
  const [mode, setMode] = useState<VerdictMode>("now");
  const [modePulse, setModePulse] = useState(0);

  // ATH compares against Coin B's all-time-high market cap:
  // ath_market_cap = ath_price × circulating_supply. Without both
  // numbers the toggle disappears and the verdict stays on NOW.
  const athCap =
    b.athPrice != null && b.circulatingSupply
      ? b.athPrice * b.circulatingSupply
      : null;
  const athAvailable = athCap != null && athCap > 0;
  const effectiveMode: VerdictMode = athAvailable && mode === "ath" ? "ath" : "now";
  const isAth = effectiveMode === "ath";

  // A new Coin B is a new question — drop back to NOW.
  const prevB = useRef(b.slug);
  useEffect(() => {
    if (prevB.current !== b.slug) {
      prevB.current = b.slug;
      setMode("now");
    }
  }, [b.slug]);

  const switchMode = (next: VerdictMode) => {
    if (next === effectiveMode) return;
    setMode(next);
    setModePulse((n) => n + 1);
  };

  // impliedPrice = priceA × (capB / mcapA), capB = current or ATH cap.
  const targetCap = isAth ? (athCap as number) : b.marketCap;
  const multiplier = targetCap / a.marketCap;
  const impliedPrice = a.price * multiplier;
  const capGap = targetCap - a.marketCap;
  const alreadyFlipped = multiplier < 1;

  const priceText = useCountUp(impliedPrice, fmtPrice, pulse + modePulse);

  // Log-scale positions, as in the reference. The selection is included in
  // the range (and clamped) since deep-ranked coins sit below the top slice.
  const caps = coins.map((c) => c.marketCap).concat(a.marketCap, targetCap);
  const lo = Math.log10(Math.min(...caps)) - 0.15;
  const hi = Math.log10(Math.max(...caps)) + 0.15;
  const pos = (v: number) =>
    Math.min(100, Math.max(0, ((Math.log10(v) - lo) / (hi - lo)) * 100));
  const pa = pos(a.marketCap);
  const pb = pos(targetCap);

  return (
    <div className="verdict">
      <div className={`x-pill${alreadyFlipped ? " down" : ""}`}>
        <span>{fmtX(multiplier)}</span>
        <small>
          {isAth
            ? alreadyFlipped
              ? "above ATH cap"
              : "to flip ATH"
            : alreadyFlipped
              ? "already flipped"
              : "to flip"}
        </small>
      </div>
      <div className="v-head">
        <div className="eyebrow">Verdict</div>
        {athAvailable && (
          <div
            className="mode-toggle"
            role="group"
            aria-label="Compare against current or all-time-high market cap"
          >
            <button
              type="button"
              className={isAth ? "" : "active"}
              aria-pressed={!isAth}
              onClick={() => switchMode("now")}
            >
              Now
            </button>
            <button
              type="button"
              className={isAth ? "active" : ""}
              aria-pressed={isAth}
              onClick={() => switchMode("ath")}
            >
              ATH
            </button>
          </div>
        )}
      </div>
      <div className="v-line">
        <span className="sym">{a.symbol}</span>
        <span>at</span>
        <span className="sym">{b.symbol}</span>
        <span>&apos;s {isAth ? "ATH market cap" : "market cap"}</span>
      </div>
      <div className="big-price">{priceText}</div>
      {alreadyFlipped ? (
        <p className="v-sub">
          {isAth ? (
            <>
              <b className="down">Already above it.</b> {a.symbol}&apos;s market cap is{" "}
              {fmtX(1 / multiplier)} the size of {b.symbol}&apos;s ATH market cap.
            </>
          ) : (
            <>
              <b className="down">Already flipped.</b> {a.symbol}&apos;s market cap is{" "}
              {fmtX(1 / multiplier)} the size of {b.symbol}&apos;s.
            </>
          )}
        </p>
      ) : (
        <p className="v-sub">
          {a.symbol} needs <b className="up">{fmtX(multiplier)}</b> — that&apos;s{" "}
          {fmtBig(capGap)} more market cap to flip {b.symbol}
          {isAth ? " at its ATH" : ""}.
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
          {a.symbol} {fmtBig(a.marketCap)} → {b.symbol} {isAth ? "ATH " : ""}
          {fmtBig(targetCap)}
        </div>
      </div>
    </div>
  );
}
