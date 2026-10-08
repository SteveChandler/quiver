import { z } from "zod";

export const RecommendationImpressionSurfaceSchema = z.enum([
  "home_hero",
  "home_top_spots",
  "home_nearby_spots",
  "discover_list",
  "explore_for_you",
  "session_intelligence",
]);

const RecommendationImpressionModeSchema = z.enum(["log"]);

const RecommendationImpressionTimeSlotSchema = z
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

const RecommendationImpressionInputSchema = z.object({
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

type RecommendationImpressionInput = z.infer<
  typeof RecommendationImpressionInputSchema
>;

export type RecommendationImpressionSurface = z.infer<
  typeof RecommendationImpressionSurfaceSchema
>;

function buildRecommendationImpressionKey(
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
