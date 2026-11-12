import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { runDailyCallCron } from "@/lib/cron/daily-call-runner";
import { runWithWaterQualityReadScope } from "@/lib/recommendations/major-event-hold/read-scope";
import { withObservedCron } from "@/lib/cron/observability";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SENTRY_MONITOR = {
  slug: "daily-call",
  schedule: "8 * * * *",
  maxRuntimeMinutes: 5,
};

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
  }

  try {
    // Every user in the tick shares one read of each hold table.
    return createSuccessResponse(await runWithWaterQualityReadScope(() => runDailyCallCron({ now: new Date() })));
  } catch (error) {
    return handleApiError(error, "Failed to run daily call cron");
  }
}

const handleGet = withObservedCron(
  "/api/cron/daily-call",
  _GET,
  SENTRY_MONITOR,
);

export const GET = withErrorNoStore(handleGet);
