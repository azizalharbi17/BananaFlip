import { ImageResponse } from "next/og";
import { OG_SIZE, RootCard } from "@/lib/og";

export const alt = "BananaFlip — the flippening calculator";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<RootCard />, OG_SIZE);
}
