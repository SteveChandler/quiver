import { COMPLETE_PARTITIONS_RULE, type SwellWatchQualificationRule } from "@/lib/alerts/swell-watch/native-sampling";
import { withObservedCron } from "@/lib/cron/observability";
import { createErrorResponse, createSuccessResponse, validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { acquisitionConfig, acquireSwellWatchCohort, type SwellWatchAcquisitionStage } from "@/lib/alerts/swell-watch/acquisition";
import { completeSwellWatchStudyRun, readSwellWatchStudyStatus, recoverSwellWatchStudyRuns, studyConfig } from "@/lib/alerts/swell-watch/study";
import { getSingleRunTupleDiagnostic } from "@/lib/alerts/swell-watch/single-run-receipt";
import { z } from "zod";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Emit only fixed labels: upstream messages can contain payloads, URLs, or credentials.
function failureCode(error: unknown): string {
  if (error instanceof z.ZodError) return "schema_validation_failed";
  if (!(error instanceof Error)) return "unknown";
  const messages = [
    "Collection lease unavailable", "Collection lease release unavailable",
    "Acquisition scope differs from configured cohort",
    "Provider availability read unsuccessful", "Provider availability response exceeds limit",
    "Provider run is not ready after replication delay",
    "Single Runs HTTP response was unsuccessful", "Single Runs response JSON is invalid",
    "Single Runs response exceeds the durable receipt limit",
    "Single Runs tuple is invalid", "Single Runs hourly response is invalid",
    "Single Runs hourly response is unexpected", "Single Runs hourly arrays are invalid",
    "Single Runs hourly slots are invalid", "Single Runs top-level response is unexpected",
    "Single Runs top-level response is invalid", "Single Runs hourly units are invalid",
    "Single Runs selected grid is outside the prototype mapping policy",
    "Provider run receipt provenance is invalid", "Provider run receipt scope is invalid",
    "Provider run receipt scope is incomplete", "Provider run receipt slots are invalid",
    "Provider run receipt values are invalid", "Provider run receipt storage returned an invalid result",
    "Study health unavailable", "Pending study runs unavailable",
    "Study completion failed", "Study outcome recording failed",
  ];
  const known = messages.find((message) => message === error.message);
  if (known) return known.toLowerCase().replaceAll(" ", "_");
  if (error.message.startsWith("Acquisition scope read failed:")) return "acquisition_scope_read_failed";
  if (error.message.startsWith("Provider run receipt storage failed:")) return "provider_receipt_storage_failed";
  if (error.name === "AbortError" || error.name === "TimeoutError") return "request_aborted_or_timed_out";
  if (error instanceof SyntaxError) return "json_parse_failed";
  if (error instanceof TypeError && error.message === "fetch failed") return "network_fetch_failed";
  return "unknown";
}

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
  let stage: "client" | "health" | "recovery" | "health_after_recovery" | "acquisition" | "completion"
    | SwellWatchAcquisitionStage = "client";
  try {
    const client = createSupabaseServiceRoleClient();
    let qualificationRule: SwellWatchQualificationRule = COMPLETE_PARTITIONS_RULE;
    let recovery = { processed: 0, failed: 0 };
    if (automated) {
      stage = "health";
      const health = await readSwellWatchStudyStatus(client);
      const { status } = health;
      qualificationRule = health.qualificationRule;
      if (status === "complete" || status === "expired") {
        return createSuccessResponse({ skipped: true, reason: `study_${status}`, enqueued: 0 });
      }
      if (status !== "active") return createErrorResponse("Study unavailable", "Study authority is not active", 503);
      stage = "recovery";
      recovery = await recoverSwellWatchStudyRuns(studyConfig.parse(config), client, qualificationRule);
      if (recovery.processed) {
        stage = "health_after_recovery";
        const afterRecovery = await readSwellWatchStudyStatus(client);
        if (afterRecovery.status === "complete" || afterRecovery.status === "expired") {
          return createSuccessResponse({ skipped: true, reason: `study_${afterRecovery.status}`, recovery, enqueued: 0 });
        }
        if (afterRecovery.status !== "active") return createErrorResponse("Study unavailable", "Study authority is not active", 503);
        qualificationRule = afterRecovery.qualificationRule;
      }
    }
    stage = "acquisition";
    const stored = await acquireSwellWatchCohort(config.cohort, client, (acquisitionStage) => { stage = acquisitionStage; });
    if (automated && !("skipped" in stored)) {
      stage = "completion";
      const study = await completeSwellWatchStudyRun(stored.revisionSetId, studyConfig.parse(config), client, qualificationRule);
      if (recovery.failed) return createErrorResponse("Study recovery incomplete", { recovery, study, enqueued: 0 }, 500);
      if ("status" in study && study.status === "suppressed") {
        // Recording a suppressed result is not a successful study cycle.
        return createErrorResponse("Study suppressed", { ...stored, study, recovery, qualification: "automated_study", enqueued: 0 }, 503);
      }
      return createSuccessResponse({ ...stored, study, recovery, qualification: "automated_study", enqueued: 0 });
    }
    if (recovery.failed) return createErrorResponse("Study recovery incomplete", { recovery, enqueued: 0 }, 500);
    return createSuccessResponse({ ...stored, qualification: "prototype_unqualified", enqueued: 0 });
  } catch (error) {
    const tuple = getSingleRunTupleDiagnostic(error);
    const diagnostic = { stage, code: failureCode(error), ...(tuple ? { tuple } : {}) };
    if (automated) {
      console.error("[swell-watch-acquire] automated study failed", diagnostic);
      return createErrorResponse("Study failed", "Automated study cycle failed; retained receipts can be retried", 500);
    }
    console.error("[swell-watch-acquire] acquisition failed", diagnostic);
    return createErrorResponse("Producer failed", "Provider acquisition failed", 500);
  }
}

export const GET = withObservedCron("/api/cron/swell-watch-acquire", async (request: Request): Promise<Response> => {
  const response = await acquire(request);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
});
