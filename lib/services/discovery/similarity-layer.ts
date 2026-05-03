/**
 * Similarity Layer — Pro Similarity Scoring for Discovery Ranking
 *
 * Two-pass design (Plan V4):
 *   PASS 1: existing condition-scoring engine selects the best window per
 *           beach (in surf-discovery-orchestrator).
 *   PASS 2: this layer bulk-scores the top-N candidates via
 *           compute_user_match_score_batch and injects an additive bonus
 *           into each recommendation's `score` field, then the orchestrator
 *           re-sorts.
 *
 * Authority separation (locked by feedback_separate_ranking_from_verdict_authority):
 *   - This layer affects RANK only — it modifies recommendation.score.
 *   - The hero verdict (Worth it / Maybe / Skip and the "best window" copy)
 *     is computed by computeSurfCall from snapshot data; similarity does NOT
 *     feed into that path.
 *
 * Bonus math (LOCKED — do not retune without product approval):
 *   - state="ready" with score >= 7.0:  bonusApplied = min(15, (score - 7) * 5)
 *   - state="ready" with score < 7.0:   bonusApplied = 0
 *   - state="onboarding":               bonusApplied = 0
 *   - null (free / disabled):           bonusApplied = 0
 *
 * @module lib/services/discovery/similarity-layer
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createContextLogger } from "@/lib/logger";
import type {
  SimilarityRecommendation,
  SurfDiscoveryRecommendation,
} from "@/types/personalization";

const log = createContextLogger("SimilarityLayer");

/** Threshold below which a "ready" similarity score yields no bonus. */
const SIMILARITY_BONUS_THRESHOLD = 7.0;

/** Hard cap on the additive bonus injected into recommendation.score. */
const SIMILARITY_BONUS_MAX = 15;

/** Slope: each +1 above threshold = +5 points, capped at +15 (i.e. score=10). */
const SIMILARITY_BONUS_SLOPE = 5;

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
  /** Same array length and shape as input, with `similarity` stamped + score adjusted. */
  recommendations: SurfDiscoveryRecommendation[];
}

/**
 * Bonus calculation, exported for unit-test reuse and to keep the formula
 * pinned to one place (see "Bonus math" in the module doc).
 */
export function computeSimilarityBonus(score: number): number {
  if (!Number.isFinite(score) || score < SIMILARITY_BONUS_THRESHOLD) return 0;
  const raw = (score - SIMILARITY_BONUS_THRESHOLD) * SIMILARITY_BONUS_SLOPE;
  return Math.min(SIMILARITY_BONUS_MAX, raw);
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
 * Translate a single slot's RPC `result` jsonb into a SimilarityRecommendation
 * and the bonus to add. Tolerant to the three documented shapes plus a missing/
 * malformed result (treated as null, no bonus).
 */
function interpretRpcResult(
  result: Record<string, unknown> | null,
): { similarity: SimilarityRecommendation; bonus: number } {
  if (!result || typeof result !== "object") {
    return { similarity: null, bonus: 0 };
  }

  const state = result.state;

  if (state === "onboarding") {
    const sessionCount =
      typeof result.session_count === "number" ? result.session_count : 0;
    const sessionsNeeded =
      typeof result.sessions_needed === "number" ? result.sessions_needed : 0;
    return {
      similarity: { state: "onboarding", sessionCount, sessionsNeeded },
      bonus: 0,
    };
  }

  if (state === "ready") {
    const score = typeof result.score === "number" ? result.score : 0;
    const label = typeof result.label === "string" ? result.label : "";
    const sessionCount =
      typeof result.sessions_in_profile === "number"
        ? result.sessions_in_profile
        : 0;

    // Pull first reason bullet for user-facing copy. Fall back to label when absent.
    const reasonBullets = Array.isArray(result.reason_bullets)
      ? result.reason_bullets
      : [];
    const reason =
      typeof reasonBullets[0] === "string" && reasonBullets[0].length > 0
        ? reasonBullets[0]
        : label;

    const bonus = computeSimilarityBonus(score);

    return {
      similarity: {
        state: "ready",
        score,
        label,
        bonusApplied: bonus,
        reason,
        sessionCount,
      },
      bonus,
    };
  }

  // Unknown state — degrade gracefully to null.
  return { similarity: null, bonus: 0 };
}

/**
 * Inject Pro similarity scoring into the top-N discovery recommendations.
 *
 * - Free users (or null userId): every rec gets `similarity: null`, no RPC.
 * - Pro users: one bulk RPC call per beach (most discovery returns share no
 *   beach so it's typically N calls; if multiple recs share a beach the calls
 *   are still made independently because each carries a distinct slot — this
 *   mirrors the per-slot semantics of compute_user_match_score).
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

  // Pro path. Score each rec independently (one RPC per beach because the
  // bulk RPC is keyed on a single beach_id). Recs without a beach.id are
  // skipped — they fall through to similarity: null.
  const results = await Promise.all(
    recommendations.map(async (rec) => {
      const beachId = rec.beach?.id;
      if (!beachId) {
        return { rec, similarity: null as SimilarityRecommendation, bonus: 0 };
      }

      try {
        const { data, error } = await supabase.rpc(
          "compute_user_match_score_batch",
          {
            p_user_id: userId,
            p_beach_id: beachId,
            p_slots: recToSlotPayload(rec),
          },
        );

        if (error) {
          log.warn(
            `Bulk match-score RPC error for beach=${beachId}: ${error.message}`,
          );
          return {
            rec,
            similarity: null as SimilarityRecommendation,
            bonus: 0,
          };
        }

        const rows = (data ?? []) as BatchRpcRow[];
        // Single-slot input → first (and only) row carries the result.
        const first = rows[0];
        const interp = interpretRpcResult(first?.result ?? null);
        return { rec, similarity: interp.similarity, bonus: interp.bonus };
      } catch (err) {
        log.warn(
          `Bulk match-score RPC threw for beach=${beachId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return {
          rec,
          similarity: null as SimilarityRecommendation,
          bonus: 0,
        };
      }
    }),
  );

  return {
    recommendations: results.map(({ rec, similarity, bonus }) => ({
      ...rec,
      score: bonus > 0 ? Math.min(100, rec.score + bonus) : rec.score,
      similarity,
    })),
  };
}
