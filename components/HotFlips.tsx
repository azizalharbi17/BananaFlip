"use client";

import { useMemo } from "react";
import Disc from "./Disc";
import { fmtBig, fmtX } from "@/lib/format";
import { HOT_PAIRS } from "@/lib/pairs";
import type { RankedCoin } from "@/lib/types";

interface HotFlipsProps {
  coins: RankedCoin[];
  onLoadPair: (challenger: RankedCoin, target: RankedCoin) => void;
}

export default function HotFlips({ coins, onLoadPair }: HotFlipsProps) {
  const rows = useMemo(() => {
    const byId = new Map(coins.map((c) => [c.id, c]));
    return HOT_PAIRS.flatMap(({ challengerId, targetId }) => {
      const c = byId.get(challengerId);
      const t = byId.get(targetId);
      return c && t ? [{ c, t }] : [];
    });
  }, [coins]);

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
        {rows.map(({ c, t }, i) => (
          <button
            key={`${c.id}-${t.id}`}
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
