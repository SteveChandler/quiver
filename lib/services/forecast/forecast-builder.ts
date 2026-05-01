/**
 * Forecast Builder
 *
 * Combines multiple data sources (wave, tide, weather, buoy, CDIP) into comprehensive
 * forecast entities. Handles data prioritization and fallbacks.
 *
 * Extracted from lib/services/enhanced-forecast-service.ts as part of P1 refactoring
 * to reduce file size and improve maintainability.
 */

import { createContextLogger } from "@/lib/logger";
import { calculateConfidenceScore } from "./confidence-scorer";
import {
  toFaceHeightFeetDecomposedWithDebug,
  METERS_TO_FEET,
  type WaveHeightDebugInfo,
} from "@/lib/utils/wave-formatters";
import {
  applyBeachHeightOffset,
  formatDisplayHeightFt,
  parseDisplayHeightFt,
} from "./apply-beach-height-offset";
import {
  logDisplayPredictions,
  type DisplayPredictionRow,
} from "./log-display-prediction";
import { createServiceRoleClient } from "@/lib/supabase";
import type {
  ShoalingFactors,
  SwellComponentInput,
} from "@/lib/utils/wave-height-transformer";
import { cardinalToDegrees } from "./forecast-transformer";
import { formatWaterTemp } from "@/lib/formatters/surf-data";
import { formatPeriodSeconds } from "@/lib/formatters/surf-data";
import { getNormalizedDateString, getNormalizedTimeString, getNormalizedForecastAt } from "./datetime-utils";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";
import type { Beach } from "@/types/database";
import {
  FORECAST_CONSTANTS,
  TOTAL_FORECASTS,
  type EnhancedForecastEntity,
  type EnhancedForecastWithRawData,
  type CDIPBuoyData,
} from "@/types/forecast";
import type { NowcastAnchor } from "@/lib/services/observations/nowcast-anchor.types";
import { isNowcastAnchorEnabled } from "@/lib/services/observations/nowcast-anchor.types";
import { STALENESS_THRESHOLDS } from "@/lib/config/forecast-staleness";
import { pickDominantSwell } from "@/lib/domains/conditions";

/**
 * Nowcast-anchor design (see plan golden-sleeping-steele.md):
 *  - NOWCAST_WINDOW_MS: forecast rows within ±1.5h of now may be anchored.
 *  - ANCHOR_FRESHNESS_MS: observations up to NOWCAST_ANCHOR hours old count as valid.
 * Sourced from STALENESS_THRESHOLDS.NOWCAST_ANCHOR for one source of truth across
 * forecast-builder + the display-side `fetchLatestObservation` helper.
 */
const NOWCAST_WINDOW_MS = 1.5 * 60 * 60 * 1000;
const ANCHOR_FRESHNESS_MS = STALENESS_THRESHOLDS.NOWCAST_ANCHOR * 60 * 60 * 1000;

export function shouldApplyNowcastAnchor(args: {
  beachFeatures: string[] | null | undefined;
  anchor: NowcastAnchor | undefined;
  forecastAtMs: number;
  nowMs: number;
}): boolean {
  if (!isNowcastAnchorEnabled(args.beachFeatures)) return false;
  if (!args.anchor) return false;
  if (Math.abs(args.forecastAtMs - args.nowMs) > NOWCAST_WINDOW_MS) return false;
  const observedMs = Date.parse(args.anchor.observedAt);
  if (Number.isNaN(observedMs)) return false;
  const age = args.nowMs - observedMs;
  if (age < 0 || age > ANCHOR_FRESHNESS_MS) return false;
  return true;
}
import type { TideStatus } from "@/lib/services/noaa-coops/types";
import type {
  WaveWatchForecast,
  WaveWatchData,
  COOPSForecast,
  COOPSTideData,
  WeatherPeriod,
  CDIPDataPoint,
  NDBCBuoyRow,
  ResolvedTideInfo,
} from "./api-types";

/**
 * Interface for injected dependencies (services)
 */
export interface DataSourceServices {
  getWaveDirectionText: (degrees: number) => string;
  getTideStatusAtTime: (tides: COOPSTideData[], time: Date) => TideStatus;
  getTideHeightAtTime: (tides: COOPSTideData[], time: Date) => number | null;
  getNextTideFromTime: (tides: COOPSTideData[], time: Date) => COOPSTideData | null;
  getDataQualityScore: (data: CDIPBuoyData) => number;
}

/**
 * Per-beach height offset row, loaded once per cron invocation by the caller
 * and passed in via ForecastInputs.offsetMap. Mirrors the
 * beach_height_offsets table shape; kept narrow because forecast-builder only
 * reads the columns the helper consumes.
 */
export type BeachHeightOffsetRow = {
  offset_m: number | null;
  sample_count: number | null;
  mae_before_m: number | null;
  mae_after_m: number | null;
  computed_at: string | null;
};

/**
 * Input data for building forecasts
 */
export interface ForecastInputs {
  beach: Beach;
  waveData: WaveWatchForecast | null;
  tideData: COOPSForecast | null;
  weatherData: WeatherPeriod[];
  buoyData: NDBCBuoyRow | null;
  cdipData: CDIPBuoyData | null;
  ioosWaterTempC: number | null;
  coopsWaterTempC: number | null;
  /**
   * Optional single-row buoy observation anchor for THIS beach, produced by
   * fetchNowcastAnchors() once per cron invocation. When the beach opts in
   * via `features: ['observation_anchor']` and nowcast-window gates pass,
   * getWaveHeight swaps this observation in as the Hs input. Missing = use
   * forecast-only path (current behavior).
   */
  nowcastAnchor?: NowcastAnchor | null;
  /**
   * Optional per-beach height offset row (source='display'), loaded for the
   * beach being built. When undefined the helper short-circuits to identity
   * and wave_height is byte-identical to today's output.
   */
  heightOffset?: BeachHeightOffsetRow | null;
}

const log = createContextLogger("ForecastBuilder");

/**
 * Read the per-beach offset config from a Beach row. The columns
 * `height_offset_enabled`, `height_offset_min_sample_count`, and
 * `height_offset_max_age_days` were added by migration
 * 20260501200500_create_beach_height_offsets.sql but the generated DB types
 * have not yet been regenerated (per task constraint). This helper isolates
 * the typed cast to one place and applies the migration's column defaults.
 */
function readBeachOffsetConfig(beach: Beach): {
  enabled: boolean;
  minSampleCount: number;
  maxAgeDays: number;
} {
  const cfg = beach as unknown as {
    height_offset_enabled?: boolean | null;
    height_offset_min_sample_count?: number | null;
    height_offset_max_age_days?: number | null;
  };
  return {
    enabled: cfg.height_offset_enabled === true,
    minSampleCount: cfg.height_offset_min_sample_count ?? 30,
    maxAgeDays: cfg.height_offset_max_age_days ?? 14,
  };
}

/**
 * Batch-load beach_height_offsets rows for a set of beaches in ONE query.
 * Production callers (e.g. enhanced-forecast-service.updateAllEnhancedForecasts)
 * should use this and pass the resulting Map into ForecastInputs.heightOffset
 * per beach to avoid N+1 lookups.
 *
 * Returns an empty Map on any failure — the helper short-circuits to identity
 * when no offset row is provided, so the caller is safe to fall through.
 */
export async function loadHeightOffsetsForBeaches(
  beachIds: string[]
): Promise<Map<string, BeachHeightOffsetRow>> {
  const out = new Map<string, BeachHeightOffsetRow>();
  if (!beachIds || beachIds.length === 0) return out;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("beach_height_offsets" as never)
      .select(
        "beach_id, offset_m, sample_count, mae_before_m, mae_after_m, computed_at"
      )
      .eq("source", "display")
      .in("beach_id", beachIds);

    if (error || !data) return out;

    for (const row of data as unknown as Array<
      BeachHeightOffsetRow & { beach_id: string }
    >) {
      out.set(row.beach_id, {
        offset_m: row.offset_m,
        sample_count: row.sample_count,
        mae_before_m: row.mae_before_m,
        mae_after_m: row.mae_after_m,
        computed_at: row.computed_at,
      });
    }
  } catch (err) {
    log.warn("loadHeightOffsetsForBeaches failed", {
      err: err instanceof Error ? err.message : String(err),
      beachCount: beachIds.length,
    });
  }

  return out;
}

/**
 * Builds forecast entities by combining data from multiple sources
 */
export class ForecastBuilder {
  private services: DataSourceServices;
  private verbose: boolean;

  constructor(services: DataSourceServices, verbose = false) {
    this.services = services;
    this.verbose = verbose;
  }

  /**
   * Build forecasts from raw data sources
   */
  async buildForecasts(inputs: ForecastInputs): Promise<EnhancedForecastWithRawData[]> {
    const { beach, waveData, tideData, weatherData, buoyData, cdipData, ioosWaterTempC, coopsWaterTempC, nowcastAnchor, heightOffset } = inputs;
    const forecasts: EnhancedForecastWithRawData[] = [];
    const now = new Date();

    // If no offset row was preloaded by the caller AND the beach has the flag
    // enabled, fetch it inline so the helper has data to work with. Most
    // production callers pre-load via a single batched query (see
    // loadHeightOffsetsForBeaches below) to avoid N+1 — this branch is the
    // single-beach fallback path. The new height_offset_* columns are not yet
    // in the generated DB types (added by migration 20260501200500), so we
    // read them via a narrow typed projection.
    const beachOffsetCfg = readBeachOffsetConfig(beach);
    let resolvedOffset: BeachHeightOffsetRow | null | undefined = heightOffset;
    if (resolvedOffset === undefined && beachOffsetCfg.enabled) {
      resolvedOffset = await this.loadOffsetForBeach(beach.id);
    }

    // Snapshot buffer for ml_predictions_log. Captured pre-offset (telemetry
    // feedback-loop invariant) inside buildSingleForecast and flushed after
    // the row loop completes.
    const snapshotBuffer: DisplayPredictionRow[] = [];

    // Determine data sources used for metadata
    const dataSources: string[] = [];
    if (cdipData) dataSources.push("CDIP");
    if (waveData) dataSources.push("NOAA_NWS");
    if (tideData) dataSources.push("NOAA_COOPS");
    if (buoyData) dataSources.push("NOAA_BUOY");
    if (dataSources.length === 0) dataSources.push("FALLBACK");

    // Track processed dates to store tide_schedule only once per day
    const processedDates = new Set<string>();

    // Generate forecasts for each time point
    for (let i = 0; i < TOTAL_FORECASTS; i++) {
      const forecastTime = new Date(
        now.getTime() + i * FORECAST_CONSTANTS.INTERVAL_HOURS * 60 * 60 * 1000
      );

      // Get data for this time point
      const wavePoint = this.getWaveDataForTime(waveData, forecastTime);
      const tideInfo = this.getTideInfo(tideData, forecastTime, beach.timezone);
      const weatherPoint = this.getWeatherDataForTime(weatherData, forecastTime);
      const cdipPoint = this.getCDIPDataForTime(cdipData, forecastTime);

      // Determine data source for this time point.
      // Per-slot wavePoint.data_source is canonical (NOAA_NWS for days 1-3,
      // OPEN_METEO for days 4-12 after merge). No wrapper-level fallback —
      // it would mask one source as the other.
      const useBuoyData = i === 0 && buoyData;
      const useCDIPData = !!cdipPoint;
      const timepointDataSource = useCDIPData
        ? "CDIP"
        : wavePoint
          ? (wavePoint.data_source ?? "FALLBACK")
          : (useBuoyData ? "NOAA_BUOY" : "FALLBACK");

      // Calculate confidence score
      const confidenceScore = calculateConfidenceScore({
        hasWaveData: !!wavePoint,
        hasTideData: !!tideInfo,
        hasWeatherData: !!weatherPoint,
        hasBuoyData: !!useBuoyData,
        hasCDIPData: useCDIPData,
        forecastHoursAhead: i * FORECAST_CONSTANTS.INTERVAL_HOURS,
      });

      // Check if this is the first forecast of the day
      const dateString = getNormalizedDateString(forecastTime);
      const isFirstOfDay = !processedDates.has(dateString);
      if (isFirstOfDay) {
        processedDates.add(dateString);
      }

      // Resolve the active nowcast anchor for THIS forecast row (if any).
      // Gate: beach opted into feature flag, observation is fresh enough
      // (≤6h), and the forecast row is within the ±1.5h nowcast window.
      const applyAnchor = shouldApplyNowcastAnchor({
        beachFeatures: beach.features ?? null,
        anchor: nowcastAnchor ?? undefined,
        forecastAtMs: forecastTime.getTime(),
        nowMs: now.getTime(),
      });
      const effectiveAnchor = applyAnchor ? (nowcastAnchor ?? null) : null;

      // Build the forecast entity
      const forecast = this.buildSingleForecast({
        beach,
        forecastTime,
        dateString,
        wavePoint,
        cdipPoint,
        tideInfo,
        weatherPoint,
        buoyData: useBuoyData ? buoyData : null,
        useCDIPData,
        confidenceScore,
        timepointDataSource,
        dataSources,
        tideData,
        isFirstOfDay,
        cdipData,
        now,
        ioosWaterTempC,
        coopsWaterTempC,
        nowcastAnchor: effectiveAnchor,
        heightOffset: resolvedOffset ?? null,
        snapshotBuffer,
      });

      forecasts.push(forecast);
    }

    // Fire-and-forget snapshot write. NEVER awaited and NEVER throws —
    // logDisplayPredictions catches all errors internally. This must not block
    // the forecast write path under any failure mode (env missing, network,
    // schema mismatch, etc.). See feedback_dont_parallelize_redirect_critical_awaits.
    if (snapshotBuffer.length > 0) {
      try {
        void logDisplayPredictions(snapshotBuffer).catch((err) => {
          log.warn("Snapshot write rejected (non-blocking)", { err: String(err) });
        });
      } catch (err) {
        log.warn("Snapshot dispatch threw synchronously (non-blocking)", {
          err: String(err),
        });
      }
    }

    return forecasts;
  }

  /**
   * Single-beach fallback offset loader. Production callers should batch-load
   * with loadHeightOffsetsForBeaches to avoid N+1.
   */
  private async loadOffsetForBeach(
    beachId: string
  ): Promise<BeachHeightOffsetRow | null> {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("beach_height_offsets" as never)
        .select(
          "offset_m, sample_count, mae_before_m, mae_after_m, computed_at"
        )
        .eq("beach_id", beachId)
        .eq("source", "display")
        .maybeSingle();

      if (error || !data) return null;
      return data as unknown as BeachHeightOffsetRow;
    } catch (err) {
      log.warn("loadOffsetForBeach failed", {
        beachId,
        err: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Build a single forecast entity
   */
  private buildSingleForecast(params: {
    beach: Beach;
    forecastTime: Date;
    dateString: string;
    wavePoint: WaveWatchData | null;
    cdipPoint: CDIPDataPoint | null;
    tideInfo: ResolvedTideInfo;
    weatherPoint: WeatherPeriod | null;
    buoyData: NDBCBuoyRow | null;
    useCDIPData: boolean;
    confidenceScore: number;
    timepointDataSource: string;
    dataSources: string[];
    tideData: COOPSForecast | null;
    isFirstOfDay: boolean;
    cdipData: CDIPBuoyData | null;
    now: Date;
    ioosWaterTempC: number | null;
    coopsWaterTempC: number | null;
    nowcastAnchor: NowcastAnchor | null;
    heightOffset: BeachHeightOffsetRow | null;
    snapshotBuffer: DisplayPredictionRow[];
  }): EnhancedForecastWithRawData {
    const {
      beach,
      forecastTime,
      dateString,
      wavePoint,
      cdipPoint,
      tideInfo,
      weatherPoint,
      buoyData,
      useCDIPData,
      confidenceScore,
      timepointDataSource,
      dataSources,
      tideData,
      isFirstOfDay,
      cdipData,
      now,
      ioosWaterTempC,
      coopsWaterTempC,
      nowcastAnchor,
      heightOffset,
      snapshotBuffer,
    } = params;

    // Compute wave height once and capture provenance metadata for raw_forecast.
    // The debug record explains which source/transform path produced the number,
    // making post-hoc "why does Quiver show X?" questions answerable from one row.
    const waveHeightResult = this.getWaveHeight(
      cdipPoint,
      wavePoint,
      buoyData,
      useCDIPData,
      beach,
      nowcastAnchor,
    );

    // Telemetry feedback-loop invariant: parse the PRE-offset display value
    // and capture rawDisplayHeightFt BEFORE applyBeachHeightOffset runs. The
    // snapshot writer below uses this raw value directly; it never re-derives
    // from enhanced_forecasts.wave_height (which would close a feedback loop
    // once the cron starts writing offsets).
    const parsedDisplay = parseDisplayHeightFt(waveHeightResult.value);
    const rawDisplayHeightFt = parsedDisplay.numericFt;

    // Compute the forecast horizon in hours from issue time (now) to the
    // forecast slot. Used for both the offset gate (only 24h+ horizons in
    // initial rollout) and the snapshot row's forecast_horizon_hours column.
    const forecastHorizonHours =
      (forecastTime.getTime() - now.getTime()) / (60 * 60 * 1000);

    // Apply offset. The helper short-circuits to identity when:
    //   - heightOffset is null (no row yet for this beach)
    //   - beach.height_offset_enabled is false
    //   - sample_count < min, computed_at stale, MAE not improved, etc.
    // When ANY gate fails, correctedFt === rawDisplayHeightFt so wave_height
    // is byte-identical to today's output.
    const beachOffsetCfgRow = readBeachOffsetConfig(beach);
    const correctedFt =
      rawDisplayHeightFt == null
        ? null
        : applyBeachHeightOffset({
            heightFt: rawDisplayHeightFt,
            offsetM: heightOffset?.offset_m,
            sampleCount: heightOffset?.sample_count,
            enabled: beachOffsetCfgRow.enabled,
            forecastHorizonHours,
            computedAt: heightOffset?.computed_at ?? null,
            maeBeforeM: heightOffset?.mae_before_m,
            maeAfterM: heightOffset?.mae_after_m,
            minSampleCount: beachOffsetCfgRow.minSampleCount,
            maxOffsetAgeDays: beachOffsetCfgRow.maxAgeDays,
          });

    // Determine whether the offset actually applied (corrected differs from
    // raw). When any gate fails, both numbers are equal and we emit null for
    // height_offset_m/sample_count so analysis can distinguish "applied" from
    // "no-op".
    const offsetActuallyApplied =
      rawDisplayHeightFt != null &&
      correctedFt != null &&
      Math.abs(correctedFt - rawDisplayHeightFt) > 1e-6;

    // Re-stringify ONLY when the offset actually changed the value. When no
    // offset applied (any gate failed) we leave the original string untouched
    // so wave_height is byte-identical to today's output. Reformatting an
    // unchanged value would needlessly diverge ("3 ft" → "3ft") and break the
    // height_offset_enabled=false invariant.
    const finalWaveHeightString =
      offsetActuallyApplied && correctedFt != null
        ? formatDisplayHeightFt({
            numericFt: correctedFt,
            rangeSpread: parsedDisplay.rangeSpread,
          })
        : waveHeightResult.value;

    // Append snapshot row when the parser produced a numeric value. We do not
    // snapshot rows where the display value was null/unparseable — the cron
    // can't compute residuals against a missing prediction.
    if (rawDisplayHeightFt != null && correctedFt != null) {
      const rawDisplayHeightM = rawDisplayHeightFt / METERS_TO_FEET;
      const correctedDisplayM = correctedFt / METERS_TO_FEET;
      snapshotBuffer.push({
        beach_id: beach.id,
        predicted_at: getNormalizedForecastAt(forecastTime),
        forecast_horizon_hours: Math.max(
          0,
          Math.round(forecastHorizonHours)
        ),
        raw_display_height_m: Number(rawDisplayHeightM.toFixed(3)),
        offset_corrected_display_height_m: Number(correctedDisplayM.toFixed(3)),
        height_offset_m: offsetActuallyApplied
          ? heightOffset?.offset_m ?? null
          : null,
        height_offset_sample_count: offsetActuallyApplied
          ? heightOffset?.sample_count ?? null
          : null,
        display_source: "face-Hs-transformer-v1",
      });
    }

    return {
      id: `forecast-${beach.id}-${forecastTime.getTime()}`,
      forecast_date: dateString,
      forecast_time: getNormalizedTimeString(forecastTime),
      forecast_at: getNormalizedForecastAt(forecastTime),

      // Honest face-height from the per-component transformer. The raw OM Hs is
      // still co-located on this row in `wave_height_om` for the Seaside ML
      // pipeline. The OM-primary scalar override (now removed) was inflating
      // display by ~2× because raw deep-water Hs is not face height.
      // Per-beach offset (when enabled + gates pass) is layered on TOP via
      // applyBeachHeightOffset; otherwise byte-identical to waveHeightResult.value.
      wave_height: finalWaveHeightString,
      wave_period: this.getWavePeriod(cdipPoint, wavePoint, buoyData, useCDIPData),
      wave_direction: this.getWaveDirection(cdipPoint, wavePoint, useCDIPData),

      // Detailed swell information
      swell_1_height: this.getSwell1Height(cdipPoint, wavePoint, useCDIPData),
      swell_1_period: this.getSwell1Period(cdipPoint, wavePoint, useCDIPData),
      swell_1_direction: this.getSwell1Direction(cdipPoint, wavePoint, useCDIPData),

      swell_2_height: this.getSwell2Height(wavePoint),
      swell_2_period: this.getSwell2Period(wavePoint),
      swell_2_direction: this.getSwell2Direction(wavePoint),

      // Wind waves
      wind_wave_height: this.getWindWaveHeight(cdipPoint, wavePoint, useCDIPData),
      wind_wave_period: this.getWindWavePeriod(cdipPoint, wavePoint, useCDIPData),
      wind_wave_direction: this.getWindWaveDirection(cdipPoint, wavePoint, useCDIPData),

      // Raw Open-Meteo values co-located on this row (when OM had data for
      // this slot at fetch time). NULL when outside OM's 168h horizon or
      // when OM fetch failed. The Seaside ML service reads these directly.
      ...(wavePoint?.om_values
        ? {
            wave_height_om: wavePoint.om_values.wave_height_om,
            wave_period_om: wavePoint.om_values.wave_period_om,
            wave_direction_om: wavePoint.om_values.wave_direction_om,
            swell_height_om: wavePoint.om_values.swell_height_om,
            swell_period_om: wavePoint.om_values.swell_period_om,
            swell_direction_om: wavePoint.om_values.swell_direction_om,
            wind_wave_height_om: wavePoint.om_values.wind_wave_height_om,
            om_fetched_at: now.toISOString(),
          }
        : {}),

      // Water temperature
      water_temp: this.getWaterTemperature(buoyData, beach, forecastTime, ioosWaterTempC, coopsWaterTempC),

      // Wind data
      wind_speed: this.getWindSpeed(weatherPoint),
      wind_direction: this.getWindDirection(weatherPoint),
      wind_direction_deg: cardinalToDegrees(weatherPoint?.windDirection || "SW"),
      wind_source: weatherPoint?.windSpeed ? 'NWS' : null,

      // Tide information
      tide_status: tideInfo.status,
      tide_height: tideInfo.currentHeight,
      next_tide_time: tideInfo.nextTideTime,
      next_tide_type: tideInfo.nextTideType,
      next_tide_height: tideInfo.nextTideHeight,
      next_tide_at: tideInfo.nextTideAt,
      coops_station_id: tideData?.station_id || null,

      // Weather conditions
      weather_condition: weatherPoint?.shortForecast || "Partly Cloudy",
      air_temperature: this.getAirTemperature(weatherPoint, beach, forecastTime),

      beach_id: beach.id,
      confidence_score: confidenceScore,
      data_source: timepointDataSource,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),

      // Raw forecast metadata
      raw_forecast: this.buildRawForecast({
        dataSources,
        useCDIPData,
        cdipData,
        confidenceScore,
        isFirstOfDay,
        tideData,
        now,
        waveHeightDebug: waveHeightResult.debug,
        nowcastAnchor,
      }),
    } as EnhancedForecastWithRawData;
  }

  /**
   * Build raw_forecast metadata object
   */
  private buildRawForecast(params: {
    dataSources: string[];
    useCDIPData: boolean;
    cdipData: CDIPBuoyData | null;
    confidenceScore: number;
    isFirstOfDay: boolean;
    tideData: COOPSForecast | null;
    now: Date;
    waveHeightDebug: WaveHeightDebugInfo;
    nowcastAnchor: NowcastAnchor | null;
  }): EnhancedForecastWithRawData["raw_forecast"] {
    const {
      dataSources,
      useCDIPData,
      cdipData,
      confidenceScore,
      isFirstOfDay,
      tideData,
      now,
      waveHeightDebug,
      nowcastAnchor,
    } = params;

    // Resolve the station_id for the wave-height provenance record. The
    // debug info doesn't carry it because the transformer doesn't know which
    // upstream row supplied each input — only the builder has that context.
    const provenanceStationId = (() => {
      switch (waveHeightDebug.source) {
        case 'nowcast_anchor':
          return nowcastAnchor?.stationId ?? null;
        case 'cdip_sig':
        case 'cdip_swell':
          return cdipData?.stationId ?? null;
        default:
          return null;
      }
    })();

    return {
      data_sources: dataSources,
      ...(useCDIPData &&
        cdipData && {
          cdip_data: {
            stationId: cdipData.stationId,
            stationName: cdipData.stationName,
            lastUpdated: cdipData.lastUpdated,
            dataSource: "CDIP" as const,
            data: Array.isArray(cdipData.data) ? cdipData.data.slice(0, 2) : [],
          },
        }),
      quality_scores: {
        cdip: cdipData ? this.services.getDataQualityScore(cdipData) : undefined,
        noaa: 75,
        overall: confidenceScore,
      },
      fetch_timestamps: {
        cdip: cdipData?.lastUpdated,
        noaa: now.toISOString(),
      },
      wave_height_provenance: {
        source: waveHeightDebug.source,
        raw_value_ft: waveHeightDebug.rawHeightFt,
        station_id: provenanceStationId,
        transform_path: waveHeightDebug.transformPath,
        components_used: waveHeightDebug.componentsUsed,
        calibrated_shoaling_fired: waveHeightDebug.calibratedShoalingFired,
        ...(waveHeightDebug.cdipRejection
          ? {
              cdip_rejection: {
                reason: waveHeightDebug.cdipRejection.reason,
                raw_cdip_hs: waveHeightDebug.cdipRejection.rawCdipHs,
                raw_model_hs: waveHeightDebug.cdipRejection.rawModelHs,
              },
            }
          : {}),
      },
      ...(isFirstOfDay && tideData && tideData.tides && tideData.tides.length > 0
        ? {
            tide_schedule: tideData.tides
              .slice(0, 20)
              .map((t) => ({
                time: t.time,
                height: t.height,
                type: t.type as "high" | "low",
              })),
            tide_station: {
              id: tideData.station_id ?? "",
              name: tideData.station_name ?? "",
            },
          }
        : {}),
    };
  }

  /**
   * Helper methods for data extraction
   */

  private getCDIPDataForTime(cdipData: CDIPBuoyData | null, targetTime: Date) {
    if (!cdipData?.data || cdipData.data.length === 0) return null;

    const now = new Date();
    const hoursFromNow = (targetTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Only use CDIP data for current conditions (within 1 hour)
    if (hoursFromNow > 1) {
      return null;
    }

    // Use the most recent CDIP measurement
    const sortedData = [...cdipData.data].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return sortedData[0];
  }

  private getWaveDataForTime(waveData: WaveWatchForecast | null, targetTime: Date): WaveWatchData | null {
    if (!waveData?.forecast) return null;

    const MAX_STALENESS_MS = 6 * 3600000; // 6 hours
    const targetTimestamp = targetTime.getTime();
    let closest = null;
    let minDiff = Infinity;

    for (const point of waveData.forecast) {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTimestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    // Don't reuse wave data that's >6h from the target — it would just
    // repeat the last real value for days, producing flat/identical forecasts.
    if (minDiff > MAX_STALENESS_MS) {
      return null;
    }

    return closest;
  }

  private getTideInfo(tideData: COOPSForecast | null, targetTime: Date, beachTimezone?: string | null): ResolvedTideInfo {
    const defaultTideInfo = {
      status: "Unknown",
      currentHeight: "-- ft",
      nextTideTime: "Unknown",
      nextTideType: "Unknown",
      nextTideHeight: "Unknown",
      nextTideAt: null as string | null,
    };

    if (!tideData?.tides) return defaultTideInfo;

    const status = this.services.getTideStatusAtTime(tideData.tides, targetTime);
    const currentHeight = this.services.getTideHeightAtTime(tideData.tides, targetTime);
    const nextTide = this.services.getNextTideFromTime(tideData.tides, targetTime);

    return {
      status,
      currentHeight: (() => {
        if (currentHeight != null) return `${currentHeight} ft`;
        log.debug(`Tide interpolation failed for ${targetTime.toISOString()}`);
        return "-- ft";
      })(),
      nextTideTime: nextTide
        ? new Date(nextTide.time * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: beachTimezone || DEFAULT_TIMEZONE,
          })
        : "Unknown",
      nextTideAt: nextTide ? new Date(nextTide.time * 1000).toISOString() : null,
      nextTideType: nextTide?.name || "Unknown",
      nextTideHeight: nextTide ? `${nextTide.height} ft` : "Unknown",
    };
  }

  private getWeatherDataForTime(weatherData: WeatherPeriod[], targetTime: Date): WeatherPeriod | null {
    if (!weatherData || weatherData.length === 0) return null;

    const targetTimestamp = targetTime.getTime();
    let closest = null;
    let minDiff = Infinity;

    for (const point of weatherData) {
      const pointTime = new Date(point.startTime).getTime();
      const diff = Math.abs(pointTime - targetTimestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest;
  }

  private getWaveHeight(
    cdipPoint: CDIPDataPoint | null,
    wavePoint: WaveWatchData | null,
    buoyData: NDBCBuoyRow | null,
    useCDIPData: boolean,
    beach: Beach,
    nowcastAnchor: NowcastAnchor | null = null,
  ): { value: string | null; debug: WaveHeightDebugInfo } {
    // Extract period: prefer anchor period when anchored, else CDIP peak, model swell, buoy.
    const periodS =
      nowcastAnchor?.wavePeriodS ??
      cdipPoint?.peakWavePeriod ??
      cdipPoint?.swellPeriod ??
      wavePoint?.swell_1_period ??
      wavePoint?.peak_wave_period ??
      buoyData?.wave_period ??
      null;

    // Extract swell direction: prefer anchor direction when anchored, else CDIP, else model.
    const swellDirectionDeg =
      nowcastAnchor?.waveDirectionDeg ??
      cdipPoint?.peakWaveDirection ??
      cdipPoint?.swellDirection ??
      cardinalToDegrees(wavePoint?.swell_1_direction) ??
      cardinalToDegrees(wavePoint?.peak_wave_direction) ??
      null;

    // Build beach terrain config for transformation.
    // `shoaling_factors` (when present) short-circuits the generic transform
    // in favor of an empirically calibrated period-keyed lookup for that beach.
    // `swell_window_*` drive per-component alignment weighting in the
    // decomposed pipeline; null on uncalibrated beaches (degrades to 1.0).
    // See migration 20260407134519_add_shoaling_factors_to_beaches.sql and
    // 20260211120000_comprehensive_swell_window_fix.sql.
    const beachTerrain = {
      swell_access_factors: beach.swell_access_factors ?? null,
      terrain_enabled: beach.terrain_enabled ?? false,
      shoaling_factors: (beach.shoaling_factors ?? null) as ShoalingFactors | null,
      swell_window_center_deg: beach.swell_window_center_deg ?? null,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
      deepwater_decay_factor: beach.deepwater_decay_factor ?? null,
    };

    // Build per-component inputs for the decomposed pipeline when WW3 data
    // is available. Heights arrive from WaveWatch in METERS, so we convert
    // before handing them to the transformer (the scalar source heights are
    // converted internally, but the decomposed path takes feet directly so
    // its inputs are unambiguous).
    //
    // WaveWatchData exposes three physical components: swell_1, swell_2,
    // and wind_wave. We treat all three as "swell components" for decomposition
    // purposes — the short-period cutoff inside `alignmentFactor` will zero
    // out wind-wave energy regardless of direction, which is exactly the
    // Tourmaline mixed-day failure mode we're fixing.
    const components: Array<SwellComponentInput | null> = wavePoint
      ? [
          wavePoint.swell_1_height > 0 && wavePoint.swell_1_period > 0
            ? {
                heightFt: wavePoint.swell_1_height * METERS_TO_FEET,
                periodS: wavePoint.swell_1_period,
                directionDeg:
                  cardinalToDegrees(wavePoint.swell_1_direction) ?? null,
              }
            : null,
          wavePoint.swell_2_height > 0 && wavePoint.swell_2_period > 0
            ? {
                heightFt: wavePoint.swell_2_height * METERS_TO_FEET,
                periodS: wavePoint.swell_2_period,
                directionDeg:
                  cardinalToDegrees(wavePoint.swell_2_direction) ?? null,
              }
            : null,
          wavePoint.wind_wave_height > 0 && wavePoint.wind_wave_period > 0
            ? {
                heightFt: wavePoint.wind_wave_height * METERS_TO_FEET,
                periodS: wavePoint.wind_wave_period,
                directionDeg:
                  cardinalToDegrees(wavePoint.wind_wave_direction) ?? null,
              }
            : null,
        ]
      : [null, null, null];

    // Use toFaceHeightFeet(Decomposed) with all available sources - it handles
    // source priority and applies transformation to whichever source it selects.
    // IMPORTANT: Never return raw untransformed heights - all heights must go through
    // the transformer to convert Hs to face height.
    //
    // The decomposed variant falls back to the scalar path internally when no
    // component slots are populated, so it is always safe to call even when
    // wavePoint is null.
    //
    // Branch priority:
    //   1. Nowcast anchor active → buoy observation drives Hs (scalar path).
    //   2. CDIP data present → CDIP Hs drives the scalar calibrated path.
    //      Without this branch, populated NOAA components would silently
    //      override CDIP `Hs` because the decomposed transformer sums
    //      components and never reads `rawHeightFt` (and so the per-beach
    //      `shoaling_factors` calibration, gated on `cdip_sig` source, is
    //      bypassed). selectWaveHeightSource still handles CDIP outlier
    //      rejection (>10ft or >1.8× model); on rejection it falls back to
    //      model_swell and the legacy generic pipeline runs.
    //   3. NOAA-only or buoy fallback → original decomposed path.

    // Branch 1: Nowcast anchor.
    // Swap in the observation Hs via the ndbcBuoyM slot AND pass empty
    // components. The decomposed branch sums over populated components and
    // never reads `rawHeightFt` when any are present — so keeping NOAA's
    // components would silently discard the anchor height. Empty components
    // forces the legacy scalar path, which runs `rawHeightFt` through the
    // period+alignment shoaling transform using anchor-provided period/
    // direction. See plan golden-sleeping-steele.md.
    if (nowcastAnchor) {
      const result = toFaceHeightFeetDecomposedWithDebug({
        cdipSigFt: undefined,
        cdipSwellFt: undefined,
        modelSwellM: undefined,
        modelHsM: undefined,
        ndbcBuoyM: nowcastAnchor.waveHeightM,
        beach: beachTerrain,
        periodS,
        swellDirectionDeg,
        components: [null, null, null],
      });
      return {
        value: result.value,
        debug: { ...result.debug, source: 'nowcast_anchor' },
      };
    }

    // Branch 2: CDIP data present. Force the scalar/legacy path so CDIP `Hs`
    // is read as `rawHeightFt` with `source = 'cdip_sig'`, which triggers the
    // per-beach `shoaling_factors` short-circuit (when calibrated) instead of
    // letting NOAA component decomposition discard CDIP entirely.
    if (useCDIPData && cdipPoint) {
      const result = toFaceHeightFeetDecomposedWithDebug({
        cdipSigFt: cdipPoint.significantWaveHeight ?? undefined,
        cdipSwellFt: cdipPoint.swellHeight ?? undefined,
        modelSwellM: wavePoint?.swell_1_height ?? undefined,
        modelHsM: wavePoint?.significant_wave_height ?? undefined,
        ndbcBuoyM: buoyData?.wave_height ?? undefined,
        beach: beachTerrain,
        periodS,
        swellDirectionDeg,
        components: [null, null, null],
      });
      return result;
    }

    // Branch 3: NOAA-only / buoy fallback — original decomposed path.
    return toFaceHeightFeetDecomposedWithDebug({
      cdipSigFt: cdipPoint?.significantWaveHeight ?? undefined,
      cdipSwellFt: cdipPoint?.swellHeight ?? undefined,
      modelSwellM: wavePoint?.swell_1_height ?? undefined,
      modelHsM: wavePoint?.significant_wave_height ?? undefined,
      ndbcBuoyM: buoyData?.wave_height ?? undefined,
      beach: beachTerrain,
      periodS,
      swellDirectionDeg,
      components,
    });
  }

  private getWavePeriod(
    cdipPoint: CDIPDataPoint | null,
    wavePoint: WaveWatchData | null,
    buoyData: NDBCBuoyRow | null,
    useCDIPData: boolean
  ): string | null {

    // CDIP peak period already reflects the dominant energy band
    if (useCDIPData && cdipPoint?.peakWavePeriod != null)
      return formatPeriodSeconds(cdipPoint.peakWavePeriod);
    if (useCDIPData && cdipPoint?.swellPeriod != null)
      return formatPeriodSeconds(cdipPoint.swellPeriod);

    // For model data, pick the dominant component (tallest height; on ties,
    // longer period wins) so wave_period matches the dominant energy the
    // surfer actually sees.
    if (wavePoint) {
      const dominant = this.getDominantSwellComponent(wavePoint);
      if (dominant != null) return formatPeriodSeconds(dominant.period);
    }

    if (buoyData?.wave_period != null) return formatPeriodSeconds(buoyData.wave_period);
    if (wavePoint?.peak_wave_period != null)
      return formatPeriodSeconds(wavePoint.peak_wave_period);
    return null;
  }

  /**
   * Return the full identity (height, period, direction) of whichever swell
   * component (swell_1, swell_2, wind_wave) has the greatest height. This is
   * the single source of truth for "which partition wins display" — both
   * `wave_period` and `wave_direction` consume it so they stay paired.
   *
   * When multiple components are within 20% of the tallest, prefer the longer
   * period — surfers feel longer-period swells more even at similar heights.
   *
   * Without this pairing, `wave_period` could come from the long-period
   * groundswell while `wave_direction` came from `peak_wave_direction` (the
   * spectral peak, often the wind-sea), producing nonsense like "13s W" when
   * the 13s component is actually SSW.
   */
  private getDominantSwellComponent(
    wavePoint: WaveWatchData
  ): { height: number; period: number; direction: number } | null {
    return pickDominantSwell({
      swell_1: { height: wavePoint.swell_1_height, period: wavePoint.swell_1_period, direction: wavePoint.swell_1_direction },
      swell_2: { height: wavePoint.swell_2_height, period: wavePoint.swell_2_period, direction: wavePoint.swell_2_direction },
      wind_wave: { height: wavePoint.wind_wave_height, period: wavePoint.wind_wave_period, direction: wavePoint.wind_wave_direction },
    });
  }

  private getWaveDirection(cdipPoint: CDIPDataPoint | null, wavePoint: WaveWatchData | null, useCDIPData: boolean): string | null {
    if (useCDIPData && cdipPoint) {
      return this.services.getWaveDirectionText(cdipPoint.peakWaveDirection);
    }
    if (wavePoint) {
      // Pair wave_direction with the same component getWavePeriod selected.
      // Falling back to peak_wave_direction would emit the spectral peak's
      // direction (usually the wind-sea on mixed days), decoupling it from
      // the long-period groundswell whose period we just reported.
      const dominant = this.getDominantSwellComponent(wavePoint);
      if (dominant != null) {
        return this.services.getWaveDirectionText(dominant.direction);
      }
      return this.services.getWaveDirectionText(wavePoint.peak_wave_direction);
    }
    return null;
  }

  // Swell 1 needs no 0-sentinel guard: data-processors.ts always populates
  // swell_1_height with a real value (NOAA primary partition, generic swell
  // fallback, or `significantWaveHeight * 0.7`), never the 0 sentinel used for
  // absent secondary partitions.
  private getSwell1Height(cdipPoint: CDIPDataPoint | null, wavePoint: WaveWatchData | null, useCDIPData: boolean): string | null {
    const formatWaveFeet = (meters: number | null | undefined): string | null => {
      if (meters == null) return null;
      if (!isFinite(meters)) return null;
      if (meters < 0 || meters > 10) return null;
      return this.metersToFeet(meters);
    };

    const formatFeet = (feet: number | null | undefined): string | null => {
      if (feet == null) return null;
      if (!isFinite(feet)) return null;
      if (feet < 0) return null;
      const rounded = Math.round(feet * 10) / 10;
      return `${rounded} ft`;
    };

    if (useCDIPData && cdipPoint?.swellHeight != null) return formatFeet(cdipPoint.swellHeight);
    if (wavePoint?.swell_1_height != null) return formatWaveFeet(wavePoint.swell_1_height);
    return null;
  }

  private getSwell1Period(cdipPoint: CDIPDataPoint | null, wavePoint: WaveWatchData | null, useCDIPData: boolean): string | null {

    if (useCDIPData && cdipPoint?.swellPeriod != null)
      return formatPeriodSeconds(cdipPoint.swellPeriod);
    if (wavePoint?.swell_1_period != null) return formatPeriodSeconds(wavePoint.swell_1_period);
    return null;
  }

  private getSwell1Direction(cdipPoint: CDIPDataPoint | null, wavePoint: WaveWatchData | null, useCDIPData: boolean): string | null {
    if (useCDIPData && cdipPoint?.swellDirection) {
      return this.services.getWaveDirectionText(cdipPoint.swellDirection);
    }
    if (wavePoint) {
      return this.services.getWaveDirectionText(wavePoint.swell_1_direction);
    }
    return null;
  }

  private getSwell2Height(wavePoint: WaveWatchData | null): string | null {
    // 0 is the pipeline sentinel from data-processors.ts meaning "no real
    // secondary swell" (see the Phase 1 note in that file). Treat it as absent
    // instead of rendering "0 ft" downstream.
    if (wavePoint?.swell_2_height == null || wavePoint.swell_2_height === 0) return null;
    if (!isFinite(wavePoint.swell_2_height)) return null;
    if (wavePoint.swell_2_height < 0 || wavePoint.swell_2_height > 10) return null;
    return this.metersToFeet(wavePoint.swell_2_height);
  }

  private getSwell2Period(wavePoint: WaveWatchData | null): string | null {
    if (wavePoint?.swell_2_period == null || wavePoint.swell_2_period === 0) return null;
    return formatPeriodSeconds(wavePoint.swell_2_period);
  }

  private getSwell2Direction(wavePoint: WaveWatchData | null): string | null {
    // Gate on height: 0° is a legitimate direction on its own, but if the
    // secondary-swell height is the 0 sentinel the direction is meaningless.
    if (!wavePoint || wavePoint.swell_2_height == null || wavePoint.swell_2_height === 0) return null;
    return this.services.getWaveDirectionText(wavePoint.swell_2_direction);
  }

  private getWindWaveHeight(cdipPoint: CDIPDataPoint | null, wavePoint: WaveWatchData | null, useCDIPData: boolean): string | null {
    const formatFeet = (feet: number | null | undefined): string | null => {
      if (feet == null) return null;
      if (!isFinite(feet)) return null;
      if (feet < 0) return null;
      const rounded = Math.round(feet * 10) / 10;
      return `${rounded} ft`;
    };

    if (useCDIPData && cdipPoint?.windWaveHeight) return formatFeet(cdipPoint.windWaveHeight);
    if (wavePoint) return this.metersToFeet(wavePoint.wind_wave_height);
    return null;
  }

  private getWindWavePeriod(cdipPoint: CDIPDataPoint | null, wavePoint: WaveWatchData | null, useCDIPData: boolean): string | null {
    // Route both branches through formatPeriodSeconds (4s floor) so the 0
    // sentinel emitted by data-processors.ts when `wavePeriod` was null —
    // and any other sub-4s fabricated/sentinel value — renders as null
    // instead of "0s" / "2.8s". Mirrors getSwell1Period / getWavePeriod.
    if (useCDIPData && cdipPoint?.windWavePeriod != null)
      return formatPeriodSeconds(cdipPoint.windWavePeriod);
    if (wavePoint?.wind_wave_period != null)
      return formatPeriodSeconds(wavePoint.wind_wave_period);
    return null;
  }

  private getWindWaveDirection(
    cdipPoint: CDIPDataPoint | null,
    wavePoint: WaveWatchData | null,
    useCDIPData: boolean
  ): string | null {
    if (useCDIPData && cdipPoint?.windWaveDirection) {
      return this.services.getWaveDirectionText(cdipPoint.windWaveDirection);
    }
    if (wavePoint) {
      return this.services.getWaveDirectionText(wavePoint.wind_wave_direction);
    }
    return null;
  }

  private getWaterTemperature(
    buoyData: NDBCBuoyRow | null,
    beach: Beach,
    forecastTime: Date,
    ioosWaterTempC: number | null,
    coopsWaterTempC: number | null
  ): string | null {
    // Priority 1: IOOS observed water temperature (most geographically accurate)
    if (ioosWaterTempC != null && isFinite(ioosWaterTempC)) {
      const tempF = (ioosWaterTempC * 9) / 5 + 32;
      return formatWaterTemp(tempF);
    }

    // Priority 2: CO-OPS observed water temperature
    if (coopsWaterTempC != null && isFinite(coopsWaterTempC)) {
      const tempF = (coopsWaterTempC * 9) / 5 + 32;
      return formatWaterTemp(tempF);
    }

    // Priority 3: NDBC buoy water temperature (currently dead code — buoyData always null)
    if (buoyData?.water_temperature != null && isFinite(buoyData.water_temperature)) {
      return formatWaterTemp((buoyData.water_temperature * 9) / 5 + 32);
    }

    // Priority 4: Latitude-based estimation
    return this.estimateWaterTemperature(beach.lat ?? 0, forecastTime);
  }

  private getWindSpeed(weatherPoint: WeatherPeriod | null): string | null {
    if (!weatherPoint) return "10 mph";
    return this.extractWindSpeed(weatherPoint.windSpeed);
  }

  private getWindDirection(weatherPoint: WeatherPeriod | null): string | null {
    return weatherPoint?.windDirection || "SW";
  }

  private getAirTemperature(weatherPoint: WeatherPeriod | null, beach: Beach, forecastTime: Date): string | null {
    if (weatherPoint) {
      return `${weatherPoint.temperature}°F`;
    }
    return this.estimateAirTemperature(beach.lat ?? 0, forecastTime);
  }

  /**
   * Utility methods
   */

  private metersToFeet(meters: number): string {
    const feet = meters * 3.28084;
    if (feet < 1) {
      return `${Math.round(feet * 10) / 10} ft`;
    }
    const rounded = Math.round(feet * 10) / 10;
    return `${rounded} ft`;
  }

  private extractWindSpeed(windSpeedStr: string): string {
    if (!windSpeedStr) return "10 mph";
    const match = windSpeedStr.match(/(\d+)/);
    return match ? `${match[1]} mph` : "10 mph";
  }

  private estimateWaterTemperature(lat: number, date: Date): string {
    const month = date.getMonth();
    const absLat = Math.abs(lat);

    // Base temperature varies by latitude zone (in degrees F)
    let baseTemp: number;
    let seasonalAmplitude: number;

    if (absLat < 20) {
      // Tropical: warm year-round, minimal seasonal variation
      baseTemp = 80;
      seasonalAmplitude = 3;
    } else if (absLat < 30) {
      // Subtropical: warm with moderate seasonal variation
      baseTemp = 75;
      seasonalAmplitude = 6;
    } else if (absLat < 40) {
      // Temperate: moderate with significant seasonal variation
      baseTemp = 62;
      seasonalAmplitude = 10;
    } else if (absLat < 50) {
      // Cool temperate: cooler with large seasonal swing
      baseTemp = 54;
      seasonalAmplitude = 12;
    } else {
      // Northern/polar: cold year-round
      baseTemp = 48;
      seasonalAmplitude = 10;
    }

    // Seasonal adjustment - water temp peaks around Aug-Sep (lags air by 1-2 months)
    const seasonalAdjustment = seasonalAmplitude * Math.sin(((month - 2) * Math.PI) / 6);

    const estimatedTemp = baseTemp + seasonalAdjustment;
    return formatWaterTemp(estimatedTemp);
  }

  private estimateAirTemperature(lat: number, date: Date): string {
    const month = date.getMonth();
    const absLat = Math.abs(lat);

    // Base air temperature varies by latitude zone (in degrees F)
    let baseTemp: number;
    let seasonalAmplitude: number;

    if (absLat < 20) {
      // Tropical: warm year-round
      baseTemp = 84;
      seasonalAmplitude = 4;
    } else if (absLat < 30) {
      // Subtropical
      baseTemp = 78;
      seasonalAmplitude = 10;
    } else if (absLat < 40) {
      // Temperate
      baseTemp = 65;
      seasonalAmplitude = 15;
    } else if (absLat < 50) {
      // Cool temperate
      baseTemp = 55;
      seasonalAmplitude = 18;
    } else {
      // Northern/polar
      baseTemp = 48;
      seasonalAmplitude = 15;
    }

    // Air temp peaks ~July (month 6), earlier than water temp
    const seasonalAdjustment = seasonalAmplitude * Math.sin(((month - 3) * Math.PI) / 6);
    const estimatedTemp = Math.round(baseTemp + seasonalAdjustment);
    return `${estimatedTemp}°F`;
  }
}
