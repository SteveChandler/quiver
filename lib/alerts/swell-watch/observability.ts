const STAGES = ["detection", "suppression", "transition", "consolidation", "audience", "enqueue", "hold", "error"] as const;
const REASONS = [
  "static_disabled", "missing_immutable_issuance", "unknown_provider", "incomplete_tuple", "contradictory_tuple",
  "invalid_provisional_policy", "incomplete_partition", "seam_discontinuous", "source_contradiction", "non_impactful",
  "low_significance", "not_actionable", "incoherent_evaluation", "continuity_broken", "insufficient_distinct_evaluations",
  "candidate_cap_exceeded", "recipient_cap_exceeded", "projected_send_cap_exceeded", "data_discontinuity",
  "material_disagreement", "forecast_stale", "provider_failure_rate", "invalid_hold_input", "authority_invalid",
  "control_unavailable", "control_not_armed", "authority_unavailable", "authority_revoked", "event_not_releasable",
  "recipient_not_eligible", "recipient_deduplicated", "ambiguous_persisted_event", "control_epoch_changed",
] as const;

type SwellWatchStage = (typeof STAGES)[number];
type SwellWatchReasonCode = (typeof REASONS)[number];
interface SwellWatchDiagnostics {
  stageCounts: Record<SwellWatchStage, number>;
  reasonCounts: Partial<Record<SwellWatchReasonCode, number>>;
  correlations: Array<{ evaluationId?: string; regionalEventId?: string }>;
}

type Observation = { count?: number; reasonCode?: SwellWatchReasonCode; evaluationId?: string | null; regionalEventId?: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVALUATION = /^(?:[a-f0-9]{64}|genuine_completed:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function validCount(value: number | undefined): number {
  const count = value ?? 1;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Swell Watch diagnostic count is invalid");
  return count;
}

function validReason(value: unknown): value is SwellWatchReasonCode {
  return typeof value === "string" && (REASONS as readonly string[]).includes(value);
}

function validStage(value: unknown): value is SwellWatchStage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

/** Aggregate-only boundary. The runtime accepts only finite counters and contract-bound IDs. */
export function createSwellWatchObservability(): { record: (stage: SwellWatchStage, observation?: Observation) => void; snapshot: () => SwellWatchDiagnostics } {
  const stageCounts = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<SwellWatchStage, number>;
  const reasonCounts: Partial<Record<SwellWatchReasonCode, number>> = {};
  const correlations: Array<{ evaluationId?: string; regionalEventId?: string }> = [];
  return {
    record(stage, observation = {}) {
      if (!validStage(stage)) throw new Error("Swell Watch diagnostic stage is invalid");
      const count = validCount(observation.count);
      if (observation.reasonCode !== undefined && !validReason(observation.reasonCode)) throw new Error("Swell Watch diagnostic reason is invalid");
      stageCounts[stage] = validCount(stageCounts[stage] + count);
      if (observation.reasonCode !== undefined) reasonCounts[observation.reasonCode] = (reasonCounts[observation.reasonCode] ?? 0) + 1;
      const evaluationId = EVALUATION.test(observation.evaluationId ?? "") ? observation.evaluationId ?? undefined : undefined;
      const regionalEventId = UUID.test(observation.regionalEventId ?? "") ? observation.regionalEventId ?? undefined : undefined;
      if ((evaluationId || regionalEventId) && correlations.length < 20) correlations.push({ ...(evaluationId ? { evaluationId } : {}), ...(regionalEventId ? { regionalEventId } : {}) });
    },
    snapshot: () => ({ stageCounts: { ...stageCounts }, reasonCounts: { ...reasonCounts }, correlations: correlations.map((item) => ({ ...item })) }),
  };
}
