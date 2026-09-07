import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.generated";
import { calculateSwellWatchConsistency, matchRegionalSwellEvent, type MatchedRegionalEvent, type RegionalSwellEvaluation } from "./event-matcher";
import { verifySwellWatchPolicy, type SwellWatchPolicy } from "./policy";

const instant = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const identity = z.string().regex(/^genuine_completed:[0-9a-f-]{36}$/i);
const transition = z.object({ state: z.enum(["candidate", "stable", "suppressed"]), version: z.number().int().positive(), created_at: instant });
const observation = z.object({ provider_batch_id: z.uuid(), source_point_id: z.uuid(), evaluation_id: identity,
  identity_kind: z.literal("genuine_completed"), provider: z.literal("open_meteo"), forecast_at: instant,
  source_slot: z.enum(["s1", "s2"]), height_m: z.number().finite().nonnegative(),
  period_s: z.number().finite().positive(), direction_deg: z.number().finite().min(0).lt(360) });
const rowSchema = z.object({ regional_event_id: z.uuid(), evaluation_id: identity, beach_id: z.uuid(),
  arrival_at: instant, peak_at: instant, evaluated_at: instant,
  swell_watch_regional_events: z.object({ region_key: z.string().min(1), latest_state: z.array(transition).max(1), last_suppression: z.array(transition).max(1) }),
  swell_watch_beach_impacts: z.object({ policy_hash: z.string().regex(/^[a-f0-9]{64}$/), swell_watch_observations: observation }),
});

interface HistoryClient {
  from: SupabaseClient<Database>["from"];
  rpc: (name: "read_swell_watch_attested_components", args: Record<string, string>) => PromiseLike<{
    data: unknown; error: { message: string } | null;
  }>;
}

export async function loadSwellWatchHistory(
  input: { regionKey: string; beachId: string },
  client: HistoryClient,
): Promise<Array<RegionalSwellEvaluation & { evaluatedAt: string; eventState: "candidate" | "stable" | "suppressed" }>> {
  z.object({ regionKey: z.string().min(1).max(100), beachId: z.uuid() }).parse(input);
  // ponytail: fail closed above 1,000 associations; add paginated snapshot reads if regions outgrow this bound.
  const result = await client.from("swell_watch_event_impacts")
    .select("regional_event_id,evaluation_id,beach_id,arrival_at,peak_at,evaluated_at,swell_watch_regional_events!inner(region_key,latest_state:swell_watch_event_state_transitions(state,version,created_at),last_suppression:swell_watch_event_state_transitions(state,version,created_at)),swell_watch_beach_impacts!swell_watch_event_impacts_beach_impact_id_fkey!inner(policy_hash,swell_watch_observations!inner(provider_batch_id,source_point_id,evaluation_id,identity_kind,provider,forecast_at,source_slot,height_m,period_s,direction_deg))", { count: "exact" })
    .eq("beach_id", input.beachId)
    .eq("swell_watch_regional_events.region_key", input.regionKey)
    .eq("swell_watch_regional_events.last_suppression.state", "suppressed")
    .order("version", { referencedTable: "swell_watch_regional_events.latest_state", ascending: false })
    .limit(1, { referencedTable: "swell_watch_regional_events.latest_state" })
    .order("created_at", { referencedTable: "swell_watch_regional_events.last_suppression", ascending: false })
    .limit(1, { referencedTable: "swell_watch_regional_events.last_suppression" })
    .order("evaluated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1001);
  if (result.error) throw new Error(`Swell Watch history read failed: ${result.error.message}`);
  const rows = z.array(rowSchema).max(1000).parse(result.data);
  if (result.count !== rows.length || new Set(rows.map((row) => `${row.regional_event_id}:${row.evaluation_id}`)).size !== rows.length) {
    throw new Error("Swell Watch history is truncated or duplicated");
  }
  const history: Awaited<ReturnType<typeof loadSwellWatchHistory>> = [];
  for (const row of rows) {
    const event = row.swell_watch_regional_events;
    const impact = row.swell_watch_beach_impacts;
    const partition = impact.swell_watch_observations;
    if (row.beach_id !== input.beachId || partition.source_point_id !== input.beachId || event.region_key !== input.regionKey
      || row.evaluation_id !== partition.evaluation_id || !z.uuid().safeParse(row.evaluation_id.slice("genuine_completed:".length)).success
      || Date.parse(row.peak_at) < Date.parse(row.arrival_at)) throw new Error("Swell Watch history scope is inconsistent");
    const latest = event.latest_state[0];
    const suppression = event.last_suppression[0];
    if (suppression && (suppression.state !== "suppressed" || !latest || suppression.version > latest.version)) throw new Error("Swell Watch history state is inconsistent");
    const suppressedAt = suppression ? Date.parse(suppression.created_at) : Number.NEGATIVE_INFINITY;
    if (Date.parse(row.evaluated_at) <= suppressedAt) continue;
    const attested = await client.rpc("read_swell_watch_attested_components", {
      p_provider_batch_id: partition.provider_batch_id, p_source_point_id: partition.source_point_id, p_forecast_at: partition.forecast_at,
    });
    if (attested.error) throw new Error(`Swell Watch history attestation failed: ${attested.error.message}`);
    const components = z.array(z.object({ evaluation_id: identity, source_slot: z.enum(["s1", "s2"]),
      height_m: z.number().finite().nonnegative(), period_s: z.number().finite().positive(), direction_deg: z.number().finite().min(0).lt(360) })).length(2).parse(attested.data);
    const matched = components.find((component) => component.source_slot === partition.source_slot);
    if (new Set(components.map((component) => component.source_slot)).size !== 2
      || components.some((component) => component.evaluation_id !== row.evaluation_id)
      || !matched || matched.height_m !== partition.height_m || matched.period_s !== partition.period_s || matched.direction_deg !== partition.direction_deg) {
      throw new Error("Swell Watch history differs from attested component");
    }
    history.push({ regionKey: event.region_key, persistedRegionalEventId: row.regional_event_id,
      evaluatedAt: row.evaluated_at, eventState: latest?.state ?? "candidate",
      identity: { kind: "genuine_completed", id: row.evaluation_id }, peakAt: row.peak_at,
      impact: { kind: "candidate", policyHash: impact.policy_hash, arrivalAt: row.arrival_at,
        partition: { provider: partition.provider, evaluationId: partition.evaluation_id, forecastAt: partition.forecast_at,
          sourceSlot: partition.source_slot, heightM: partition.height_m, periodS: partition.period_s,
          directionDeg: partition.direction_deg, completeness: "complete" } },
    });
  }
  return history;
}

/** Matching is advisory; atomic enqueue still checks the latest completed run frontier. */
export async function loadMatchedSwellWatchHistory(
  input: { regionKey: string; beachId: string; regionalEventId: string; evaluationId: string; policy: SwellWatchPolicy },
  client: HistoryClient,
): Promise<{ regionalEvent: MatchedRegionalEvent; confidence: number | null }> {
  input = structuredClone(input);
  z.object({ regionalEventId: z.uuid(), evaluationId: identity }).parse(input);
  if (!verifySwellWatchPolicy(input.policy)) throw new Error("Invalid matching policy");
  const history = (await loadSwellWatchHistory(input, client))
    .filter((item) => item.persistedRegionalEventId === input.regionalEventId);
  const current = history.at(-1);
  if (!current || current.identity.id !== input.evaluationId) throw new Error("Current evaluation is absent or superseded");
  const regionalEvent = matchRegionalSwellEvent(history, input.policy, {
    persistedEvents: history.map((reference) => ({ regionalEventId: input.regionalEventId,
      regionKey: input.regionKey, aliases: [], reference })),
    allocateId: () => { throw new Error("Persisted history cannot allocate an identity"); },
  });
  if (regionalEvent.regionalEventId !== input.regionalEventId) throw new Error("Persisted matching identity changed");
  if (current.eventState !== "stable") {
    return { regionalEvent: { ...regionalEvent,
      status: regionalEvent.status === "suppressed" ? "suppressed" : current.eventState }, confidence: null };
  }
  const prior = history.at(-2);
  return { regionalEvent, confidence: regionalEvent.status === "stable" && prior
    ? calculateSwellWatchConsistency(prior, current, input.policy) : null };
}
