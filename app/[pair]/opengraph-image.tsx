import { ImageResponse } from "next/og";
import { getCoinBySlug } from "@/lib/coins";
import { OG_SIZE, PairCard, RootCard } from "@/lib/og";
import { parsePairSlug } from "@/lib/pairs";

/** Multiplier in the preview may lag up to an hour — it's a teaser. */
export const revalidate = 3600;

export const alt = "BananaFlip matchup";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({ params }: { params: { pair: string } }) {
  const parsed = parsePairSlug(params.pair);
  if (parsed) {
    const [a, b] = await Promise.all([
      getCoinBySlug(parsed.challengerSlug),
      getCoinBySlug(parsed.targetSlug),
    ]);
    if (a && b) {
      return new ImageResponse(<PairCard a={a} b={b} />, OG_SIZE);
    }
  }
  // Unknown pair or data layer down — the site-wide card still works.
  return new ImageResponse(<RootCard />, OG_SIZE);
}
