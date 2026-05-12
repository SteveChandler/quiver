import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/api-utils";
import { runForecastThresholdAlerts } from "@/lib/services/forecast-alerts";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/forecast-alerts
 *
 * Cron job entrypoint for the disabled legacy daily forecast summary producer.
 *
 * Auth:
 * - Vercel Cron header (`x-vercel-cron`)
 * - OR Authorization: Bearer <CRON_SECRET>
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const summary = await runForecastThresholdAlerts();
    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/forecast-alerts", _GET);



