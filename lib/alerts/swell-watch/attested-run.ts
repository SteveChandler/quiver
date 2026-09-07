import { z } from "zod";
import { deriveSwellWatchHorizon } from "./horizon-derivation";
import { normalizeSwellPartitions } from "./partition-normalizer";
import { verifySwellWatchPolicy } from "./policy";

const instant = z.string().datetime({ offset: true });
const component = z.object({
  sourceSlot: z.enum(["s1", "s2"]), heightM: z.number().finite().nonnegative(),
  periodS: z.number().finite().nonnegative(), directionDeg: z.number().finite().min(0).lt(360),
  unavailableReason: z.literal("provider_zero_tuple").optional(),
  rawFieldProvenance: z.record(z.string(), z.unknown()), timeProvenance: z.record(z.string(), z.unknown()),
}).refine((value) => value.unavailableReason
  ? value.heightM === 0 && value.periodS === 0 && value.directionDeg === 0
  : value.periodS > 0);
const runSchema = z.object({
  source: z.object({ provider: z.literal("open_meteo"), transportProvider: z.literal("open_meteo_single_runs"),
    model: z.literal("ncep_gfswave016"), upstreamModelProvider: z.literal("ncep"), sourcePointId: z.uuid(),
    issuedAt: instant, issuanceId: z.uuid(), evaluationId: z.string().regex(/^genuine_completed:[0-9a-f-]{36}$/i),
    providerBatchId: z.uuid(), revisionSetId: z.uuid() }),
  forecastDays: z.number().int().min(1).max(7), selectedGrid: z.record(z.string(), z.unknown()),
  samples: z.array(z.object({ forecastAt: instant, components: z.array(component).length(2) })).min(24).max(168),
});

type AttestedSwellWatchRun = z.infer<typeof runSchema>;

/** Owner attestation is checked under the provider lock in the read transaction. */
export async function loadAttestedSwellWatchRun(
  input: { providerBatchId: string; sourcePointId: string },
  client: { rpc: (name: "read_swell_watch_attested_run", args: Record<string, string>) => PromiseLike<{
    data: unknown; error: { message: string } | null;
  }> },
): Promise<AttestedSwellWatchRun> {
  z.object({ providerBatchId: z.uuid(), sourcePointId: z.uuid() }).parse(input);
  const result = await client.rpc("read_swell_watch_attested_run", {
    p_provider_batch_id: input.providerBatchId, p_source_point_id: input.sourcePointId,
  });
  if (result.error) throw new Error(`Attested run read failed: ${result.error.message}`);
  const run = runSchema.parse(result.data);
  const issued = Date.parse(run.source.issuedAt);
  if (run.source.providerBatchId !== input.providerBatchId || run.source.sourcePointId !== input.sourcePointId
    || !z.uuid().safeParse(run.source.evaluationId.slice("genuine_completed:".length)).success
    || issued % (6 * 3_600_000) !== 0 || run.samples.length !== run.forecastDays * 24
    || run.samples.some((sample, index) => Date.parse(sample.forecastAt) !== issued + index * 3_600_000
      || sample.components[0].sourceSlot !== "s1" || sample.components[1].sourceSlot !== "s2")) {
    throw new Error("Attested run scope is inconsistent");
  }
  return run;
}

/** Calculation from an owner-attested read; ingestion must independently recheck that authority. */
export async function deriveAttestedSwellWatchRun(
  input: Parameters<typeof loadAttestedSwellWatchRun>[0] & {
    now: string;
    beach: Parameters<typeof deriveSwellWatchHorizon>[0]["beach"];
    policy: Parameters<typeof deriveSwellWatchHorizon>[0]["policy"];
  },
  client: Parameters<typeof loadAttestedSwellWatchRun>[1],
): Promise<
  | { kind: "suppressed"; reason: string }
  | ({ kind: "derived"; source: AttestedSwellWatchRun["source"]; thresholdPolicyHash: string }
    & ReturnType<typeof deriveSwellWatchHorizon>)
> {
  instant.parse(input.now);
  z.object({ swell_window_center_deg: z.number().finite().min(0).lt(360),
    swell_window_halfwidth_deg: z.number().finite().positive().max(180) }).parse(input.beach);
  if (!verifySwellWatchPolicy(input.policy)) throw new Error("Invalid derivation policy");
  const run = await loadAttestedSwellWatchRun(input, client);
  const age = (Date.parse(input.now) - Date.parse(run.source.issuedAt)) / 3_600_000;
  if (age < 0) return { kind: "suppressed", reason: "future_run" };
  if (age > input.policy.policy_values.staleness.maximum_forecast_age_hours) {
    return { kind: "suppressed", reason: "stale_run" };
  }
  if (run.samples.some((sample) => sample.components.some((part) => part.unavailableReason))) {
    return { kind: "suppressed", reason: "incomplete_partition" };
  }
  const series = run.samples.map((sample) => {
    const normalized = normalizeSwellPartitions(sample.components.map((part) => ({
      ...part, provider: run.source.provider, evaluationId: run.source.evaluationId,
      forecastAt: new Date(sample.forecastAt).toISOString(),
    })));
    if (normalized.kind !== "observations") throw new Error("Invalid attested partition");
    return normalized.observations;
  });
  try {
    return { kind: "derived", source: run.source, thresholdPolicyHash: input.policy.value_hash,
      ...deriveSwellWatchHorizon({ series, now: input.now, beach: input.beach, policy: input.policy }) };
  } catch (error) {
    return { kind: "suppressed", reason: error instanceof Error ? error.message : "invalid_horizon" };
  }
}
