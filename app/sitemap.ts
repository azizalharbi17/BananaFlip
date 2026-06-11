import type { MetadataRoute } from "next";
import { getRankedCoins } from "@/lib/coins";
import { pairSlug } from "@/lib/pairs";
import { SITE_URL } from "@/lib/site";

/** Homepage plus every ordered coin pair — all resolvable flip pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const coins = await getRankedCoins();
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  ];
  for (const a of coins) {
    for (const b of coins) {
      if (a.id === b.id) continue;
      entries.push({
        url: `${SITE_URL}/${pairSlug({ challengerId: a.id, targetId: b.id })}`,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }
  return entries;
}
