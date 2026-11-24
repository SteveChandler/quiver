import {
  buildCanonicalSessionDecision,
  type CanonicalSessionDecision,
} from "@/lib/recommendations/canonical-decision";
import type { BoardClass } from "@/lib/domains/rideability";
import { getSkillLevelOrDefault, parseSkillLevel } from "@/lib/domains/user-preferences";
import type { RecommendationLabel } from "@/lib/scoring";
import type { BeachWithThresholds } from "@/lib/scoring/types";
import { resolveRecommendationLabel } from "@/lib/services/discovery/recommendation-label";
import { getRecommendationLabel } from "@/lib/services/discovery/response-formatter";
import {
  scoreWindowConditionDetails,
  scoreWindowConditionScore,
} from "@/lib/services/discovery/window-selector";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const HOUR_MS = 60 * 60 * 1000;

/** Pass the full beach row: the scorer applies decision effects only when it sees one. */
interface ForecastVerdictBeach extends BeachWithThresholds {
  id: string;
  name: string;
  skill_level: string | null;
}

export interface ForecastVerdict {
  forecast: EnhancedForecastEntity;
  score: number;
  verdict: "go" | "maybe" | "no";
  decision: CanonicalSessionDecision;
  /** Set only on the go-check path. */
  boardClass?: BoardClass | null;
}

interface ForecastGoCheckContext {
  boardClasses: readonly BoardClass[];
}

/** Rate a no-skill user as a beginner, score with their boards and gate the label for learners (D1, D1b, D3a, D3b). */
function scoreWithGoChecks(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  experienceLevel: string | null,
  goChecks: ForecastGoCheckContext,
): {
  score: number;
  recommendationLabel: RecommendationLabel;
  profileExperience: string;
  boardClass: BoardClass | null;
} {
  const skill = getSkillLevelOrDefault(parseSkillLevel(experienceLevel));
  const details = scoreWindowConditionDetails(forecast, beach, skill, null, goChecks.boardClasses);
  const { label } = resolveRecommendationLabel({
    beach,
    forecast,
    score: details.score,
    learner: { skill, boardClass: details.boardClass },
  });
  return {
    score: details.score,
    recommendationLabel: label,
    profileExperience: skill,
    boardClass: details.boardClass,
  };
}

/** The one go/maybe/no rule for a single forecast hour, shared by every push producer. */
export function evaluateForecastVerdict(args: {
  forecast: EnhancedForecastEntity;
  experienceLevel: string | null;
  timezone: string;
  now: Date;
  candidateIdPrefix: string;
} & (
  | { beach: ForecastVerdictBeach; goChecks?: undefined }
  | { beach: Beach; goChecks: ForecastGoCheckContext }
)): ForecastVerdict {
  const checked = args.goChecks
    ? scoreWithGoChecks(args.forecast, args.beach, args.experienceLevel, args.goChecks)
    : null;
  const { forecast, beach, timezone, now } = args;
  const score = checked
    ? checked.score
    : scoreWindowConditionScore(forecast, beach, args.experienceLevel);
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
    profileExperience: checked ? checked.profileExperience : args.experienceLevel,
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
      recommendationLabel: checked ? checked.recommendationLabel : getRecommendationLabel(score),
    }],
  });
  if (checked) {
    return { forecast, score, verdict: decision.verdict, decision, boardClass: checked.boardClass };
  }
  return { forecast, score, verdict: decision.verdict, decision };
}
