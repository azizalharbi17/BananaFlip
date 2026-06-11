import Link from "next/link";
import { getCoin } from "@/lib/store";
import { compareCoins } from "@/lib/compare";
import { TRENDING_PAIRS } from "@/lib/trending";
import { formatMultiplier, formatUsd } from "@/lib/format";
import { CoinLogo } from "./coin-logo";

/**
 * Server-rendered grid of curated flips — crawlable links into the
 * static /a-flip-b pages, with live multipliers from the cached table.
 */
export async function TrendingFlips() {
  const cards = (
    await Promise.all(
      TRENDING_PAIRS.map(async ([aId, bId]) => {
        const [a, b] = await Promise.all([getCoin(aId), getCoin(bId)]);
        return a && b ? compareCoins(a, b) : null;
      }),
    )
  ).filter((c) => c !== null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((flip, i) => (
        <Link
          key={flip.slug}
          href={`/${flip.slug}`}
          className="group card p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-hard-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center">
              <CoinLogo coin={flip.a} size="md" className="ring-2 ring-paper" />
              <CoinLogo coin={flip.b} size="md" className="-ml-2.5 ring-2 ring-paper" />
            </div>
            <span
              className={`sticker text-xs ${
                i % 2 ? "-rotate-2" : "rotate-2"
              } ${flip.alreadyFlipped ? "bg-leaf-400 text-ink" : "bg-banana-300"}`}
            >
              {flip.alreadyFlipped ? "flipped ✓" : `${formatMultiplier(flip.multiplier)} to go`}
            </span>
          </div>

          <p className="mt-4 font-display text-xl font-extrabold leading-snug">
            Can {flip.a.symbol} flip {flip.b.symbol}?
          </p>
          <p className="mt-1.5 text-sm text-ink-soft">
            {flip.a.symbol} at {flip.b.symbol}&apos;s cap →{" "}
            <span className="font-mono font-semibold text-ink tabular">
              {formatUsd(flip.hypotheticalPrice)}
            </span>
          </p>

          <p className="mt-4 font-display text-sm font-bold text-ink-faint transition-colors group-hover:text-ink">
            Run the numbers <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </p>
        </Link>
      ))}
    </div>
  );
}
