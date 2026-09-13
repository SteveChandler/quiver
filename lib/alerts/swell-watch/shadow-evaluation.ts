import { ingestAttestedSwellWatchCohort } from "./provider-impact-ingestion";
import { loadMatchedSwellWatchHistory } from "./persisted-history";
import { loadSwellWatchAudience } from "./audience";
import { consolidateRegionalSwellEvents, consolidateSwellWatchRecipients } from "./regional-consolidator";
import { evaluateSwellWatchSafety } from "./safety-control";

interface ShadowEvaluation {
  providerBatchId: string;
  policyHash: string;
  evaluationIds: string[];
  status: "evaluated" | "suppressed";
  reason: string | null;
  suppressionReasons: Record<string, number>;
  candidateCount: number | null;
  stableRegionalEventCount: number | null;
  preSafetyRecipientsThisEvaluation: number | null;
  sendEligibility: "not_evaluated";
  projectedSendsRolling24Hours: null;
  deliveryHealth: null;
  recordedDemand: { observedAt: string; recipientEventPairs24Hours: number } | null;
  safety: ReturnType<typeof evaluateSwellWatchSafety> | null;
  enqueued: 0;
}

/** Local-only until evaluation-policy authority is separated from push authority in SQL.
 * Persists attested detection; counts pre-safety audience, never reserves or announces recipients. */
export async function evaluateSwellWatchShadow(
  input: Parameters<typeof ingestAttestedSwellWatchCohort>[0],
  client: Parameters<typeof ingestAttestedSwellWatchCohort>[1]
    & Parameters<typeof loadMatchedSwellWatchHistory>[1]
    & Parameters<typeof loadSwellWatchAudience>[0],
): Promise<ShadowEvaluation> {
  input = structuredClone(input);
  const result: ShadowEvaluation = {
    providerBatchId: input.providerBatchId, policyHash: input.policy.value_hash, evaluationIds: [],
    status: "suppressed", reason: null, suppressionReasons: {}, candidateCount: null, stableRegionalEventCount: null,
    preSafetyRecipientsThisEvaluation: null, sendEligibility: "not_evaluated",
    projectedSendsRolling24Hours: null, deliveryHealth: null, recordedDemand: null, safety: null, enqueued: 0,
  };
  const cohort = await ingestAttestedSwellWatchCohort(input, client);
  if (cohort.kind === "suppressed") return { ...result, reason: cohort.reason };
  const candidates: Array<Awaited<ReturnType<typeof loadMatchedSwellWatchHistory>> & {
    beachId: string; projectedImpact: number;
  }> = [];
  for (const [index, run] of cohort.runs.entries()) {
    const scope = input.scopes[index];
    for (const event of run.events) {
      const matched = await loadMatchedSwellWatchHistory({
        regionKey: scope.regionKey.trim(), beachId: scope.sourcePointId,
        regionalEventId: event.impact.regionalEventId, evaluationId: run.source.evaluationId, policy: input.policy,
      }, client);
      if (matched.regionalEvent.status !== "stable") {
        const reason = matched.regionalEvent.reason ?? "not_stable";
        result.suppressionReasons[reason] = (result.suppressionReasons[reason] ?? 0) + 1;
      }
      if (!Number.isFinite(event.impact.projectedFaceHeightFt) || event.impact.projectedFaceHeightFt < 0
        || (matched.regionalEvent.status === "stable" && (matched.confidence === null
          || !Number.isFinite(matched.confidence) || matched.confidence < 0 || matched.confidence > 1))) {
        throw new Error("Invalid shadow candidate");
      }
      candidates.push({ ...matched, beachId: scope.sourcePointId, projectedImpact: event.impact.projectedFaceHeightFt });
    }
  }
  const events = consolidateRegionalSwellEvents(candidates);
  const byKey = new Map(candidates.map((candidate) => [`${candidate.regionalEvent.regionalEventId}:${candidate.beachId}`, candidate]));
  if (byKey.size !== candidates.length) throw new Error("Duplicate shadow candidate");
  const audience = await loadSwellWatchAudience(client, events.flatMap((event) => event.beachIds));
  const recipients = consolidateSwellWatchRecipients(events.flatMap((event) => audience
    .filter((member) => event.beachIds.includes(member.beachId))
    .map((member) => {
      const candidate = byKey.get(`${event.regionalEventId}:${member.beachId}`)!;
      return { ...member, regionalEventId: event.regionalEventId,
        projectedImpact: candidate.projectedImpact, confidence: candidate.confidence! };
    })));
  const writer = client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown; error: unknown;
  }> };
  const recorded = await writer.rpc("record_swell_watch_shadow_demand", {
    p_provider_batch_id: input.providerBatchId, p_policy_hash: input.policy.value_hash,
    p_pairs: recipients.map((recipient) => ({ regional_event_id: recipient.regionalEventId, recipient_id: recipient.recipientUserId })),
  });
  const row = Array.isArray(recorded.data) && recorded.data.length === 1 ? recorded.data[0] : null;
  if (recorded.error || !row || typeof row.observed_at !== "string" || !Number.isFinite(Date.parse(row.observed_at))
    || !Number.isSafeInteger(row.recorded_pairs_24h) || row.recorded_pairs_24h < 0) {
    throw new Error("Shadow demand recording failed");
  }
  const recordedDemand = { observedAt: row.observed_at, recipientEventPairs24Hours: row.recorded_pairs_24h };
  const regionEvents = new Map<string, Set<string | null>>();
  for (const candidate of candidates) {
    if (candidate.regionalEvent.status === "suppressed") continue;
    const ids = regionEvents.get(candidate.regionalEvent.regionKey) ?? new Set();
    ids.add(candidate.regionalEvent.regionalEventId);
    regionEvents.set(candidate.regionalEvent.regionKey, ids);
  }
  const recipientCounts = new Map<string, number>();
  for (const recipient of recipients) recipientCounts.set(recipient.regionalEventId,
    (recipientCounts.get(recipient.regionalEventId) ?? 0) + 1);
  const reasons = result.suppressionReasons;
  const safety = evaluateSwellWatchSafety({ policy: input.policy,
    candidateCount: Math.max(0, ...[...regionEvents.values()].map((ids) => ids.size)),
    recipientCount: Math.max(0, ...recipientCounts.values()), projectedSendCount: null, providerFailures: null,
    hasDiscontinuousData: !!(reasons.continuity_broken || reasons.missing_immutable_issuance),
    hasMaterialDisagreement: !!(reasons.incoherent_evaluation || reasons.ambiguous_persisted_event), stale: false });
  return { ...result, status: "evaluated", evaluationIds: [...new Set(cohort.runs.map((run) => run.source.evaluationId))].sort(),
    candidateCount: candidates.length, stableRegionalEventCount: events.length,
    preSafetyRecipientsThisEvaluation: recipients.length, safety, recordedDemand };
}
