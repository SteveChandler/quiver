import "server-only";

import type { MatchingWindow } from "@/lib/alerts/types";
import { buildCanonicalSessionDecision } from "./engine";
import type {
  BuildCanonicalSessionDecisionInput,
  CanonicalDecisionCandidate,
  CanonicalSessionDecision,
} from "./types";

export type BuildCanonicalDecisionFromAlertMatchesInput = Omit<
  BuildCanonicalSessionDecisionInput,
  "candidates"
> & {
  matches: readonly MatchingWindow[];
};

export function canonicalAlertCandidateId(
  match: Pick<MatchingWindow, "rule_id" | "beach_id" | "window_start">,
): string {
  return `alert:${match.rule_id}:${match.beach_id}:${match.window_start}`;
}

function waveHeightForDecision(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value} ft`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
}

function candidateFromMatch(match: MatchingWindow): CanonicalDecisionCandidate {
  const forecastId =
    typeof match.conditions_snapshot.forecast_id === "string" &&
    match.conditions_snapshot.forecast_id.length > 0
      ? match.conditions_snapshot.forecast_id
      : `forecast:${match.beach_id}:${match.best_hour}`;

  return {
    candidateId: canonicalAlertCandidateId(match),
    beachId: match.beach_id,
    beachName: match.beach_name,
    beachSkillLevel: match.beach_skill_level,
    windowStart: match.window_start,
    windowEnd: match.window_end,
    timezone: match.beach_timezone,
    forecastId,
    forecastAt: match.best_hour,
    waveHeight: waveHeightForDecision(match.conditions_snapshot.wave_height),
    utilityScore:
      match.best_score >= 0 && match.best_score <= 1
        ? match.best_score * 100
        : match.best_score,
  };
}

export function buildCanonicalDecisionFromAlertMatches(
  input: BuildCanonicalDecisionFromAlertMatchesInput,
): CanonicalSessionDecision {
  return buildCanonicalSessionDecision({
    anchorTime: input.anchorTime,
    scope: input.scope,
    profileExperience: input.profileExperience,
    recommendationAvailability: input.recommendationAvailability,
    candidates: input.matches.map(candidateFromMatch),
  });
}
