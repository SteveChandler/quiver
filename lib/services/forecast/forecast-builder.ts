/**
 * Forecast Builder
 *
 * Combines multiple data sources (wave, tide, weather, buoy, CDIP) into comprehensive
 * forecast entities. Handles data prioritization and fallbacks.
 *
 * Extracted from lib/services/enhanced-forecast-service.ts as part of P1 refactoring
 * to reduce file size and improve maintainability.
 */

import { calculateConfidenceScore } from "./confidence-scorer";
import { toFaceHeightFeet } from "@/lib/utils/wave-height-formatter";
import { cardinalToDegrees } from "./forecast-transformer";
import { getNormalizedDateString, getNormalizedTimeString } from "./datetime-utils";
import type { Beach } from "@/types/database";
import {
  FORECAST_CONSTANTS,
  TOTAL_FORECASTS,
  type EnhancedForecastEntity,
  type CDIPBuoyData,
} from "@/types/forecast";

/**
 * Interface for injected dependencies (services)
 */
export interface DataSourceServices {
  getWaveDirectionText: (degrees: number) => string;
  getTideStatusAtTime: (tides: any[], time: Date) => string;
  getTideHeightAtTime: (tides: any[], time: Date) => number | null;
  getNextTideFromTime: (tides: any[], time: Date) => any;
  getDataQualityScore: (data: any) => number;
}

/**
 * Input data for building forecasts
 */
export interface ForecastInputs {
  beach: Beach;
  waveData: any;
  tideData: any;
  weatherData: any[];
  buoyData: any;
  cdipData: CDIPBuoyData | null;
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
  async buildForecasts(inputs: ForecastInputs): Promise<EnhancedForecastEntity[]> {
    const { beach, waveData, tideData, weatherData, buoyData, cdipData } = inputs;
    const forecasts: EnhancedForecastEntity[] = [];
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
      const tideInfo = this.getTideInfo(tideData, forecastTime);
      const weatherPoint = this.getWeatherDataForTime(weatherData, forecastTime);
      const cdipPoint = this.getCDIPDataForTime(cdipData, forecastTime);

      // Determine data source for this time point
      const useBuoyData = i === 0 && buoyData;
      const useCDIPData = !!cdipPoint;
      const timepointDataSource = useCDIPData
        ? "CDIP"
        : waveData?.data_source || (useBuoyData ? "NOAA_BUOY" : "FALLBACK");

      // Calculate confidence score
      const confidenceScore = calculateConfidenceScore({
        hasWaveData: !!wavePoint,
        hasTideData: !!tideInfo,
        hasWeatherData: !!weatherPoint,
        hasBuoyData: useBuoyData,
        hasCDIPData: useCDIPData,
        forecastHoursAhead: i * FORECAST_CONSTANTS.INTERVAL_HOURS,
      });

      // Check if this is the first forecast of the day
      const dateString = getNormalizedDateString(forecastTime);
      const isFirstOfDay = !processedDates.has(dateString);
      if (isFirstOfDay) {
        processedDates.add(dateString);
      }

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
    wavePoint: any;
    cdipPoint: any;
    tideInfo: any;
    weatherPoint: any;
    buoyData: any;
    useCDIPData: boolean;
    confidenceScore: number;
    timepointDataSource: string;
    dataSources: string[];
    tideData: any;
    isFirstOfDay: boolean;
    cdipData: CDIPBuoyData | null;
    now: Date;
  }): EnhancedForecastEntity {
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
    } = params;

    return {
      id: `forecast-${beach.id}-${forecastTime.getTime()}`,
      forecast_date: dateString,
      forecast_time: getNormalizedTimeString(forecastTime),

      // Wave data
      wave_height: this.getWaveHeight(cdipPoint, wavePoint, buoyData, useCDIPData),
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

      // Water temperature
      water_temp: this.getWaterTemperature(buoyData, beach, forecastTime),

      // Wind data
      wind_speed: this.getWindSpeed(weatherPoint),
      wind_direction: this.getWindDirection(weatherPoint),
      wind_direction_deg: cardinalToDegrees(weatherPoint?.windDirection || "SW"),

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
    } as EnhancedForecastEntity;
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
    tideData: any;
    now: Date;
  }): any {
    const { dataSources, useCDIPData, cdipData, confidenceScore, isFirstOfDay, tideData, now } =
      params;

    return {
      data_sources: dataSources,
      ...(useCDIPData &&
        cdipData && {
          cdip_data: {
            stationId: (cdipData as any).stationId,
            stationName: (cdipData as any).stationName,
            lastUpdated: (cdipData as any).lastUpdated,
            dataSource: "CDIP",
            data: Array.isArray((cdipData as any).data) ? (cdipData as any).data.slice(0, 2) : [],
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
      ...(isFirstOfDay &&
        tideData?.tides?.length > 0 && {
          tide_schedule: tideData.tides
            .slice(0, 20)
            .map((t: { time: number; height: number; type: string }) => ({
              time: t.time,
              height: t.height,
              type: t.type as "high" | "low",
            })),
          tide_station: {
            id: tideData.station_id ?? "",
            name: tideData.station_name ?? "",
          },
        }),
    };
  }

  /**
   * Helper methods for data extraction
   */

  private getCDIPDataForTime(cdipData: CDIPBuoyData | null, targetTime: Date) {
    if (!cdipData?.data || cdipData.data.length === 0) return null;

    const now = new Date();
    const hoursFromNow = (targetTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Only use CDIP data for current conditions (within 6 hours)
    if (hoursFromNow > 6) {
      return null;
    }

    // Use the most recent CDIP measurement
    const sortedData = [...cdipData.data].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return sortedData[0];
  }

  private getWaveDataForTime(waveData: any, targetTime: Date) {
    if (!waveData?.forecast) return null;

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

    return closest;
  }

  private getTideInfo(tideData: any, targetTime: Date) {
    const defaultTideInfo = {
      status: "Unknown",
      currentHeight: "2.5 ft",
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
      currentHeight: currentHeight ? `${currentHeight} ft` : "2.5 ft",
      nextTideTime: nextTide
        ? new Date(nextTide.time * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Unknown",
      nextTideAt: nextTide ? new Date(nextTide.time * 1000).toISOString() : null,
      nextTideType: nextTide?.name || "Unknown",
      nextTideHeight: nextTide ? `${nextTide.height} ft` : "Unknown",
    };
  }

  private getWeatherDataForTime(weatherData: any[], targetTime: Date) {
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
    cdipPoint: any,
    wavePoint: any,
    buoyData: any,
    useCDIPData: boolean
  ): string | null {
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

    // Try toFaceHeightFeet first
    const face = toFaceHeightFeet({
      cdipSigFt: cdipPoint?.significantWaveHeight ?? undefined,
      cdipSwellFt: cdipPoint?.swellHeight ?? undefined,
      modelSwellM: wavePoint?.swell_1_height ?? undefined,
      modelHsM: wavePoint?.significant_wave_height ?? undefined,
    });
    if (face) return face;

    // Fallback logic
    if (useCDIPData && cdipPoint?.significantWaveHeight != null)
      return formatFeet(cdipPoint.significantWaveHeight);
    if (useCDIPData && cdipPoint?.swellHeight != null) return formatFeet(cdipPoint.swellHeight);
    if (wavePoint?.swell_1_height != null) return formatWaveFeet(wavePoint.swell_1_height);
    if (useCDIPData && cdipPoint) return formatFeet(cdipPoint.significantWaveHeight);
    if (buoyData?.wave_height != null) return formatWaveFeet(buoyData.wave_height);
    if (wavePoint?.significant_wave_height != null)
      return formatWaveFeet(wavePoint.significant_wave_height);
    return null;
  }

  private getWavePeriod(
    cdipPoint: any,
    wavePoint: any,
    buoyData: any,
    useCDIPData: boolean
  ): string | null {
    const formatPeriodSeconds = (value: number | string | null | undefined): string | null => {
      if (value == null) return null;
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (!isFinite(num)) return null;
      if (num < 4 || num > 25) return null;
      const rounded = Math.round(num * 10) / 10;
      return `${rounded}s`;
    };

    if (useCDIPData && cdipPoint?.peakWavePeriod != null)
      return formatPeriodSeconds(cdipPoint.peakWavePeriod);
    if (useCDIPData && cdipPoint?.swellPeriod != null)
      return formatPeriodSeconds(cdipPoint.swellPeriod);
    if (wavePoint?.swell_1_period != null) return formatPeriodSeconds(wavePoint.swell_1_period);
    if (buoyData?.wave_period != null) return formatPeriodSeconds(buoyData.wave_period);
    if (wavePoint?.peak_wave_period != null)
      return formatPeriodSeconds(wavePoint.peak_wave_period);
    return null;
  }

  private getWaveDirection(cdipPoint: any, wavePoint: any, useCDIPData: boolean): string | null {
    if (useCDIPData && cdipPoint) {
      return this.services.getWaveDirectionText(cdipPoint.peakWaveDirection);
    }
    if (wavePoint) {
      return this.services.getWaveDirectionText(wavePoint.peak_wave_direction);
    }
    return null;
  }

  private getSwell1Height(cdipPoint: any, wavePoint: any, useCDIPData: boolean): string | null {
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

  private getSwell1Period(cdipPoint: any, wavePoint: any, useCDIPData: boolean): string | null {
    const formatPeriodSeconds = (value: number | string | null | undefined): string | null => {
      if (value == null) return null;
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (!isFinite(num)) return null;
      if (num < 4 || num > 25) return null;
      const rounded = Math.round(num * 10) / 10;
      return `${rounded}s`;
    };

    if (useCDIPData && cdipPoint?.swellPeriod != null)
      return formatPeriodSeconds(cdipPoint.swellPeriod);
    if (wavePoint?.swell_1_period != null) return formatPeriodSeconds(wavePoint.swell_1_period);
    return null;
  }

  private getSwell1Direction(cdipPoint: any, wavePoint: any, useCDIPData: boolean): string | null {
    if (useCDIPData && cdipPoint?.swellDirection) {
      return this.services.getWaveDirectionText(cdipPoint.swellDirection);
    }
    if (wavePoint) {
      return this.services.getWaveDirectionText(wavePoint.swell_1_direction);
    }
    return null;
  }

  private getSwell2Height(wavePoint: any): string | null {
    if (wavePoint?.swell_2_height == null) return null;
    if (!isFinite(wavePoint.swell_2_height)) return null;
    if (wavePoint.swell_2_height < 0 || wavePoint.swell_2_height > 10) return null;
    return this.metersToFeet(wavePoint.swell_2_height);
  }

  private getSwell2Period(wavePoint: any): string | null {
    if (wavePoint?.swell_2_period == null) return null;
    const num = wavePoint.swell_2_period;
    if (!isFinite(num)) return null;
    if (num < 4 || num > 25) return null;
    const rounded = Math.round(num * 10) / 10;
    return `${rounded}s`;
  }

  private getSwell2Direction(wavePoint: any): string | null {
    if (!wavePoint) return null;
    return this.services.getWaveDirectionText(wavePoint.swell_2_direction);
  }

  private getWindWaveHeight(cdipPoint: any, wavePoint: any, useCDIPData: boolean): string | null {
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

  private getWindWavePeriod(cdipPoint: any, wavePoint: any, useCDIPData: boolean): string | null {
    if (useCDIPData && cdipPoint?.windWavePeriod) return `${cdipPoint.windWavePeriod}s`;
    if (wavePoint) return `${wavePoint.wind_wave_period}s`;
    return null;
  }

  private getWindWaveDirection(
    cdipPoint: any,
    wavePoint: any,
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

  private getWaterTemperature(buoyData: any, beach: Beach, forecastTime: Date): string | null {
    if (buoyData?.water_temperature) {
      return `${Math.round((buoyData.water_temperature * 9) / 5 + 32)}°F`;
    }
    return this.estimateWaterTemperature(beach.lat ?? 32.7, forecastTime);
  }

  private getWindSpeed(weatherPoint: any): string | null {
    if (!weatherPoint) return "10 mph";
    return this.extractWindSpeed(weatherPoint.windSpeed);
  }

  private getWindDirection(weatherPoint: any): string | null {
    return weatherPoint?.windDirection || "SW";
  }

  private getAirTemperature(weatherPoint: any, beach: Beach, forecastTime: Date): string | null {
    if (weatherPoint) {
      return `${weatherPoint.temperature}°F`;
    }
    return this.estimateAirTemperature(beach.lat ?? 32.7, forecastTime);
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
    let baseTemp = 65;
    const seasonalAdjustment = 10 * Math.sin(((month - 3) * Math.PI) / 6);
    const estimatedTemp = Math.round(baseTemp + seasonalAdjustment);
    return `${estimatedTemp}°F`;
  }

  private estimateAirTemperature(lat: number, date: Date): string {
    const month = date.getMonth();
    let baseTemp = 70;
    const seasonalAdjustment = 15 * Math.sin(((month - 3) * Math.PI) / 6);
    const estimatedTemp = Math.round(baseTemp + seasonalAdjustment);
    return `${estimatedTemp}°F`;
  }
}
