import Link from "next/link";
import { getDataTimestamp } from "@/lib/store";
import { BananaMark, Wordmark } from "./banana-mark";

export async function Footer() {
  const updated = await getDataTimestamp();

  return (
    <footer className="mt-20 border-t-2 border-ink bg-banana-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <BananaMark className="h-8 w-8" />
            <Wordmark className="text-lg" />
          </div>
          <p className="max-w-xs text-sm text-ink-soft">
            The flippening, calculated. Pick two coins, see what happens when the
            little one eats the big one&apos;s market cap.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="stat-label">Explore</p>
          <ul className="space-y-1.5 font-display font-bold">
            <li><Link className="hover:underline" href="/#flip">Flip calculator</Link></li>
            <li><Link className="hover:underline" href="/#trending">Trending flips</Link></li>
            <li><Link className="hover:underline" href="/roi">ROI machine</Link></li>
            <li><Link className="hover:underline" href="/pepe-flip-dogecoin">Can PEPE flip DOGE?</Link></li>
          </ul>
        </div>

        <div className="space-y-2 text-sm text-ink-soft">
          <p className="stat-label">The fine print</p>
          <p>
            Hypothetical math, not financial advice. Market caps move; bananas
            bruise. Demo data snapshot:{" "}
            <span className="font-mono tabular">{updated.toISOString().slice(0, 10)}</span>.
          </p>
          <p className="font-display font-bold text-ink">Built on potassium. 🍌</p>
        </div>
      </div>
    </footer>
  );
}
