#!/usr/bin/env tsx
/**
 * Read-only live trace for the CDIP nowcast horizon fix.
 *
 * Compares the old 1h slot gate with the new CDIP staleness-aligned gate for
 * Blacks Beach and Cottons. Writes nothing.
 *
 * Run from quiver/:
 *   yarn tsx scripts/validate-cdip-nowcast-horizon.ts
 */

import { CDIP_NOWCAST_HORIZON_HOURS, STALENESS_THRESHOLDS } from "@/lib/config/forecast-staleness";
import { CDIPService } from "@/lib/services/cdip";
import { resolveCdipNowcastPoint } from "@/lib/services/forecast/forecast-builder";
import { cardinalToDegrees } from "@/lib/services/forecast/forecast-transformer";
import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch/noaa-wavewatch-service";
import type { WaveWatchData, WaveWatchForecast } from "@/lib/services/noaa-wavewatch/types";
import { METERS_TO_FEET, toFaceHeightFeetDecomposedWithDebug } from "@/lib/utils/wave-formatters";
import type {
  BeachTerrainConfig,
  ShoalingFactors,
  SwellComponentInput,
} from "@/lib/utils/wave-height-transformer";
import type { CDIPBuoyData, CDIPDataPoint } from "@/types/forecast";

const SLOT_HOURS = [0, 3, 6] as const;
const MAX_WAVEPOINT_DIFF_MS = 6 * 3_600_000;

const BLACKS_SHOALING: ShoalingFactors = {
  version: 1,
  type: "period_lookup",
  buckets: [
    { tp_min_s: 0, tp_max_s: 8, factor: 1.57 },
    { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
    { tp_min_s: 12, tp_max_s: 16, factor: 2.13 },
    { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
  ],
};

const COTTONS_SHOALING: ShoalingFactors = {
  version: 1,
  type: "period_lookup",
  buckets: [
    { tp_min_s: 0, tp_max_s: 8, factor: 1.07 },
    { tp_min_s: 8, tp_max_s: 12, factor: 1.22 },
    { tp_min_s: 12, tp_max_s: 16, factor: 1.44 },
    { tp_min_s: 16, tp_max_s: 999, factor: 1.55 },
  ],
};

interface TraceBeach {
  name: string;
  lat: number;
  lon: number;
  cdipStation: string;
  terrain: BeachTerrainConfig;
}

const BEACHES: TraceBeach[] = [
  {
    name: "Blacks Beach",
    lat: 32.8892,
    lon: -117.2549,
    cdipStation: "201",
    terrain: {
      terrain_enabled: true,
      swell_access_factors: null,
      shoaling_factors: BLACKS_SHOALING,
      swell_window_center_deg: 275,
      swell_window_halfwidth_deg: 80,
      deepwater_decay_factor: 1.15,
    },
  },
  {
    name: "Cottons",
    lat: 33.4021,
    lon: -117.6136,
    cdipStation: "45",
    terrain: {
      terrain_enabled: true,
      swell_access_factors: null,
      shoaling_factors: COTTONS_SHOALING,
      swell_window_center_deg: 155,
      swell_window_halfwidth_deg: 60,
      deepwater_decay_factor: 1,
    },
  },
];

interface FaceTrace {
  value: string | null;
  source: string | null;
  calibrated: boolean;
  rejection: string | null;
}

function fmt(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "null";
  return value.toFixed(digits);
}

function fmtAge(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "unknown";
  return `${hours.toFixed(2)}h`;
}

function latestCdipPoint(cdipData: CDIPBuoyData | null, nowMs: number): CDIPDataPoint | null {
  return resolveCdipNowcastPoint({
    cdipData,
    targetMs: nowMs,
    nowMs,
    horizonHours: 0,
    maxMeasurementAgeHours: Infinity,
  });
}

function measurementAgeHours(point: CDIPDataPoint | null, nowMs: number): number | null {
  if (!point) return null;
  const timestampMs = Date.parse(point.timestamp);
  if (!Number.isFinite(timestampMs)) return null;
  return (nowMs - timestampMs) / 3_600_000;
}

function pickWavePoint(
  waveData: WaveWatchForecast | null,
  targetMs: number,
): WaveWatchData | null {
  if (!waveData?.forecast?.length) return null;

  let closest: WaveWatchData | null = null;
  let minDiff = Infinity;

  for (const point of waveData.forecast) {
    const pointMs = Date.parse(point.timestamp);
    if (!Number.isFinite(pointMs)) continue;

    const diff = Math.abs(pointMs - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return minDiff <= MAX_WAVEPOINT_DIFF_MS ? closest : null;
}

function toComponent(
  heightM: number | null | undefined,
  periodS: number | null | undefined,
  directionDeg: number | null | undefined,
  partition?: "wind_wave",
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
    directionDeg: directionDeg ?? null,
    ...(partition ? { partition } : {}),
  };
}

function componentsFromWavePoint(
  wavePoint: WaveWatchData | null,
): Array<SwellComponentInput | null> {
  if (!wavePoint) return [null, null, null];
  return [
    toComponent(
      wavePoint.swell_1_height,
      wavePoint.swell_1_period,
      cardinalToDegrees(wavePoint.swell_1_direction),
    ),
    toComponent(
      wavePoint.swell_2_height,
      wavePoint.swell_2_period,
      cardinalToDegrees(wavePoint.swell_2_direction),
    ),
    toComponent(
      wavePoint.wind_wave_height,
      wavePoint.wind_wave_period,
      cardinalToDegrees(wavePoint.wind_wave_direction),
      "wind_wave",
    ),
  ];
}

function computeFaceTrace(args: {
  cdipPoint: CDIPDataPoint | null;
  wavePoint: WaveWatchData | null;
  terrain: BeachTerrainConfig;
}): FaceTrace {
  const { cdipPoint, wavePoint, terrain } = args;
  const periodS =
    cdipPoint?.peakWavePeriod ??
    cdipPoint?.swellPeriod ??
    wavePoint?.swell_1_period ??
    wavePoint?.peak_wave_period ??
    null;
  const swellDirectionDeg =
    cdipPoint?.peakWaveDirection ??
    cdipPoint?.swellDirection ??
    cardinalToDegrees(wavePoint?.swell_1_direction) ??
    cardinalToDegrees(wavePoint?.peak_wave_direction) ??
    null;

  const result = cdipPoint
    ? toFaceHeightFeetDecomposedWithDebug({
        cdipSigFt: cdipPoint.significantWaveHeight,
        cdipSwellFt: cdipPoint.swellHeight,
        modelSwellM: wavePoint?.swell_1_height,
        modelHsM: wavePoint?.significant_wave_height,
        beach: terrain,
        periodS,
        swellDirectionDeg,
        components: [null, null, null],
      })
    : toFaceHeightFeetDecomposedWithDebug({
        cdipSigFt: undefined,
        cdipSwellFt: undefined,
        modelSwellM: wavePoint?.swell_1_height,
        modelHsM: wavePoint?.significant_wave_height,
        beach: terrain,
        periodS,
        swellDirectionDeg,
        components: componentsFromWavePoint(wavePoint),
      });

  return {
    value: result.value,
    source: result.debug.source,
    calibrated: result.debug.calibratedShoalingFired,
    rejection: result.debug.cdipRejection?.reason ?? null,
  };
}

function sourceLabel(cdipPoint: CDIPDataPoint | null, face: FaceTrace): string {
  if (cdipPoint && face.rejection) {
    return `CDIP_REJECTED/${face.source}/${face.rejection}`;
  }
  return cdipPoint
    ? `CDIP/${face.source}${face.calibrated ? "/cal" : ""}`
    : `${face.source}${face.calibrated ? "/cal" : ""}`;
}

function resolvePointForGate(args: {
  cdipData: CDIPBuoyData | null;
  targetMs: number;
  nowMs: number;
  horizonHours: number;
  maxMeasurementAgeHours: number;
}): CDIPDataPoint | null {
  return resolveCdipNowcastPoint(args);
}

function makeSyntheticOutlier(
  base: CDIPDataPoint | null,
  wavePoint: WaveWatchData,
): CDIPDataPoint {
  const modelSwellFt = wavePoint.swell_1_height * METERS_TO_FEET;
  const syntheticCdipFt = Math.max(modelSwellFt * 1.9, modelSwellFt + 0.5);
  return {
    timestamp: base?.timestamp ?? new Date().toISOString(),
    significantWaveHeight: syntheticCdipFt,
    peakWavePeriod: base?.peakWavePeriod ?? wavePoint.peak_wave_period,
    peakWaveDirection: base?.peakWaveDirection ?? wavePoint.peak_wave_direction,
    swellHeight: syntheticCdipFt * 0.8,
    swellPeriod: base?.swellPeriod ?? wavePoint.swell_1_period,
    swellDirection: base?.swellDirection ?? wavePoint.swell_1_direction,
  };
}

function wouldRejectCdipAsOutlier(
  cdipPoint: CDIPDataPoint | null,
  wavePoint: WaveWatchData | null,
): boolean {
  if (!cdipPoint || !wavePoint) return false;
  const modelSwellFt = wavePoint.swell_1_height * METERS_TO_FEET;
  if (!Number.isFinite(modelSwellFt) || modelSwellFt <= 0) return false;
  return (
    cdipPoint.significantWaveHeight > 10 ||
    cdipPoint.significantWaveHeight > modelSwellFt * 1.8
  );
}

async function traceBeach(
  beach: TraceBeach,
  services: { cdip: CDIPService; wave: NOAAWaveWatchService },
): Promise<number> {
  const nowMs = Date.now();
  const [cdipData, waveData] = await Promise.all([
    services.cdip.fetchBuoyData(beach.cdipStation),
    services.wave.fetchWaveWatchForecast(beach.lat, beach.lon, 1),
  ]);

  console.log(`\n=== ${beach.name} (CDIP ${beach.cdipStation}) ===`);
  if (!waveData?.forecast?.length) {
    console.log("FAIL: no live NOAA/Open-Meteo wave forecast returned");
    return 1;
  }

  const latest = latestCdipPoint(cdipData, nowMs);
  const ageHours = measurementAgeHours(latest, nowMs);
  console.log(
    `latest CDIP: Hs=${fmt(latest?.significantWaveHeight)}ft ` +
      `Tp=${fmt(latest?.peakWavePeriod, 1)}s ` +
      `Dp=${fmt(latest?.peakWaveDirection, 0)}deg ` +
      `age=${fmtAge(ageHours)}`,
  );
  console.log(
    `gate: old=1h/no age cap, new=${CDIP_NOWCAST_HORIZON_HOURS}h slot + ` +
      `${STALENESS_THRESHOLDS.CDIP}h measurement age`,
  );

  let failures = 0;
  const cdipIsFresh = ageHours != null && ageHours <= STALENESS_THRESHOLDS.CDIP;

  for (const slotHours of SLOT_HOURS) {
    const targetMs = nowMs + slotHours * 3_600_000;
    const wavePoint = pickWavePoint(waveData, targetMs);
    const oldCdipPoint = resolvePointForGate({
      cdipData,
      targetMs,
      nowMs,
      horizonHours: 1,
      maxMeasurementAgeHours: Infinity,
    });
    const newCdipPoint = resolvePointForGate({
      cdipData,
      targetMs,
      nowMs,
      horizonHours: CDIP_NOWCAST_HORIZON_HOURS,
      maxMeasurementAgeHours: STALENESS_THRESHOLDS.CDIP,
    });
    const oldFace = computeFaceTrace({
      cdipPoint: oldCdipPoint,
      wavePoint,
      terrain: beach.terrain,
    });
    const newFace = computeFaceTrace({
      cdipPoint: newCdipPoint,
      wavePoint,
      terrain: beach.terrain,
    });

    console.log(
      `slot +${slotHours}h target=${new Date(targetMs).toISOString()} ` +
        `model=${wavePoint?.data_source ?? "none"} ` +
        `modelHs=${fmt(wavePoint?.significant_wave_height)}m ` +
        `old=${oldFace.value ?? "null"} [${sourceLabel(oldCdipPoint, oldFace)}] ` +
        `new=${newFace.value ?? "null"} [${sourceLabel(newCdipPoint, newFace)}]`,
    );

    if (cdipIsFresh && (slotHours === 0 || slotHours === 3)) {
      const rejectedByQualityGate = wouldRejectCdipAsOutlier(
        newCdipPoint,
        wavePoint,
      );
      if (rejectedByQualityGate) {
        if (
          newFace.source !== "model_swell" ||
          newFace.calibrated ||
          newFace.rejection == null
        ) {
          console.log(
            `FAIL: +${slotHours}h CDIP outlier should fall back to model_swell`,
          );
          failures += 1;
        } else {
          console.log(
            `info: +${slotHours}h selected CDIP but outlier gate correctly fell back to model_swell`,
          );
        }
      } else if (newFace.source !== "cdip_sig" || !newFace.calibrated) {
        console.log(`FAIL: +${slotHours}h should use calibrated CDIP`);
        failures += 1;
      }
    }
    if (slotHours === 3 && oldCdipPoint !== null) {
      console.log("FAIL: old 1h gate unexpectedly selected CDIP for +3h");
      failures += 1;
    }
    if (slotHours === 6 && newCdipPoint !== null) {
      console.log("FAIL: +6h should remain model-backed beyond nowcast horizon");
      failures += 1;
    }
  }

  if (!cdipIsFresh) {
    console.log(
      "INCONCLUSIVE: live CDIP is stale, so the near-now CDIP path cannot be validated for this beach.",
    );
  }

  const wavePoint = pickWavePoint(waveData, nowMs);
  if (!wavePoint) {
    console.log("FAIL: no model slot available for outlier invariant");
    return failures + 1;
  }

  const outlier = makeSyntheticOutlier(latest, wavePoint);
  const outlierFace = computeFaceTrace({
    cdipPoint: outlier,
    wavePoint,
    terrain: beach.terrain,
  });
  console.log(
    `outlier check: syntheticCdip=${fmt(outlier.significantWaveHeight)}ft ` +
      `modelSwell=${fmt(wavePoint.swell_1_height * METERS_TO_FEET)}ft ` +
      `source=${outlierFace.source} calibrated=${outlierFace.calibrated} ` +
      `rejection=${outlierFace.rejection ?? "none"}`,
  );

  if (
    outlierFace.source !== "model_swell" ||
    outlierFace.calibrated ||
    outlierFace.rejection == null
  ) {
    console.log("FAIL: synthetic CDIP outlier did not fall back to model_swell");
    failures += 1;
  }

  if (failures === 0) {
    console.log("PASS");
  }
  return failures;
}

async function main(): Promise<void> {
  const services = {
    cdip: new CDIPService(),
    wave: new NOAAWaveWatchService(),
  };

  let failures = 0;
  for (const beach of BEACHES) {
    failures += await traceBeach(beach, services);
  }

  if (failures > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("Validation script error:", error);
  process.exit(1);
});
