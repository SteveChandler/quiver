import { NextResponse } from "next/server";

import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createCountyAdvisoryRepository,
  createCountyFeedFetcher,
  runCountyAdvisoryIngest,
} from "@/lib/services/county-beach-advisories";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE = "/api/cron/county-beach-advisories";

/**
 * GET /api/cron/county-beach-advisories
 *
 * The only code path allowed to construct the County feed client. All request
 * paths resolve holds from the completed snapshots in our own database.
 */
async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await withCronOutcome(
      {
        job: ROUTE,
        unit: "advisories_synced",
        expectedMin: 1,
        getProduced: (value) =>
          value.status === "ok" ? value.summary.records.length : 0,
        legitimatelyZero: (value) =>
          value.status === "skipped"
            ? { reason: `County feed skipped: ${value.reason}` }
            : undefined,
      },
      () =>
        runCountyAdvisoryIngest({
          fetcher: createCountyFeedFetcher(),
          repository: createCountyAdvisoryRepository(
            createSupabaseServiceRoleClient(),
          ),
        }),
    );

    if (result.status === "error") {
      return NextResponse.json(
        {
          success: false,
          error: "County advisory ingest unavailable",
          details: result,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[county-advisory-ingest] cron failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "County advisory ingest failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const GET = withObservedCron(ROUTE, _GET, {
  slug: "county-beach-advisories",
  schedule: "*/30 * * * *",
  maxRuntimeMinutes: 2,
});
