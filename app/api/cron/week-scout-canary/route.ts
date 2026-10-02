import { NextResponse } from "next/server";

import { withObservedCron } from "@/lib/cron/observability";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { runWeekScoutCanary } from "@/lib/monitoring/week-scout-canary";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE = "/api/cron/week-scout-canary";

/**
 * GET /api/cron/week-scout-canary
 *
 * Every 30 minutes, 10 minutes after each County feed run: asks Week Scout for a
 * fixed set of Southern California beaches and fails (503 → cron_runs error,
 * Sentry event, failed monitor check-in) when it would withhold every pick or
 * rank nothing. On 2026-10-02 a stale County feed did exactly that for hours.
 */
async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWeekScoutCanary();
  if (!result.healthy) {
    return NextResponse.json(
      { success: false, error: `Week Scout canary failed: ${result.reason}`, details: result },
      { status: 503 },
    );
  }
  return NextResponse.json({ success: true, data: result });
}

export const GET = withObservedCron(ROUTE, _GET, {
  slug: "week-scout-canary",
  schedule: "10,40 * * * *",
  maxRuntimeMinutes: 2,
});
