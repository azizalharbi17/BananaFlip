import type { Metadata } from "next";
import { getCoin } from "@/lib/store";
import { RoiCalculator } from "@/components/roi-calculator";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "ROI Machine — “what if I'd bought…”",
  description:
    "If you invested $X in any coin on any date, what would it be worth today? The BananaFlip ROI Machine replays the trade — gains, bruises and all.",
  alternates: { canonical: "/roi" },
};

export default async function RoiPage() {
  const bitcoin = await getCoin("bitcoin");
  if (!bitcoin) throw new Error("Seed table is missing bitcoin");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mx-auto max-w-2xl text-center">
        <span className="sticker -rotate-2 bg-paper text-xs text-ink-soft">the time machine 🕰️</span>
        <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          The ROI{" "}
          <span className="relative inline-block">
            <span className="relative z-10">Machine</span>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-1 z-0 h-4 -rotate-1 rounded-md bg-banana-400 sm:h-5"
            />
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-ink-soft">
          Every crypto regret starts with “if I&apos;d just bought back then.” Put a
          number on it: pick the coin, the bag and the date.
        </p>
      </header>

      <div className="mt-10">
        <RoiCalculator defaultCoin={bitcoin} />
      </div>
    </div>
  );
}
