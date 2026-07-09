import { z } from "zod";

export const RecommendationImpressionSurfaceSchema = z.enum([
  "home_hero",
  "home_top_spots",
  "home_nearby_spots",
  "discover_list",
  "explore_for_you",
  "session_intelligence",
]);

export const RecommendationImpressionModeSchema = z.enum(["log"]);

export const RecommendationImpressionTimeSlotSchema = z
  .enum([
    "dawn-patrol",
    "morning",
    "late-morning",
    "lunch-session",
    "afternoon",
    "evening",
    "any",
  ])
  .nullable()
  .optional();

export const RecommendationImpressionInputSchema = z.object({
  recommendationId: z.string().min(1).max(200),
  beachId: z.string().uuid(),
  rank: z.number().int().min(1).max(100),
  score: z.number().min(0).max(100).nullable().optional(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  mode: RecommendationImpressionModeSchema.default("log"),
  timeSlot: RecommendationImpressionTimeSlotSchema,
  surface: RecommendationImpressionSurfaceSchema,
});

export const RecommendationImpressionsRequestSchema = z.object({
  impressions: z.array(RecommendationImpressionInputSchema).min(1).max(20),
});

export type RecommendationImpressionInput = z.infer<
  typeof RecommendationImpressionInputSchema
>;

export type RecommendationImpressionSurface = z.infer<
  typeof RecommendationImpressionSurfaceSchema
>;

export function buildRecommendationImpressionKey(
  userId: string,
  impression: Pick<
    RecommendationImpressionInput,
    "recommendationId" | "surface" | "windowStart"
  >
): string {
  return [
    userId,
    impression.recommendationId,
    impression.surface,
    new Date(impression.windowStart).toISOString(),
  ].join(":");
}

export function toRecommendationImpressionRow(
  userId: string,
  impression: RecommendationImpressionInput
): Record<string, unknown> {
  return {
    user_id: userId,
    recommendation_id: impression.recommendationId,
    beach_id: impression.beachId,
    rank: impression.rank,
    score: impression.score ?? null,
    window_start: impression.windowStart,
    window_end: impression.windowEnd,
    mode: impression.mode,
    time_slot: impression.timeSlot ?? null,
    surface: impression.surface,
    impression_key: buildRecommendationImpressionKey(userId, impression),
  };
}

export function toRecommendationImpressionEventRow(
  userId: string,
  impression: RecommendationImpressionInput
): Record<string, unknown> {
  return {
    user_id: userId,
    event_type: "recommendation_impression",
    beach_id: impression.beachId,
    metadata: {
      recommendation_id: impression.recommendationId,
      rank: impression.rank,
      score: impression.score ?? null,
      window_start: impression.windowStart,
      window_end: impression.windowEnd,
      mode: impression.mode,
      time_slot: impression.timeSlot ?? null,
      surface: impression.surface,
      impression_key: buildRecommendationImpressionKey(userId, impression),
    },
  };
}
