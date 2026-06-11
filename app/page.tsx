import SiteContent from "@/components/SiteContent";
import { getCoinBySlug, getRankedCoins } from "@/lib/coins";
import { DEFAULT_PAIR } from "@/lib/pairs";

/** Re-render with fresh prices as the cron updates them. */
export const revalidate = 60;

export default async function HomePage() {
  // The default pair always exists in the demo seed; with live data, fall
  // back to the top two coins if those slugs ever disappear.
  const [pepe, doge] = await Promise.all([
    getCoinBySlug(DEFAULT_PAIR.challengerSlug),
    getCoinBySlug(DEFAULT_PAIR.targetSlug),
  ]);
  const coins = await getRankedCoins();
  const challenger = pepe ?? coins[1];
  const target = doge ?? coins[0];

  return <SiteContent challenger={challenger} target={target} />;
}
