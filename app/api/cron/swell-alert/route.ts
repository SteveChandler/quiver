import { runSwellAlertCron } from "@/lib/cron/swell-alert-runner";
import { withObservedCron } from "@/lib/cron/observability";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SENTRY_MONITOR = {
  slug: "swell-alert",
  schedule: "0 * * * *",
  maxRuntimeMinutes: 5,
};

async function swellAlertCron(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse(
      "Unauthorized",
      "Invalid cron authentication",
      401,
    );
  }

  try {
    return createSuccessResponse(await runSwellAlertCron({ now: new Date() }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron(
  "/api/cron/swell-alert",
  swellAlertCron,
  SENTRY_MONITOR,
);
