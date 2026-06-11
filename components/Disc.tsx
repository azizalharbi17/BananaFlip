import { discTextColor } from "@/lib/format";
import type { Coin } from "@/lib/types";

/**
 * Two-letter coin badge. Size variants come from context selectors in
 * globals.css (.menu .disc, .pair .disc), exactly like the reference.
 */
export default function Disc({ coin }: { coin: Coin }) {
  return (
    <span
      className="disc"
      style={{ background: coin.color, color: discTextColor(coin.color) }}
    >
      {coin.symbol.slice(0, 2)}
    </span>
  );
}
