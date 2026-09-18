import { COMPLETE_PARTITIONS_RULE, type SwellWatchQualificationRule } from "@/lib/alerts/swell-watch/native-sampling";
import { withObservedCron } from "@/lib/cron/observability";
import { createErrorResponse, createSuccessResponse, validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { acquisitionConfig, acquireSwellWatchCohort, type SwellWatchAcquisitionStage } from "@/lib/alerts/swell-watch/acquisition";
import { completeSwellWatchStudyRun, readSwellWatchStudyStatus, recoverSwellWatchStudyRuns, studyConfig, SwellWatchStudySkip, type SwellWatchStudyStage } from "@/lib/alerts/swell-watch/study";
import { getSingleRunTupleDiagnostic } from "@/lib/alerts/swell-watch/single-run-receipt";
import { z } from "zod";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const CRON_MONITOR_STATUS = "x-cron-monitor-status";
const STUDY_STALL_MS = 18 * 60 * 60 * 1000;
const STUDY_EXPIRY_DRAIN_MS = 30 * 60 * 1000;

type OperationalStudyHealth = {
  policyHash?: string | null;
  expiresAt?: string | null;
  lastEvaluatedAt?: string | null;
  evaluatedRuns: number;
  suppressedAttempts: number;
  activationAt?: string | null;
};

function setMonitorStatus(response: Response, status: "ok" | "error"): Response {
  response.headers.set(CRON_MONITOR_STATUS, status);
  return response;
}

async function readOperationalStudyHealth(
  client: unknown,
  fallback: { status: string; qualificationRule: SwellWatchQualificationRule },
): Promise<OperationalStudyHealth & { status: string; qualificationRule: SwellWatchQualificationRule }> {
  const reader = client as { rpc?: (name: "read_swell_watch_study_health") => PromiseLike<{ data: unknown; error: unknown }> };
  if (typeof reader.rpc !== "function") return { ...fallback, evaluatedRuns: 0, suppressedAttempts: 0 };
  const result = await reader.rpc("read_swell_watch_study_health");
  if (result.error) throw new Error("Study health unavailable");
  const health = z.object({
    policyHash: z.string().nullable().optional(), expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    lastEvaluatedAt: z.string().datetime({ offset: true }).nullable().optional(),
    evaluatedRuns: z.number().int().nonnegative().default(0), suppressedAttempts: z.number().int().nonnegative().default(0),
    activationAt: z.string().datetime({ offset: true }).nullable().optional(),
  }).parse(result.data);
  return { ...fallback, ...health };
}

function stallReason(health: OperationalStudyHealth): "last_evaluated_at_stale" | "last_evaluated_at_missing" | null {
  const lastEvaluatedAt = health.lastEvaluatedAt ? Date.parse(health.lastEvaluatedAt) : Number.NaN;
  if (Number.isFinite(lastEvaluatedAt) && Date.now() - lastEvaluatedAt > STUDY_STALL_MS) return "last_evaluated_at_stale";
  if (health.lastEvaluatedAt !== null && health.lastEvaluatedAt !== undefined) return null;
  const activationAt = health.activationAt ? Date.parse(health.activationAt) : Number.NaN;
  if (Number.isFinite(activationAt) && Date.now() - activationAt <= STUDY_STALL_MS) return null;
  return health.suppressedAttempts + health.evaluatedRuns > 0 ? "last_evaluated_at_missing" : null;
}

// Emit only fixed labels: upstream messages can contain payloads, URLs, or credentials.
function failureCode(error: unknown): string {
  if (error instanceof z.ZodError) return "schema_validation_failed";
  if (!(error instanceof Error)) return "unknown";
  if (error.message.startsWith("Swell Watch history attestation failed:")) return "history_attestation_failed";
  if (error.message.startsWith("Swell Watch history differs from attested component")) return "history_component_mismatch";
  if (["Swell Watch history scope is inconsistent", "Swell Watch history state is inconsistent",
    "Swell Watch history is truncated or duplicated"].includes(error.message)) return "history_invalid";
  const fixed = new Map([
    ["Current evaluation is absent or superseded", "current_evaluation_absent_or_superseded"],
    ["Persisted matching identity changed", "persisted_matching_identity_changed"],
    ["Invalid shadow candidate", "invalid_shadow_candidate"],
    ["Duplicate shadow candidate", "duplicate_shadow_candidate"],
    ["Shadow demand recording failed", "shadow_demand_recording_failed"],
    ["Attested run ingestion identities are missing or inconsistent", "attested_run_ingestion_identities_are_missing_or_inconsistent"],
    ["Cohort exceeds atomic impact limit", "cohort_exceeds_atomic_impact_limit"],
  ]);
  const fixedCode = fixed.get(error.message);
  if (fixedCode) return fixedCode;
  if (error.message.startsWith("Attested run ingestion failed:")) return "attested_run_ingestion_failed";
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
  if (error.message === "provider budget exceeded") return "provider_budget_exceeded";
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
  let stage: "client" | "health" | "recovery" | "health_after_recovery" | "acquisition"
    | SwellWatchAcquisitionStage | SwellWatchStudyStage = "client";
  try {
    const client = createSupabaseServiceRoleClient();
    let qualificationRule: SwellWatchQualificationRule = COMPLETE_PARTITIONS_RULE;
    let recovery = { processed: 0, failed: 0 };
    let stalled = false;
    const respond = (response: Response, status: "ok" | "error" = "ok"): Response => setMonitorStatus(response, stalled ? "error" : status);
    if (automated) {
      stage = "health";
      const health = await readSwellWatchStudyStatus(client);
      const operationalHealth = await readOperationalStudyHealth(client, health);
      stalled = operationalHealth.status === "active" && stallReason(operationalHealth) !== null;
      if (stalled) console.error("[swell-watch-acquire] study stalled", { reason: stallReason(operationalHealth) });
      const { status } = health;
      qualificationRule = health.qualificationRule;
      if (status === "complete" || status === "expired") {
        return respond(createSuccessResponse({ skipped: true, reason: `study_${status}`, enqueued: 0 }));
      }
      if (status !== "active") return createErrorResponse("Study unavailable", "Study authority is not active", 503);
      if (operationalHealth.policyHash !== undefined && operationalHealth.policyHash !== studyConfig.parse(config).policy.value_hash) {
        return respond(createErrorResponse("Study unavailable", { code: "study_config_hash_mismatch", enqueued: 0 }, 503), "error");
      }
      const expiresAt = operationalHealth.expiresAt ? Date.parse(operationalHealth.expiresAt) : Number.NaN;
      if (Number.isFinite(expiresAt) && expiresAt - Date.now() <= STUDY_EXPIRY_DRAIN_MS) {
        return respond(createSuccessResponse({ skipped: true, reason: "study_expiring", enqueued: 0 }));
      }
      stage = "recovery";
      recovery = await recoverSwellWatchStudyRuns(studyConfig.parse(config), client, qualificationRule, (studyStage) => { stage = studyStage; });
      if (recovery.processed) {
        stage = "health_after_recovery";
        const afterRecovery = await readSwellWatchStudyStatus(client);
        if (afterRecovery.status === "complete" || afterRecovery.status === "expired") {
          return respond(createSuccessResponse({ skipped: true, reason: `study_${afterRecovery.status}`, recovery, enqueued: 0 }));
        }
        if (afterRecovery.status !== "active") return createErrorResponse("Study unavailable", "Study authority is not active", 503);
        qualificationRule = afterRecovery.qualificationRule;
        const afterRecoveryHealth = await readOperationalStudyHealth(client, afterRecovery);
        const afterRecoveryStall = afterRecoveryHealth.status === "active" && stallReason(afterRecoveryHealth);
        if (afterRecoveryStall && !stalled) {
          stalled = true;
          console.error("[swell-watch-acquire] study stalled", { reason: afterRecoveryStall });
        }
        const afterRecoveryExpiry = afterRecoveryHealth.expiresAt ? Date.parse(afterRecoveryHealth.expiresAt) : Number.NaN;
        if (Number.isFinite(afterRecoveryExpiry) && afterRecoveryExpiry - Date.now() <= STUDY_EXPIRY_DRAIN_MS) {
          return respond(createSuccessResponse({ skipped: true, reason: "study_expiring", recovery, enqueued: 0 }));
        }
      }
    }
    stage = "acquisition";
    const stored = await acquireSwellWatchCohort(config.cohort, client, (acquisitionStage) => { stage = acquisitionStage; });
    if (automated && !("skipped" in stored)) {
      stage = "study_completion";
      let study;
      try {
        study = await completeSwellWatchStudyRun(stored.revisionSetId, studyConfig.parse(config), client, qualificationRule, (studyStage) => { stage = studyStage; });
      } catch (error) {
        if (!(error instanceof SwellWatchStudySkip)) throw error;
        if (recovery.failed) return createErrorResponse("Study recovery incomplete", { recovery, enqueued: 0 }, 500);
        return respond(createSuccessResponse({ skipped: true, reason: error.reason, revisionSetId: stored.revisionSetId,
          issuanceId: stored.issuanceId, runBatchId: stored.runBatchId, recovery, qualification: "automated_study", enqueued: 0 }));
      }
      if (recovery.failed) return createErrorResponse("Study recovery incomplete", { recovery, study, enqueued: 0 }, 500);
      if ("status" in study && study.status === "suppressed") {
        // Recording a suppressed result is not a successful study cycle.
        return respond(createErrorResponse("Study suppressed", { ...stored, study, recovery, qualification: "automated_study", enqueued: 0 }, 503));
      }
      return respond(createSuccessResponse({ ...stored, study, recovery, qualification: "automated_study", enqueued: 0 }));
    }
    if (recovery.failed) return createErrorResponse("Study recovery incomplete", { recovery, enqueued: 0 }, 500);
    return respond(createSuccessResponse({ ...stored, qualification: "prototype_unqualified", enqueued: 0 }));
  } catch (error) {
    const tuple = getSingleRunTupleDiagnostic(error);
    const diagnostic = { stage, code: failureCode(error), ...(tuple ? { tuple } : {}) };
    if (automated) {
      console.error("[swell-watch-acquire] automated study failed", diagnostic);
      return setMonitorStatus(createErrorResponse("Study failed", { stage: diagnostic.stage, code: diagnostic.code, enqueued: 0 }, 500), "error");
    }
    console.error("[swell-watch-acquire] acquisition failed", diagnostic);
    return setMonitorStatus(createErrorResponse("Producer failed", { stage: diagnostic.stage, code: diagnostic.code, enqueued: 0 }, 500), "error");
  }
}

export const GET = withObservedCron("/api/cron/swell-watch-acquire", async (request: Request): Promise<Response> => {
  const response = await acquire(request);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
}, { slug: "swell-watch-acquire", schedule: "15 * * * *", maxRuntimeMinutes: 6 });
