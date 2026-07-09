import type {
  SurfDiscoveryRecommendation,
  TimeSlot,
} from "@/types/personalization";
import type {
  RecommendationImpressionInput,
  RecommendationImpressionSurface,
} from "./impressions";
import { RecommendationImpressionTimeSlotSchema } from "./impressions";

interface RecommendationAttributionInput {
  recommendation: SurfDiscoveryRecommendation;
  rank: number;
  surface: RecommendationImpressionSurface;
  timeSlot?: TimeSlot | string | null;
}

function normalizeImpressionTimeSlot(
  timeSlot: RecommendationAttributionInput["timeSlot"]
): RecommendationImpressionInput["timeSlot"] {
  const parsed = RecommendationImpressionTimeSlotSchema.safeParse(
    timeSlot ?? undefined
  );

  if (!parsed.success) {
    return undefined;
  }

  return parsed.data ?? undefined;
}

export function getRecommendationId(
  recommendation: SurfDiscoveryRecommendation
): string {
  if (recommendation.recommendationId) {
    return recommendation.recommendationId;
  }

  const forecastAt =
    recommendation.forecast.forecast_at ??
    recommendation.window.start.toISOString();
  const entityId =
    recommendation.kind === "custom_spot" && recommendation.customSpotId
      ? `custom:${recommendation.customSpotId}`
      : `beach:${recommendation.beach.id}`;

  return `${entityId}:${forecastAt}`;
}

export function buildRecommendationImpressionInput({
  recommendation,
  rank,
  surface,
  timeSlot,
}: RecommendationAttributionInput): RecommendationImpressionInput {
  return {
    recommendationId: getRecommendationId(recommendation),
    beachId: recommendation.beach.id,
    rank,
    score: recommendation.score,
    windowStart: recommendation.window.start.toISOString(),
    windowEnd: recommendation.window.end.toISOString(),
    mode: "log",
    timeSlot: normalizeImpressionTimeSlot(timeSlot),
    surface,
  };
}

export function buildRecommendationLogUrl({
  recommendation,
  rank,
  surface,
  timeSlot,
}: RecommendationAttributionInput): string {
  const params = new URLSearchParams({
    mode: "log",
    beach: recommendation.beach.id,
    beachName: recommendation.beach.name,
    startTime: recommendation.window.start.toISOString(),
    endTime: recommendation.window.end.toISOString(),
    recommendation_id: getRecommendationId(recommendation),
    recommendation_surface: surface,
    recommendation_rank: rank.toString(),
    recommendation_score: recommendation.score.toString(),
    recommendation_window_start: recommendation.window.start.toISOString(),
    recommendation_window_end: recommendation.window.end.toISOString(),
  });

  if (timeSlot) {
    params.set("recommendation_time_slot", String(timeSlot));
  }

  return `/sessions/new?${params.toString()}`;
}
