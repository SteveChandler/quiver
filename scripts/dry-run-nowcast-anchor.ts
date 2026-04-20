#!/usr/bin/env tsx
/**
 * Dry-run preview of the nowcast-anchor feature for Ocean Beach Pier.
 *
 * Reads the live prod DB to get:
 *   - OB Pier beach row (terrain + current features)
 *   - Current `enhanced_forecasts.wave_height` for the row nearest now
 *   - The nowcast anchor via get_nowcast_anchors(6.0)
 *
 * Then simulates both paths through `toFaceHeightFeetDecomposed`:
 *   1. Feature flag OFF (current behavior): NOAA components drive output.
 *   2. Feature flag ON (proposed): anchor drives output.
 *
 * Writes nothing. Does not flip the feature flag. Safe to run repeatedly.
 *
 * Usage:
 *   npx tsx scripts/dry-run-nowcast-anchor.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  toFaceHeightFeetDecomposed,
  METERS_TO_FEET,
} from "../lib/utils/wave-formatters";
import type { SwellComponentInput } from "../lib/utils/wave-height-transformer";

config({ path: ".env.production.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BEACH_SLUG = "ocean-beach-pier";

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: beach, error: beachErr } = await supabase
    .from("beaches")
    .select(
      "id, name, slug, features, swell_window_center_deg, swell_window_halfwidth_deg, shoaling_factors, terrain_enabled, deepwater_decay_factor, swell_access_factors",
    )
    .eq("slug", BEACH_SLUG)
    .single();
  if (beachErr || !beach) throw new Error(`Beach lookup failed: ${beachErr?.message}`);

  const { data: anchorRow, error: anchorErr } = await supabase
    .rpc("get_nowcast_anchors", { max_age_hours: 6.0 })
    .then((r) => ({
      data: (r.data as Array<{
        beach_id: string;
        station_id: string;
        observed_at: string;
        wave_height_m: number | string;
        wave_period_s: number | string | null;
        wave_direction_deg: number | string | null;
      }>)?.find((x) => x.beach_id === beach.id),
      error: r.error,
    }));
  if (anchorErr) throw new Error(`RPC failed: ${anchorErr.message}`);
  if (!anchorRow) {
    console.log(`No anchor available for ${beach.name} — either out-of-window or no matched station.`);
    process.exit(0);
  }

  const nowIso = new Date().toISOString();
  const windowStart = new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString();
  const { data: forecastRows } = await supabase
    .from("enhanced_forecasts")
    .select(
      "forecast_at, wave_height, data_source, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_wave_height, wind_wave_period, wind_wave_direction",
    )
    .eq("beach_id", beach.id)
    .gte("forecast_at", windowStart)
    .lte("forecast_at", windowEnd)
    .order("forecast_at", { ascending: true });

  const nearest = forecastRows?.reduce<(typeof forecastRows)[number] | null>(
    (best, row) => {
      const diff = Math.abs(Date.parse(row.forecast_at) - Date.now());
      const bestDiff = best ? Math.abs(Date.parse(best.forecast_at) - Date.now()) : Infinity;
      return diff < bestDiff ? row : best;
    },
    null,
  );
  if (!nearest) {
    console.log(`No forecast row within ±1.5h for ${beach.name}.`);
    process.exit(0);
  }

  const beachTerrain = {
    swell_access_factors: beach.swell_access_factors ?? null,
    terrain_enabled: beach.terrain_enabled ?? false,
    shoaling_factors: beach.shoaling_factors ?? null,
    swell_window_center_deg: beach.swell_window_center_deg ?? null,
    swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
    deepwater_decay_factor: beach.deepwater_decay_factor ?? null,
  };

  const cardinalToDeg = (d: string | number | null): number | null => {
    if (d == null) return null;
    if (typeof d === "number") return d;
    const map: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    };
    return map[d] ?? null;
  };

  const swell1Dir = cardinalToDeg(nearest.swell_1_direction);
  const swell2Dir = cardinalToDeg(nearest.swell_2_direction);
  const windDir = cardinalToDeg(nearest.wind_wave_direction);

  const components: Array<SwellComponentInput | null> = [
    (nearest.swell_1_height ?? 0) > 0 && (nearest.swell_1_period ?? 0) > 0
      ? { heightFt: (nearest.swell_1_height ?? 0) * METERS_TO_FEET, periodS: nearest.swell_1_period!, directionDeg: swell1Dir }
      : null,
    (nearest.swell_2_height ?? 0) > 0 && (nearest.swell_2_period ?? 0) > 0
      ? { heightFt: (nearest.swell_2_height ?? 0) * METERS_TO_FEET, periodS: nearest.swell_2_period!, directionDeg: swell2Dir }
      : null,
    (nearest.wind_wave_height ?? 0) > 0 && (nearest.wind_wave_period ?? 0) > 0
      ? { heightFt: (nearest.wind_wave_height ?? 0) * METERS_TO_FEET, periodS: nearest.wind_wave_period!, directionDeg: windDir }
      : null,
  ];

  // Path A: current behavior (no anchor) — exactly what the cron writes today.
  const withoutAnchor = toFaceHeightFeetDecomposed({
    modelHsM: components.reduce((s, c) => s + (c ? c.heightFt / METERS_TO_FEET : 0), 0) || undefined,
    beach: beachTerrain,
    periodS: nearest.swell_1_period ?? null,
    swellDirectionDeg: swell1Dir,
    components,
  });

  // Path B: anchored — empty components force the legacy rawHeightFt path.
  const anchorM = Number(anchorRow.wave_height_m);
  const anchorPeriod = anchorRow.wave_period_s != null ? Number(anchorRow.wave_period_s) : null;
  const anchorDir = anchorRow.wave_direction_deg != null ? Number(anchorRow.wave_direction_deg) : null;
  const withAnchor = toFaceHeightFeetDecomposed({
    ndbcBuoyM: anchorM,
    beach: beachTerrain,
    periodS: anchorPeriod ?? nearest.swell_1_period ?? null,
    swellDirectionDeg: anchorDir ?? swell1Dir,
    components: [null, null, null],
  });

  const ageMin = Math.round((Date.now() - Date.parse(anchorRow.observed_at)) / 60000);
  const featuresArr = (beach.features ?? []) as string[];

  console.log(`\n=== Dry-run: ${beach.name} (${beach.slug}) ===`);
  console.log(`Now (UTC):              ${nowIso}`);
  console.log(`Beach features:         ${JSON.stringify(featuresArr)}`);
  console.log(`Feature-flag enabled?:  ${featuresArr.includes("observation_anchor") ? "YES" : "NO (prod unchanged)"}`);
  console.log(`\n-- Forecast row at ${nearest.forecast_at} (data_source=${nearest.data_source}) --`);
  console.log(`  swell_1: ${nearest.swell_1_height}m @ ${nearest.swell_1_period}s ${nearest.swell_1_direction}`);
  console.log(`  swell_2: ${nearest.swell_2_height}m @ ${nearest.swell_2_period}s ${nearest.swell_2_direction}`);
  console.log(`  wind_wave: ${nearest.wind_wave_height}m @ ${nearest.wind_wave_period}s ${nearest.wind_wave_direction}`);
  console.log(`\n-- Nowcast anchor (${anchorRow.station_id}) --`);
  console.log(`  observed_at: ${anchorRow.observed_at} (${ageMin} min ago)`);
  console.log(`  Hs: ${anchorM}m   period: ${anchorPeriod ?? "null"}s   direction: ${anchorDir ?? "null"}°`);
  console.log(`\n-- Results --`);
  console.log(`  Prod currently stored:     ${nearest.wave_height}`);
  console.log(`  Simulated (no anchor):     ${withoutAnchor}`);
  console.log(`  Simulated (with anchor):   ${withAnchor}`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
