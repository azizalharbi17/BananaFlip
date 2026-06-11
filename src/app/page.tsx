import Link from "next/link";
import { getCoin, getCoins } from "@/lib/store";
import { compareCoins } from "@/lib/compare";
import { FlipComparator } from "@/components/flip-comparator";
import { TrendingFlips } from "@/components/trending-flips";
import { BananaMark } from "@/components/banana-mark";

export const revalidate = 300;

export default async function HomePage() {
  const [pepe, doge, coins] = await Promise.all([
    getCoin("pepe"),
    getCoin("dogecoin"),
    getCoins(),
  ]);
  const initialResult = pepe && doge ? compareCoins(pepe, doge) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* ───────────────────────── hero ───────────────────────── */}
      <section className="relative pb-14 pt-12 sm:pt-16">
        <BananaMark className="absolute -right-2 top-10 hidden h-16 w-16 animate-float-slow opacity-70 lg:block" />
        <BananaMark className="absolute -left-4 top-44 hidden h-10 w-10 animate-float-slow opacity-50 [animation-delay:-3s] lg:block" />

        <div className="mx-auto max-w-3xl text-center">
          <span className="sticker -rotate-2 bg-paper text-xs text-ink-soft">
            🍌 crypto&apos;s favorite hypothetical, quantified
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            Will it{" "}
            <span className="relative inline-block">
              <span className="relative z-10">flip?</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1 z-0 h-4 -rotate-1 rounded-md bg-banana-400 sm:h-6"
              />
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-ink-soft">
            Pick a challenger and a top banana. We&apos;ll tell you exactly what the
            challenger would cost with the big coin&apos;s market cap — and how many
            ×&apos;s stand in the way.
          </p>
        </div>

        <div id="flip" className="card mt-10 scroll-mt-24 p-5 sm:p-8">
          <FlipComparator initialA={pepe ?? null} initialB={doge ?? null} initialResult={initialResult} />
        </div>
      </section>

      {/* ───────────────────── how it works ───────────────────── */}
      <section className="py-14" aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Flippening math, peeled
        </h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Pick two coins",
              copy: `Any pair from the top ${coins.length}. The challenger dreams big; the target holds the cap.`,
            },
            {
              step: "02",
              title: "We run one honest formula",
              copy: "No vibes, no hopium. Just the challenger's price scaled to the target's market cap.",
              formula: true,
            },
            {
              step: "03",
              title: "Share the verdict",
              copy: "Every flip gets a permanent URL like /pepe-flip-dogecoin. Send it to the group chat.",
            },
          ].map((item) => (
            <div key={item.step} className="card p-6 shadow-hard-sm">
              <span className="sticker rotate-2 bg-banana-300 font-mono text-xs">{item.step}</span>
              <h3 className="mt-4 font-display text-xl font-extrabold">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{item.copy}</p>
              {item.formula && (
                <code className="mt-3 block rounded-xl bg-ink px-3 py-2.5 font-mono text-xs text-banana-200">
                  price<sub>A</sub> × (mcap<sub>B</sub> ÷ mcap<sub>A</sub>)
                </code>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────── trending flips ─────────────────── */}
      <section id="trending" className="scroll-mt-24 py-14" aria-labelledby="trending-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="trending-heading" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Trending flips
            </h2>
            <p className="mt-2 text-ink-soft">The matchups everyone keeps asking about.</p>
          </div>
          <span className="sticker -rotate-2 bg-paper text-xs text-ink-soft">updated with the table 🔄</span>
        </div>
        <div className="mt-7">
          <TrendingFlips />
        </div>
      </section>

      {/* ───────────────────── ROI teaser ───────────────────── */}
      <section className="py-14">
        <div className="card flex flex-col items-start gap-6 overflow-hidden bg-ink p-8 text-cream sm:p-10 md:flex-row md:items-center">
          <div className="flex-1">
            <span className="sticker rotate-2 bg-banana-400 text-xs text-ink">time machine 🕰️</span>
            <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-banana-100 sm:text-4xl">
              “If I&apos;d bought $1,000 of DOGE in 2021…”
            </h2>
            <p className="mt-3 max-w-lg text-cream/80">
              Finish the sentence with actual numbers. The ROI Machine replays any
              investment in any coin from any date — gains, bruises and all.
            </p>
          </div>
          <Link href="/roi" className="btn-banana shrink-0 text-base">
            Open the ROI Machine →
          </Link>
        </div>
      </section>

      {/* ───────────────────────── FAQ ───────────────────────── */}
      <section className="py-14" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Fair questions
        </h2>
        <div className="mt-7 space-y-3">
          {[
            {
              q: "What does “flip” mean in crypto?",
              a: "A flip (or “flippening”) is when one coin's market cap overtakes another's — the classic example being Ethereum flipping Bitcoin. BananaFlip shows what a coin's price would be if a flip happened today, holding circulating supply constant.",
            },
            {
              q: "Is the hypothetical price realistic?",
              a: "It's arithmetic, not prophecy. Market cap = price × circulating supply, so a coin matching another's cap implies the price shown. Whether the market ever gets there is your call, not ours.",
            },
            {
              q: "Where does the data come from?",
              a: "Everything is served from BananaFlip's own cached coin table — your browser never talks to third-party APIs. The table currently runs on a demo snapshot of 50 major coins and is built to be refreshed on a schedule from a live market-data provider.",
            },
            {
              q: "Is this financial advice?",
              a: "Absolutely not. It's a calculator with a banana on it.",
            },
          ].map((item) => (
            <details key={item.q} className="group card p-0 shadow-hard-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-xl transition-transform duration-200 group-open:rotate-180">⌄</span>
              </summary>
              <p className="border-t-2 border-ink/10 px-6 py-4 text-sm text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
