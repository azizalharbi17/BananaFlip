import { ImageResponse } from "next/og";
import { getCoinBySlug } from "@/lib/coins";
import { OG_SIZE, PairCard, RootCard } from "@/lib/og";
import { parsePairSlug } from "@/lib/pairs";

export const revalidate = 3600;

export const alt = "BananaFlip matchup";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function TwitterImage({ params }: { params: { pair: string } }) {
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
  return new ImageResponse(<RootCard />, OG_SIZE);
}
