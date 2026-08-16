export type SafetyCohort =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert"
  | "unknown";

export type MajorEventHoldMode = "off" | "shadow" | "enforce";

export const MAJOR_EVENT_HOLD_TRANSITIONS = [
  "activation",
  "extension",
  "replacement",
  "cancellation",
] as const;
export type MajorEventHoldTransition =
  (typeof MAJOR_EVENT_HOLD_TRANSITIONS)[number];

export const MAJOR_EVENT_HOLD_STATUSES = ["active", "cancelled"] as const;
export type MajorEventHoldStatus = (typeof MAJOR_EVENT_HOLD_STATUSES)[number];

export const MAJOR_EVENT_HOLD_EXPOSURE_CLASSES = [
  "fully_exposed",
  "partially_protected",
  "protected",
  "unknown",
] as const;
export type MajorEventHoldExposureClass =
  (typeof MAJOR_EVENT_HOLD_EXPOSURE_CLASSES)[number];

export const MAJOR_EVENT_HOLD_ACTIONS = [
  "suppress_positive",
  "protected_alternatives_only",
] as const;
export type MajorEventHoldAction = (typeof MAJOR_EVENT_HOLD_ACTIONS)[number];

export const MAJOR_EVENT_HOLD_TRIGGER_TYPES = [
  "automatic_official",
  "manual_operator",
] as const;
export type MajorEventHoldTriggerType =
  (typeof MAJOR_EVENT_HOLD_TRIGGER_TYPES)[number];

export const MAJOR_EVENT_HOLD_REASON_CODES = [
  "major_swell_manual_safety",
  "official_high_rip_current",
  "scope_correction",
  "event_expired",
  "operator_cancelled",
  "policy_rollback",
] as const;
export type MajorEventHoldReasonCode =
  (typeof MAJOR_EVENT_HOLD_REASON_CODES)[number];

export const MAJOR_EVENT_HOLD_AUTHORIZING_ACTORS = [
  "admin_api",
  "official_automation",
] as const;
export type MajorEventHoldAuthorizingActor =
  (typeof MAJOR_EVENT_HOLD_AUTHORIZING_ACTORS)[number];

export type RecommendationHoldReasonCode =
  | "major_event_hold"
  | "water_quality_hold"
  | "hold_state_unavailable";

export const RECOMMENDATION_HOLD_REASON_CODES = [
  "major_event_hold",
  "water_quality_hold",
  "hold_state_unavailable",
] as const satisfies readonly RecommendationHoldReasonCode[];

export function isRecommendationHoldReasonCode(
  value: unknown,
): value is RecommendationHoldReasonCode {
  return (
    typeof value === "string" &&
    (RECOMMENDATION_HOLD_REASON_CODES as readonly string[]).includes(value)
  );
}

export interface RecommendationAvailability {
  state: "available" | "none";
  reasonCode?: RecommendationHoldReasonCode;
  expiresAt?: string;
  holdEpoch: string;
  /** Server snapshot time used to reject delayed pre-hold responses. */
  resolutionAsOf?: string;
}

export interface MajorEventHoldCandidate {
  candidateId: string;
  beachId: string;
  startsAt: string;
  endsAt: string;
}

export interface MajorEventHoldEvaluation {
  outcome: "allow" | "explicit_none";
  reasonCode?: RecommendationHoldReasonCode;
  holdIds: string[];
  expiresAt?: string;
  holdEpoch: string;
}

export type MajorEventHoldProvenance =
  | {
      triggerType: "manual_operator";
      automaticPolicyVersion: null;
      authorizingOperatorRef: string;
      authorizingActor: "admin_api";
    }
  | {
      triggerType: "automatic_official";
      automaticPolicyVersion: "official-rip-high.v1";
      authorizingOperatorRef: null;
      authorizingActor: "official_automation";
    };

export type RegionalRecommendationHoldRecord = {
  recordId: string;
  holdId: string;
  version: number;
  transition: MajorEventHoldTransition;
  status: MajorEventHoldStatus;
  regionKeys: string[];
  scopeBeachIds: string[];
  scopeExposureClasses: MajorEventHoldExposureClass[];
  protectedAlternativeBeachIds: string[];
  eventReference: string | null;
  validFrom: string;
  validUntil: string;
  affectedCohorts: SafetyCohort[];
  action: MajorEventHoldAction;
  supportingEvidenceRefs: string[];
  reasonCode: MajorEventHoldReasonCode;
  effectiveAt: string;
  expiresAt: string;
  supersedesRecordId: string | null;
  idempotencyKey: string;
  payloadHash: string;
  requestId: string | null;
  createdAt: string;
} & MajorEventHoldProvenance;

export interface ResolvedMajorEventHold {
  recordId: string;
  holdId: string;
  version: number;
  status: MajorEventHoldStatus;
  scopeBeachIds: string[];
  validFrom: string;
  validUntil: string;
  affectedCohorts: SafetyCohort[];
  action: MajorEventHoldAction;
  expiresAt: string;
}

export type MajorEventHoldResolution =
  | { state: "resolved"; holds: ResolvedMajorEventHold[] }
  | { state: "unresolved"; holds: [] };

export type MajorEventHoldAuditEventType =
  | "would_block"
  | "blocked"
  | "resolution_unavailable";

export interface MajorEventHoldAuditEvent {
  event: MajorEventHoldAuditEventType;
  mode: Exclude<MajorEventHoldMode, "off">;
  candidateId: string | null;
  beachId: string | null;
  cohort: SafetyCohort;
  holdIds: string[];
  holdEpoch: string;
  reasonCode: RecommendationHoldReasonCode;
}

export type MajorEventHoldAuditSink = (
  event: MajorEventHoldAuditEvent,
) => void | Promise<void>;

export interface MajorEventHoldCandidateDecision {
  candidateId: string | null;
  evaluation: MajorEventHoldEvaluation;
  recommendationAvailability: RecommendationAvailability;
}
