import SiteContent from "@/components/SiteContent";
import { getRankedCoins } from "@/lib/coins";
import { DEFAULT_PAIR } from "@/lib/pairs";

export default async function HomePage() {
  const coins = await getRankedCoins();
  return (
    <SiteContent
      coins={coins}
      challengerId={DEFAULT_PAIR.challengerId}
      targetId={DEFAULT_PAIR.targetId}
    />
  );
}
