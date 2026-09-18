import { COMPLETE_PARTITIONS_RULE, MODEL_REPORTED_PARTITION_COUNT_RULE, MODEL_REPORTED_SWELL_SYSTEM_COUNT_RULE, RETAINED_UNAVAILABLE_SECONDARY_RULE, type SwellWatchQualificationRule } from "./native-sampling";
import { z } from "zod";
import { acquisitionConfig } from "./acquisition";
import { verifySwellWatchPolicy, type SwellWatchPolicy } from "./policy";
import { loadSwellWatchAcquisitionScope } from "./provider-run-store";
import { evaluateSwellWatchShadow } from "./shadow-evaluation";

export const studyConfig = acquisitionConfig.extend({
  cohort: acquisitionConfig.shape.cohort.length(10),
  policy: z.custom<SwellWatchPolicy>((value) => verifySwellWatchPolicy(value)
    && value.schema_version === "swell-watch-policy.v2"
    && value.policy_values.cadence.evaluation_interval_minutes === 60),
});

const completionResult = z.array(z.object({
  provider_batch_id: z.uuid(),
  evaluation_id: z.string().regex(/^genuine_completed:[0-9a-f-]{36}$/),
  already_evaluated: z.boolean(),
  authority_epoch: z.number().int().positive(),
  qualification_rule: z.enum([COMPLETE_PARTITIONS_RULE, RETAINED_UNAVAILABLE_SECONDARY_RULE, MODEL_REPORTED_PARTITION_COUNT_RULE, MODEL_REPORTED_SWELL_SYSTEM_COUNT_RULE]),
})).length(1);

export class SwellWatchStudySkip extends Error {
  constructor(readonly reason: "issuance_accepted_under_previous_epoch" | "latest_issuance_stale") {
    super(reason);
  }
}

export type SwellWatchStudyStage = "study_completion" | "study_evaluation" | "study_recording";

export async function readSwellWatchStudyStatus(
  client: Parameters<typeof loadSwellWatchAcquisitionScope>[1],
): Promise<{ status: "active" | "complete" | "expired" | "unconfigured" | "blocked"; qualificationRule: SwellWatchQualificationRule }> {
  const reader = client as unknown as {
    rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const result = await reader.rpc("read_swell_watch_study_health");
  if (result.error) throw new Error("Study health unavailable");
  return z.object({ status: z.enum(["active", "complete", "expired", "unconfigured", "blocked"]),
    qualificationRule: z.enum([COMPLETE_PARTITIONS_RULE, RETAINED_UNAVAILABLE_SECONDARY_RULE, MODEL_REPORTED_PARTITION_COUNT_RULE, MODEL_REPORTED_SWELL_SYSTEM_COUNT_RULE]).default(COMPLETE_PARTITIONS_RULE),
  }).parse(result.data);
}

export async function recoverSwellWatchStudyRuns(
  config: z.infer<typeof studyConfig>,
  client: Parameters<typeof loadSwellWatchAcquisitionScope>[1],
  qualificationRule: SwellWatchQualificationRule,
  onStage?: (stage: SwellWatchStudyStage) => void,
): Promise<{ processed: number; failed: number }> {
  const reader = client as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const pending = await reader.rpc("read_swell_watch_study_pending_runs", { p_policy_hash: config.policy.value_hash });
  if (pending.error) throw new Error("Pending study runs unavailable");
  const runs = z.array(z.object({ revision_set_id: z.uuid() })).max(3).parse(pending.data);
  const result = { processed: 0, failed: 0 };
  for (const run of runs) {
    try {
      await completeSwellWatchStudyRun(run.revision_set_id, config, client, qualificationRule, onStage);
      result.processed += 1;
    } catch {
      await reader.rpc("record_swell_watch_study_recovery_failure", {
        p_revision_set_id: run.revision_set_id, p_code: "study_recovery_failed",
      });
      // Retained failures must not prevent collecting the next issuance.
      result.failed += 1;
    }
  }
  return result;
}

export async function completeSwellWatchStudyRun(
  revisionSetId: string,
  config: z.infer<typeof studyConfig>,
  client: Parameters<typeof loadSwellWatchAcquisitionScope>[1],
  qualificationRule: SwellWatchQualificationRule,
  onStage?: (stage: SwellWatchStudyStage) => void,
): Promise<Awaited<ReturnType<typeof evaluateSwellWatchShadow>>
  | { skipped: true; reason: "already_evaluated"; providerBatchId: string; enqueued: 0 }> {
  onStage?.("study_completion");
  config = studyConfig.parse(config);
  const scopes = await loadSwellWatchAcquisitionScope(config.cohort, client);
  const scopeInputs = scopes.map(({ sourcePointId, latitude, longitude, beach }) => ({
    sourcePointId, latitude, longitude, beach: {
      swell_window_center_deg: beach.swell_window_center_deg,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
      swell_access_factors: beach.swell_access_factors ?? null,
      terrain_enabled: beach.terrain_enabled ?? null,
      deepwater_decay_factor: beach.deepwater_decay_factor ?? null,
      shoaling_factors: beach.shoaling_factors ?? null,
    },
  })).sort((a, b) => a.sourcePointId.localeCompare(b.sourcePointId));
  const writer = client as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const completed = await writer.rpc("complete_swell_watch_study_run", {
    p_revision_set_id: z.uuid().parse(revisionSetId), p_policy_hash: config.policy.value_hash,
    p_cohort: [...config.cohort].sort((a, b) => a.sourcePointId.localeCompare(b.sourcePointId)),
    p_scope_inputs: scopeInputs,
  });
  if (completed.error) {
    const message = typeof completed.error === "object" && completed.error !== null && "message" in completed.error
      ? (completed.error as { message?: unknown }).message : null;
    if (message === "study acceptance belongs to a different authority epoch") {
      throw new SwellWatchStudySkip("issuance_accepted_under_previous_epoch");
    }
    if (message === "study run is stale") throw new SwellWatchStudySkip("latest_issuance_stale");
    throw new Error("Study completion failed");
  }
  const [batch] = completionResult.parse(completed.data);
  if (batch.already_evaluated) return { skipped: true, reason: "already_evaluated", providerBatchId: batch.provider_batch_id, enqueued: 0 };
  onStage?.("study_evaluation");
  const result = await evaluateSwellWatchShadow({ providerBatchId: batch.provider_batch_id,
    qualificationRule: batch.qualification_rule, forecastDays: 7, now: new Date().toISOString(), policy: config.policy, scopes },
  client as unknown as Parameters<typeof evaluateSwellWatchShadow>[1]);
  onStage?.("study_recording");
  const recorded = await writer.rpc("record_swell_watch_study_evaluation", {
    p_provider_batch_id: batch.provider_batch_id, p_policy_hash: config.policy.value_hash, p_result: result,
    p_scope_inputs: scopeInputs,
  });
  if (recorded.error || !z.object({ recorded: z.literal(true) }).safeParse(recorded.data).success) {
    throw new Error("Study outcome recording failed");
  }
  return result;
}
