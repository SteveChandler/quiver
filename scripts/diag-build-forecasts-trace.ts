/**
 * Diagnostic: invoke EnhancedForecastService.generateComprehensiveForecast()
 * for one real beach end-to-end, then count ml_predictions_log rows written
 * by display_source='face-Hs-transformer-v1' in the last 60s for that beach.
 *
 * Goal: determine whether snapshotBuffer is being populated (and the insert
 * silently fails) OR whether the buffer is empty (push gate filters all
 * rows).
 */
import "dotenv/config";
import { createServiceRoleClient } from "../lib/supabase";
import { EnhancedForecastService } from "../lib/services/enhanced-forecast-service";
import { fetchNowcastAnchors } from "../lib/services/observations/nowcast-anchor";

async function main() {
  const supabase = createServiceRoleClient();

  // Pick one CDIP-backed SD beach (high-volume forecast slot path).
  const { data: beach, error } = await supabase
    .from("beaches")
    .select("id, slug, name, lat, lon, timezone, features, height_offset_enabled")
    .eq("slug", "ocean-beach")
    .single();

  if (error || !beach) {
    console.error("[diag-trace] could not fetch beach:", error);
    process.exit(1);
  }
  console.log("[diag-trace] beach:", beach);

  const before = await supabase
    .from("ml_predictions_log")
    .select("id", { count: "exact", head: true })
    .eq("beach_id", beach.id)
    .eq("display_source", "face-Hs-transformer-v1");
  const beforeCount = before.count ?? 0;
  console.log(`[diag-trace] face-Hs-transformer-v1 rows for this beach BEFORE: ${beforeCount}`);

  console.log("[diag-trace] constructing EnhancedForecastService...");
  const service = new EnhancedForecastService();

  console.log("[diag-trace] fetching nowcast anchor...");
  const anchors = await fetchNowcastAnchors(supabase);
  const anchor = anchors.get(beach.id) ?? null;
  console.log(`[diag-trace] anchor: ${anchor ? "present" : "null"}`);

  console.log("[diag-trace] calling generateComprehensiveForecast...");
  const t0 = Date.now();
  const forecasts = await service.generateComprehensiveForecast(beach as any, anchor);
  console.log(`[diag-trace] returned ${forecasts.length} forecasts in ${Date.now() - t0}ms`);

  // Wait briefly for the in-flight snapshot insert to complete (logDisplayPredictions is awaited inside buildForecasts so it should already be done).
  await new Promise((r) => setTimeout(r, 500));

  const after = await supabase
    .from("ml_predictions_log")
    .select("id, predicted_at, forecast_horizon_hours, raw_display_height_m, v5_shadow_height_m, wave_height_om, direction_bucket, om_bucket", { count: "exact" })
    .eq("beach_id", beach.id)
    .eq("display_source", "face-Hs-transformer-v1")
    .order("created_at", { ascending: false })
    .limit(5);

  const afterCount = after.count ?? 0;
  console.log(`[diag-trace] face-Hs-transformer-v1 rows for this beach AFTER: ${afterCount} (delta=${afterCount - beforeCount})`);
  if (after.data && after.data.length > 0) {
    console.log("[diag-trace] latest 5 snapshot rows:");
    for (const r of after.data) console.log("  ", r);
  } else {
    console.log("[diag-trace] no rows present at all");
  }

  // Sample of first 3 forecast slots' wave_height for confirmation
  console.log("[diag-trace] first 3 forecast slot wave heights from buildForecasts output:");
  for (const f of forecasts.slice(0, 3)) {
    console.log("  ", { forecast_at: (f as any).forecast_at, wave_height: (f as any).wave_height });
  }
}

main().catch((err) => {
  console.error("[diag-trace] fatal:", err);
  process.exit(1);
});
