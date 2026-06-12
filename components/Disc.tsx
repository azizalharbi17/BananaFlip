"use client";

import { useEffect, useState } from "react";
import { discTextColor } from "@/lib/format";
import type { Coin } from "@/lib/types";

/**
 * Coin badge: the coinpaprika logo when one can exist, otherwise the
 * two-letter colored monogram from the reference design. Demo-seed ids
 * (no "-") are not coinpaprika ids, so demo mode goes straight to the
 * monogram; live logos that fail to load fall back to it too. Size
 * variants come from context selectors in globals.css (.menu .disc,
 * .pair .disc), exactly like the reference.
 */
export default function Disc({ coin }: { coin: Coin }) {
  const hasLogo = coin.id.includes("-");
  const [failed, setFailed] = useState(false);

  // A new coin gets a fresh chance even if the previous logo 404'd.
  useEffect(() => setFailed(false), [coin.id]);

  if (hasLogo && !failed) {
    return (
      // Tiny remote favicons with a JS error fallback — next/image's
      // optimizer adds nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="disc"
        src={`https://static.coinpaprika.com/coin/${coin.id}/logo.png`}
        alt=""
        width={42}
        height={42}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="disc"
      style={{ background: coin.color, color: discTextColor(coin.color) }}
    >
      {coin.symbol.slice(0, 2)}
    </span>
  );
}
