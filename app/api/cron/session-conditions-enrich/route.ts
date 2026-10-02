import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { isSessionConditionsEnrichEnabled } from "@/lib/flags/session-conditions-enrich";
import {
  createSupabaseSessionConditionsStore,
  enrichSessionConditions,
} from "@/lib/sessions/session-conditions-enrich";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Backfill default: before the first logged session. MOP's nowcast archive starts 2025-04-01. */
const DEFAULT_BACKFILL_SINCE = "2024-01-01T00:00:00Z";

/**
 * GET /api/cron/session-conditions-enrich
 *
 * Hourly at :20 (CDIP MOP's nowcast lands about an hour behind): gives logged sessions the swell and wind
 * of the forecast row at or before paddle-out, and the MOP nearshore hour for mapped California beaches.
 * Fills nulls only. Live runs take sessions logged, moved or surfed in the last 72 h (the migration queues
 * every existing session, so those are filled in the first runs). `?mode=backfill&since=YYYY-MM-DD` walks
 * older leftovers; pass the response's `result.nextSince` as the next `since` until it comes back null.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. Gated by SESSION_CONDITIONS_ENRICH_ENABLED=true.
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }
    if (!isSessionConditionsEnrichEnabled()) {
      return createSuccessResponse({ skipped: "SESSION_CONDITIONS_ENRICH_ENABLED is not true" });
    }

    const params = new URL(request.url).searchParams;
    const mode = params.get("mode") === "backfill" ? "backfill" : "live";
    let since: Date | undefined;
    if (mode === "backfill") {
      since = new Date(params.get("since") ?? DEFAULT_BACKFILL_SINCE);
      if (Number.isNaN(since.getTime())) {
        return createErrorResponse("Bad request", "since must be an ISO date", 400);
      }
    }

    const store = createSupabaseSessionConditionsStore(createSupabaseServiceRoleClient());
    const result = await withCronOutcome(
      {
        job: "/api/cron/session-conditions-enrich",
        unit: "sessions_enriched",
        expectedMin: 1,
        getProduced: (value) => value.updated,
        legitimatelyZero: (value) => {
          if (value.selected === 0) return { reason: "No logged sessions are waiting for conditions" };
          // Orphaned sessions are re-selected until they age out of the live window, and a pending MOP hour
          // retries next run; neither is a failure.
          if (value.errors === 0 && value.selected <= value.unwritable + value.pending) {
            return {
              reason: `Only sessions that cannot be filled yet: ${value.unwritable} unwritable, ${value.pending} awaiting the MOP hour`,
            };
          }
          return undefined;
        },
      },
      () => enrichSessionConditions(store, { mode, since, now: new Date() }),
    );

    console.log("[session-conditions] complete:", JSON.stringify({ mode, ...result }));
    return createSuccessResponse({ mode, result });
  } catch (error) {
    console.error("[session-conditions] cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/session-conditions-enrich", _GET);
