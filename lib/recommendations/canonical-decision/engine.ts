import "server-only";

import { SCORE_THRESHOLDS } from "@/lib/utils/score-color-utils";
import { createHash } from "node:crypto";

import {
  parseBeachSkillRequirement,
  parseSkillLevel,
  SKILL_WAVE_RANGES,
} from "@/lib/domains/user-preferences/skill-level";
import { parseWaveHeightRangeFt } from "@/lib/alerts/forecast-parsers";
import { parseCanonicalSessionDecision } from "./contract";
import type {
  BuildCanonicalSessionDecisionInput,
  CanonicalDecisionCandidate,
  CanonicalDecisionBasis,
  CanonicalDecisionBasisV2,
  CanonicalDecisionReasonCode,
  CanonicalDecisionSelection,
  CanonicalDecisionSkill,
  CanonicalSessionDecision,
} from "./types";
import type { ScoringDecisionEffect } from "@/lib/domains/scoring/types";
import {
  CANONICAL_SESSION_DECISION_ENGINE_VERSION,
  CANONICAL_SESSION_DECISION_SCHEMA_VERSION,
} from "./types";

const DECISION_TTL_MS = 15 * 60 * 1000;
const GO_UTILITY_THRESHOLD = 70;
const CONSIDER_UTILITY_THRESHOLD = 40;
const VERDICT_RANK = { no: 0, maybe: 1, go: 2 } as const;
const SKILL_ORDER: Record<Exclude<CanonicalDecisionSkill, "unknown">, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

function isValidCandidate(candidate: CanonicalDecisionCandidate): boolean {
  const windowStart = Date.parse(candidate.windowStart);
  const windowEnd = Date.parse(candidate.windowEnd);
  const forecastAt = Date.parse(candidate.forecastAt);
  return (
    candidate.candidateId.length > 0 &&
    candidate.beachId.length > 0 &&
    candidate.beachName.length > 0 &&
    candidate.timezone.length > 0 &&
    candidate.forecastId.length > 0 &&
    Number.isFinite(windowStart) &&
    Number.isFinite(windowEnd) &&
    windowStart < windowEnd &&
    Number.isFinite(forecastAt) &&
    Number.isFinite(candidate.utilityScore)
  );
}

function candidateSafetyReasons(
  candidate: CanonicalDecisionCandidate,
  skill: CanonicalDecisionSkill,
): CanonicalDecisionReasonCode[] {
  const reasons: CanonicalDecisionReasonCode[] = [
    ...(candidate.safetyOverrideReasons ?? []),
  ];
  if (!isValidCandidate(candidate)) {
    reasons.push("invalid_candidate");
  }
  const beachSkill = parseBeachSkillRequirement(
    typeof candidate.beachSkillLevel === "string"
      ? candidate.beachSkillLevel
      : null,
  );
  if (beachSkill === null) {
    reasons.push("missing_beach_skill");
  } else if (
    skill !== "unknown" &&
    SKILL_ORDER[beachSkill] > SKILL_ORDER[skill]
  ) {
    reasons.push("beach_skill_exceeds_user");
  }
  const range = parseWaveHeightRangeFt(
    typeof candidate.waveHeight === "string" ? candidate.waveHeight : null,
  );
  if (range === null || range.min <= 0) {
    reasons.push("missing_wave_height");
  } else if (
    range.max >
    SKILL_WAVE_RANGES[
      skill === "unknown" ? "beginner" : skill
    ].acceptable.max
  ) {
    reasons.push("wave_height_exceeds_skill");
  }
  return reasons;
}

function physicalVerdictForCandidate(
  candidate: CanonicalDecisionCandidate,
): "go" | "maybe" | "no" {
  const baseVerdict = physicalVerdictWithoutCeiling(candidate);
  return applyVerdictCeiling(baseVerdict, verdictCeiling(candidate.effects));
}

function physicalVerdictWithoutCeiling(
  candidate: CanonicalDecisionCandidate,
): "go" | "maybe" | "no" {
  if (candidate.recommendationLabel === "Skip") return "no";
  if (candidate.recommendationLabel === "Maybe") return "maybe";
  if (candidate.recommendationLabel === "Worth it") return "go";
  if (candidate.utilityScore >= GO_UTILITY_THRESHOLD) return "go";
  if (candidate.utilityScore >= CONSIDER_UTILITY_THRESHOLD) return "maybe";
  return "no";
}

function applyVerdictCeiling(
  verdict: "go" | "maybe" | "no",
  ceiling: number,
): "go" | "maybe" | "no" {
  if (ceiling < 40) return "no";
  if (ceiling < 70 && verdict === "go") return "maybe";
  return verdict;
}

function verdictCeiling(effects: readonly ScoringDecisionEffect[] | undefined): number {
  return (effects ?? []).reduce(
    (current, effect) => Math.min(current, effect.verdictCeiling ?? 100),
    100,
  );
}

function personalMatchVerdict(candidate: CanonicalDecisionCandidate): "go" | "maybe" | "no" | null {
  const match = candidate.personalMatch;
  // Five comparable sessions with fit feedback uses the existing learning minimum.
  // High confidence additionally requires 25 profile sessions; absent evidence is neutral.
  if (!match || match.confidence !== "high" || match.sessionCount < 25 ||
      (match.similarSessionCount ?? 0) < 5) return null;
  if (match.label === "GOOD" || match.label === "EPIC") return "go";
  if (match.label === "MEH") return "no";
  return null;
}

/** True when the engine's own safety gates will veto this candidate. */
export function candidateHasSafetyVeto(
  candidate: CanonicalDecisionCandidate,
  profileExperience: unknown,
): boolean {
  return candidateSafetyReasons(candidate, canonicalSkill(profileExperience)).length > 0;
}

/** Physical conditions lead; personal evidence moves at most one tier. */
export function canonicalCandidateVerdict(
  candidate: CanonicalDecisionCandidate,
  profileExperience: unknown,
): "go" | "maybe" | "no" {
  const skill = canonicalSkill(profileExperience);
  if (candidateSafetyReasons(candidate, skill).length > 0) return "no";
  const physical = physicalVerdictForCandidate(candidate);
  const personal = skill === "unknown" ? null : personalMatchVerdict(candidate);
  if (personal === null) return physical;
  const delta = Math.sign(VERDICT_RANK[personal] - VERDICT_RANK[physical]);
  const adjusted = (["no", "maybe", "go"] as const)[VERDICT_RANK[physical] + delta];
  return applyVerdictCeiling(adjusted, verdictCeiling(candidate.effects));
}

export function conditionLabelForVerdict(verdict: "go" | "maybe" | "no", score: number): "EPIC" | "GOOD" | "FAIR" | "MEH" {
  if (verdict === "no") return "MEH";
  if (verdict === "maybe") return "FAIR";
  return score >= SCORE_THRESHOLDS.EPIC ? "EPIC" : "GOOD";
}

export function recommendationLabelForVerdict(
  verdict: "go" | "maybe" | "no",
): "Worth it" | "Maybe" | "Skip" {
  return verdict === "go" ? "Worth it" : verdict === "maybe" ? "Maybe" : "Skip";
}

function confidenceRank(
  candidate: CanonicalDecisionCandidate,
): number {
  const confidence = candidate.personalMatch?.confidence;
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return confidence === "low" ? 1 : 0;
}

function decisionId(input: BuildCanonicalSessionDecisionInput): string {
  const manifest = JSON.stringify({
    anchorTime: new Date(input.anchorTime).toISOString(),
    scope: {
      kind: input.scope.kind,
      windowStart: new Date(input.scope.windowStart).toISOString(),
      windowEnd: new Date(input.scope.windowEnd).toISOString(),
      timezone: input.scope.timezone,
    },
    skill: canonicalSkill(input.profileExperience),
    recommendationAvailability: {
      state: input.recommendationAvailability.state,
      reasonCode: input.recommendationAvailability.reasonCode ?? null,
      holdEpoch: input.recommendationAvailability.holdEpoch,
      resolutionAsOf: input.recommendationAvailability.resolutionAsOf ?? null,
      expiresAt: input.recommendationAvailability.expiresAt ?? null,
    },
    candidates: [...input.candidates]
      .map((candidate) => ({
        candidateId: candidate.candidateId,
        beachId: candidate.beachId,
        beachName: candidate.beachName,
        beachSkillLevel: parseBeachSkillRequirement(
          typeof candidate.beachSkillLevel === "string"
            ? candidate.beachSkillLevel
            : null,
        ),
        windowStart: candidate.windowStart,
        windowEnd: candidate.windowEnd,
        timezone: candidate.timezone,
        forecastId: candidate.forecastId,
        forecastAt: candidate.forecastAt,
        waveHeight:
          typeof candidate.waveHeight === "string"
            ? candidate.waveHeight.trim()
            : null,
        utilityScore: candidate.utilityScore,
        recommendationLabel: candidate.recommendationLabel ?? null,
        personalMatch: candidate.personalMatch ?? null,
        safetyOverrideReasons: candidate.safetyOverrideReasons ?? [],
        effects: candidate.effects ?? [],
      }))
      .sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
    engineVersion: CANONICAL_SESSION_DECISION_ENGINE_VERSION,
  });
  return createHash("sha256").update(manifest).digest("hex");
}

function canonicalSkill(value: unknown): CanonicalDecisionSkill {
  return parseSkillLevel(typeof value === "string" ? value : null) ?? "unknown";
}

function selectionFor(
  candidate: CanonicalDecisionCandidate,
  skill: CanonicalDecisionSkill,
  verdict: "go" | "maybe" | "no",
): CanonicalDecisionSelection {
  return {
    candidateId: candidate.candidateId,
    beachId: candidate.beachId,
    beachName: candidate.beachName,
    windowStart: candidate.windowStart,
    windowEnd: candidate.windowEnd,
    timezone: candidate.timezone,
    forecastRef: {
      forecastId: candidate.forecastId,
      beachId: candidate.beachId,
      forecastAt: candidate.forecastAt,
    },
    skillEligibility: {
      skill,
      state: "eligible",
      reasonCodes: [],
    },
    evidence: {
      conditionScore: Math.min(candidate.utilityScore, verdictCeiling(candidate.effects)),
      recommendationLabel:
        recommendationLabelForVerdict(verdict),
      personalMatch: skill === "unknown" ? null : candidate.personalMatch ?? null,
      effects: candidate.effects ?? [],
    },
  };
}

export function buildCanonicalSessionDecision(
  input: BuildCanonicalSessionDecisionInput,
): CanonicalSessionDecision {
  const anchor = new Date(input.anchorTime);
  const createdAt = anchor.toISOString();
  const scopeEnd = new Date(input.scope.windowEnd).getTime();
  const expiresAt = new Date(
    Math.min(anchor.getTime() + DECISION_TTL_MS, scopeEnd),
  ).toISOString();
  const skill = canonicalSkill(input.profileExperience);
  const isUnknownSkill = skill === "unknown";
  const candidateEvaluations = input.candidates.map((candidate) => ({
    candidate,
    reasons: candidateSafetyReasons(candidate, skill),
  }));
  const safeCandidates = candidateEvaluations
    .filter(({ reasons }) => reasons.length === 0)
    .map(({ candidate }) => candidate);
  const learnedCandidates = safeCandidates.filter(
    (candidate) => !isUnknownSkill && candidate.personalMatch != null,
  );
  const physicallyRecommendableCandidates = safeCandidates.filter(
    (candidate) => physicalVerdictForCandidate(candidate) !== "no",
  );
  const selected =
    learnedCandidates.length > 0
      ? [...learnedCandidates].sort(
          (left, right) =>
            (right.personalMatch?.score ?? -1) -
              (left.personalMatch?.score ?? -1) ||
            confidenceRank(right) - confidenceRank(left) ||
            right.utilityScore - left.utilityScore ||
            Date.parse(left.windowStart) - Date.parse(right.windowStart) ||
            left.candidateId.localeCompare(right.candidateId),
        )[0]
      : [
          ...(physicallyRecommendableCandidates.length > 0
            ? physicallyRecommendableCandidates
            : safeCandidates),
        ].sort(
          (left, right) =>
            right.utilityScore - left.utilityScore ||
            Date.parse(left.windowStart) - Date.parse(right.windowStart) ||
            left.candidateId.localeCompare(right.candidateId),
        )[0];
  const holdReason =
    input.recommendationAvailability.state === "none"
      ? input.recommendationAvailability.reasonCode ?? "hold_state_unavailable"
      : null;
  const hasNoCandidates = input.candidates.length === 0;
  const safetyReasons = Array.from(
    new Set(candidateEvaluations.flatMap(({ reasons }) => reasons)),
  ).sort((left, right) => {
    const priority: CanonicalDecisionReasonCode[] = [
      "water_quality_closure",
      "water_quality_hold",
      "hold_state_unavailable",
      "beach_skill_exceeds_user",
      "wave_height_exceeds_skill",
      "missing_beach_skill",
      "missing_wave_height",
      "invalid_candidate",
      "unknown_skill",
    ];
    return priority.indexOf(left) - priority.indexOf(right);
  });
  const noSafeCandidate =
    input.candidates.length > 0 &&
    safeCandidates.length === 0;
  const safetyOverride =
    holdReason !== null ||
    hasNoCandidates ||
    noSafeCandidate;
  const decisionBasis: CanonicalDecisionBasis = safetyOverride
    ? "safety_override"
    : learnedCandidates.length > 0
      ? "personal_match"
      : "physical_fallback";
  const decisionBasisV2: CanonicalDecisionBasisV2 = hasNoCandidates
    ? "data_unavailable"
    : decisionBasis;
  const verdict = safetyOverride
    ? "no"
    : selected
      ? canonicalCandidateVerdict(selected, input.profileExperience)
      : "no";
  const hasSelection = !safetyOverride && selected !== undefined;

  let reasonCode: CanonicalDecisionReasonCode;
  if (holdReason !== null) {
    reasonCode = holdReason;
  } else if (hasNoCandidates) {
    reasonCode = "no_candidates";
  } else if (noSafeCandidate) {
    reasonCode = safetyReasons[0];
  } else if (verdict === "go") {
    reasonCode = "selected_go";
  } else if (verdict === "maybe") {
    reasonCode = "selected_maybe";
  } else if (selected) {
    reasonCode = "selected_no";
  } else {
    reasonCode = "below_minimum_utility";
  }

  let eligibilityState: CanonicalSessionDecision["skillEligibility"]["state"];
  if (
    holdReason === "hold_state_unavailable" ||
    hasNoCandidates
  ) {
    eligibilityState = "insufficient_safety_data";
  } else if (holdReason === "major_event_hold") {
    eligibilityState = "ineligible";
  } else if (noSafeCandidate) {
    const isSafetyDataMissing = safetyReasons.some((reason) =>
      ["missing_beach_skill", "missing_wave_height", "invalid_candidate"].includes(
        reason,
      ),
    );
    eligibilityState = isSafetyDataMissing
      ? "insufficient_safety_data"
      : "ineligible";
  } else if (isUnknownSkill) {
    eligibilityState = "insufficient_safety_data";
  } else {
    eligibilityState = "eligible";
  }

  const decision: CanonicalSessionDecision = {
    schemaVersion: CANONICAL_SESSION_DECISION_SCHEMA_VERSION,
    engineVersion: CANONICAL_SESSION_DECISION_ENGINE_VERSION,
    decisionId: decisionId(input),
    createdAt,
    expiresAt,
    scope: input.scope,
    verdict,
    decisionBasis,
    decisionBasisV2,
    reasonCode,
    ...(selected && !safetyOverride && verdict !== physicalVerdictForCandidate(selected)
      ? { personalAdjustmentReason: VERDICT_RANK[verdict] > VERDICT_RANK[physicalVerdictForCandidate(selected)]
        ? "personal_adjusted_up" as const : "personal_adjusted_down" as const } : {}),
    conditionLabel: conditionLabelForVerdict(
      verdict,
      selected ? Math.min(selected.utilityScore, verdictCeiling(selected.effects)) : 0,
    ),
    selection: hasSelection
      ? selectionFor(selected, skill, verdict)
      : null,
    skillEligibility: {
      skill,
      state: eligibilityState,
      reasonCodes: holdReason
        ? [holdReason]
        : hasNoCandidates
          ? ["no_candidates"]
          : noSafeCandidate
            ? [
                ...safetyReasons,
                ...(isUnknownSkill
                  ? (["unknown_skill"] as CanonicalDecisionReasonCode[])
                  : []),
              ]
            : isUnknownSkill
              ? ["unknown_skill"]
              : [],
    },
    holdEpoch: input.recommendationAvailability.holdEpoch,
    effects: selected?.effects ?? [],
  };

  return parseCanonicalSessionDecision(decision);
}
