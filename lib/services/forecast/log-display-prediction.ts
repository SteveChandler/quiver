/**
 * Display-prediction snapshot writer.
 *
 * Fire-and-forget service-role writer that captures user-facing display heights
 * (face-Hs transformer output) into ml_predictions_log at issue time. The
 * Seaside cron `compute-beach-height-offsets` reads these rows alongside
 * observed_m (filled by `backfill_observations.py`) to compute the per-beach
 * rolling-median residual offset.
 *
 * Critical invariants:
 *  1. raw_display_height_m is captured PRE-correction by the caller (in
 *     forecast-builder before applyBeachHeightOffset runs). This module never
 *     re-derives heights from enhanced_forecasts (telemetry feedback hazard).
 *  2. NEVER throws to the caller — the user-facing forecast pipeline must not
 *     block on snapshot writes. All failures are logged + swallowed.
 *  3. Env-gated: missing SUPABASE_SERVICE_ROLE_KEY → warn once + no-op.
 *
 * See plan: ~/.claude/plans/you-are-working-on-precious-papert.md (A3).
 */

import { createServiceRoleClient } from "@/lib/supabase";
import { createContextLogger } from "@/lib/logger";

const log = createContextLogger("LogDisplayPrediction");

export type DisplayPredictionRow = {
  beach_id: string;
  /** ISO timestamp of the forecast slot (forecast_at). */
  predicted_at: string;
  /** 0..168 — hours from issue time to the forecast slot. */
  forecast_horizon_hours: number;
  /** PRE-offset face height in meters. Telemetry feedback-loop invariant. */
  raw_display_height_m: number;
  /** POST-offset face height in meters. Equal to raw when no offset applied. */
  offset_corrected_display_height_m: number;
  /** Offset applied (in meters), or null when no offset row was found / gates failed. */
  height_offset_m: number | null;
  /** Sample count backing the offset, or null when no offset applied. */
  height_offset_sample_count: number | null;
  /** Display path identifier, e.g. 'face-Hs-transformer-v1'. */
  display_source: string;
  /**
   * model_version is NOT NULL on ml_predictions_log. When the caller does not
   * supply one we fall back to display_source so the constraint is satisfied.
   */
  model_version?: string;
};

/**
 * Insert display-prediction snapshots into ml_predictions_log.
 *
 * Fire-and-forget: never throws to the caller, always returns void.
 *
 * @param rows Snapshot rows captured by forecast-builder for a single run.
 */
let warnedMissingServiceRoleKey = false;

export async function logDisplayPredictions(
  rows: DisplayPredictionRow[]
): Promise<void> {
  if (!rows || rows.length === 0) return;

  log.info("logDisplayPredictions: entry", { rowCount: rows.length });

  const hasServiceRoleKey =
    !!(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() &&
    !!(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

  if (!hasServiceRoleKey) {
    if (!warnedMissingServiceRoleKey) {
      warnedMissingServiceRoleKey = true;
      log.warn(
        "logDisplayPredictions: SUPABASE_SERVICE_ROLE_KEY not configured; skipping snapshot write",
        { rowCount: rows.length }
      );
    }
    return;
  }

  try {
    const supabase = createServiceRoleClient();

    const payload = rows.map((r) => ({
      beach_id: r.beach_id,
      predicted_at: r.predicted_at,
      forecast_horizon_hours: r.forecast_horizon_hours,
      raw_display_height_m: r.raw_display_height_m,
      offset_corrected_display_height_m: r.offset_corrected_display_height_m,
      height_offset_m: r.height_offset_m,
      height_offset_sample_count: r.height_offset_sample_count,
      display_source: r.display_source,
      model_version: r.model_version ?? r.display_source,
    }));

    const { error } = await supabase
      .from("ml_predictions_log")
      .insert(payload as unknown as never);

    if (error) {
      log.warn("logDisplayPredictions: insert failed", {
        rowCount: rows.length,
        error: error.message,
        code: error.code,
      });
      return;
    }

    log.info("logDisplayPredictions: insert ok", { rowCount: rows.length });
  } catch (err) {
    log.warn("logDisplayPredictions: unexpected error", {
      rowCount: rows.length,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
