import { runSwellEventVerification } from "@/lib/alerts/swell-verification/verify";
import { withObservedCron } from "@/lib/cron/observability";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SENTRY_MONITOR = {
  slug: "swell-event-verify",
  schedule: "0 16 * * *",
  maxRuntimeMinutes: 5,
};

async function swellEventVerifyCron(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse(
      "Unauthorized",
      "Invalid cron authentication",
      401,
    );
  }

  try {
    return createSuccessResponse(await runSwellEventVerification({ now: new Date() }));
  } catch (error) {
    return handleApiError(error);
  }
}

const handleGet = withObservedCron(
  "/api/cron/swell-event-verify",
  swellEventVerifyCron,
  SENTRY_MONITOR,
);

export const GET = withErrorNoStore(handleGet);
