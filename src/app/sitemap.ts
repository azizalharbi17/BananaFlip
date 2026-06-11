import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { TRENDING_PAIRS } from "@/lib/trending";
import { pairToSlug } from "@/lib/slug";

export default function sitemap(): MetadataRoute.Sitemap {
  const flipPages = TRENDING_PAIRS.flatMap(([a, b]) => [
    pairToSlug(a, b),
    pairToSlug(b, a),
  ]).map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/roi`, changeFrequency: "daily", priority: 0.9 },
    ...flipPages,
  ];
}
