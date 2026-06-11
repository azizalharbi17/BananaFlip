import FlipDashboard from "./FlipDashboard";
import Hero from "./Hero";
import RoiCalculator from "./RoiCalculator";
import type { RankedCoin } from "@/lib/types";

interface SiteContentProps {
  coins: RankedCoin[];
  challengerId: string;
  targetId: string;
}

/** Full page body, shared by the homepage and every /a-flip-b pair page. */
export default function SiteContent({ coins, challengerId, targetId }: SiteContentProps) {
  return (
    <>
      <Hero />
      <main className="wrap">
        <FlipDashboard
          coins={coins}
          initialChallengerId={challengerId}
          initialTargetId={targetId}
        />
        <RoiCalculator coins={coins} />
      </main>
    </>
  );
}
