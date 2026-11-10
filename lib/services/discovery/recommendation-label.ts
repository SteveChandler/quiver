import {
  beachToSpotProfile,
  getDiscoveryScoringEngine,
  forecastToSnapshot,
  getConditionCharacter,
  getConditionCharacterDetails,
  type ConditionCharacterCategory,
} from "@/lib/domains/scoring";
import type { BoardClass } from "@/lib/domains/rideability";
import type { SkillLevel } from "@/lib/domains/user-preferences";
import type { RecommendationLabel } from "@/lib/scoring";
import {
  getRecommendationLabel,
  getRecommendationLabelGated,
} from "@/lib/services/discovery/response-formatter";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface LabelLearnerInput {
  skill: SkillLevel;
  boardClass: BoardClass | null;
}

export function resolveRecommendationLabel({
  beach,
  forecast,
  score,
  learner,
}: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  score: number;
  learner?: LabelLearnerInput;
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
    if (!learner) {
      const character = getConditionCharacter(snapshot, profile, composite);
      return {
        label: getRecommendationLabelGated(score, character.category),
        // Only the two fields the recommendation contract exposes.
        character: { label: character.label, category: character.category },
      };
    }
    const { character, smallWeakReason } = getConditionCharacterDetails(
      snapshot,
      profile,
      composite,
    );
    return {
      label: getRecommendationLabelGated(score, character.category, {
        ...learner,
        waveHeightFt: snapshot.waveHeight,
        wavePeriodS: snapshot.wavePeriod,
        smallWeakReason,
      }),
      character: { label: character.label, category: character.category },
    };
  } catch {
    return { label: getRecommendationLabel(score), character: undefined };
  }
}
