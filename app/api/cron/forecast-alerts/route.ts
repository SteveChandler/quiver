import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { validateCronRequest } from "@/lib/api-response-utils";
import { runForecastThresholdAlerts } from "@/lib/services/forecast-alerts";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/forecast-alerts
 *
 * Cron job entrypoint: evaluates forecast threshold alerts and sends push notifications.
 *
 * Auth:
 * - Vercel Cron header (`x-vercel-cron`)
 * - OR Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  try {
    if (!validateCronRequest(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const summary = await runForecastThresholdAlerts();
    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}





