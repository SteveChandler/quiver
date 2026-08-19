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
  const snapshotForecastId = match.conditions_snapshot.forecast_id;
  const forecastId =
    match.forecast_id ??
    (typeof snapshotForecastId === "string" && snapshotForecastId.length > 0
      ? snapshotForecastId
      : canonicalAlertCandidateId(match));

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
