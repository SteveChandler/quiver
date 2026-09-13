import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { evaluateSwellWatchImpact, type SwellWatchImpactResult } from "./impact-evaluator";
import { normalizeSwellPartitions } from "./partition-normalizer";
import { deriveAttestedSwellWatchRun } from "./attested-run";
import { loadAttestedProviderRunScope } from "./provider-run-store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RpcResult = { data: unknown; error: { message: string } | null };
interface ImpactIngestionClient {
  from: SupabaseClient<Database>["from"];
  rpc: (name: "read_swell_watch_attested_components" | "resolve_and_ingest_swell_watch_evaluation", args: Record<string, string | number>) => Promise<RpcResult>;
}
interface ImpactIngestionInput {
  providerBatchId: string;
  sourcePointId: string;
  forecastAt: string;
  sourceSlot: "s1" | "s2";
  observationId: string;
  impactId: string;
  /** Compatibility only: allocation now belongs to the database. */
  regionalEventId?: string;
  regionKey: string;
  physicalKey: string;
  peakAt: string;
  impact: Omit<Parameters<typeof evaluateSwellWatchImpact>[0], "partition">;
}

function hashAttestedImpact(
  input: Pick<ImpactIngestionInput, "providerBatchId" | "sourcePointId" | "peakAt">,
  impact: Extract<SwellWatchImpactResult, { kind: "candidate" }>,
): string {
  return createHash("sha256").update(JSON.stringify({
    providerBatchId: input.providerBatchId, sourcePointId: input.sourcePointId, partition: impact.partition,
    projectedFaceHeightFt: impact.projectedFaceHeightFt, heightRiseFt: impact.heightRiseFt,
    energyRatio: impact.energyRatio, arrivalAt: impact.arrivalAt, peakAt: input.peakAt, policyHash: impact.policyHash,
  })).digest("hex");
}

/** Verified ingestion advances database event state atomically; it never enqueues. */
export async function ingestAttestedSwellWatchImpact(input: ImpactIngestionInput, client: ImpactIngestionClient): Promise<
  | (Extract<SwellWatchImpactResult, { kind: "candidate" }> & { regionalEventId: string; eventState: "candidate" | "stable" | "suppressed" })
  | Extract<SwellWatchImpactResult, { kind: "suppressed" }>
> {
  if (![input.providerBatchId,input.sourcePointId,input.observationId,input.impactId].every((id) => UUID.test(id))
    || !["s1","s2"].includes(input.sourceSlot) || !input.regionKey.trim() || !input.physicalKey.trim()
    || !Number.isFinite(Date.parse(input.forecastAt)) || !Number.isFinite(Date.parse(input.peakAt))
    || !Number.isFinite(Date.parse(input.impact.arrivalAt)) || !Number.isFinite(input.impact.now.getTime())
    || Date.parse(input.peakAt) < Date.parse(input.impact.arrivalAt)) throw new Error("Invalid attested impact input");
  input = { ...input, forecastAt: new Date(input.forecastAt).toISOString(), peakAt: new Date(input.peakAt).toISOString(),
    impact: { ...input.impact, arrivalAt: new Date(input.impact.arrivalAt).toISOString(), now: new Date(input.impact.now) } };
  const result = await client.rpc("read_swell_watch_attested_components", {
    p_provider_batch_id: input.providerBatchId, p_source_point_id: input.sourcePointId, p_forecast_at: input.forecastAt,
  });
  if (result.error) throw new Error(`Attested component read failed: ${result.error.message}`);
  if (!Array.isArray(result.data) || result.data.length > 2) throw new Error("Attested component scope is incomplete");
  if (result.data.length === 0) return { kind: "suppressed", reason: "incomplete_partition" };
  const rows = result.data as Record<string, unknown>[];
  if (rows.some((row) => !row || typeof row !== "object")
    || new Set(rows.map((row) => row.source_slot)).size !== rows.length
    || rows.some((row) => row.source_slot !== "s1" && row.source_slot !== "s2")
    || typeof rows[0].evaluation_id !== "string" || !rows[0].evaluation_id.startsWith("genuine_completed:")
    || !UUID.test(rows[0].evaluation_id.slice("genuine_completed:".length))
    || rows.some((row) => row.evaluation_id !== rows[0].evaluation_id)) throw new Error("Attested component identity is invalid");
  const normalized = normalizeSwellPartitions(rows.map((row) => ({
    provider: "open_meteo", evaluationId: row.evaluation_id as string, forecastAt: input.forecastAt,
    sourceSlot: row.source_slot as "s1" | "s2", heightM: row.height_m, periodS: row.period_s, directionDeg: row.direction_deg,
  })));
  if (normalized.kind === "suppressed") throw new Error(`Attested component normalization failed: ${normalized.reason}`);
  if (normalized.observations.length !== 2) return { kind: "suppressed", reason: "incomplete_partition" };
  const partition = normalized.observations.find((item) => item.sourceSlot === input.sourceSlot)!;
  const impact = evaluateSwellWatchImpact({ ...input.impact, partition });
  if (impact.kind === "suppressed") return impact;
  const impactHash = hashAttestedImpact(input, impact);
  const persisted = await client.rpc("resolve_and_ingest_swell_watch_evaluation", {
    p_provider_batch_id: input.providerBatchId, p_observation_id: input.observationId, p_impact_id: input.impactId,
    p_source_point_id: input.sourcePointId,
    p_region_key: input.regionKey, p_physical_key: input.physicalKey, p_forecast_at: input.forecastAt,
    p_source_slot: partition.sourceSlot, p_height_m: partition.heightM, p_period_s: partition.periodS,
    p_direction_deg: partition.directionDeg, p_projected_face_height_ft: impact.projectedFaceHeightFt,
    p_policy_id: impact.policyId, p_policy_hash: impact.policyHash, p_impact_hash: impactHash,
    p_arrival_at: impact.arrivalAt, p_peak_at: input.peakAt,
  });
  if (persisted.error) throw new Error(`Attested impact ingestion failed: ${persisted.error.message}`);
  const row = Array.isArray(persisted.data) ? persisted.data[0] as { regional_event_id?: unknown; event_state?: unknown } | null : null;
  if (!Array.isArray(persisted.data) || persisted.data.length !== 1 || typeof row?.regional_event_id !== "string" || !UUID.test(row.regional_event_id)
    || (row.event_state !== "candidate" && row.event_state !== "stable" && row.event_state !== "suppressed")) {
    throw new Error("Persisted event identity is missing or ambiguous");
  }
  return { ...impact, regionalEventId: row.regional_event_id, eventState: row.event_state };
}

type DerivedRun = Extract<Awaited<ReturnType<typeof deriveAttestedSwellWatchRun>>, { kind: "derived" }>;
type RunInput = Parameters<typeof deriveAttestedSwellWatchRun>[0] & { regionKey: string };
type IngestedRun = { kind: "ingested"; source: DerivedRun["source"]; events: Array<{
  arrivalAt: string; peakAt: string;
  impact: Extract<Awaited<ReturnType<typeof ingestAttestedSwellWatchImpact>>, { kind: "candidate" }>;
}> };
type RunClient = ImpactIngestionClient & Parameters<typeof deriveAttestedSwellWatchRun>[1] & {
  rpc: (name: "ingest_swell_watch_run" | "ingest_swell_watch_cohort",
    args: { p_impacts: Record<string, string | number>[] }) => Promise<RpcResult>;
};

function prepareImpacts(input: RunInput, derived: DerivedRun): Record<string, string | number>[] {
  return derived.events.map((event) => {
    const partition = event.impact.partition;
    const physicalKey = createHash("sha256").update(JSON.stringify([
      derived.source.evaluationId, input.sourcePointId, event.arrivalAt, event.peakAt, partition.sourceSlot,
    ])).digest("hex");
    return {
      p_provider_batch_id: input.providerBatchId, p_source_point_id: input.sourcePointId,
      p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_region_key: input.regionKey.trim(),
      p_physical_key: physicalKey, p_forecast_at: event.peakAt, p_source_slot: partition.sourceSlot,
      p_height_m: partition.heightM, p_period_s: partition.periodS, p_direction_deg: partition.directionDeg,
      p_projected_face_height_ft: event.impact.projectedFaceHeightFt, p_policy_id: event.impact.policyId,
      p_policy_hash: event.impact.policyHash, p_impact_hash: hashAttestedImpact({ ...input, peakAt: event.peakAt }, event.impact),
      p_arrival_at: event.arrivalAt, p_peak_at: event.peakAt,
    };
  });
}

async function persistRuns(
  prepared: Array<{ input: RunInput; derived: DerivedRun }>, client: RunClient,
  method: "ingest_swell_watch_run" | "ingest_swell_watch_cohort",
): Promise<IngestedRun[]> {
  const impacts = prepared.flatMap(({ input, derived }) => prepareImpacts(input, derived));
  if (impacts.length > 1000) throw new Error("Cohort exceeds atomic impact limit");
  const result = impacts.length ? await client.rpc(method, { p_impacts: impacts }) : { data: [], error: null };
  if (result.error) throw new Error(`Attested run ingestion failed: ${result.error.message}`);
  const rows = result.data;
  if (!Array.isArray(rows) || rows.length !== impacts.length || rows.some((row, index) =>
    !row || row.ordinal !== index || typeof row.regional_event_id !== "string" || !UUID.test(row.regional_event_id)
    || !["candidate", "stable", "suppressed"].includes(row.event_state))) {
    throw new Error("Attested run ingestion identities are missing or inconsistent");
  }
  let offset = 0;
  return prepared.map(({ derived }) => ({ kind: "ingested", source: derived.source,
    events: derived.events.map((event) => {
      const row = rows[offset++];
      return { arrivalAt: event.arrivalAt, peakAt: event.peakAt,
        impact: { ...event.impact, regionalEventId: row.regional_event_id, eventState: row.event_state } };
    }),
  }));
}

/** Retries reconcile at database uniqueness keys; no release or send occurs here. */
export async function ingestAttestedSwellWatchRun(
  input: RunInput, client: RunClient,
): Promise<{ kind: "suppressed"; reason: string } | IngestedRun> {
  input = structuredClone(input);
  if (!input.regionKey.trim() || input.regionKey.trim().length > 100) throw new Error("Invalid region key");
  const derived = await deriveAttestedSwellWatchRun(input, client);
  if (derived.kind === "suppressed") return derived;
  return (await persistRuns([{ input, derived }], client, "ingest_swell_watch_run"))[0];
}

/** Complete cohort preflight precedes one transaction across all beaches and regions. */
export async function ingestAttestedSwellWatchCohort(
  input: Omit<Parameters<typeof loadAttestedProviderRunScope>[0], "scopes"> & Pick<RunInput, "now" | "policy"> & {
    scopes: Array<Parameters<typeof loadAttestedProviderRunScope>[0]["scopes"][number] & Pick<RunInput, "regionKey" | "beach">>;
  },
  client: RunClient & Parameters<typeof loadAttestedProviderRunScope>[1],
): Promise<{ kind: "suppressed"; reason: string; sourcePointId: string } | { kind: "ingested"; runs: IngestedRun[] }> {
  input = structuredClone(input);
  if (input.scopes.some((scope) => !scope.regionKey.trim() || scope.regionKey.trim().length > 100)) {
    throw new Error("Invalid region key");
  }
  const coverage = await loadAttestedProviderRunScope(input, client);
  const prepared: Array<{ input: RunInput; derived: DerivedRun }> = [];
  for (const scope of input.scopes) {
    const runInput = { providerBatchId: input.providerBatchId, sourcePointId: scope.sourcePointId,
      now: input.now, policy: input.policy, regionKey: scope.regionKey, beach: scope.beach };
    const derived = await deriveAttestedSwellWatchRun(runInput, client);
    if (derived.kind === "suppressed") return { ...derived, sourcePointId: scope.sourcePointId };
    if (derived.source.evaluationId !== coverage.evaluationId || Date.parse(derived.source.issuedAt) !== Date.parse(coverage.issuedAt)) {
      throw new Error("Cohort evaluation identity changed");
    }
    prepared.push({ input: runInput, derived });
  }
  return { kind: "ingested", runs: await persistRuns(prepared, client, "ingest_swell_watch_cohort") };
}
