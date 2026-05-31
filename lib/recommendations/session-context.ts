import { z } from 'zod';

export const RecommendationSessionContextSchema = z.object({
  sessionId: z.string().uuid(),
  recommendationId: z.string().min(1).max(160),
  sourceSurface: z.enum([
    'home_hero',
    'home_also_worth_it',
    'explore_for_you',
    'beach_detail',
    'surf_window_adjacent',
  ]),
  beachId: z.string().uuid(),
  beachName: z.string().max(160).nullable().optional(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  forecastAt: z.string().datetime().nullable().optional(),
  conditionScore: z.number().min(0).max(100),
  personalMatchScore: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(100),
  reasonType: z.string().min(1).max(80),
  recommendationState: z.enum([
    'ready_today',
    'future_fallback',
    'no_good_window',
  ]),
  rankingPosition: z.number().int().min(1).max(100),
  fallbackHorizonHours: z.number().int().min(1).max(168).nullable().optional(),
});

export type RecommendationSessionContextPayload = z.infer<
  typeof RecommendationSessionContextSchema
>;

export function toRecommendationSessionContextRow(
  payload: RecommendationSessionContextPayload,
  userId: string,
): Record<string, unknown> {
  return {
    user_id: userId,
    session_id: payload.sessionId,
    recommendation_id: payload.recommendationId,
    source_surface: payload.sourceSurface,
    beach_id: payload.beachId,
    beach_name: payload.beachName ?? null,
    window_start: payload.windowStart,
    window_end: payload.windowEnd,
    forecast_at: payload.forecastAt ?? null,
    condition_score: payload.conditionScore,
    personal_match_score: payload.personalMatchScore,
    overall_score: payload.overallScore,
    reason_type: payload.reasonType,
    recommendation_state: payload.recommendationState,
    ranking_position: payload.rankingPosition,
    fallback_horizon_hours: payload.fallbackHorizonHours ?? null,
  };
}
