/**
 * Similarity Layer — Pro Similarity Scoring for Discovery Ranking
 *
 * The physical condition score and learned personal match remain separate.
 * This layer attaches the learned match evidence; the canonical decision
 * engine owns window selection and verdict mapping.
 *
 * @module lib/services/discovery/similarity-layer
 */

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

/**
 * Shape of a single row from compute_user_match_score_batch.
 * Mirrors the SQL `RETURNS TABLE (slot_idx int, forecast_at timestamptz, result jsonb)`.
 */
interface BatchRpcRow {
  slot_idx: number;
  forecast_at: string;
  result: Record<string, unknown> | null;
}

export interface ApplySimilarityLayerArgs {
  recommendations: SurfDiscoveryRecommendation[];
  userId: string | null;
  isPro: boolean;
  // Typed loosely — supabase-js client variants in this codebase use the
  // un-parametrized SupabaseClient (see lib/alerts/best-days.ts). Keeping
  // it loose avoids forcing a Database generic on every caller.
  supabase: Pick<SupabaseClient, "rpc">;
}

export interface ApplySimilarityLayerResult {
  /** Same array length and shape as input, with `similarity` stamped. */
  recommendations: SurfDiscoveryRecommendation[];
}

/**
 * Build the jsonb p_slots payload for the bulk RPC from a single recommendation.
 * The RPC parses every field as text via parse_numeric_from_text, so stringify
 * numerics here. Mirrors the existing single-slot caller pattern in
 * lib/alerts/best-days.ts and app/api/cron/similarity-alerts/route.ts.
 */
function recToSlotPayload(
  rec: SurfDiscoveryRecommendation,
): Array<Record<string, string>> {
  const f = rec.forecast;

  const wave = f.wave_height != null ? String(f.wave_height) : "";
  const period =
    f.wave_period != null
      ? String(f.wave_period).replace(/s$/i, "")
      : "";
  const wind = f.wind_speed != null ? String(f.wind_speed) : "";
  const windDir =
    f.wind_direction_deg != null ? String(f.wind_direction_deg) : "";
  const tide = f.tide_height != null ? String(f.tide_height) : "";

  // forecast_at — fall back to the window start if the forecast row is missing it.
  const forecastAt =
    f.forecast_at ??
    (rec.window?.start instanceof Date
      ? rec.window.start.toISOString()
      : String(rec.window?.start ?? ""));

  return [
    {
      forecast_at: forecastAt,
      wave_height: wave,
      wave_period: period,
      wind_speed: wind,
      wind_direction: windDir,
      tide_height: tide,
    },
  ];
}

/**
 * Translate a single slot's RPC `result` jsonb into a SimilarityRecommendation.
 * Tolerant to the three documented shapes plus a missing/malformed result.
 */
function interpretRpcResult(
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
    };
  }

  // Unknown state — degrade gracefully to null.
  return null;
}

/**
 * Attach Pro similarity scoring to discovery window candidates.
 *
 * - Free users (or null userId): every rec gets `similarity: null`, no RPC.
 * - Pro users: one bulk RPC call per beach with every candidate window passed
 *   as a slot.
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

  const indexesByBeach = new Map<string, number[]>();
  recommendations.forEach((rec, index) => {
    const beachId = rec.beach?.id;
    if (!beachId) return;
    const indexes = indexesByBeach.get(beachId) ?? [];
    indexes.push(index);
    indexesByBeach.set(beachId, indexes);
  });

  const similarityByIndex: SimilarityRecommendation[] =
    recommendations.map(() => null);

  await Promise.all(
    Array.from(indexesByBeach.entries()).map(async ([beachId, indexes]) => {
      try {
        const { data, error } = await supabase.rpc(
          "compute_user_match_score_batch",
          {
            p_user_id: userId,
            p_beach_id: beachId,
            p_slots: indexes.flatMap((index) =>
              recToSlotPayload(recommendations[index]),
            ),
          },
        );

        if (error) {
          log.warn(
            `Bulk match-score RPC error for beach=${beachId}: ${error.message}`,
          );
          return;
        }

        const rowsBySlot = new Map(
          ((data ?? []) as BatchRpcRow[]).map((row) => [row.slot_idx, row]),
        );
        indexes.forEach((recommendationIndex, slotIndex) => {
          similarityByIndex[recommendationIndex] = interpretRpcResult(
            rowsBySlot.get(slotIndex)?.result ?? null,
          );
        });
      } catch (err) {
        log.warn(
          `Bulk match-score RPC threw for beach=${beachId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }),
  );

  return {
    recommendations: recommendations.map((rec, index) => ({
      ...rec,
      similarity: similarityByIndex[index],
    })),
  };
}
