import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";

export const CANONICAL_SESSION_DECISION_SCHEMA_VERSION =
  "canonical-session-decision.v1" as const;
export const CANONICAL_SESSION_DECISION_ENGINE_VERSION =
  "rules.v1" as const;

export type CanonicalDecisionVerdict = "go" | "maybe" | "no";
export type CanonicalDecisionBasis =
  | "personal_match"
  | "physical_fallback"
  | "safety_override";
export type CanonicalDecisionBasisV2 =
  | CanonicalDecisionBasis
  | "data_unavailable";
export type CanonicalMatchConfidence = "low" | "medium" | "high";
export type CanonicalDecisionSkill =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert"
  | "unknown";
export type CanonicalEligibilityState =
  | "eligible"
  | "ineligible"
  | "insufficient_safety_data";

export type CanonicalDecisionReasonCode =
  | "selected_go"
  | "selected_maybe"
  | "selected_no"
  | "below_minimum_utility"
  | "no_candidates"
  | "unknown_skill"
  | "major_event_hold"
  | "water_quality_hold"
  | "hold_state_unavailable"
  | "water_quality_closure"
  | "beach_skill_exceeds_user"
  | "wave_height_exceeds_skill"
  | "missing_beach_skill"
  | "missing_wave_height"
  | "invalid_candidate";

export interface CanonicalPersonalMatchEvidence {
  score: number;
  label: "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH";
  confidence: CanonicalMatchConfidence;
  sessionCount: number;
  reasons: string[];
}

export interface CanonicalDecisionScope {
  kind: "plan_next_session";
  windowStart: string;
  windowEnd: string;
  timezone: string;
}

export interface CanonicalDecisionCandidate {
  candidateId: string;
  beachId: string;
  beachName: string;
  beachSkillLevel: unknown;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  forecastId: string;
  forecastAt: string;
  waveHeight: unknown;
  utilityScore: number;
  recommendationLabel?: "Worth it" | "Maybe" | "Skip";
  personalMatch?: CanonicalPersonalMatchEvidence | null;
  safetyOverrideReasons?: CanonicalDecisionReasonCode[];
}

export interface CanonicalDecisionSelection {
  candidateId: string;
  beachId: string;
  beachName: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  forecastRef: {
    forecastId: string;
    beachId: string;
    forecastAt: string;
  };
  skillEligibility: {
    skill: CanonicalDecisionSkill;
    state: "eligible";
    reasonCodes: [];
  };
  evidence: {
    conditionScore: number;
    recommendationLabel: "Worth it" | "Maybe" | "Skip" | null;
    personalMatch: CanonicalPersonalMatchEvidence | null;
  };
}

export interface CanonicalSessionDecision {
  schemaVersion: typeof CANONICAL_SESSION_DECISION_SCHEMA_VERSION;
  engineVersion: typeof CANONICAL_SESSION_DECISION_ENGINE_VERSION;
  decisionId: string;
  createdAt: string;
  expiresAt: string;
  scope: CanonicalDecisionScope;
  verdict: CanonicalDecisionVerdict;
  decisionBasis: CanonicalDecisionBasis;
  /** Additive basis for clients that distinguish missing data from safety overrides. */
  decisionBasisV2?: CanonicalDecisionBasisV2;
  reasonCode: CanonicalDecisionReasonCode;
  selection: CanonicalDecisionSelection | null;
  skillEligibility: {
    skill: CanonicalDecisionSkill;
    state: CanonicalEligibilityState;
    reasonCodes: CanonicalDecisionReasonCode[];
  };
  holdEpoch: string;
}

export interface BuildCanonicalSessionDecisionInput {
  anchorTime: string;
  scope: CanonicalDecisionScope;
  profileExperience: unknown;
  recommendationAvailability: RecommendationAvailability;
  candidates: readonly CanonicalDecisionCandidate[];
}
