"use client";

import CoinPicker from "./CoinPicker";
import { fmtBig, fmtPrice } from "@/lib/format";
import type { RankedCoin } from "@/lib/types";

interface CoinCardProps {
  roleLabel: "Coin A" | "Coin B";
  side: "A" | "B";
  coin: RankedCoin;
  coins: RankedCoin[];
  onSelect: (coin: RankedCoin) => void;
}

export default function CoinCard({ roleLabel, side, coin, coins, onSelect }: CoinCardProps) {
  return (
    <div className="coin-card">
      <div className="role">
        <span>{roleLabel}</span>
        <span className="mono">#{coin.rank}</span>
      </div>
      <CoinPicker side={side} coin={coin} coins={coins} onSelect={onSelect} />
      <div className="stats">
        <div className="stat">
          <div className="lbl">Price</div>
          <div className="val">{fmtPrice(coin.price)}</div>
        </div>
        <div className="stat">
          <div className="lbl">Market cap</div>
          <div className="val">{fmtBig(coin.marketCap)}</div>
        </div>
      </div>
    </div>
  );
}
