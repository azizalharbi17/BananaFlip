/** Canonical site origin — override per environment with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bananaflip.vercel.app";
