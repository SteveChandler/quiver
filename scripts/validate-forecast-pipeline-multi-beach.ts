#!/usr/bin/env tsx
/**
 * Read-only diagnostic for the NOAA interval + terrain-access forecast fix.
 *
 * Usage:
 *   yarn tsx scripts/validate-forecast-pipeline-multi-beach.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  constructGridUrl,
  fetchNOAAGridData,
  fetchNOAAPointData,
} from "../lib/services/noaa-wavewatch/api-client";
import { processNOAAGridData } from "../lib/services/noaa-wavewatch/data-processors";
import type {
  NOAAGridData,
  NOAAValueSeries,
  WaveWatchData,
} from "../lib/services/noaa-wavewatch/types";
import {
  getTimestampForForecastSlot,
  getValueAtIndex,
  getValueAtTime,
  parseNOAAValidTime,
} from "../lib/services/noaa-wavewatch/wave-analysis";
import { METERS_TO_FEET } from "../lib/utils/unit-conversions";
import {
  alignmentFactor,
  BASE_SHOALING,
  calculatePeriodFactor,
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
  type ShoalingFactors,
  type SwellComponentInput,
  type WaveHeightSourceTag,
} from "../lib/utils/wave-height-transformer";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const BEACH_SLUGS = [
  "la-jolla-shores",
  "waikiki-beach",
  "malibu-first-point-surfrider",
] as const;
const DAYS = 3;
const SLOTS = 24;

interface BeachRow {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lon: number;
  terrain_enabled: boolean | null;
  swell_access_factors: number[] | null;
  shoaling_factors: ShoalingFactors | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  deepwater_decay_factor: number | null;
}

interface SlotComparison {
  timestamp: string;
  oldFaceFt: number | null;
  newFaceFt: number | null;
  oldPrimary: string;
  newPrimary: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env.local or .env.production.local`);
  }
  return value;
}

function toBeachTerrain(beach: BeachRow): BeachTerrainConfig {
  return {
    terrain_enabled: beach.terrain_enabled ?? false,
    swell_access_factors: beach.swell_access_factors ?? null,
    shoaling_factors: beach.shoaling_factors ?? null,
    swell_window_center_deg: beach.swell_window_center_deg ?? null,
    swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
    deepwater_decay_factor: beach.deepwater_decay_factor ?? null,
  };
}

function fmt(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "null";
  return value.toFixed(digits);
}

function fmtUnit(
  value: number | null | undefined,
  unit: string,
  digits = 1
): string {
  if (value == null || !Number.isFinite(value)) return "null";
  return `${value.toFixed(digits)}${unit}`;
}

function field(
  gridData: NOAAGridData,
  key: keyof NOAAGridData["properties"]
): NOAAValueSeries | undefined {
  return gridData.properties[key];
}

function toComponent(
  heightM: number | null,
  periodS: number | null,
  directionDeg: number | null,
  partition?: "swell" | "wind_wave"
): SwellComponentInput | null {
  if (
    heightM == null ||
    periodS == null ||
    heightM <= 0 ||
    periodS <= 0 ||
    !Number.isFinite(heightM) ||
    !Number.isFinite(periodS)
  ) {
    return null;
  }

  return {
    heightFt: heightM * METERS_TO_FEET,
    periodS,
    directionDeg,
    ...(partition ? { partition } : {}),
  };
}

function componentsFromWavePoint(wavePoint: WaveWatchData): Array<SwellComponentInput | null> {
  return [
    toComponent(
      wavePoint.swell_1_height,
      wavePoint.swell_1_period,
      wavePoint.swell_1_direction
    ),
    toComponent(
      wavePoint.swell_2_height,
      wavePoint.swell_2_period,
      wavePoint.swell_2_direction
    ),
    toComponent(
      wavePoint.wind_wave_height,
      wavePoint.wind_wave_period,
      wavePoint.wind_wave_direction,
      "wind_wave"
    ),
  ];
}

function componentsFromPositionalIndex(
  gridData: NOAAGridData,
  index: number
): Array<SwellComponentInput | null> {
  const wavePeriod = getValueAtIndex(field(gridData, "wavePeriod")?.values, index);
  const waveDirection = getValueAtIndex(field(gridData, "waveDirection")?.values, index);
  const primaryHeight =
    getValueAtIndex(field(gridData, "primarySwellHeight")?.values, index) ??
    getValueAtIndex(field(gridData, "swellHeight")?.values, index);
  const primaryDirection =
    getValueAtIndex(field(gridData, "primarySwellDirection")?.values, index) ??
    getValueAtIndex(field(gridData, "swellDirection")?.values, index) ??
    waveDirection;
  const primaryPeriod =
    getValueAtIndex(field(gridData, "swellPeriod")?.values, index) ?? wavePeriod;
  const secondaryHeight = getValueAtIndex(
    field(gridData, "secondarySwellHeight")?.values,
    index
  );
  const secondaryDirection = getValueAtIndex(
    field(gridData, "secondarySwellDirection")?.values,
    index
  );
  const secondaryPeriod = getValueAtIndex(field(gridData, "wavePeriod2")?.values, index);
  const waveHeight = getValueAtIndex(field(gridData, "waveHeight")?.values, index);
  const windWaveHeight =
    waveHeight != null
      ? waveHeight * 0.5
      : null;
  const windWavePeriod = wavePeriod != null ? wavePeriod * 0.7 : null;

  return [
    toComponent(primaryHeight, primaryPeriod, primaryDirection),
    toComponent(secondaryHeight, secondaryPeriod, secondaryDirection),
    toComponent(windWaveHeight, windWavePeriod, waveDirection, "wind_wave"),
  ];
}

function strictWindowFaceHeight(
  components: Array<SwellComponentInput | null>,
  beach: BeachTerrainConfig
): number | null {
  const decay = beach.deepwater_decay_factor ?? 1;
  let sumOfSquares = 0;

  for (const component of components) {
    if (!component) continue;
    if (component.partition === "wind_wave" && component.periodS <= 9) continue;

    const access = alignmentFactor(
      component.directionDeg,
      component.periodS,
      beach.swell_window_center_deg ?? null,
      beach.swell_window_halfwidth_deg ?? null
    );
    if (access === 0) continue;

    const periodFactor = calculatePeriodFactor(component.periodS);
    const face = component.heightFt * decay * BASE_SHOALING * periodFactor * access;
    sumOfSquares += face * face;
  }

  if (sumOfSquares === 0) return null;
  return Math.round(Math.sqrt(sumOfSquares) * 10) / 10;
}

function newFaceHeight(
  wavePoint: WaveWatchData,
  beach: BeachTerrainConfig
): number | null {
  const components = componentsFromWavePoint(wavePoint);
  const source: WaveHeightSourceTag =
    components[0] || components[1] ? "model_swell" : "model_hs";
  const result = transformToFaceHeightDecomposed({
    components,
    beach,
    source,
    rawHeightFt: wavePoint.significant_wave_height * METERS_TO_FEET,
    periodS: wavePoint.peak_wave_period,
    swellDirectionDeg: wavePoint.peak_wave_direction,
  });
  return result.faceHeightFt;
}

function summarizePrimary(components: Array<SwellComponentInput | null>): string {
  const component = components.find((c) => c != null);
  if (!component) return "none";
  return [
    fmtUnit(component.heightFt, "ft"),
    "@",
    fmtUnit(component.periodS, "s", 0),
    fmtUnit(component.directionDeg, "deg", 0),
  ].join(" ");
}

function printIntervalCoverage(gridData: NOAAGridData): void {
  const keys: Array<keyof NOAAGridData["properties"]> = [
    "waveHeight",
    "wavePeriod",
    "primarySwellHeight",
    "secondarySwellHeight",
    "wavePeriod2",
  ];

  for (const key of keys) {
    const values = field(gridData, key)?.values ?? [];
    const preview = values.slice(0, 3).map((entry) => {
      const interval = parseNOAAValidTime(entry.validTime);
      const hours = interval ? (interval.endMs - interval.startMs) / 3600000 : null;
      return `${entry.validTime} value=${fmt(entry.value)} hours=${fmt(hours, 0)}`;
    });
    console.log(`  ${key}: ${values.length} intervals`);
    for (const line of preview) {
      console.log(`    ${line}`);
    }
  }
}

function compareSlots(
  gridData: NOAAGridData,
  processed: WaveWatchData[],
  beach: BeachTerrainConfig,
  baseTime: Date
): SlotComparison[] {
  const processedByTimestamp = new Map(
    processed.map((wavePoint) => [wavePoint.timestamp, wavePoint])
  );
  const rows: SlotComparison[] = [];

  for (let index = 0; index < SLOTS; index++) {
    const timestamp = getTimestampForForecastSlot(index, baseTime);
    const wavePoint = processedByTimestamp.get(timestamp);
    const oldComponents = componentsFromPositionalIndex(gridData, index);

    rows.push({
      timestamp,
      oldFaceFt: strictWindowFaceHeight(oldComponents, beach),
      newFaceFt: wavePoint ? newFaceHeight(wavePoint, beach) : null,
      oldPrimary: summarizePrimary(oldComponents),
      newPrimary: wavePoint
        ? summarizePrimary(componentsFromWavePoint(wavePoint))
        : "no NOAA waveHeight coverage",
    });
  }

  return rows;
}

function countCoverage(
  gridData: NOAAGridData,
  baseTime: Date
): { noaa: number; missing: number } {
  let noaa = 0;
  let missing = 0;

  for (let index = 0; index < SLOTS; index++) {
    const timestamp = getTimestampForForecastSlot(index, baseTime);
    const targetMs = Date.parse(timestamp);
    if (getValueAtTime(field(gridData, "waveHeight"), targetMs) == null) {
      missing += 1;
    } else {
      noaa += 1;
    }
  }

  return { noaa, missing };
}

async function validateBeach(beach: BeachRow): Promise<void> {
  console.log(`\n=== ${beach.name} (${beach.slug}) ===`);
  console.log({
    lat: beach.lat,
    lon: beach.lon,
    terrain_enabled: beach.terrain_enabled,
    swell_window_center_deg: beach.swell_window_center_deg,
    swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
    deepwater_decay_factor: beach.deepwater_decay_factor,
    access_bins: Array.isArray(beach.swell_access_factors)
      ? beach.swell_access_factors.length
      : null,
  });

  const pointData = await fetchNOAAPointData(beach.lat, beach.lon);
  if (!pointData) {
    console.log("  NOAA point lookup failed; skipping beach.");
    return;
  }

  const gridUrl = constructGridUrl(pointData);
  if (!gridUrl) {
    console.log("  NOAA grid URL missing; skipping beach.");
    return;
  }

  const gridData = await fetchNOAAGridData(gridUrl);
  if (!gridData) {
    console.log("  NOAA grid fetch failed; skipping beach.");
    return;
  }

  console.log(
    `  grid: ${pointData.properties.gridId}/${pointData.properties.gridX},${pointData.properties.gridY}`
  );
  console.log("  interval coverage preview:");
  printIntervalCoverage(gridData);

  const baseTime = new Date();
  const processed = processNOAAGridData(gridData, DAYS, beach.lat, beach.lon, {
    baseTime,
  });
  const sourceCounts = countCoverage(gridData, baseTime);
  console.log("  next 72h source coverage:", {
    NOAA_NWS: sourceCounts.noaa,
    OPEN_METEO_fill: sourceCounts.missing,
    processed_NOAA_slots: processed.length,
  });

  const beachTerrain = toBeachTerrain(beach);
  const comparisons = compareSlots(gridData, processed, beachTerrain, baseTime);
  console.log("  old positional/strict-window vs new interval/terrain-access:");
  for (const row of comparisons.slice(0, 8)) {
    console.log(
      `    ${row.timestamp} old=${fmtUnit(row.oldFaceFt, "ft")} [${row.oldPrimary}] ` +
        `new=${fmtUnit(row.newFaceFt, "ft")} [${row.newPrimary}]`
    );
  }
}

async function main(): Promise<void> {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data, error } = await supabase
    .from("beaches")
    .select(
      "id, name, slug, lat, lon, terrain_enabled, swell_access_factors, shoaling_factors, swell_window_center_deg, swell_window_halfwidth_deg, deepwater_decay_factor"
    )
    .in("slug", [...BEACH_SLUGS]);

  if (error) {
    throw new Error(`Beach config lookup failed: ${error.message}`);
  }

  const beaches = (data ?? []) as BeachRow[];
  for (const slug of BEACH_SLUGS) {
    const beach = beaches.find((row) => row.slug === slug);
    if (!beach) {
      console.log(`\n=== ${slug} ===`);
      console.log("  Beach row missing; skipping.");
      continue;
    }
    await validateBeach(beach);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
