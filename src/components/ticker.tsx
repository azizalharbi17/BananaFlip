import { getCoins } from "@/lib/store";
import { formatPct, formatUsd } from "@/lib/format";

/**
 * The market tape: a slim scrolling strip of live(ish) prices.
 * Server-rendered from the cached table, animated with pure CSS.
 */
export async function Ticker() {
  const coins = (await getCoins()).slice(0, 20);

  const items = coins.map((coin) => (
    <span key={coin.id} className="mx-4 inline-flex items-baseline gap-1.5 tabular">
      <span className="font-bold text-banana-200">{coin.symbol}</span>
      <span className="text-cream/95">{formatUsd(coin.price)}</span>
      <span className={coin.change_24h >= 0 ? "text-leaf-400" : "text-bruise-500"}>
        {formatPct(coin.change_24h)}
      </span>
    </span>
  ));

  return (
    <div
      className="overflow-hidden border-b-2 border-ink bg-ink py-1.5 font-mono text-xs marquee-mask"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee whitespace-nowrap hover:[animation-play-state:paused]">
        <div className="flex shrink-0">{items}</div>
        <div className="flex shrink-0">{items}</div>
      </div>
    </div>
  );
}
