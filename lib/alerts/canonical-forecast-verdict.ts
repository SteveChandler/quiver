import {
  buildCanonicalSessionDecision,
  type CanonicalSessionDecision,
} from "@/lib/recommendations/canonical-decision";
import type { BeachWithThresholds } from "@/lib/scoring/types";
import { getRecommendationLabel } from "@/lib/services/discovery/response-formatter";
import { scoreWindowConditionScore } from "@/lib/services/discovery/window-selector";
import type { EnhancedForecastEntity } from "@/types/forecast";

const HOUR_MS = 60 * 60 * 1000;

/** Pass the full beach row: the scorer applies decision effects only when it sees one. */
export interface ForecastVerdictBeach extends BeachWithThresholds {
  id: string;
  name: string;
  skill_level: string | null;
}

export interface ForecastVerdict {
  forecast: EnhancedForecastEntity;
  score: number;
  verdict: "go" | "maybe" | "no";
  decision: CanonicalSessionDecision;
}

/** The one go/maybe/no rule for a single forecast hour, shared by every push producer. */
export function evaluateForecastVerdict(args: {
  forecast: EnhancedForecastEntity;
  beach: ForecastVerdictBeach;
  experienceLevel: string | null;
  timezone: string;
  now: Date;
  candidateIdPrefix: string;
}): ForecastVerdict {
  const { forecast, beach, timezone, now } = args;
  const score = scoreWindowConditionScore(forecast, beach, args.experienceLevel);
  const start = new Date(forecast.forecast_at);
  const end = new Date(start.getTime() + HOUR_MS);
  const decision = buildCanonicalSessionDecision({
    anchorTime: now.toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      timezone,
    },
    profileExperience: args.experienceLevel,
    recommendationAvailability: {
      state: "available",
      holdEpoch: args.candidateIdPrefix,
      resolutionAsOf: now.toISOString(),
    },
    candidates: [{
      candidateId: `${args.candidateIdPrefix}:${beach.id}:${forecast.forecast_at}`,
      beachId: beach.id,
      beachName: beach.name,
      beachSkillLevel: beach.skill_level,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      timezone,
      forecastId: forecast.id,
      forecastAt: forecast.forecast_at,
      waveHeight: forecast.wave_height,
      utilityScore: score,
      recommendationLabel: getRecommendationLabel(score),
    }],
  });
  return { forecast, score, verdict: decision.verdict, decision };
}
