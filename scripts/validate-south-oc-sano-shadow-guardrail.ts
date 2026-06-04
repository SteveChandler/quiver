#!/usr/bin/env tsx
/**
 * Live validation for South OC/San Onofre shadow guardrail.
 *
 * Read-only: pulls current production beach config, latest stored forecast
 * rows, and latest unified wave observations. Prints current stored output
 * beside the guarded candidate the new code would floor to.
 *
 * Run:
 *   yarn tsx scripts/validate-south-oc-sano-shadow-guardrail.ts
 */

import { config as dotenvConfig } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  buildSouthOcSanoShadowZoneSnapshot,
  resolveSouthOcSanoShadowGuardrail,
  SOUTH_OC_SANO_SHADOW_GUARDRAIL_FEATURE_FLAG,
  SOUTH_OC_SANO_SHADOW_STATION_IDS,
  SOUTH_OC_SANO_SHADOW_ZONE_SLUGS,
} from "../lib/services/forecast/south-oc-sano-shadow-guardrail";
import { toFaceHeightFeetDecomposedWithDebug } from "../lib/utils/wave-formatters";
import type { Beach } from "../types/database";
import type { SouthOcSanoObservationRow } from "../lib/services/forecast/south-oc-sano-shadow-guardrail";
import type { ShoalingFactors } from "../lib/utils/wave-height-transformer";

dotenvConfig({ path: ".env.production.local" });
dotenvConfig({ path: ".env.local" });

type ForecastRow = {
  beach_id: string;
  forecast_at: string;
  wave_height: string | null;
};

function parseFt(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function withGuardrailFlag(beach: Beach): Beach {
  const features = Array.isArray(beach.features) ? beach.features : [];
  if (features.includes(SOUTH_OC_SANO_SHADOW_GUARDRAIL_FEATURE_FLAG)) {
    return beach;
  }
  return {
    ...beach,
    features: [...features, SOUTH_OC_SANO_SHADOW_GUARDRAIL_FEATURE_FLAG],
  };
}

async function main(): Promise<void> {
  const supabase = createClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } },
  );
  const nowMs = Date.now();

  const { data: beaches, error: beachError } = await supabase
    .from("beaches")
    .select(
      "id, slug, name, lat, lon, features, timezone, terrain_enabled, swell_access_factors, shoaling_factors, swell_window_center_deg, swell_window_halfwidth_deg, deepwater_decay_factor",
    )
    .in("slug", [...SOUTH_OC_SANO_SHADOW_ZONE_SLUGS])
    .order("lat", { ascending: false });
  if (beachError) throw beachError;

  const beachRows = (beaches ?? []) as unknown as Beach[];
  const beachIds = beachRows.map((beach) => beach.id);

  const { data: forecastRows, error: forecastError } = await supabase
    .from("enhanced_forecasts")
    .select(
      "beach_id, forecast_at, wave_height",
    )
    .in("beach_id", beachIds)
    .gte("forecast_at", new Date(nowMs - 3 * 60 * 60 * 1000).toISOString())
    .lte("forecast_at", new Date(nowMs + 3 * 60 * 60 * 1000).toISOString())
    .order("forecast_at", { ascending: true });
  if (forecastError) throw forecastError;

  const { data: observationRows, error: observationError } = await supabase
    .from("unified_wave_observations")
    .select(
      "station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg, source, source_network",
    )
    .in("station_id", [...SOUTH_OC_SANO_SHADOW_STATION_IDS])
    .order("observed_at", { ascending: false });
  if (observationError) throw observationError;

  const latestByStation = new Map<string, SouthOcSanoObservationRow>();
  for (const row of (observationRows ?? []) as unknown as SouthOcSanoObservationRow[]) {
    if (!latestByStation.has(row.station_id)) latestByStation.set(row.station_id, row);
  }

  const snapshot = buildSouthOcSanoShadowZoneSnapshot([...latestByStation.values()], nowMs);
  const forecastsByBeach = new Map<string, ForecastRow>();
  for (const row of (forecastRows ?? []) as unknown as ForecastRow[]) {
    const current = forecastsByBeach.get(row.beach_id);
    if (
      !current ||
      Math.abs(Date.parse(row.forecast_at) - nowMs) <
        Math.abs(Date.parse(current.forecast_at) - nowMs)
    ) {
      forecastsByBeach.set(row.beach_id, row);
    }
  }

  console.log("=== South OC/SanO Shadow Guardrail Live Trace ===");
  console.log(`snapshot confirmedNearshore=${snapshot.confirmedNearshore?.stationId ?? "none"}`);
  console.log(
    `nearshore Hs=${snapshot.confirmedNearshore?.waveHeightM ?? "n/a"}m ` +
      `period=${snapshot.confirmedNearshore?.wavePeriodS ?? "n/a"}s ` +
      `dir=${snapshot.confirmedNearshore?.waveDirectionDeg ?? "n/a"}deg`,
  );
  console.log(`offshoreContext=${snapshot.offshoreContext?.stationId ?? "none"}`);
  console.log("");
  console.log("slug,currentFt,guardrailKind,candidateFt,newChosenFt,source,calibrated,station");

  for (const beach of beachRows) {
    const forecast = forecastsByBeach.get(beach.id);
    if (!forecast) continue;

    const guardedBeach = withGuardrailFlag(beach);
    const guardrail = resolveSouthOcSanoShadowGuardrail({
      beach: guardedBeach,
      snapshot,
      forecastAtMs: Date.parse(forecast.forecast_at),
      nowMs,
    });
    const currentFt = parseFt(forecast.wave_height);
    let candidateFt: number | null = null;
    let source = "n/a";
    let calibrated = "false";
    let station = "n/a";

    if (guardrail.kind !== "noop") {
      const candidate = toFaceHeightFeetDecomposedWithDebug({
        nowcastAnchorM: guardrail.anchor.waveHeightM,
        beach: {
          swell_access_factors: beach.swell_access_factors ?? null,
          terrain_enabled: beach.terrain_enabled ?? false,
          shoaling_factors: (beach.shoaling_factors ?? null) as ShoalingFactors | null,
          swell_window_center_deg: beach.swell_window_center_deg ?? null,
          swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
          deepwater_decay_factor: beach.deepwater_decay_factor ?? null,
        },
        periodS: guardrail.anchor.wavePeriodS,
        swellDirectionDeg: guardrail.anchor.waveDirectionDeg,
        allowCalibratedShoaling: guardrail.anchor.allowCalibratedShoaling === true,
        components: [null, null, null],
      });
      candidateFt = parseFt(candidate.value);
      source = candidate.debug.source ?? "null";
      calibrated = String(candidate.debug.calibratedShoalingFired);
      station = guardrail.anchor.stationId;
    }

    const newChosenFt =
      candidateFt != null && (currentFt == null || candidateFt > currentFt)
        ? candidateFt
        : currentFt;

    console.log(
      [
        (beach as unknown as { slug: string }).slug,
        currentFt ?? "null",
        guardrail.kind,
        candidateFt ?? "null",
        newChosenFt ?? "null",
        source,
        calibrated,
        station,
      ].join(","),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
