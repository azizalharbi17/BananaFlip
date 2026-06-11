import type { MetadataRoute } from "next";
import { getRankedCoins } from "@/lib/coins";
import { HOT_PAIRS, pairSlug } from "@/lib/pairs";
import { SITE_URL } from "@/lib/site";

const MAX_URLS = 600;

/** Rebuilt hourly so it tracks the live top-40 as ranks shift. */
export const revalidate = 3600;

/**
 * Homepage, hot pairs, then top-40 challengers × top-8 targets. With
 * ~2000 live coins the full permutation space is millions of URLs — this
 * keeps the sitemap to the pairs people actually search for.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const coins = await getRankedCoins();
  const slugs = new Set(HOT_PAIRS.map(pairSlug));
  const challengers = coins.slice(0, 40);
  const targets = coins.slice(0, 8);
  for (const a of challengers) {
    for (const b of targets) {
      if (a.slug !== b.slug) {
        slugs.add(pairSlug({ challengerSlug: a.slug, targetSlug: b.slug }));
      }
    }
  }

  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...[...slugs].map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
  return entries.slice(0, MAX_URLS);
}
