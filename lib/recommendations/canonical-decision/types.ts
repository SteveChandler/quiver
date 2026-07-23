import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";

export const CANONICAL_SESSION_DECISION_SCHEMA_VERSION =
  "canonical-session-decision.v1" as const;
export const CANONICAL_SESSION_DECISION_ENGINE_VERSION =
  "rules.v1" as const;

export type CanonicalDecisionVerdict = "go" | "consider" | "no";
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
  | "selected_consider"
  | "below_minimum_utility"
  | "no_candidates"
  | "unknown_skill"
  | "major_event_hold"
  | "hold_state_unavailable"
  | "beach_skill_exceeds_user"
  | "wave_height_exceeds_skill"
  | "missing_beach_skill"
  | "missing_wave_height"
  | "invalid_candidate";

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
}

export interface CanonicalSessionDecision {
  schemaVersion: typeof CANONICAL_SESSION_DECISION_SCHEMA_VERSION;
  engineVersion: typeof CANONICAL_SESSION_DECISION_ENGINE_VERSION;
  decisionId: string;
  createdAt: string;
  expiresAt: string;
  scope: CanonicalDecisionScope;
  verdict: CanonicalDecisionVerdict;
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
