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
})).length(1);

export async function readSwellWatchStudyStatus(
  client: Parameters<typeof loadSwellWatchAcquisitionScope>[1],
): Promise<"active" | "complete" | "expired" | "unconfigured" | "blocked"> {
  const reader = client as unknown as {
    rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const result = await reader.rpc("read_swell_watch_study_health");
  if (result.error) throw new Error("Study health unavailable");
  return z.object({ status: z.enum(["active", "complete", "expired", "unconfigured", "blocked"]) }).parse(result.data).status;
}

export async function recoverSwellWatchStudyRuns(
  config: z.infer<typeof studyConfig>,
  client: Parameters<typeof loadSwellWatchAcquisitionScope>[1],
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
      await completeSwellWatchStudyRun(run.revision_set_id, config, client);
      result.processed += 1;
    } catch {
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
): Promise<Awaited<ReturnType<typeof evaluateSwellWatchShadow>>
  | { skipped: true; reason: "already_evaluated"; providerBatchId: string; enqueued: 0 }> {
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
  if (completed.error) throw new Error("Study completion failed");
  const [batch] = completionResult.parse(completed.data);
  if (batch.already_evaluated) return { skipped: true, reason: "already_evaluated", providerBatchId: batch.provider_batch_id, enqueued: 0 };
  const result = await evaluateSwellWatchShadow({ providerBatchId: batch.provider_batch_id,
    forecastDays: 7, now: new Date().toISOString(), policy: config.policy, scopes },
  client as unknown as Parameters<typeof evaluateSwellWatchShadow>[1]);
  const recorded = await writer.rpc("record_swell_watch_study_evaluation", {
    p_provider_batch_id: batch.provider_batch_id, p_policy_hash: config.policy.value_hash, p_result: result,
    p_scope_inputs: scopeInputs,
  });
  if (recorded.error || !z.object({ recorded: z.literal(true) }).safeParse(recorded.data).success) {
    throw new Error("Study outcome recording failed");
  }
  return result;
}
