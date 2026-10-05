import { createHash } from "node:crypto";

export const SWELL_WATCH_POLICY_SCHEMA = "swell-watch-policy.v1" as const;

export type SwellWatchPolicyProvenance =
  | "provisional_fixture"
  | "pending_review"
  | "production_approved";

const TRAILING_BASELINE_SOURCE = "trailing_persisted_frames.v1" as const;
const PARTITION_RAMP_TIMING_SOURCE = "partition_ramp.v1" as const;

/** Absent blocks select the legacy forecast-front baseline and gate-frame timing. */
export interface SwellWatchDetectionPolicy {
  baseline?: {
    source: typeof TRAILING_BASELINE_SOURCE;
    trailing_hours: number;
    maximum_lead_hours: number;
    minimum_trailing_frames: number;
  };
  timing?: {
    source: typeof PARTITION_RAMP_TIMING_SOURCE;
    arrival_rise_fraction: number;
    actionability_basis: "ramp_arrival" | "gated_arrival";
  };
}

export interface SwellWatchPolicyValues {
  detection?: SwellWatchDetectionPolicy;
  local_significance: {
    minimum_height_rise_ft: number;
    minimum_energy_ratio: number;
  };
  local_impact: { minimum_impact_score: number };
  partition_matching: {
    maximum_direction_delta_deg: number;
    maximum_period_delta_s: number;
    maximum_arrival_delta_hours: number;
    trajectory_assignment?: "max-cardinality-minimax-normalized.v1";
  };
  missing_or_disagreement: {
    suppress_on_missing_partition: boolean;
    suppress_on_material_source_disagreement: boolean;
  };
  actionability: {
    minimum_days_before_arrival: number;
    maximum_days_before_arrival: number;
  };
  stability: { minimum_genuine_evaluations: number };
  volume_caps: {
    maximum_candidates_per_region: number;
    maximum_recipients_per_event: number;
    maximum_projected_sends_per_window: number;
    projected_send_window_hours?: 24;
  };
  provider_failure_hold: {
    window_minutes: number;
    maximum_failure_rate: number;
    minimum_samples: number;
  };
  staleness: { maximum_forecast_age_hours: number };
  cadence: { evaluation_interval_minutes: number };
}

export interface SwellWatchPolicy {
  schema_version: typeof SWELL_WATCH_POLICY_SCHEMA | "swell-watch-policy.v2";
  profile_id: string;
  provenance: SwellWatchPolicyProvenance;
  policy_values: SwellWatchPolicyValues;
  value_hash: string;
  approval_evidence: {
    approval_id: string;
    evidence_hash: string;
    reviewer: string;
    reviewed_at: string;
  } | null;
}

export interface ProductionPolicyAuthority {
  policy_hash: string;
  approval_id: string;
  approval_evidence_hash: string;
  production_scope?: string;
  reviewer?: string;
  not_before?: string;
  expires_at?: string;
  authority_epoch?: number;
  revoked_at?: string | null;
  superseded_at?: string | null;
  /** Legacy caller-owned field. It is deliberately ignored. */
  trusted_policy_hash?: string;
  /** Legacy caller-owned field. It is deliberately ignored. */
  armed?: boolean;
}

type ProductionAuthorityValidation =
  | { authorized: true }
  | { authorized: false; reason: string };

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isIntegerBetween(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function hasValidDetection(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const { baseline, timing, ...rest } = value;
  if (Object.keys(rest).length > 0) return false;
  if (baseline !== undefined) {
    if (!isRecord(baseline) || Object.keys(baseline).length !== 4 || baseline.source !== TRAILING_BASELINE_SOURCE
      || !isIntegerBetween(baseline.trailing_hours, 6, 72) || !isIntegerBetween(baseline.maximum_lead_hours, 1, 24)
      || !isIntegerBetween(baseline.minimum_trailing_frames, 1, baseline.trailing_hours as number)) return false;
  }
  if (timing !== undefined) {
    if (!isRecord(timing) || Object.keys(timing).length !== 3 || timing.source !== PARTITION_RAMP_TIMING_SOURCE
      || typeof timing.arrival_rise_fraction !== "number" || !(timing.arrival_rise_fraction > 0 && timing.arrival_rise_fraction < 1)
      || (timing.actionability_basis !== "ramp_arrival" && timing.actionability_basis !== "gated_arrival")) return false;
  }
  return true;
}

function hasValidPolicyValues(value: unknown): value is SwellWatchPolicyValues {
  if (!isRecord(value)) return false;
  const significance = value.local_significance;
  const impact = value.local_impact;
  const matching = value.partition_matching;
  const missing = value.missing_or_disagreement;
  const actionability = value.actionability;
  const stability = value.stability;
  const caps = value.volume_caps;
  const failureHold = value.provider_failure_hold;
  const staleness = value.staleness;
  const cadence = value.cadence;
  if (!hasValidDetection(value.detection)) return false;
  if (
    !isRecord(significance) ||
    !isRecord(impact) ||
    !isRecord(matching) ||
    !isRecord(missing) ||
    !isRecord(actionability) ||
    !isRecord(stability) ||
    !isRecord(caps) ||
    !isRecord(failureHold) ||
    !isRecord(staleness) ||
    !isRecord(cadence)
  ) {
    return false;
  }
  if (
    !isPositiveFinite(significance.minimum_height_rise_ft) ||
    !isPositiveFinite(significance.minimum_energy_ratio) ||
    !isPositiveFinite(impact.minimum_impact_score) ||
    !isPositiveFinite(matching.maximum_direction_delta_deg) ||
    !isPositiveFinite(matching.maximum_period_delta_s) ||
    !isPositiveFinite(matching.maximum_arrival_delta_hours) ||
    (matching.trajectory_assignment !== undefined && matching.trajectory_assignment !== "max-cardinality-minimax-normalized.v1") ||
    !isBoolean(missing.suppress_on_missing_partition) ||
    !isBoolean(missing.suppress_on_material_source_disagreement) ||
    !isPositiveFinite(actionability.minimum_days_before_arrival) ||
    !isPositiveFinite(actionability.maximum_days_before_arrival) ||
    actionability.minimum_days_before_arrival !== 2 ||
    actionability.maximum_days_before_arrival !== 5 ||
    typeof stability.minimum_genuine_evaluations !== "number" ||
    !Number.isInteger(stability.minimum_genuine_evaluations) ||
    stability.minimum_genuine_evaluations < 2 ||
    !isPositiveFinite(caps.maximum_candidates_per_region) ||
    !isPositiveFinite(caps.maximum_recipients_per_event) ||
    !isPositiveFinite(caps.maximum_projected_sends_per_window) ||
    !isPositiveFinite(failureHold.window_minutes) ||
    typeof failureHold.maximum_failure_rate !== "number" ||
    !Number.isFinite(failureHold.maximum_failure_rate) ||
    failureHold.maximum_failure_rate <= 0 ||
    failureHold.maximum_failure_rate > 1 ||
    typeof failureHold.minimum_samples !== "number" ||
    !Number.isInteger(failureHold.minimum_samples) ||
    failureHold.minimum_samples < 1 ||
    !isPositiveFinite(staleness.maximum_forecast_age_hours) ||
    !isPositiveFinite(cadence.evaluation_interval_minutes)
  ) {
    return false;
  }
  return true;
}

function isPolicy(value: unknown): value is SwellWatchPolicy {
  if (!isRecord(value)) return false;
  if (
    ![SWELL_WATCH_POLICY_SCHEMA, "swell-watch-policy.v2"].includes(value.schema_version as string) ||
    typeof value.profile_id !== "string" ||
    value.profile_id.length === 0 ||
    !["provisional_fixture", "pending_review", "production_approved"].includes(
      value.provenance as string,
    ) ||
    typeof value.value_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.value_hash) ||
    !hasValidPolicyValues(value.policy_values)
  ) {
    return false;
  }
  const windowHours = value.policy_values.volume_caps.projected_send_window_hours;
  if (value.schema_version === "swell-watch-policy.v2" ? windowHours !== 24 : windowHours !== undefined) return false;
  if (value.approval_evidence === null) return true;
  return (
    isRecord(value.approval_evidence) &&
    typeof value.approval_evidence.approval_id === "string" &&
    value.approval_evidence.approval_id.length > 0 &&
    typeof value.approval_evidence.evidence_hash === "string" &&
    /^[a-f0-9]{64}$/.test(value.approval_evidence.evidence_hash) &&
    typeof value.approval_evidence.reviewer === "string" &&
    value.approval_evidence.reviewer.length > 0 &&
    typeof value.approval_evidence.reviewed_at === "string" &&
    !Number.isNaN(Date.parse(value.approval_evidence.reviewed_at))
  );
}

function policyHashInput(
  policy: Omit<SwellWatchPolicy, "value_hash" | "approval_evidence">,
): string {
  return stableStringify({
    schema_version: policy.schema_version,
    profile_id: policy.profile_id,
    provenance: policy.provenance,
    policy_values: policy.policy_values,
  });
}

export function calculateSwellWatchPolicyHash(
  policy: Omit<SwellWatchPolicy, "value_hash" | "approval_evidence">,
): string {
  return createHash("sha256").update(policyHashInput(policy)).digest("hex");
}

export function verifySwellWatchPolicy(
  policy: unknown,
): policy is SwellWatchPolicy {
  return (
    isPolicy(policy) &&
    policy.value_hash === calculateSwellWatchPolicyHash(policy)
  );
}

export function validateProductionPolicyAuthority(
  policy: unknown,
  authority: ProductionPolicyAuthority | null | undefined,
  options: { scope?: string; now?: Date } = {},
): ProductionAuthorityValidation {
  if (!verifySwellWatchPolicy(policy))
    return { authorized: false, reason: "policy hash is invalid" };
  if (policy.provenance !== "production_approved") {
    return { authorized: false, reason: "policy is not production approved" };
  }
  if (!policy.approval_evidence || !authority) {
    return {
      authorized: false,
      reason:
        "independently trusted production approval is unavailable until Plan 06",
    };
  }
  if (
    authority.production_scope === undefined ||
    authority.reviewer === undefined ||
    authority.not_before === undefined ||
    authority.expires_at === undefined ||
    authority.authority_epoch === undefined
  ) {
    return {
      authorized: false,
      reason:
        "independently trusted production approval is unavailable until Plan 06",
    };
  }
  const now = options.now ?? new Date();
  const notBefore = Date.parse(authority.not_before ?? "");
  const expiresAt = Date.parse(authority.expires_at ?? "");
  const invalidTemporalAuthority =
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(notBefore) ||
    !Number.isFinite(expiresAt) ||
    notBefore > now.getTime() ||
    expiresAt <= now.getTime();
  if (invalidTemporalAuthority) {
    return { authorized: false, reason: "authority is not currently valid" };
  }
  if (authority.revoked_at || authority.superseded_at) {
    return { authorized: false, reason: "authority is revoked" };
  }
  if (
    authority.production_scope !== (options.scope ?? "swell_watch_push") ||
    authority.policy_hash !== policy.value_hash ||
    authority.approval_evidence_hash !== policy.approval_evidence.evidence_hash ||
    authority.approval_id !== policy.approval_evidence.approval_id ||
    authority.reviewer !== policy.approval_evidence.reviewer ||
    !Number.isInteger(authority.authority_epoch) ||
    (authority.authority_epoch ?? 0) < 1
  ) {
    return { authorized: false, reason: "authority does not bind this policy" };
  }
  if (policy.schema_version !== "swell-watch-policy.v2") {
    return { authorized: false, reason: "production policy requires the approved rolling 24-hour send window" };
  }
  return { authorized: true };
}
