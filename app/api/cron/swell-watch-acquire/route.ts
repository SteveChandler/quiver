import { withObservedCron } from "@/lib/cron/observability";
import { createErrorResponse, createSuccessResponse, validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { acquisitionConfig, acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";
import { completeSwellWatchStudyRun, readSwellWatchStudyStatus, recoverSwellWatchStudyRuns, studyConfig } from "@/lib/alerts/swell-watch/study";

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
  const automated = process.env.SWELL_WATCH_STUDY_ENABLED === "true";
  if (automated && (process.env.SWELL_WATCH_ENABLED !== "false"
    || process.env.SWELL_WATCH_PUSH_ENABLED !== "false"
    || process.env.SWELL_WATCH_SHADOW_EVALUATION_ENABLED !== "true")) {
    return createErrorResponse("Study unavailable", "Study requires shadow evaluation and disabled sends", 503);
  }
  let config: ReturnType<typeof acquisitionConfig.parse>;
  try {
    config = acquisitionConfig.extend({ cohort: acquisitionConfig.shape.cohort.max(10) })
      .parse(JSON.parse(process.env.SWELL_WATCH_PRODUCER_CONFIG ?? "null"));
    if (automated) config = studyConfig.parse(config);
  } catch {
    return createErrorResponse("Producer unavailable", "Valid server-side acquisition configuration is required", 503);
  }
  try {
    const client = createSupabaseServiceRoleClient();
    let recovery = { processed: 0, failed: 0 };
    if (automated) {
      const status = await readSwellWatchStudyStatus(client);
      if (status === "complete" || status === "expired") {
        return createSuccessResponse({ skipped: true, reason: `study_${status}`, enqueued: 0 });
      }
      if (status !== "active") return createErrorResponse("Study unavailable", "Study authority is not active", 503);
      recovery = await recoverSwellWatchStudyRuns(studyConfig.parse(config), client);
      if (recovery.processed) {
        const afterRecovery = await readSwellWatchStudyStatus(client);
        if (afterRecovery === "complete" || afterRecovery === "expired") {
          return createSuccessResponse({ skipped: true, reason: `study_${afterRecovery}`, recovery, enqueued: 0 });
        }
        if (afterRecovery !== "active") return createErrorResponse("Study unavailable", "Study authority is not active", 503);
      }
    }
    const stored = await acquireSwellWatchCohort(config.cohort, client);
    if (automated && !("skipped" in stored)) {
      const study = await completeSwellWatchStudyRun(stored.revisionSetId, studyConfig.parse(config), client);
      if (recovery.failed) return createErrorResponse("Study recovery incomplete", { recovery, study, enqueued: 0 }, 500);
      return createSuccessResponse({ ...stored, study, recovery, qualification: "automated_study", enqueued: 0 });
    }
    if (recovery.failed) return createErrorResponse("Study recovery incomplete", { recovery, enqueued: 0 }, 500);
    return createSuccessResponse({ ...stored, qualification: "prototype_unqualified", enqueued: 0 });
  } catch {
    if (automated) {
      console.error("[swell-watch-acquire] automated study failed");
      return createErrorResponse("Study failed", "Automated study cycle failed; retained receipts can be retried", 500);
    }
    console.error("[swell-watch-acquire] acquisition failed");
    return createErrorResponse("Producer failed", "Provider acquisition failed", 500);
  }
}

export const GET = withObservedCron("/api/cron/swell-watch-acquire", async (request: Request): Promise<Response> => {
  const response = await acquire(request);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
});
