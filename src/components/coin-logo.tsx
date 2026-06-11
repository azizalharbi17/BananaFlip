import type { Coin } from "@/lib/types";

const SIZES = {
  sm: "h-6 w-6",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
} as const;

export function CoinLogo({
  coin,
  size = "md",
  className = "",
}: {
  coin: Pick<Coin, "logo" | "name">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <img
      src={coin.logo}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      className={`${SIZES[size]} shrink-0 rounded-full ${className}`}
    />
  );
}
