import {
  beachToSpotProfile,
  createDiscoveryScoringEngine,
  forecastToSnapshot,
  getConditionCharacter,
  type ConditionCharacterCategory,
} from "@/lib/domains/scoring";
import type { RecommendationLabel } from "@/lib/scoring";
import {
  getRecommendationLabel,
  getRecommendationLabelGated,
} from "@/lib/services/discovery/response-formatter";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

let discoveryScoringEngine: ReturnType<typeof createDiscoveryScoringEngine> | null = null;

export function getDiscoveryScoringEngine(): ReturnType<typeof createDiscoveryScoringEngine> {
  discoveryScoringEngine ??= createDiscoveryScoringEngine();
  return discoveryScoringEngine;
}

export function resolveRecommendationLabel({
  beach,
  forecast,
  score,
}: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  score: number;
}): {
  label: RecommendationLabel;
  character: { label: string; category: ConditionCharacterCategory } | undefined;
} {
  try {
    const profile = beachToSpotProfile(beach);
    const snapshot = forecastToSnapshot(forecast);
    const composite = getDiscoveryScoringEngine().score({
      profile,
      snapshot,
      window: null,
      preferences: null,
    });
    const character = getConditionCharacter(snapshot, profile, composite);
    return {
      label: getRecommendationLabelGated(score, character.category),
      // Only the two fields the recommendation contract exposes.
      character: { label: character.label, category: character.category },
    };
  } catch {
    return { label: getRecommendationLabel(score), character: undefined };
  }
}
