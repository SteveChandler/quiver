/**
 * One-shot backfill: populate v5 shadow fields on the 17,100 stale rows
 * written by the 2026-05-02 16:01 UTC bootstrap batch (commit 3fb77bf6,
 * before the v5 calibration was seeded at 20:00 UTC).
 *
 * Strategy:
 *   1. SELECT stale ml_predictions_log rows (created 5/2, v5_shadow NULL).
 *   2. JOIN to enhanced_forecasts on (beach_id, predicted_at = forecast_at)
 *      to recover wave_height_om + wave_direction_om.
 *   3. Compute v5 in TypeScript via the production computeV5Shadow path.
 *   4. UPSERT in batches with the existing row values + new v5 fields.
 *      Conflict target (beach_id, predicted_at) + ignoreDuplicates:false
 *      means existing rows get UPDATE-on-conflict on the columns we send.
 *
 * Methodological caveat (acknowledged):
 *   The OM data in enhanced_forecasts has been overwritten by every hourly
 *   cron run since 5/2, so it is NOT the 5/2 16:01 issue-time OM value —
 *   it's whatever the most-recent cron stored, often a near-now hindcast.
 *   This means backfilled v5 has hindsight that raw_display_height_m does
 *   not. To keep that bias visible in any future comparator analysis,
 *   v5_model_version is tagged with the `.backfill_hindcast` suffix.
 *
 * Safety:
 *   - --dry-run prints the planned mutation without writing.
 *   - Batches of 500. Each batch is one UPSERT round-trip.
 *   - Idempotent: re-running is a no-op once v5_shadow_height_m is set.
 */
import "dotenv/config";
import { createServiceRoleClient } from "../lib/supabase";
import {
  computeV5Shadow,
  getActiveCalibration,
} from "../lib/services/forecast/calibration-v5";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

type StaleRow = {
  id: string;
  beach_id: string;
  predicted_at: string;
  forecast_horizon_hours: number;
  raw_display_height_m: number;
  offset_corrected_display_height_m: number | null;
  height_offset_m: number | null;
  height_offset_sample_count: number | null;
  display_source: string;
  model_version: string;
};

type EnhancedRow = {
  beach_id: string;
  forecast_at: string;
  wave_height_om: number | null;
  wave_direction_om: number | null;
};

async function main() {
  const supabase = createServiceRoleClient();

  console.log(`[backfill] mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);

  const calibration = await getActiveCalibration();
  if (!calibration) {
    console.error("[backfill] no active calibration loaded — aborting");
    process.exit(1);
  }
  console.log(`[backfill] active calibration: ${calibration.version}`);

  // Pull all stale 5/2 rows with v5_shadow NULL. Paginate via .range() since
  // PostgREST caps at 1000 per request.
  console.log("[backfill] loading stale rows...");
  const stale: StaleRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ml_predictions_log")
      .select(
        "id, beach_id, predicted_at, forecast_horizon_hours, raw_display_height_m, offset_corrected_display_height_m, height_offset_m, height_offset_sample_count, display_source, model_version"
      )
      .gte("created_at", "2026-05-02")
      .lt("created_at", "2026-05-03")
      .is("v5_shadow_height_m", null)
      // id is the PK and immutable, so this is the only stable pagination
      // order. predicted_at has many ties across beaches; ordering by it
      // alone leaks/skips rows under concurrent writes.
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) {
      console.error("[backfill] stale-row select failed:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    stale.push(...(data as StaleRow[]));
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`[backfill] stale rows: ${stale.length}`);

  if (stale.length === 0) {
    console.log("[backfill] nothing to backfill — exiting");
    return;
  }

  // Pull matching enhanced_forecasts rows. Build a Map<`${beach}|${ts}`, EF>.
  // Page in chunks of beach_ids to keep request size bounded.
  console.log("[backfill] loading enhanced_forecasts join data...");
  const efMap = new Map<string, EnhancedRow>();
  const beachIds = Array.from(new Set(stale.map((r) => r.beach_id)));
  // Compute the predicted_at window from the full array, not first/last —
  // ordering is by id (stable), so positional values are not chronological.
  const allTs = stale.map((r) => r.predicted_at).sort();
  const minTs = allTs[0];
  const maxTs = allTs[allTs.length - 1];
  console.log(
    `[backfill] beach count: ${beachIds.length}, predicted_at range: ${minTs} → ${maxTs}`
  );

  for (let i = 0; i < beachIds.length; i += 50) {
    const slice = beachIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("beach_id, forecast_at, wave_height_om, wave_direction_om")
      .in("beach_id", slice)
      .gte("forecast_at", minTs)
      .lte("forecast_at", maxTs);
    if (error) {
      console.error("[backfill] enhanced_forecasts select failed:", error);
      process.exit(1);
    }
    for (const r of (data as EnhancedRow[]) ?? []) {
      // Multiple data_source rows per (beach, forecast_at) — prefer rows where
      // wave_height_om is non-null. Last write wins; OM-source rows usually
      // win because the cron runs OPEN_METEO last in the merge order. Belt-
      // and-suspenders: only overwrite if the existing entry has null OM.
      const key = `${r.beach_id}|${r.forecast_at}`;
      const existing = efMap.get(key);
      if (
        !existing ||
        (existing.wave_height_om == null && r.wave_height_om != null)
      ) {
        efMap.set(key, r);
      }
    }
  }
  console.log(`[backfill] enhanced_forecasts entries indexed: ${efMap.size}`);

  // Build payloads. Skip rows where enhanced_forecasts has no OM height —
  // can't compute v5 without it.
  const updates: Record<string, unknown>[] = [];
  let skipped_no_ef = 0;
  let skipped_no_om = 0;
  for (const r of stale) {
    const ef = efMap.get(`${r.beach_id}|${r.predicted_at}`);
    if (!ef) {
      skipped_no_ef += 1;
      continue;
    }
    if (ef.wave_height_om == null) {
      skipped_no_om += 1;
      continue;
    }
    const v5 = computeV5Shadow({
      wave_height_om_m: ef.wave_height_om,
      primary_swell_direction_deg: ef.wave_direction_om,
      calibration,
    });
    updates.push({
      // Conflict target — must be present.
      beach_id: r.beach_id,
      predicted_at: r.predicted_at,
      // Round-trip the existing values so NOT NULL columns pass on the
      // INSERT side of the upsert (the row already exists so DO UPDATE
      // runs, but Postgres still validates NOT NULL on the prospective
      // INSERT row).
      forecast_horizon_hours: r.forecast_horizon_hours,
      raw_display_height_m: r.raw_display_height_m,
      offset_corrected_display_height_m: r.offset_corrected_display_height_m,
      height_offset_m: r.height_offset_m,
      height_offset_sample_count: r.height_offset_sample_count,
      display_source: r.display_source,
      model_version: r.model_version,
      // Backfilled v5 fields.
      wave_height_om: ef.wave_height_om,
      wave_direction_deg: ef.wave_direction_om,
      v5_shadow_height_m: v5?.v5_shadow_height_m ?? null,
      v5_model_version: v5
        ? `${v5.v5_model_version}.backfill_hindcast`
        : null,
      direction_bucket: v5?.direction_bucket ?? null,
      om_bucket: v5?.om_bucket ?? null,
    });
  }

  console.log(`[backfill] update payloads built: ${updates.length}`);
  console.log(`[backfill] skipped (no enhanced_forecasts row): ${skipped_no_ef}`);
  console.log(`[backfill] skipped (EF row but wave_height_om null): ${skipped_no_om}`);

  // Diagnostic: are there duplicate (beach_id, predicted_at) tuples in
  // updates? Postgres ON CONFLICT DO UPDATE rejects same conflict target
  // appearing twice in one batch.
  const tupleCounts = new Map<string, number>();
  for (const u of updates) {
    const k = `${u.beach_id}|${u.predicted_at}`;
    tupleCounts.set(k, (tupleCounts.get(k) ?? 0) + 1);
  }
  const dupCount = Array.from(tupleCounts.values()).filter((n) => n > 1).length;
  console.log(`[backfill] distinct conflict tuples: ${tupleCounts.size}`);
  console.log(`[backfill] duplicate conflict tuples in updates: ${dupCount}`);
  if (dupCount > 0) {
    console.log(`[backfill] sample duplicates:`);
    let shown = 0;
    for (const [k, n] of tupleCounts.entries()) {
      if (n > 1 && shown < 5) {
        console.log(`  ${k}: ${n} occurrences`);
        shown += 1;
      }
    }
    // Dedupe by tuple — keep last write. Cheap insurance against any further
    // pagination weirdness; backfill values are deterministic from EF data
    // so picking either dupe is equivalent.
    const dedup = new Map<string, Record<string, unknown>>();
    for (const u of updates) {
      dedup.set(`${u.beach_id}|${u.predicted_at}`, u);
    }
    updates.length = 0;
    updates.push(...dedup.values());
    console.log(`[backfill] post-dedupe payload count: ${updates.length}`);
  }

  if (DRY_RUN) {
    console.log("[backfill] DRY-RUN — sample of first 3 planned updates:");
    for (const u of updates.slice(0, 3)) {
      console.log("  ", u);
    }
    console.log("[backfill] DRY-RUN complete — no writes performed");
    return;
  }

  let written = 0;
  let failed = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("ml_predictions_log")
      .upsert(batch as unknown as never, {
        onConflict: "beach_id,predicted_at",
        ignoreDuplicates: false,
      });
    if (error) {
      console.error(
        `[backfill] batch ${i / BATCH_SIZE} failed (${batch.length} rows):`,
        error.message
      );
      failed += batch.length;
    } else {
      written += batch.length;
    }
    if ((i / BATCH_SIZE) % 5 === 0) {
      console.log(
        `[backfill] progress: ${written}/${updates.length} written, ${failed} failed`
      );
    }
  }

  console.log(`[backfill] DONE: ${written} written, ${failed} failed`);

  // Verify — count remaining stale rows.
  const { count } = await supabase
    .from("ml_predictions_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", "2026-05-02")
    .lt("created_at", "2026-05-03")
    .is("v5_shadow_height_m", null);
  console.log(`[backfill] stale 5/2 rows remaining (v5_shadow null): ${count}`);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
