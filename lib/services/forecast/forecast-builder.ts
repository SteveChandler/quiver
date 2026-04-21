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
import { toFaceHeightFeet, toFaceHeightFeetDecomposed, METERS_TO_FEET } from "@/lib/utils/wave-formatters";
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

/**
 * Nowcast-anchor design (see plan golden-sleeping-steele.md):
 *  - NOWCAST_WINDOW_MS: forecast rows within ±1.5h of now may be anchored.
 *  - ANCHOR_FRESHNESS_MS: observations up to 6h old count as valid anchors.
 * The freshness cap is wider than the forecast window to accommodate CDIP-via-IOOS
 * ingestion lag (2h sync cron + up-to-3h source staleness). A 4h-old buoy reading
 * still beats a hallucinated NOAA forecast — swells don't swing 100% in 6h.
 */
const NOWCAST_WINDOW_MS = 1.5 * 60 * 60 * 1000;
const ANCHOR_FRESHNESS_MS = 6 * 60 * 60 * 1000;

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
}

const log = createContextLogger("ForecastBuilder");

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
    const { beach, waveData, tideData, weatherData, buoyData, cdipData, ioosWaterTempC, coopsWaterTempC, nowcastAnchor } = inputs;
    const forecasts: EnhancedForecastWithRawData[] = [];
    const now = new Date();

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

      // Determine data source for this time point
      const useBuoyData = i === 0 && buoyData;
      const useCDIPData = !!cdipPoint;
      // Use per-entry data_source (e.g. "OPEN_METEO" from merged forecasts)
      // rather than the top-level waveData.data_source (always "NOAA_NWS").
      // When wavePoint is null (no wave data for this timepoint), label as FALLBACK
      // so horizon-strip trimming can remove it.
      const timepointDataSource = useCDIPData
        ? "CDIP"
        : wavePoint
          ? (wavePoint.data_source || waveData?.data_source || "FALLBACK")
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
      });

      forecasts.push(forecast);
    }

    return forecasts;
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
    } = params;

    return {
      id: `forecast-${beach.id}-${forecastTime.getTime()}`,
      forecast_date: dateString,
      forecast_time: getNormalizedTimeString(forecastTime),
      forecast_at: getNormalizedForecastAt(forecastTime),

      // Wave data
      wave_height: this.getWaveHeight(cdipPoint, wavePoint, buoyData, useCDIPData, beach, nowcastAnchor),
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
  }): EnhancedForecastWithRawData["raw_forecast"] {
    const { dataSources, useCDIPData, cdipData, confidenceScore, isFirstOfDay, tideData, now } =
      params;

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
  ): string | null {
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
    // When a nowcast anchor is active, swap in the observation Hs via the
    // ndbcBuoyM slot AND pass empty components. The decomposed branch sums
    // over populated components and never reads `rawHeightFt` when any are
    // present — so keeping NOAA's components would silently discard the
    // anchor height. Empty components forces the legacy scalar path, which
    // runs `rawHeightFt` through the period+alignment shoaling transform
    // using anchor-provided period/direction. See plan golden-sleeping-steele.md.
    if (nowcastAnchor) {
      return toFaceHeightFeetDecomposed({
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
    }

    return toFaceHeightFeetDecomposed({
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

    // For model data, pick the period from the tallest swell component
    // so wave_period matches the dominant energy the surfer actually sees
    if (wavePoint) {
      const period = this.getDominantSwellPeriod(wavePoint);
      if (period != null) return formatPeriodSeconds(period);
    }

    if (buoyData?.wave_period != null) return formatPeriodSeconds(buoyData.wave_period);
    if (wavePoint?.peak_wave_period != null)
      return formatPeriodSeconds(wavePoint.peak_wave_period);
    return null;
  }

  /**
   * Return the period of whichever swell component (swell_1, swell_2, wind_wave)
   * has the greatest height. This ensures wave_period reflects the dominant
   * energy rather than always defaulting to swell_1.
   *
   * When multiple components are within 20% of the tallest, prefer the longer
   * period — surfers feel longer-period swells more even at similar heights.
   */
  private getDominantSwellPeriod(wavePoint: WaveWatchData): number | null {
    const components: { height: number; period: number }[] = [];

    if (wavePoint.swell_1_height > 0 && wavePoint.swell_1_period > 0) {
      components.push({ height: wavePoint.swell_1_height, period: wavePoint.swell_1_period });
    }
    if (wavePoint.swell_2_height > 0 && wavePoint.swell_2_period > 0) {
      components.push({ height: wavePoint.swell_2_height, period: wavePoint.swell_2_period });
    }
    if (wavePoint.wind_wave_height > 0 && wavePoint.wind_wave_period > 0) {
      components.push({ height: wavePoint.wind_wave_height, period: wavePoint.wind_wave_period });
    }

    if (components.length === 0) return null;

    const maxHeight = Math.max(...components.map(c => c.height));
    const dominant = components
      .filter(c => c.height >= maxHeight * 0.8)
      .sort((a, b) => b.period - a.period);

    return dominant[0].period;
  }

  private getWaveDirection(cdipPoint: CDIPDataPoint | null, wavePoint: WaveWatchData | null, useCDIPData: boolean): string | null {
    if (useCDIPData && cdipPoint) {
      return this.services.getWaveDirectionText(cdipPoint.peakWaveDirection);
    }
    if (wavePoint) {
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
    if (useCDIPData && cdipPoint?.windWavePeriod) return `${cdipPoint.windWavePeriod}s`;
    if (wavePoint) return `${wavePoint.wind_wave_period}s`;
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
