import { withObservedCron } from "@/lib/cron/observability";
import { createErrorResponse, createSuccessResponse, validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { acquisitionConfig, acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function acquire(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
  if (process.env.SWELL_WATCH_ACQUISITION_ENABLED !== "true") {
    return createSuccessResponse({ skipped: true, reason: "disabled", enqueued: 0 });
  }
  if (new URL(request.url).search) return createErrorResponse("Invalid request", "Acquisition accepts no caller parameters", 400);
  let config: ReturnType<typeof acquisitionConfig.parse>;
  try {
    config = acquisitionConfig.extend({ cohort: acquisitionConfig.shape.cohort.max(10) })
      .parse(JSON.parse(process.env.SWELL_WATCH_PRODUCER_CONFIG ?? "null"));
  } catch {
    return createErrorResponse("Producer unavailable", "Valid server-side acquisition configuration is required", 503);
  }
  try {
    const stored = await acquireSwellWatchCohort(config.cohort, createSupabaseServiceRoleClient());
    return createSuccessResponse({ ...stored, qualification: "prototype_unqualified", enqueued: 0 });
  } catch {
    console.error("[swell-watch-acquire] acquisition failed");
    return createErrorResponse("Producer failed", "Provider acquisition failed", 500);
  }
}

export const GET = withObservedCron("/api/cron/swell-watch-acquire", async (request: Request): Promise<Response> => {
  const response = await acquire(request);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
});
