/**
 * Canonical site origin for every absolute URL we emit (metadataBase,
 * canonical tags, OG urls, sitemap, robots). Override per environment
 * with NEXT_PUBLIC_SITE_URL. Deliberately never falls back to VERCEL_URL:
 * preview deployments would leak *.vercel.app into canonical/OG URLs.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bananaflip.io";
