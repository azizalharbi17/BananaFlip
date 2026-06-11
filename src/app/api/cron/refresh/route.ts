import { NextRequest, NextResponse } from "next/server";
import { refreshStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh — scheduled cache refresh hook.
 *
 * Wire this to a scheduler (e.g. vercel.json `crons`) once a live provider
 * is configured. Protected by CRON_SECRET when set.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count, fetchedAt } = await refreshStore();
  return NextResponse.json({
    ok: true,
    refreshed: count,
    dataTimestamp: fetchedAt.toISOString(),
  });
}
