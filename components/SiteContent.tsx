import DcaTimeMachine from "./DcaTimeMachine";
import FlipDashboard from "./FlipDashboard";
import Hero from "./Hero";
import MoonMath from "./MoonMath";
import RoiCalculator from "./RoiCalculator";
import { getCoins } from "@/lib/coins";
import { HOT_PAIRS } from "@/lib/pairs";
import type { RankedCoin } from "@/lib/types";

/** How many coins the client receives for pickers/ROI/distance scale. */
const CLIENT_COIN_COUNT = 100;

interface SiteContentProps {
  challenger: RankedCoin;
  target: RankedCoin;
}

/** Full page body, shared by the homepage and every /a-flip-b pair page. */
export default async function SiteContent({ challenger, target }: SiteContentProps) {
  const { coins, isDemoData } = await getCoins();

  // The client gets the top slice, not all ~2000 coins — search covers the
  // rest. Hot-flip rows are resolved here so they never depend on the slice.
  const topCoins = coins.slice(0, CLIENT_COIN_COUNT);
  const bySlug = new Map(coins.map((c) => [c.slug, c]));
  const hotRows = HOT_PAIRS.flatMap(({ challengerSlug, targetSlug }) => {
    const c = bySlug.get(challengerSlug);
    const t = bySlug.get(targetSlug);
    return c && t ? [{ challenger: c, target: t }] : [];
  });

  return (
    <>
      <Hero />
      <main className="wrap">
        <FlipDashboard
          coins={topCoins}
          initialChallenger={challenger}
          initialTarget={target}
          hotRows={hotRows}
        />
        <RoiCalculator coins={topCoins} isDemoData={isDemoData} />
        <MoonMath coins={topCoins} isDemoData={isDemoData} />
        <DcaTimeMachine coins={topCoins} isDemoData={isDemoData} />
      </main>
    </>
  );
}
