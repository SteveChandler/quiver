/**
 * Diagnostic: invoke logDisplayPredictions directly with a synthetic payload
 * against the prod Supabase, with full stdout visible.
 *
 * Tells us:
 *   - whether the function reaches the entry log
 *   - whether createServiceRoleClient() throws
 *   - whether the insert returns a Supabase error
 *   - whether the write actually lands a row in ml_predictions_log
 *
 * This bypasses the cron / Vercel runtime entirely so we can see every log
 * line without going through prod-level filtering.
 */
import "dotenv/config";
import {
  logDisplayPredictions,
  type DisplayPredictionRow,
} from "../lib/services/forecast/log-display-prediction";
import { createServiceRoleClient } from "../lib/supabase";

async function main(): Promise<void> {
  console.log("[diag] env check", {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });

  const supabase = createServiceRoleClient();

  const { data: beach, error: beachErr } = await supabase
    .from("beaches")
    .select("id, slug")
    .eq("slug", "ocean-beach")
    .single();

  if (beachErr || !beach) {
    console.error("[diag] could not fetch test beach:", beachErr);
    process.exit(1);
  }

  console.log("[diag] using beach", beach);

  const synthetic: DisplayPredictionRow[] = [
    {
      beach_id: beach.id,
      predicted_at: new Date().toISOString(),
      forecast_horizon_hours: 24,
      forecast_horizon_bucket: "0-24h",
      raw_display_height_m: 1.234,
      offset_corrected_display_height_m: 1.234,
      height_offset_m: null,
      height_offset_sample_count: null,
      feedback_height_calibration_candidate_id: null,
      feedback_height_offset_ft: null,
      feedback_height_calibration_applied: false,
      display_source: "diag-script-v1",
      display_wave_source: "model_swell",
      display_raw_input_height_m: 1.234,
      model_version: "diag-script-v1",
      wave_height_om_m: null,
      noaa_swell_1_height_m: null,
      noaa_swell_1_period_s: null,
      noaa_swell_1_direction_deg: null,
      noaa_swell_2_height_m: null,
      noaa_swell_2_period_s: null,
      noaa_swell_2_direction_deg: null,
      noaa_wind_wave_height_m: null,
      noaa_wind_wave_period_s: null,
      noaa_wind_wave_direction_deg: null,
      wave_period_s: null,
      wave_direction_deg: null,
      wave_period_om: null,
      wave_direction_om: null,
      wave_peak_period_om: null,
      swell_height_om: null,
      swell_period_om: null,
      swell_direction_om: null,
      swell_wave_peak_period_om: null,
      wind_wave_height_om: null,
      wind_wave_period_om: null,
      wind_wave_direction_om: null,
      wind_wave_peak_period_om: null,
      secondary_swell_height_om: null,
      secondary_swell_period_om: null,
      secondary_swell_direction_om: null,
      tertiary_swell_height_om: null,
      tertiary_swell_period_om: null,
      tertiary_swell_direction_om: null,
      om_wind_wave_missing: null,
      om_primary_swell_missing: null,
      om_secondary_swell_missing: null,
      om_tertiary_swell_missing: null,
      om_partition_schema_version: null,
      wind_speed_ms: null,
      wind_direction_deg: null,
      v5_shadow_height_m: null,
      v5_model_version: null,
      direction_bucket: null,
      om_bucket: null,
    },
  ];

  console.log("[diag] calling logDisplayPredictions...");
  await logDisplayPredictions(synthetic);
  console.log("[diag] logDisplayPredictions returned");

  // Verify it landed
  const { data: rows, error: readErr } = await supabase
    .from("ml_predictions_log")
    .select("id, beach_id, raw_display_height_m, display_source, created_at")
    .eq("display_source", "diag-script-v1")
    .order("created_at", { ascending: false })
    .limit(3);

  if (readErr) {
    console.error("[diag] read-back failed:", readErr);
    process.exit(1);
  }

  console.log(`[diag] found ${rows?.length ?? 0} rows with display_source=diag-script-v1`);
  if (rows && rows.length > 0) {
    console.log("[diag] sample row:", rows[0]);

    // Cleanup
    const idsToDelete = rows.map((r) => r.id);
    const { error: delErr } = await supabase
      .from("ml_predictions_log")
      .delete()
      .in("id", idsToDelete);
    if (delErr) console.error("[diag] cleanup failed:", delErr);
    else console.log(`[diag] cleaned up ${idsToDelete.length} test rows`);
  }
}

main().catch((err) => {
  console.error("[diag] fatal:", err);
  process.exit(1);
});
