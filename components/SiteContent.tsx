import DcaTimeMachine from "./DcaTimeMachine";
import FlipDashboard from "./FlipDashboard";
import Hero from "./Hero";
import MoonMath from "./MoonMath";
import RoiCalculator from "./RoiCalculator";
import { getCoins, getTrendingCoins } from "@/lib/coins";
import { buildTrendingRows } from "@/lib/hot-flips";
import { HOT_PAIRS } from "@/lib/pairs";
import { PINNED_SLUGS } from "@/lib/pinned-coins";
import type { RankedCoin } from "@/lib/types";

/** How many coins the client receives for pickers/ROI/distance scale. */
const CLIENT_COIN_COUNT = 100;

interface SiteContentProps {
  challenger: RankedCoin;
  target: RankedCoin;
}

/** Full page body, shared by the homepage and every /a-flip-b pair page. */
export default async function SiteContent({ challenger, target }: SiteContentProps) {
  const [{ coins, isDemoData }, trending] = await Promise.all([
    getCoins(),
    getTrendingCoins(),
  ]);

  // The client gets the top slice, not all ~2000 coins — search covers the
  // rest. Hot-flip rows are resolved here so they never depend on the slice.
  // Pinned coins (e.g. $ANSEM) are appended if their rank falls outside the
  // slice, so they're always selectable in the picker.
  const top = coins.slice(0, CLIENT_COIN_COUNT);
  const inTop = new Set(top.map((c) => c.slug));
  const pinnedExtra = coins.filter(
    (c) => PINNED_SLUGS.has(c.slug) && !inTop.has(c.slug)
  );
  const topCoins = [...top, ...pinnedExtra];
  const bySlug = new Map(coins.map((c) => [c.slug, c]));
  const curatedRows = HOT_PAIRS.flatMap(({ challengerSlug, targetSlug }) => {
    const c = bySlug.get(challengerSlug);
    const t = bySlug.get(targetSlug);
    return c && t ? [{ challenger: c, target: t }] : [];
  });
  // Hot flips = the auto-discovered trending set (by rank) whenever the
  // cron has produced one; the curated pairs are the fallback (demo mode,
  // first deploy, or the trending columns not migrated yet).
  const trendingRows = isDemoData ? [] : buildTrendingRows(trending, bySlug, coins);
  const hotRows = trendingRows.length > 0 ? trendingRows : curatedRows;
  const hotCaption =
    trendingRows.length > 0 ? "trending now · tap a row to load it" : undefined;

  return (
    <>
      <Hero />
      <main className="wrap">
        <FlipDashboard
          coins={topCoins}
          initialChallenger={challenger}
          initialTarget={target}
          hotRows={hotRows}
          hotCaption={hotCaption}
        />
        <RoiCalculator coins={topCoins} isDemoData={isDemoData} />
        <MoonMath coins={topCoins} isDemoData={isDemoData} />
        <DcaTimeMachine coins={topCoins} isDemoData={isDemoData} />
      </main>
    </>
  );
}
