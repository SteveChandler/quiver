/**
 * Similarity Layer — Pro Similarity Scoring for Discovery Ranking
 *
 * The physical condition score and learned personal match remain separate.
 * This layer attaches the learned match evidence; the canonical decision
 * engine owns window selection and verdict mapping.
 *
 * @module lib/services/discovery/similarity-layer
 */

import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createContextLogger } from "@/lib/logger";
import type {
  SimilarityRecommendation,
  SurfDiscoveryRecommendation,
} from "@/types/personalization";
import {
  isLearnedMatchState,
  isStarterMatchState,
} from "@/lib/personalization/match-state-compat";

const log = createContextLogger("SimilarityLayer");
interface ApplySimilarityLayerArgs {
  recommendations: SurfDiscoveryRecommendation[];
  userId: string | null;
  isPro: boolean;
  // Typed loosely — supabase-js client variants in this codebase use the
  // un-parametrized SupabaseClient (see lib/alerts/best-days.ts). Keeping
  // it loose avoids forcing a Database generic on every caller.
  supabase: Pick<SupabaseClient, "rpc">;
}

interface ApplySimilarityLayerResult {
  /** Same array length and shape as input, with `similarity` stamped. */
  recommendations: SurfDiscoveryRecommendation[];
}

/**
 * Build the jsonb p_slots payload for the bulk RPC from a single recommendation.
 * The RPC parses every field as text via parse_numeric_from_text, so stringify
 * numerics here. Mirrors the existing single-slot caller pattern in
 * lib/alerts/best-days.ts and app/api/cron/similarity-alerts/route.ts.
 */
/** The key a match RPC row is stored under: the same instant matches however it is spelled. */
export function matchSlotKey(beachId: string, forecastAt: string): string {
  return `${beachId}:${Date.parse(forecastAt)}`;
}

export function forecastToMatchSlot(
  forecast: EnhancedForecastEntity,
  fallbackForecastAt = "",
): Record<string, string> {
  return {
    forecast_at: forecast.forecast_at ?? fallbackForecastAt,
    wave_height: forecast.wave_height != null ? String(forecast.wave_height) : "",
    wave_period: forecast.wave_period != null ? String(forecast.wave_period).replace(/s$/i, "") : "",
    wind_speed: forecast.wind_speed != null ? String(forecast.wind_speed) : "",
    wind_direction: forecast.wind_direction_deg != null ? String(forecast.wind_direction_deg) : "",
    tide_height: forecast.tide_height != null ? String(forecast.tide_height) : "",
  };
}

/**
 * Translate a single slot's RPC `result` jsonb into a SimilarityRecommendation.
 * Tolerant to the three documented shapes plus a missing/malformed result.
 */
export function interpretRpcResult(
  result: Record<string, unknown> | null,
): SimilarityRecommendation {
  if (!result || typeof result !== "object") {
    return null;
  }

  const state = result.state;

  if (isStarterMatchState(typeof state === "string" ? state : undefined)) {
    const sessionCount =
      typeof result.session_count === "number" ? result.session_count : 0;
    const sessionsNeeded =
      typeof result.sessions_needed === "number" ? result.sessions_needed : 0;
    return { state: "onboarding", sessionCount, sessionsNeeded };
  }

  if (isLearnedMatchState(typeof state === "string" ? state : undefined)) {
    if (typeof result.score !== "number") {
      return null;
    }
    const score = result.score;
    const label =
      typeof result.label === "string"
        ? result.label.trim().toUpperCase()
        : "";
    const sessionCount =
      typeof result.sessions_in_profile === "number"
        ? result.sessions_in_profile
        : 0;

    // Pull first reason bullet for user-facing copy. Fall back to label when absent.
    const reasons = Array.isArray(result.reason_bullets)
      ? result.reason_bullets.filter(
          (reason): reason is string =>
            typeof reason === "string" && reason.length > 0,
        )
      : [];
    const reason = reasons[0] ?? label;
    const confidence =
      result.confidence === "high" || result.confidence === "medium"
        ? result.confidence
        : "low";

    return {
      state: "ready",
      score,
      label,
      bonusApplied: 0,
      confidence,
      reason,
      reasons,
      sessionCount,
      similarSessionCount: typeof result.similar_session_count === "number"
        ? result.similar_session_count : typeof result.fit_signal_sample_count === "number"
          ? result.fit_signal_sample_count : 0,
    };
  }

  // Unknown state — degrade gracefully to null.
  return null;
}

/**
 * Attach Pro similarity scoring to discovery window candidates.
 *
 * - Free users (or null userId): every rec gets `similarity: null`, no RPC.
 * - Pro users: one set-based RPC call with every beach and candidate slot.
 * - Recommendations missing `beach.id` are filtered before the bulk call but
 *   still receive `similarity: null` in the output (preserves array length).
 */
export async function applySimilarityLayer(
  args: ApplySimilarityLayerArgs,
): Promise<ApplySimilarityLayerResult> {
  const { recommendations, userId, isPro, supabase } = args;

  // Free path: stamp null on every rec, return early. No RPC.
  if (!isPro || !userId || recommendations.length === 0) {
    return {
      recommendations: recommendations.map((rec) => ({
        ...rec,
        similarity: null,
      })),
    };
  }

  const valid = recommendations.filter((rec) => rec.beach?.id && Number.isFinite(Date.parse(rec.forecast?.forecast_at)));
  if (!valid.length) return { recommendations: recommendations.map((rec) => ({ ...rec, similarity: null })) };
  const similarityByIndex: SimilarityRecommendation[] = recommendations.map(() => null);
  try {
    const { data, error } = await supabase.rpc("get_week_scout_personalization", {
      p_user_id: userId,
      p_beach_ids: [...new Set(valid.map((rec) => rec.beach.id))],
      p_slots: valid.map((rec) => ({ beach_id: rec.beach.id, ...forecastToMatchSlot(rec.forecast) })),
    });
    if (error) throw new Error(error.message);
    const matches = new Map<string, Record<string, unknown> | null>(
      (data?.matches ?? []).map((row: { beach_id: string; forecast_at: string; result: Record<string, unknown> | null }) =>
        [matchSlotKey(row.beach_id, row.forecast_at), row.result]),
    );
    recommendations.forEach((rec, index) => {
      if (!rec.beach?.id || !rec.forecast) return;
      const match = interpretRpcResult(matches.get(matchSlotKey(rec.beach.id, rec.forecast.forecast_at)) ?? null);
      similarityByIndex[index] = match;
    });
  } catch (error) {
    log.warn("Set-based match scoring unavailable", error);
  }

  return {
    recommendations: recommendations.map((rec, index) => ({
      ...rec,
      similarity: similarityByIndex[index],
    })),
  };
}
