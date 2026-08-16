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
 *  4. First-write-wins is absolute (Phase 21, D-18). This module only ever
 *     INSERTs with ignoreDuplicates; it must never UPDATE an existing row, and
 *     it carries no trusted-forecast sidecar fields. The trusted layer reads
 *     these rows and links them by `prediction_snapshot_id` inside
 *     `persist_trusted_forecast_build`; it never writes back here, so a
 *     snapshot stays the honest record of what was displayed at issue time.
 *

 * See plan: ~/.claude/plans/you-are-working-on-precious-papert.md (A3).
 */

import { createServiceRoleClient } from "@/lib/supabase";
import { createContextLogger } from "@/lib/logger";
import type { ForecastAccuracyHorizonBucket } from "./accuracy-metrics";
import {
  WAVE_HEIGHT_SOURCE_TAG_SET,
  type WaveHeightSourceTag,
} from "@/lib/utils/wave-height-source";

const log = createContextLogger("LogDisplayPrediction");

export type DisplayPredictionRow = {
  beach_id: string;
  /** ISO timestamp of the forecast slot (forecast_at). */
  predicted_at: string;
  /** 0..168 — hours from issue time to the forecast slot. */
  forecast_horizon_hours: number;
  /** Canonical Phase 0 lead-time split for frozen accuracy snapshots. */
  forecast_horizon_bucket: ForecastAccuracyHorizonBucket;
  /** PRE-offset face height in meters. Telemetry feedback-loop invariant. */
  raw_display_height_m: number;
  /** POST-offset face height in meters. Equal to raw when no offset applied. */
  offset_corrected_display_height_m: number;
  /** Offset applied (in meters), or null when no offset row was found / gates failed. */
  height_offset_m: number | null;
  /** Sample count backing the offset, or null when no offset applied. */
  height_offset_sample_count: number | null;
  /** Active temporary feedback calibration that changed the final display. */
  feedback_height_calibration_candidate_id: string | null;
  /** Temporary feedback residual offset in feet, or null when not applied. */
  feedback_height_offset_ft: number | null;
  /** True only when the temporary feedback layer changed the final display. */
  feedback_height_calibration_applied: boolean;
  /** Display path identifier, e.g. 'face-Hs-transformer-v1'. */
  display_source: string;
  /**
   * Source tag that selected the raw input for the face-height transformer.
   * Phase 0 replay needs this so proposed `shoaling_factors` only fire on
   * CDIP-denominated snapshots, matching runtime behavior.
   */
  display_wave_source: WaveHeightSourceTag | null;
  /**
   * Raw input height in meters handed to the face-height transformer before
   * shoaling, terrain, and display offset. This is distinct from
   * raw_display_height_m, which is already the transformed display output.
   */
  display_raw_input_height_m: number | null;
  /**
   * model_version is NOT NULL on ml_predictions_log. When the caller does not
   * supply one we fall back to display_source so the constraint is satisfied.
   */
  model_version?: string;

  /**
   * v5 shadow program (Phase 2, 2026-05-02). All five fields below are written
   * as a unit when the calibration version is loaded AND wave_height_om is
   * available. Otherwise they are null. v5 is NEVER served — these columns
   * exist solely so a paired comparator (current displayed vs raw OM vs v5)
   * can be measured once observations backfill.
   */
  /** Raw OM Hs in meters (wavePoint.om_values.wave_height_om). Comparator. */
  wave_height_om_m: number | null;
  /** NOAA primary swell partition height in meters. */
  noaa_swell_1_height_m: number | null;
  /** NOAA primary swell partition period in seconds. */
  noaa_swell_1_period_s: number | null;
  /** NOAA primary swell partition direction in degrees. */
  noaa_swell_1_direction_deg: number | null;
  /** NOAA secondary swell partition height in meters. */
  noaa_swell_2_height_m: number | null;
  /** NOAA secondary swell partition period in seconds. */
  noaa_swell_2_period_s: number | null;
  /** NOAA secondary swell partition direction in degrees. */
  noaa_swell_2_direction_deg: number | null;
  /** NOAA wind-wave partition height in meters. */
  noaa_wind_wave_height_m: number | null;
  /** NOAA wind-wave partition period in seconds. */
  noaa_wind_wave_period_s: number | null;
  /** NOAA wind-wave partition direction in degrees. */
  noaa_wind_wave_direction_deg: number | null;
  /** NOAA/merged peak wave period in seconds. */
  wave_period_s: number | null;
  /** Primary swell direction in degrees, parsed from NOAA cardinal at log time. */
  wave_direction_deg: number | null;
  /** Raw OM peak wave period in seconds. */
  wave_period_om: number | null;
  /** Raw OM peak wave direction in degrees. */
  wave_direction_om: number | null;
  /** Raw OM wave peak period in seconds. */
  wave_peak_period_om: number | null;
  /** Raw OM swell height in meters. */
  swell_height_om: number | null;
  /** Raw OM swell period in seconds. */
  swell_period_om: number | null;
  /** Raw OM swell direction in degrees. */
  swell_direction_om: number | null;
  /** Raw OM primary swell peak period in seconds. */
  swell_wave_peak_period_om: number | null;
  /** Raw OM wind-wave height in meters. */
  wind_wave_height_om: number | null;
  /** Raw OM wind-wave period in seconds. */
  wind_wave_period_om: number | null;
  /** Raw OM wind-wave direction in degrees. */
  wind_wave_direction_om: number | null;
  /** Raw OM wind-wave peak period in seconds. */
  wind_wave_peak_period_om: number | null;
  /** Raw OM secondary swell height in meters. */
  secondary_swell_height_om: number | null;
  /** Raw OM secondary swell period in seconds. */
  secondary_swell_period_om: number | null;
  /** Raw OM secondary swell direction in degrees. */
  secondary_swell_direction_om: number | null;
  /** Raw OM tertiary swell height in meters. */
  tertiary_swell_height_om: number | null;
  /** Raw OM tertiary swell period in seconds. */
  tertiary_swell_period_om: number | null;
  /** Raw OM tertiary swell direction in degrees. */
  tertiary_swell_direction_om: number | null;
  /** True when OM returned no wind-wave partition fields for the slot. */
  om_wind_wave_missing: boolean | null;
  /** True when OM returned no primary-swell partition fields for the slot. */
  om_primary_swell_missing: boolean | null;
  /** True when OM returned no secondary-swell partition fields for the slot. */
  om_secondary_swell_missing: boolean | null;
  /** True when OM returned no tertiary-swell partition fields for the slot. */
  om_tertiary_swell_missing: boolean | null;
  /** Open-Meteo partition capture schema version. */
  om_partition_schema_version: number | null;
  /** NWS wind speed converted to meters per second. Null when no weather point was present. */
  wind_speed_ms: number | null;
  /** NWS wind direction in degrees. Null when no weather point was present. */
  wind_direction_deg: number | null;
  /** v5 candidate height = f(om) + g(direction), with W × 0.5-1.0m guardrail. */
  v5_shadow_height_m: number | null;
  /** Calibration version that produced v5_shadow_height_m. */
  v5_model_version: string | null;
  /** "S/SW" | "W" | "NW" | "OTHER" — bucket used for g(dir) lookup. */
  direction_bucket: string | null;
  /** "<0.5m" | "0.5-1.0m" | "1.0-1.5m" | "1.5m+" — bucket used for f(om). */
  om_bucket: string | null;
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

    const validRows = rows.filter(hasValidSidecarProvenanceValues);
    const skippedRows = rows.length - validRows.length;
    if (skippedRows > 0) {
      log.warn(
        "logDisplayPredictions: skipped rows with invalid sidecar provenance",
        {
          rowCount: rows.length,
          skippedRows,
        }
      );
    }
    if (validRows.length === 0) {
      return;
    }

    const payload = validRows.map((r) => ({
      beach_id: r.beach_id,
      predicted_at: r.predicted_at,
      forecast_horizon_hours: r.forecast_horizon_hours,
      forecast_horizon_bucket: r.forecast_horizon_bucket,
      raw_display_height_m: r.raw_display_height_m,
      offset_corrected_display_height_m: r.offset_corrected_display_height_m,
      height_offset_m: r.height_offset_m,
      height_offset_sample_count: r.height_offset_sample_count,
      feedback_height_calibration_candidate_id:
        r.feedback_height_calibration_candidate_id,
      feedback_height_offset_ft: r.feedback_height_offset_ft,
      feedback_height_calibration_applied:
        r.feedback_height_calibration_applied,
      display_source: r.display_source,
      display_wave_source: r.display_wave_source,
      display_raw_input_height_m: r.display_raw_input_height_m,
      model_version: r.model_version ?? r.display_source,
      wave_height_om: r.wave_height_om_m,
      noaa_swell_1_height_m: r.noaa_swell_1_height_m,
      noaa_swell_1_period_s: r.noaa_swell_1_period_s,
      noaa_swell_1_direction_deg: r.noaa_swell_1_direction_deg,
      noaa_swell_2_height_m: r.noaa_swell_2_height_m,
      noaa_swell_2_period_s: r.noaa_swell_2_period_s,
      noaa_swell_2_direction_deg: r.noaa_swell_2_direction_deg,
      noaa_wind_wave_height_m: r.noaa_wind_wave_height_m,
      noaa_wind_wave_period_s: r.noaa_wind_wave_period_s,
      noaa_wind_wave_direction_deg: r.noaa_wind_wave_direction_deg,
      wave_period_s: r.wave_period_s,
      wave_direction_deg: r.wave_direction_deg,
      wave_period_om: r.wave_period_om,
      wave_direction_om: r.wave_direction_om,
      wave_peak_period_om: r.wave_peak_period_om,
      swell_height_om: r.swell_height_om,
      swell_period_om: r.swell_period_om,
      swell_direction_om: r.swell_direction_om,
      swell_wave_peak_period_om: r.swell_wave_peak_period_om,
      wind_wave_height_om: r.wind_wave_height_om,
      wind_wave_period_om: r.wind_wave_period_om,
      wind_wave_direction_om: r.wind_wave_direction_om,
      wind_wave_peak_period_om: r.wind_wave_peak_period_om,
      secondary_swell_height_om: r.secondary_swell_height_om,
      secondary_swell_period_om: r.secondary_swell_period_om,
      secondary_swell_direction_om: r.secondary_swell_direction_om,
      tertiary_swell_height_om: r.tertiary_swell_height_om,
      tertiary_swell_period_om: r.tertiary_swell_period_om,
      tertiary_swell_direction_om: r.tertiary_swell_direction_om,
      om_wind_wave_missing: r.om_wind_wave_missing,
      om_primary_swell_missing: r.om_primary_swell_missing,
      om_secondary_swell_missing: r.om_secondary_swell_missing,
      om_tertiary_swell_missing: r.om_tertiary_swell_missing,
      om_partition_schema_version: r.om_partition_schema_version,
      wind_speed_ms: r.wind_speed_ms,
      wind_direction_deg: r.wind_direction_deg,
      v5_shadow_height_m: r.v5_shadow_height_m,
      v5_model_version: r.v5_model_version,
      direction_bucket: r.direction_bucket,
      om_bucket: r.om_bucket,
    }));

    // Upsert with ignoreDuplicates=true → INSERT ... ON CONFLICT (beach_id,
    // predicted_at, forecast_horizon_bucket, display_source) DO NOTHING. This
    // keeps the feedback-loop invariant inside each Phase 0 horizon bucket
    // while still allowing short-horizon snapshots to land after an earlier
    // long-horizon snapshot for the same forecast slot.
    const { error } = await supabase
      .from("ml_predictions_log")
      .upsert(payload as unknown as never, {
        onConflict:
          "beach_id,predicted_at,forecast_horizon_bucket,display_source",
        ignoreDuplicates: true,
      });

    if (error) {
      if (shouldFallbackToLegacyConflictTarget(error)) {
        const legacyPayload = payload.map(
          ({
            forecast_horizon_bucket: _forecastHorizonBucket,
            display_wave_source: _displayWaveSource,
            display_raw_input_height_m: _displayRawInputHeightM,
            ...row
          }) => row
        );
        const { error: legacyError } = await supabase
          .from("ml_predictions_log")
          .upsert(legacyPayload as unknown as never, {
            onConflict: "beach_id,predicted_at",
            ignoreDuplicates: true,
          });

        if (!legacyError) {
          log.warn("logDisplayPredictions: used legacy snapshot conflict key", {
            rowCount: validRows.length,
            error: error.message,
            code: error.code,
          });
          return;
        }

        log.warn("logDisplayPredictions: legacy insert failed", {
          rowCount: validRows.length,
          error: legacyError.message,
          code: legacyError.code,
        });
        return;
      }

      log.warn("logDisplayPredictions: insert failed", {
        rowCount: validRows.length,
        error: error.message,
        code: error.code,
      });
      return;
    }
  } catch (err) {
    log.warn("logDisplayPredictions: unexpected error", {
      rowCount: rows.length,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function nonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function shouldFallbackToLegacyConflictTarget(error: {
  code?: string;
  message?: string;
}): boolean {
  const message = (error.message ?? "").toLowerCase();
  const isMissingPhase0Column =
    message.includes("could not find") &&
    message.includes("ml_predictions_log") &&
    (message.includes("forecast_horizon_bucket") ||
      message.includes("display_wave_source") ||
      message.includes("display_raw_input_height_m"));
  const isLegacyConflictShape =
    error.code === "42P10" &&
    message.includes("no unique or exclusion constraint");

  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    isMissingPhase0Column ||
    isLegacyConflictShape
  );
}

function hasValidSidecarProvenanceValues(row: DisplayPredictionRow): boolean {
  const hasValidWaveSource =
    row.display_wave_source == null ||
    WAVE_HEIGHT_SOURCE_TAG_SET.has(row.display_wave_source);
  const hasValidRawInput =
    row.display_raw_input_height_m == null ||
    nonNegativeFiniteNumber(row.display_raw_input_height_m);

  return hasValidWaveSource && hasValidRawInput;
}
