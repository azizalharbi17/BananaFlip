"use client";

import Disc from "./Disc";
import { fmtBig, fmtX } from "@/lib/format";
import type { RankedCoin } from "@/lib/types";

export interface HotRow {
  challenger: RankedCoin;
  target: RankedCoin;
}

interface HotFlipsProps {
  /** Resolved server-side from HOT_PAIRS so rows survive any list slicing. */
  rows: HotRow[];
  onLoadPair: (challenger: RankedCoin, target: RankedCoin) => void;
}

export default function HotFlips({ rows, onLoadPair }: HotFlipsProps) {
  return (
    <>
      <div className="section-h" id="hot">
        <h2>Hot flips</h2>
        <span>tap a row to load it</span>
      </div>
      <div className="table">
        <div className="trow head">
          <span>#</span>
          <span>Pair</span>
          <span>Needs</span>
          <span className="hide-m">Challenger cap</span>
          <span className="hide-m">Target cap</span>
        </div>
        {rows.map(({ challenger: c, target: t }, i) => (
          <button
            key={`${c.slug}-${t.slug}`}
            className="trow"
            type="button"
            onClick={() => onLoadPair(c, t)}
          >
            <span className="rank">{i + 1}</span>
            <span className="pair">
              <Disc coin={c} />
              <Disc coin={t} />
              {c.symbol} <span className="q">flips?</span> {t.symbol}
            </span>
            <span className="tx">{fmtX(t.marketCap / c.marketCap)}</span>
            <span className="tm hide-m">{fmtBig(c.marketCap)}</span>
            <span className="tm hide-m">{fmtBig(t.marketCap)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
