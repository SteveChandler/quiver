import "server-only";

import { createHash } from "node:crypto";

import {
  parseSkillLevel,
  SKILL_WAVE_RANGES,
} from "@/lib/domains/user-preferences/skill-level";
import { parseWaveHeightRangeFt } from "@/lib/alerts/forecast-parsers";
import { parseCanonicalSessionDecision } from "./contract";
import type {
  BuildCanonicalSessionDecisionInput,
  CanonicalDecisionCandidate,
  CanonicalDecisionReasonCode,
  CanonicalDecisionSelection,
  CanonicalDecisionSkill,
  CanonicalSessionDecision,
} from "./types";
import {
  CANONICAL_SESSION_DECISION_ENGINE_VERSION,
  CANONICAL_SESSION_DECISION_SCHEMA_VERSION,
} from "./types";

const DECISION_TTL_MS = 15 * 60 * 1000;
const GO_UTILITY_THRESHOLD = 70;
const CONSIDER_UTILITY_THRESHOLD = 40;
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
  if (skill === "unknown") return ["unknown_skill"];
  const reasons: CanonicalDecisionReasonCode[] = [];
  if (!isValidCandidate(candidate)) {
    reasons.push("invalid_candidate");
  }
  const beachSkill = parseSkillLevel(
    typeof candidate.beachSkillLevel === "string"
      ? candidate.beachSkillLevel
      : null,
  );
  if (beachSkill === null) {
    reasons.push("missing_beach_skill");
  } else if (SKILL_ORDER[beachSkill] > SKILL_ORDER[skill]) {
    reasons.push("beach_skill_exceeds_user");
  }
  const range = parseWaveHeightRangeFt(
    typeof candidate.waveHeight === "string" ? candidate.waveHeight : null,
  );
  if (range === null || range.min <= 0) {
    reasons.push("missing_wave_height");
  } else if (range.max > SKILL_WAVE_RANGES[skill].acceptable.max) {
    reasons.push("wave_height_exceeds_skill");
  }
  return reasons;
}

function verdictForCandidate(
  candidate: CanonicalDecisionCandidate,
): "go" | "consider" | "no" {
  if (candidate.recommendationLabel === "Skip") return "no";
  if (candidate.recommendationLabel === "Maybe") return "consider";
  if (candidate.recommendationLabel === "Worth it") return "go";
  if (candidate.utilityScore >= GO_UTILITY_THRESHOLD) return "go";
  if (candidate.utilityScore >= CONSIDER_UTILITY_THRESHOLD) return "consider";
  return "no";
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
        beachSkillLevel: parseSkillLevel(
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
  const candidateEvaluations = input.candidates.map((candidate) => ({
    candidate,
    reasons: candidateSafetyReasons(candidate, skill),
  }));
  const safeCandidates = candidateEvaluations
    .filter(({ reasons }) => reasons.length === 0)
    .map(({ candidate }) => candidate);
  const selected = safeCandidates
    .filter((candidate) => verdictForCandidate(candidate) !== "no")
    .sort(
      (left, right) =>
        right.utilityScore - left.utilityScore ||
        Date.parse(left.windowStart) - Date.parse(right.windowStart) ||
        left.candidateId.localeCompare(right.candidateId),
    )[0];
  const holdReason =
    input.recommendationAvailability.state === "none"
      ? input.recommendationAvailability.reasonCode ?? "hold_state_unavailable"
      : null;
  const verdict = holdReason
    ? "no"
    : selected
      ? verdictForCandidate(selected)
      : "no";
  const hasSelection =
    holdReason === null && selected !== undefined && verdict !== "no";
  const isUnknownSkill = skill === "unknown";
  const hasNoCandidates = input.candidates.length === 0;
  const safetyReasons = Array.from(
    new Set(candidateEvaluations.flatMap(({ reasons }) => reasons)),
  ).sort((left, right) => {
    const priority: CanonicalDecisionReasonCode[] = [
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
    !isUnknownSkill &&
    input.candidates.length > 0 &&
    safeCandidates.length === 0;

  let reasonCode: CanonicalDecisionReasonCode;
  if (holdReason !== null) {
    reasonCode = holdReason;
  } else if (isUnknownSkill) {
    reasonCode = "unknown_skill";
  } else if (hasNoCandidates) {
    reasonCode = "no_candidates";
  } else if (noSafeCandidate) {
    reasonCode = safetyReasons[0];
  } else if (verdict === "go") {
    reasonCode = "selected_go";
  } else if (verdict === "consider") {
    reasonCode = "selected_consider";
  } else {
    reasonCode = "below_minimum_utility";
  }

  let eligibilityState: CanonicalSessionDecision["skillEligibility"]["state"];
  if (
    isUnknownSkill ||
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
    reasonCode,
    selection: hasSelection ? selectionFor(selected, skill) : null,
    skillEligibility: {
      skill,
      state: eligibilityState,
      reasonCodes: isUnknownSkill
        ? ["unknown_skill"]
        : holdReason
          ? [holdReason]
        : hasNoCandidates
          ? ["no_candidates"]
        : noSafeCandidate
          ? safetyReasons
          : [],
    },
    holdEpoch: input.recommendationAvailability.holdEpoch,
  };

  return parseCanonicalSessionDecision(decision);
}
