import { NextResponse } from "next/server";

import { withObservedCron } from "@/lib/cron/observability";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { checkWeekScoutStoryStaleness } from "@/lib/monitoring/week-scout-story-staleness";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE = "/api/cron/week-scout-story-staleness";

/**
 * GET /api/cron/week-scout-story-staleness
 *
 * Daily at 16:15 UTC (08:15 PST, 09:15 PDT), after the PC worker's 05:30 PT run: fails
 * (503 → cron_runs error, Sentry event, failed monitor check-in) when fewer than half of the
 * active story regions, or San Diego, have today's edition. From 2026-11-12 to 11-14 the worker
 * failed every run without notice and phones fell back to the server's text. Read-only.
 */
async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkWeekScoutStoryStaleness();
  if (!result.healthy) {
    return NextResponse.json(
      {
        success: false,
        error: `Week Scout story editions stale (${result.reason}): ${result.detail}`,
        details: result,
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ success: true, data: result });
}

const handleGet = withObservedCron(ROUTE, _GET, {
  slug: "week-scout-story-staleness",
  schedule: "15 16 * * *",
  maxRuntimeMinutes: 2,
});

export const GET = withErrorNoStore(handleGet, "/api/cron/week-scout-story-staleness");
