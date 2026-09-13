import { createHash } from "node:crypto";
import { z } from "zod";
import { deriveSwellWatchHorizon } from "@/lib/alerts/swell-watch/horizon-derivation";
import { normalizeSwellPartitions, type SwellPartitionObservation } from "@/lib/alerts/swell-watch/partition-normalizer";
import { verifySwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const HOUR = 3_600_000;
const VERSION = "swell-watch-derivation-fixture.v1";
const timestamp = z.string().datetime({ offset: true });
const source = z.object({
  provider: z.enum(["noaa", "open_meteo"]), model: z.string().min(1).max(100),
  sourcePointId: z.string().min(1).max(100), issuedAt: timestamp,
}).strict();
const component = z.object({
  sourceSlot: z.enum(["s1", "s2"]), heightM: z.number().finite().nonnegative(),
  periodS: z.number().finite().positive(), directionDeg: z.number().finite().min(0).lt(360),
  fieldSources: z.object({ height: source, period: source, direction: source }).strict(),
}).strict();
const runSchema = z.object({
  source, forecastDays: z.number().int().min(6).max(7),
  samples: z.array(z.object({ forecastAt: timestamp, components: z.array(component).length(2) }).strict()).min(144).max(168),
}).strict();
const inputSchema = z.object({
  provenance: z.literal("synthetic_fixture"), now: timestamp, policy: z.unknown(),
  beach: z.object({ swell_window_center_deg: z.number().finite().min(0).lt(360),
    swell_window_halfwidth_deg: z.number().finite().positive().max(180) }).strict(),
  runs: z.tuple([runSchema, runSchema]),
}).strict();
type Run = z.infer<typeof runSchema>;
type Event = ReturnType<typeof deriveSwellWatchHorizon>["events"][number];
type Result = { kind: "suppressed"; reason: string } | {
  kind: "derived"; provenance: "synthetic_fixture"; productionApproved: false; qualifyingEvaluationCount: 0;
  derivationVersion: typeof VERSION; derivationPolicyHash: string; thresholdPolicyHash: string;
  baseline: { heightFt: number; energy: number }; events: Event[];
  evaluations: Array<{ issuedAt: string; baseline: { heightFt: number; energy: number }; events: Event[] }>;
};

function distance(left: number, right: number): number {
  const delta = Math.abs(left - right) % 360;
  return Math.min(delta, 360 - delta);
}

function sourceKey(value: Run["source"], includeRun = true): string {
  return JSON.stringify([value.provider, value.model, value.sourcePointId, includeRun ? Date.parse(value.issuedAt) : null]);
}

function frames(run: Run): SwellPartitionObservation[][] {
  const issued = Date.parse(run.source.issuedAt);
  if (issued % (6 * HOUR) !== 0 || run.samples.length !== run.forecastDays * 24) throw new Error("incomplete_horizon");
  const key = sourceKey(run.source);
  const evaluationId = `synthetic_fixture:${createHash("sha256").update(key).digest("hex")}`;
  return run.samples.map((sample, index) => {
    if (Date.parse(sample.forecastAt) !== issued + index * HOUR
      || new Set(sample.components.map((part) => part.sourceSlot)).size !== 2) throw new Error("incomplete_horizon");
    if (sample.components.some((part) => Object.values(part.fieldSources).some((field) => sourceKey(field) !== key))) {
      throw new Error("mixed_source_evidence");
    }
    const normalized = normalizeSwellPartitions(sample.components.map((part) => ({ ...part,
      provider: run.source.provider, evaluationId, forecastAt: new Date(sample.forecastAt).toISOString() })));
    if (normalized.kind === "suppressed") throw new Error("incomplete_partition");
    return normalized.observations.sort((left, right) => left.sourceSlot.localeCompare(right.sourceSlot));
  });
}

/** Offline fixture calculation only: does not attest, persist, enqueue, or access a provider. */
export function deriveSwellWatchFixture(value: unknown): Result {
  const parsed = inputSchema.safeParse(value);
  if (!parsed.success) return { kind: "suppressed", reason: "invalid_fixture_input" };
  const input = parsed.data;
  const policy = input.policy;
  if (!verifySwellWatchPolicy(policy) || policy.provenance !== "provisional_fixture" || policy.approval_evidence !== null) {
    return { kind: "suppressed", reason: "invalid_fixture_policy" };
  }
  const [prior, current] = input.runs;
  const now = Date.parse(input.now);
  if (Date.parse(prior.source.issuedAt) >= Date.parse(current.source.issuedAt) || Date.parse(current.source.issuedAt) > now
    || sourceKey(prior.source, false) !== sourceKey(current.source, false)) return { kind: "suppressed", reason: "invalid_run_sequence" };
  if ((now - Date.parse(current.source.issuedAt)) / HOUR > policy.policy_values.staleness.maximum_forecast_age_hours) {
    return { kind: "suppressed", reason: "stale_run" };
  }
  try {
    const previous = deriveSwellWatchHorizon({ series: frames(prior), now: input.now, beach: input.beach, policy });
    const latest = deriveSwellWatchHorizon({ series: frames(current), now: input.now, beach: input.beach, policy });
    const used = new Set<Event>();
    const tolerance = policy.policy_values.partition_matching;
    for (const event of latest.events) {
      const matches = previous.events.map((old) => ({ old, difference: Math.max(
        distance(old.impact.partition.directionDeg, event.impact.partition.directionDeg) / tolerance.maximum_direction_delta_deg,
        Math.abs(old.impact.partition.periodS - event.impact.partition.periodS) / tolerance.maximum_period_delta_s,
        Math.abs(Date.parse(old.arrivalAt) - Date.parse(event.arrivalAt)) / (HOUR * tolerance.maximum_arrival_delta_hours),
        Math.abs(Date.parse(old.peakAt) - Date.parse(event.peakAt)) / (HOUR * tolerance.maximum_arrival_delta_hours),
      ) })).filter((match) => match.difference <= 1);
      if (matches.length > 1 || (matches[0] && used.has(matches[0].old))) throw new Error("ambiguous_episode_match");
      if (matches[0]) {
        used.add(matches[0].old);
        event.confidence = 1 - matches[0].difference;
      }
    }
    const derivationPolicy = { version: VERSION, baselineHours: 48, baseline: "max_exposed_height_and_max_height_squared_period",
      arrival: "first_qualifying_slot", peak: "earliest_max_projected_slot_in_closed_episode",
      confidence: "one_minus_max_normalized_direction_period_arrival_peak_delta", unknownSource: "suppress",
      thresholdPolicyHash: policy.value_hash };
    return { kind: "derived", provenance: "synthetic_fixture", productionApproved: false, qualifyingEvaluationCount: 0,
      derivationVersion: VERSION, derivationPolicyHash: createHash("sha256").update(JSON.stringify(derivationPolicy)).digest("hex"),
      thresholdPolicyHash: policy.value_hash, ...latest,
      evaluations: [{ issuedAt: prior.source.issuedAt, ...previous }, { issuedAt: current.source.issuedAt, ...latest }] };
  } catch (error) {
    return { kind: "suppressed", reason: error instanceof Error ? error.message : "invalid_fixture_input" };
  }
}
