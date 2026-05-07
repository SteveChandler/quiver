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
import { logDisplayPredictions } from "../lib/services/forecast/log-display-prediction";
import { createServiceRoleClient } from "../lib/supabase";

async function main() {
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

  const synthetic = [
    {
      beach_id: beach.id,
      predicted_at: new Date().toISOString(),
      forecast_horizon_hours: 24,
      raw_display_height_m: 1.234,
      offset_corrected_display_height_m: 1.234,
      height_offset_m: null,
      height_offset_sample_count: null,
      display_source: "diag-script-v1",
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
