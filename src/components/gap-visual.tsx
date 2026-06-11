import type { Coin } from "@/lib/types";
import { formatCompactUsd, formatMultiplier } from "@/lib/format";
import { CoinLogo } from "./coin-logo";

/**
 * "The bunch gap": two bars sized by square-root scale (linear scale makes a
 * 1000× underdog literally invisible). Honesty is kept by printing the exact
 * caps and the multiplier on the chart itself.
 */
export function GapVisual({ a, b, multiplier }: { a: Coin; b: Coin; multiplier: number }) {
  const max = Math.max(a.market_cap, b.market_cap);
  const rows = [a, b].map((coin) => ({
    coin,
    pct: Math.max(Math.sqrt(coin.market_cap / max) * 100, 4),
  }));

  return (
    <figure className="rounded-2xl border-2 border-ink/15 bg-cream p-4">
      <div className="space-y-3">
        {rows.map(({ coin, pct }) => (
          <div key={coin.id} className="flex items-center gap-2.5">
            <CoinLogo coin={coin} size="sm" />
            <span className="w-12 shrink-0 font-display text-sm font-extrabold">{coin.symbol}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-lg">
              <div
                className="h-full rounded-lg border-2 border-ink"
                style={{
                  width: `${pct}%`,
                  backgroundColor: coin.color,
                  animation: "bar-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) backwards",
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-ink-soft tabular">
              {formatCompactUsd(coin.market_cap)}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
        <span>
          {multiplier > 1 ? (
            <>
              {b.symbol}&apos;s cap is{" "}
              <strong className="text-ink">{formatMultiplier(multiplier)}</strong> {a.symbol}&apos;s.
            </>
          ) : (
            <>
              {a.symbol} already out-caps {b.symbol} by{" "}
              <strong className="text-ink">{formatMultiplier(1 / multiplier)}</strong>.
            </>
          )}
        </span>
        <span className="italic">√ scale, so the smol stay visible</span>
      </figcaption>
    </figure>
  );
}
