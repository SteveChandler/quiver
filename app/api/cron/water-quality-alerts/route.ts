import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { processWaterQualityAlerts } from "@/lib/services/water-quality/water-quality-alerts-service";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/water-quality-alerts
 *
 * Cron job: sends push notifications to users whose home beach has had a
 * water quality status change in the last 24 hours.
 *
 * Runs after the water-quality-sync evaluate phase (Tue/Fri 13:00 UTC,
 * 30 min after the 12:30 evaluate cron to allow evaluation to complete).
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    console.log("[WQAlerts] Starting water quality alert processing...");

    const supabase = createSupabaseServiceRoleClient();
    const result = await withCronOutcome(
      {
        job: "/api/cron/water-quality-alerts",
        unit: "notifications_sent",
        expectedMin: 1,
        getProduced: (value) => value.notificationsSent,
        legitimatelyZero: (value) =>
          value.beachesWithChanges === 0
            ? { reason: "No water-quality status changes were detected in the evaluation window" }
            : undefined,
      },
      () => processWaterQualityAlerts(supabase),
    );

    console.log("[WQAlerts] Complete:", JSON.stringify(result, null, 2));
    return createSuccessResponse({ result });
  } catch (error) {
    console.error("[WQAlerts] Cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/water-quality-alerts", _GET);
