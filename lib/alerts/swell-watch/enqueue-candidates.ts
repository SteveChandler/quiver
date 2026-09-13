import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { buildSwellWatchDedupeKey, parseSwellWatchNotificationPayload } from "@/lib/notifications/types/swell-watch-v2";
import { loadSwellWatchAudience } from "./audience";
import type { SwellWatchPolicy } from "./policy";
import { consolidateRegionalSwellEvents, consolidateSwellWatchRecipients, type RegionalBeachCandidate } from "./regional-consolidator";
import { createSupabaseSwellWatchSafetyStore, evaluateSwellWatchHolds, resolveSwellWatchControl } from "./safety-control";
import { ingestAttestedSwellWatchCohort } from "./provider-impact-ingestion";
import { loadMatchedSwellWatchHistory } from "./persisted-history";
import type { createSwellWatchObservability } from "./observability";

interface Candidate extends RegionalBeachCandidate {
  payload: unknown;
  projectedImpact: number;
  confidence: number | null;
}

interface EnqueueCandidatesInput {
  policy: SwellWatchPolicy;
  candidates: readonly Candidate[];
  signals: {
    hasDiscontinuousData: boolean;
    hasMaterialDisagreement: boolean;
    stale: boolean;
    providerFailures: { samples: number; failures: number };
    priorProjectedSendsInWindow: number;
  };
}

interface EnqueueCandidatesResult {
  enqueued: number;
  duplicates: number;
  stoppedReason: string | null;
}

export async function loadSwellWatchDeliveryHealth(
  policyHash: string,
  client: { rpc: (name: "read_swell_watch_delivery_health", args: { p_policy_hash: string }) => PromiseLike<{
    data: unknown; error: { message: string } | null;
  }> },
): Promise<Pick<EnqueueCandidatesInput["signals"], "providerFailures" | "priorProjectedSendsInWindow">> {
  if (!/^[a-f0-9]{64}$/.test(policyHash)) throw new Error("Invalid delivery policy hash");
  const result = await client.rpc("read_swell_watch_delivery_health", { p_policy_hash: policyHash });
  if (result.error) throw new Error(`Delivery health read failed: ${result.error.message}`);
  const row = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : null;
  if (!row || row.policy_hash !== policyHash || ![row.samples, row.failures, row.projected_sends]
    .every((value) => Number.isSafeInteger(value) && value >= 0) || row.failures > row.samples) {
    throw new Error("Delivery health is missing or inconsistent");
  }
  return { providerFailures: { samples: row.samples, failures: row.failures },
    priorProjectedSendsInWindow: row.projected_sends };
}

/** Candidates must come from persisted matching; the worker still revalidates all evidence. */
export async function enqueueSwellWatchCandidates(input: EnqueueCandidatesInput, client: SupabaseClient<Database>, diagnostics?: ReturnType<typeof createSwellWatchObservability>): Promise<EnqueueCandidatesResult> {
  const { policy, signals, candidates } = structuredClone(input);
  const result: EnqueueCandidatesResult = { enqueued: 0, duplicates: 0, stoppedReason: null };
  const store = createSupabaseSwellWatchSafetyStore(client);
  const control = await resolveSwellWatchControl({ policy, store });
  if (!control.allowed) {
    diagnostics?.record("hold", { reasonCode: control.reasonCode });
    return { ...result, stoppedReason: control.reasonCode };
  }
  if (![signals.hasDiscontinuousData, signals.hasMaterialDisagreement, signals.stale].every((value) => typeof value === "boolean")
    || !Number.isSafeInteger(signals.priorProjectedSendsInWindow) || signals.priorProjectedSendsInWindow < 0
    || !Number.isSafeInteger(signals.providerFailures.samples) || !Number.isSafeInteger(signals.providerFailures.failures)
    || signals.providerFailures.failures < 0 || signals.providerFailures.samples < signals.providerFailures.failures) throw new Error("Invalid Swell Watch producer signals");
  const normalized = candidates.map((candidate) => {
    const payload = parseSwellWatchNotificationPayload(candidate.payload);
    if (payload.kind !== "v2" || payload.beach_id !== candidate.beachId || payload.regional_event_id !== candidate.regionalEvent.regionalEventId
      || !Number.isFinite(candidate.projectedImpact) || candidate.projectedImpact < 0
      || (candidate.confidence === null ? candidate.regionalEvent.status === "stable"
        : !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1)) throw new Error("Invalid Swell Watch candidate");
    return { ...candidate, payload };
  });
  const byKey = new Map(normalized.map((candidate) => [`${candidate.payload.regional_event_id}:${candidate.beachId}`, candidate]));
  if (byKey.size !== normalized.length) throw new Error("Duplicate Swell Watch candidate");
  const events = consolidateRegionalSwellEvents(normalized);
  diagnostics?.record("consolidation", { count: events.length });
  const audience = await loadSwellWatchAudience(client, events.flatMap((event) => event.beachIds));
  const recipients = consolidateSwellWatchRecipients(events.flatMap((event) => audience
    .filter((member) => event.beachIds.includes(member.beachId))
    .map((member) => {
      const candidate = byKey.get(`${event.regionalEventId}:${member.beachId}`)!;
      return { ...member, regionalEventId: event.regionalEventId, projectedImpact: candidate.projectedImpact, confidence: candidate.confidence! };
    })));
  diagnostics?.record("audience", { count: recipients.length });
  const regionEvents = new Map<string, Set<string>>();
  const recipientCounts = new Map<string, number>();
  for (const candidate of normalized) {
    if (candidate.regionalEvent.status === "suppressed") continue;
    const region = candidate.regionalEvent.regionKey;
    const ids = regionEvents.get(region) ?? new Set<string>();
    ids.add(candidate.payload.regional_event_id);
    regionEvents.set(region, ids);
  }
  for (const recipient of recipients) recipientCounts.set(recipient.regionalEventId, (recipientCounts.get(recipient.regionalEventId) ?? 0) + 1);
  const hold = await evaluateSwellWatchHolds({
    policy, store, expectedEpoch: control.epoch!, idempotencyKey: randomUUID(),
    candidateCount: Math.max(0, ...[...regionEvents.values()].map((ids) => ids.size)), recipientCount: Math.max(0, ...recipientCounts.values()),
    projectedSendCount: signals.priorProjectedSendsInWindow + recipients.length, ...signals,
  });
  if (hold.held) {
    diagnostics?.record("hold", { reasonCode: hold.reasonCode ?? undefined });
    return { ...result, stoppedReason: hold.reasonCode };
  }
  for (const recipient of recipients) {
    const current = await resolveSwellWatchControl({ policy, store });
    if (!current.allowed || current.epoch !== control.epoch) {
      const stoppedReason = current.allowed ? "control_epoch_changed" : current.reasonCode;
      diagnostics?.record("hold", { reasonCode: stoppedReason });
      return { ...result, stoppedReason };
    }
    const candidate = byKey.get(`${recipient.regionalEventId}:${recipient.leadBeachId}`)!;
    const { kind: _kind, title: _title, body: _body, ...payload } = candidate.payload;
    const queued = await enqueueNotification({ type: "swell_watch", recipientUserId: recipient.recipientUserId, payload,
      swellWatchAuthority: { expectedEpoch: control.epoch!, policyHash: policy.value_hash },
      dedupeKey: buildSwellWatchDedupeKey(candidate.payload) }, client);
    if (queued.enqueued) {
      result.enqueued += 1;
      diagnostics?.record("enqueue", { regionalEventId: recipient.regionalEventId });
    }
    else if (queued.reason === "duplicate") result.duplicates += 1;
    else if (queued.reason === "safety_rejected") {
      diagnostics?.record("hold");
      return { ...result, stoppedReason: queued.message ?? "enqueue_rejected" };
    }
    else throw new Error(`Swell Watch enqueue failed: ${queued.reason}`);
  }
  return result;
}

/** Frozen cohort -> persisted matching -> guarded queue. Does not acquire, arm or deliver. */
export async function enqueueAttestedSwellWatchCohort(
  input: Parameters<typeof ingestAttestedSwellWatchCohort>[0] & {
    scopes: Array<Parameters<typeof ingestAttestedSwellWatchCohort>[0]["scopes"][number] & {
      slug?: string | null; timezone?: string | null;
    }>;
  },
  client: SupabaseClient<Database> & Parameters<typeof ingestAttestedSwellWatchCohort>[1],
  diagnostics?: ReturnType<typeof createSwellWatchObservability>,
): Promise<EnqueueCandidatesResult> {
  input = structuredClone(input);
  const cohort = await ingestAttestedSwellWatchCohort(input, client);
  if (cohort.kind === "ingested") {
    for (const run of cohort.runs) {
      if (!run.events.length) diagnostics?.record("detection", { count: 0, evaluationId: run.source.evaluationId });
      for (const event of run.events) diagnostics?.record("detection", {
        evaluationId: run.source.evaluationId, regionalEventId: event.impact.regionalEventId });
    }
  } else diagnostics?.record("suppression");
  const control = await resolveSwellWatchControl({ policy: input.policy, store: createSupabaseSwellWatchSafetyStore(client) });
  if (!control.allowed) {
    diagnostics?.record("hold", { reasonCode: control.reasonCode });
    return { enqueued: 0, duplicates: 0, stoppedReason: control.reasonCode };
  }
  const health = await loadSwellWatchDeliveryHealth(input.policy.value_hash, client);
  const candidates: Candidate[] = [];
  const signals = { ...health, hasDiscontinuousData: false, hasMaterialDisagreement: false, stale: false };
  if (cohort.kind === "suppressed") {
    signals.stale = cohort.reason === "stale_run";
    signals.hasMaterialDisagreement = cohort.reason === "ambiguous_partition_path";
    signals.hasDiscontinuousData = !signals.stale && !signals.hasMaterialDisagreement;
  } else {
    for (const [index, run] of cohort.runs.entries()) {
      const scope = input.scopes[index];
      for (const event of run.events) {
        const matched = await loadMatchedSwellWatchHistory({ regionKey: scope.regionKey.trim(), beachId: scope.sourcePointId,
          regionalEventId: event.impact.regionalEventId, evaluationId: run.source.evaluationId, policy: input.policy }, client);
        if (matched.regionalEvent.status !== "stable") diagnostics?.record("suppression", {
          reasonCode: matched.regionalEvent.reason, evaluationId: run.source.evaluationId,
          regionalEventId: event.impact.regionalEventId });
        signals.hasDiscontinuousData ||= matched.regionalEvent.reason === "continuity_broken"
          || matched.regionalEvent.reason === "missing_immutable_issuance";
        signals.hasMaterialDisagreement ||= matched.regionalEvent.reason === "incoherent_evaluation"
          || matched.regionalEvent.reason === "ambiguous_persisted_event";
        const part = event.impact.partition;
        candidates.push({ beachId: scope.sourcePointId, ...matched, projectedImpact: event.impact.projectedFaceHeightFt,
          payload: { type: "swell_watch", schema_version: "swell-watch-notification.v2",
            regional_event_id: event.impact.regionalEventId, beach_id: scope.sourcePointId,
            ...(scope.slug ? { beach_slug: scope.slug } : {}),
            ...(scope.timezone ? { copy_context: { beach_timezone: scope.timezone } } : {}),
            forecast_at: part.forecastAt, arrival_at: event.arrivalAt, peak_at: event.peakAt,
            target_partition: { height_m: part.heightM, period_s: part.periodS, direction_deg: part.directionDeg } } });
      }
    }
  }
  return enqueueSwellWatchCandidates({ policy: input.policy, candidates, signals }, client, diagnostics);
}
