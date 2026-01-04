import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ForecastDataSourceManager, NOAAWeatherDataSource } from "./forecast/data-source-manager";
import { cardinalToDegrees } from "./forecast/forecast-transformer";
import { calculateConfidenceScore } from "./forecast/confidence-scorer";
import { ForecastStorageService } from "./forecast/storage-service";
import { getForecastWeightingService } from "./forecast-weighting-service";
import { calculateDistance } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";
import {
  FORECAST_CONSTANTS,
  TOTAL_FORECASTS,
  createConfidenceScore,
  createBeachId,
  createLatitude,
  createLongitude,
  type Location,
  type TimeRange,
  type ForecastTimePoint,
  type WeatherConditions,
  type WaveConditions,
  type TideConditions,
  type SwellComponent,
  type WaveDataSource,
  type TideDataSource,
  type WeatherDataSource,
  type WaveData,
  type TideData,
  type WeatherData,
  type EnhancedForecastEntity,
  type CDIPBuoyData,
  type EnhancedForecastWithRawData,
} from "@/types/forecast";
import { toFaceHeightFeet } from "@/lib/utils/wave-height-formatter";
import {
  ForecastError,
  ForecastErrorCode,
  DataSourceError,
  ValidationError,
  ApiError,
  StorageError,
  isNoaaInvalidPointError,
  isNoaaMarineForecastNotSupportedError,
  withErrorHandling,
  withRetry,
  logError,
} from "@/lib/errors/forecast-errors";

// Data source implementations moved to lib/services/forecast/data-source-manager.ts

export class EnhancedForecastService {
  private readonly warnedSchemaColumns = new Set<string>();
  private isVerboseLoggingEnabled(): boolean {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    return process.env.FORECAST_VERBOSE_LOGS === "true" || env !== "production";
  }

  // cardinalToDegrees method moved to lib/services/forecast/forecast-transformer.ts

  private dataSourceManager: ForecastDataSourceManager;
  private storageService: ForecastStorageService;

  constructor() {
    this.dataSourceManager = new ForecastDataSourceManager();
    this.storageService = new ForecastStorageService();
  }

  /**
   * Generate comprehensive 12-day forecast for a beach
   */
  async generateComprehensiveForecast(
    beach: Beach
  ): Promise<EnhancedForecastEntity[]> {
    return withErrorHandling(
      async () => {
        // Validate input
        if (!beach.id || !beach.lat || !beach.lon) {
          throw new ValidationError(
            "beach",
            beach,
            "Beach must have valid ID, latitude, and longitude"
          );
        }

        // Fetch all data sources in parallel with error handling
        const [waveData, tideData, weatherData, buoyData, cdipData] =
          await Promise.allSettled([
            this.fetchWaveDataWithRetry(beach),
            this.fetchTidalDataWithRetry(beach),
            this.fetchWeatherDataWithRetry(beach),
            this.fetchNearbyBuoyDataWithRetry(beach),
            this.fetchCDIPDataWithRetry(beach),
          ]);

        // Process results and handle failures gracefully
        const processedData = {
          beach,
          waveData: waveData.status === "fulfilled" ? waveData.value : null,
          tideData: tideData.status === "fulfilled" ? tideData.value : null,
          weatherData:
            weatherData.status === "fulfilled" ? weatherData.value : [],
          buoyData: buoyData.status === "fulfilled" ? buoyData.value : null,
          cdipData: cdipData.status === "fulfilled" ? cdipData.value : null,
        };

        // Log any data source failures
        if (waveData.status === "rejected")
          logError(waveData.reason, { beachId: beach.id, dataSource: "wave" });
        if (tideData.status === "rejected")
          logError(tideData.reason, { beachId: beach.id, dataSource: "tide" });
        if (weatherData.status === "rejected")
          logError(weatherData.reason, {
            beachId: beach.id,
            dataSource: "weather",
          });
        if (buoyData.status === "rejected")
          logError(buoyData.reason, { beachId: beach.id, dataSource: "buoy" });
        if (cdipData.status === "rejected")
          logError(cdipData.reason, { beachId: beach.id, dataSource: "cdip" });

        // Process and combine all data sources
        const forecasts = await this.combineDataSources(processedData);

        return forecasts;
      },
      { beachId: beach.id }
    )();
  }

  /**
   * Fetch wave data with retry logic
   */
  private async fetchWaveDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      const result = await this.dataSourceManager.getWaveWatchService().fetchWaveWatchForecast(
        beach.lat ?? 0,
        beach.lon ?? 0,
        FORECAST_CONSTANTS.DAYS
      );
      if (!result) {
        throw new DataSourceError(
          "WaveWatch",
          new Error("No wave data returned")
        );
      }
      return result;
    });
  }

  /**
   * Fetch tidal data with retry logic
   */
  private async fetchTidalDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      try {
        const stationId = this.dataSourceManager.getCOOPSService().getStationForLocation(
          beach.name,
          beach.lat ?? 0,
          beach.lon ?? 0
        );
        const result = await this.dataSourceManager.getCOOPSService().fetchCOOPSData(
          stationId,
          FORECAST_CONSTANTS.DAYS
        );
        return result;
      } catch (error) {
        throw new DataSourceError("CO-OPS", error as Error, {
          beachId: beach.id,
          location: { lat: beach.lat ?? 0, lng: beach.lon ?? 0 },
        });
      }
    });
  }

  /**
   * Fetch weather data with retry logic
   */
  private async fetchWeatherDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      const weatherSource = new NOAAWeatherDataSource();
      const location = {
        latitude: beach.lat as any, // Type assertion for now
        longitude: beach.lon as any,
      };
      try {
        const result = await weatherSource.fetchWeatherData(
          location,
          FORECAST_CONSTANTS.DAYS
        );
        return result.periods;
      } catch (error) {
        // Expected for some beaches (e.g. outside NWS coverage like Baja): treat as "no weather coverage".
        if (isNoaaInvalidPointError(error)) {
          return [];
        }
        // Expected for some coast/offshore points: hourly marine forecasts not supported.
        if (isNoaaMarineForecastNotSupportedError(error)) {
          return [];
        }
        throw error;
      }
    });
  }

  /**
   * Fetch buoy data with retry logic
   */
  private async fetchNearbyBuoyDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      return this.fetchNearbyBuoyData(beach);
    });
  }

  /**
   * Fetch CDIP data with retry logic
   */
  private async fetchCDIPDataWithRetry(beach: Beach) {
    if (this.isVerboseLoggingEnabled()) {
      console.log(
        `🏖️ fetchCDIPDataWithRetry called for beach: ${beach.name} (${beach.lat}, ${beach.lon})`
      );
    }
    return withRetry(async () => {
      try {
        // Prefer explicit override when present
        let selectedStation: string | null = null;
        const beachAny = beach as any;
        if (beachAny.cdip_station) {
          selectedStation = beachAny.cdip_station;
          if (this.isVerboseLoggingEnabled()) {
            console.log(
              `✅ Using CDIP override station ${selectedStation} for ${beach.name}`
            );
          }
        } else {
          if (this.isVerboseLoggingEnabled()) {
            console.log(`🔍 Looking for nearest CDIP station for ${beach.name}`);
          }
          selectedStation = await this.dataSourceManager.getCDIPService().getNearestStation(
            beach.lat ?? 0,
            beach.lon ?? 0,
            150 // 150km radius to cover gaps where station 67 is blacklisted
          );
        }

        if (!selectedStation) {
          console.warn(
            `❌ No nearby CDIP station found for ${beach.name} within 150km`
          );
          return null;
        }

        if (this.isVerboseLoggingEnabled()) {
          console.log(
            `✅ Selected CDIP station ${selectedStation} for ${beach.name}`
          );
        }

        // Fetch CDIP data for the nearest station
        if (this.isVerboseLoggingEnabled()) {
          console.log(
            `🌊 Fetching CDIP data from station ${selectedStation} for ${beach.name}`
          );
        }
        const cdipData = await this.dataSourceManager.getCDIPService().fetchBuoyData(selectedStation);

        if (cdipData) {
          if (this.isVerboseLoggingEnabled()) {
            console.log(
              `✅ Successfully fetched CDIP data for ${beach.name} from station ${selectedStation}`
            );
          }
        } else {
          console.warn(
            `❌ CDIP data fetch returned null for ${beach.name} from station ${selectedStation}`
          );
        }

        return cdipData;
      } catch (error) {
        console.error(`💥 Error fetching CDIP data for ${beach.name}:`, error);
        throw new DataSourceError("CDIP", error as Error, {
          beachId: beach.id,
          location: { lat: beach.lat ?? 0, lng: beach.lon ?? 0 },
        });
      }
    });
  }

  /**
   * Fetch weather data from NOAA with retry logic
   */
  private async fetchWeatherData(beach: Beach) {
    try {
      // Import retry client dynamically to avoid circular dependencies
      const { apiClient } = await import("@/lib/utils/api-retry");
      
      // Get grid coordinates
      const pointsUrl = `https://api.weather.gov/points/${beach.lat},${beach.lon}`;
      const pointsResponse = await apiClient.fetchNOAAData(pointsUrl);

      if (!pointsResponse.ok) {
        throw new Error(`NOAA points API error: ${pointsResponse.status}`);
      }

      const pointsData = await pointsResponse.json();
      const forecastUrl = pointsData.properties.forecastHourly;

      if (!forecastUrl) {
        throw new Error("No forecast URL available");
      }

      // Fetch hourly forecast with retry
      const forecastResponse = await apiClient.fetchNOAAData(forecastUrl);

      if (!forecastResponse.ok) {
        throw new Error(`NOAA forecast API error: ${forecastResponse.status}`);
      }

      const forecastData = await forecastResponse.json();
      return forecastData.properties.periods || [];
    } catch (error) {
      console.error("Error fetching weather data:", error);
      return [];
    }
  }

  /**
   * Fetch nearby buoy data for real-time conditions
   */
  private async fetchNearbyBuoyData(beach: Beach) {
    try {
      const supabase = await createSupabaseServiceRoleClient();

      // If an override NDBC station is set, return it directly (if present in table)
      const beachAny = beach as any;
      if (beachAny.ndbc_station) {
        const { data: overrideBuoy } = await supabase
          .from("buoys")
          .select("*")
          .eq("buoy_uuid", beachAny.ndbc_station)
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        if (overrideBuoy) {
          return { ...overrideBuoy, distance: 0 } as any;
        }
      }

      // Get nearby buoys with recent data (no coordinates in table; cannot distance-sort here reliably)
      const { data: buoys, error } = await supabase
        .from("buoys")
        .select("*")
        .eq("active", true)
        .not("wave_height", "is", null)
        .not("water_temperature", "is", null);

      if (error || !buoys) {
        return null;
      }

      // Without coordinates, pick the first active with wave data as a coarse fallback
      return buoys[0] || null;
    } catch (error) {
      console.error("Error fetching buoy data:", error);
      return null;
    }
  }

  /**
   * Helper function to get normalized date string (YYYY-MM-DD) in local timezone
   */
  private getNormalizedDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper function to get normalized time string rounded to 3-hour intervals
   * Valid times: 00:00:00, 03:00:00, 06:00:00, 09:00:00, 12:00:00, 15:00:00, 18:00:00, 21:00:00
   */
  private getNormalizedTimeString(date: Date): string {
    // Round to nearest 3-hour interval
    const currentHour = date.getHours();
    const roundedHour = Math.floor(currentHour / 3) * 3;
    const hours = String(roundedHour).padStart(2, "0");
    return `${hours}:00:00`;
  }

  /**
   * Combine all data sources into comprehensive forecast
   */
  private async combineDataSources({
    beach,
    waveData,
    tideData,
    weatherData,
    buoyData,
    cdipData,
  }: {
    beach: Beach;
    waveData: any;
    tideData: any;
    weatherData: any[];
    buoyData: any;
    cdipData: CDIPBuoyData | null;
  }): Promise<EnhancedForecastWithRawData[]> {
    const forecasts: EnhancedForecastWithRawData[] = [];
    const now = new Date();
    const verboseLogs = this.isVerboseLoggingEnabled();

    /**
     * Forecast validation warnings can be extremely noisy (called per timepoint).
     * In production, we aggregate per beach to avoid drowning out cron success/failure logs.
     * Set FORECAST_VERBOSE_LOGS=true (or run non-production) to see the full per-timepoint payloads.
     */
    type ForecastValidationSample = {
      date: string | null;
      time: string | null;
      dataSource: string | null;
      values: {
        waveHeight: string | null;
        wavePeriod: string | null;
        swell1Height: string | null;
        swell1Period: string | null;
      };
      sampleWarningMessage: string;
    };

    const validationWarningTypes = new Map<
      string,
      { count: number; sample: ForecastValidationSample }
    >();
    const validationDataSourceCounts = new Map<string, number>();
    let validationTimepointsWithWarnings = 0;
    let validationTotalWarnings = 0;

    // Local helpers for safe value formatting and sanity checks
    const formatPeriodSeconds = (
      value: number | string | null | undefined
    ): string | null => {
      if (value == null) return null;
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (!isFinite(num)) return null;
      // Reject obviously bad readings per product spec (<4s or >25s)
      if (num < 4 || num > 25) return null;
      const rounded = Math.round(num * 10) / 10;
      return `${rounded}s`;
    };

    const formatWaveFeet = (
      meters: number | null | undefined
    ): string | null => {
      if (meters == null) return null;
      if (!isFinite(meters)) return null;
      // Guard against absurd values; discard > 10m (≈ 32.8ft) as sensor/model glitch
      if (meters < 0 || meters > 10) return null;
      return this.metersToFeet(meters);
    };

    // CDIP already delivers values in feet; format without re-scaling
    const formatFeet = (feet: number | null | undefined): string | null => {
      if (feet == null) return null;
      if (!isFinite(feet)) return null;
      if (feet < 0) return null;
      const rounded = Math.round(feet * 10) / 10;
      return `${rounded} ft`;
    };

    // Determine the primary data source - prioritize CDIP for high-quality buoy data
    const primaryDataSource = cdipData
      ? "CDIP"
      : waveData?.data_source || "FALLBACK";

    // Determine data sources used for metadata
    const dataSources: string[] = [];
    if (cdipData) dataSources.push("CDIP");
    if (waveData) dataSources.push("NOAA_NWS");
    if (tideData) dataSources.push("NOAA_COOPS");
    if (buoyData) dataSources.push("NOAA_BUOY");
    if (dataSources.length === 0) dataSources.push("FALLBACK");

    // Generate forecasts using constants
    for (let i = 0; i < TOTAL_FORECASTS; i++) {
      const forecastTime = new Date(
        now.getTime() + i * FORECAST_CONSTANTS.INTERVAL_HOURS * 60 * 60 * 1000
      );

      // Get wave data for this time
      const wavePoint = this.getWaveDataForTime(waveData, forecastTime);

      // Get tide data for this time
      const tideInfo = this.getTideInfoForTime(tideData, forecastTime);

      // Get weather data for this time
      const weatherPoint = this.getWeatherDataForTime(
        weatherData,
        forecastTime
      );

      // Use buoy data for current conditions if available
      const useBuoyData = i === 0 && buoyData;

      // Get CDIP data for this time (use most recent if available)
      const cdipPoint = this.getCDIPDataForTime(cdipData, forecastTime);
      const useCDIPData = !!cdipPoint;
      
      // Determine the actual data source used for this forecast timepoint.
      // CDIP is only valid for current/recent conditions (see getCDIPDataForTime).
      const timepointDataSource = useCDIPData
        ? "CDIP"
        : waveData?.data_source || (useBuoyData ? "NOAA_BUOY" : "FALLBACK");

      // Calculate confidence score based on data availability and freshness
      const confidenceScore = calculateConfidenceScore({
        hasWaveData: !!wavePoint,
        hasTideData: !!tideInfo,
        hasWeatherData: !!weatherPoint,
        hasBuoyData: useBuoyData,
        hasCDIPData: useCDIPData,
        forecastHoursAhead: i * FORECAST_CONSTANTS.INTERVAL_HOURS,
      });

      const forecast = {
        id: `forecast-${beach.id}-${i}`, // Temporary ID for now
        forecast_date: this.getNormalizedDateString(forecastTime),
        forecast_time: this.getNormalizedTimeString(forecastTime),

        // Wave data prioritized for primary swell per spec: CDIP significant height > CDIP swell > model primary > combined/total
        wave_height: (() => {
          const face = toFaceHeightFeet({
            cdipSigFt: cdipPoint?.significantWaveHeight ?? undefined,
            cdipSwellFt: cdipPoint?.swellHeight ?? undefined,
            modelSwellM: wavePoint?.swell_1_height ?? undefined,
            modelHsM: wavePoint?.significant_wave_height ?? undefined,
          });
          if (face) return face;
          // Fallback to previous formatting if calibration returns null
          if (useCDIPData && cdipPoint?.significantWaveHeight != null)
            return formatFeet(cdipPoint.significantWaveHeight);
          if (useCDIPData && cdipPoint?.swellHeight != null)
            return formatFeet(cdipPoint.swellHeight);
          if (wavePoint?.swell_1_height != null)
            return formatWaveFeet(wavePoint.swell_1_height);
          if (useCDIPData && cdipPoint)
            return formatFeet(cdipPoint.significantWaveHeight);
          if (useBuoyData && buoyData.wave_height != null)
            return formatWaveFeet(buoyData.wave_height);
          if (wavePoint?.significant_wave_height != null)
            return formatWaveFeet(wavePoint.significant_wave_height);
          return null;
        })(),
        wave_period:
          useCDIPData && cdipPoint?.peakWavePeriod != null
            ? formatPeriodSeconds(cdipPoint.peakWavePeriod)
            : useCDIPData && cdipPoint?.swellPeriod != null
            ? formatPeriodSeconds(cdipPoint.swellPeriod)
            : wavePoint?.swell_1_period != null
            ? formatPeriodSeconds(wavePoint.swell_1_period)
            : useBuoyData && buoyData.wave_period != null
            ? formatPeriodSeconds(buoyData.wave_period)
            : wavePoint?.peak_wave_period != null
            ? formatPeriodSeconds(wavePoint.peak_wave_period)
            : null,
        wave_direction:
          useCDIPData && cdipPoint
            ? this.dataSourceManager.getWaveWatchService().getWaveDirectionText(
                cdipPoint.peakWaveDirection
              )
            : wavePoint
            ? this.dataSourceManager.getWaveWatchService().getWaveDirectionText(
                wavePoint.peak_wave_direction
              )
            : null,

        // Detailed swell information - prioritize CDIP when available
        swell_1_height:
          useCDIPData && cdipPoint?.swellHeight != null
            ? formatFeet(cdipPoint.swellHeight)
            : wavePoint?.swell_1_height != null
            ? formatWaveFeet(wavePoint.swell_1_height)
            : null,
        swell_1_period:
          useCDIPData && cdipPoint?.swellPeriod != null
            ? formatPeriodSeconds(cdipPoint.swellPeriod)
            : wavePoint?.swell_1_period != null
            ? formatPeriodSeconds(wavePoint.swell_1_period)
            : null,
        swell_1_direction:
          useCDIPData && cdipPoint?.swellDirection
            ? this.dataSourceManager.getWaveWatchService().getWaveDirectionText(
                cdipPoint.swellDirection
              )
            : wavePoint
            ? this.dataSourceManager.getWaveWatchService().getWaveDirectionText(
                wavePoint.swell_1_direction
              )
            : null,

        swell_2_height:
          wavePoint?.swell_2_height != null
            ? formatWaveFeet(wavePoint.swell_2_height)
            : null,
        swell_2_period:
          wavePoint?.swell_2_period != null
            ? formatPeriodSeconds(wavePoint.swell_2_period)
            : null,
        swell_2_direction: wavePoint
          ? this.dataSourceManager
              .getWaveWatchService()
              .getWaveDirectionText(wavePoint.swell_2_direction)
          : null,

        // Wind waves - prioritize CDIP when available
        wind_wave_height:
          useCDIPData && cdipPoint?.windWaveHeight
            ? formatFeet(cdipPoint.windWaveHeight)
            : wavePoint
            ? this.metersToFeet(wavePoint.wind_wave_height)
            : null,
        wind_wave_period:
          useCDIPData && cdipPoint?.windWavePeriod
            ? `${cdipPoint.windWavePeriod}s`
            : wavePoint
            ? `${wavePoint.wind_wave_period}s`
            : null,
        wind_wave_direction:
          useCDIPData && cdipPoint?.windWaveDirection
            ? this.dataSourceManager.getWaveWatchService().getWaveDirectionText(
                cdipPoint.windWaveDirection
              )
            : wavePoint
            ? this.dataSourceManager.getWaveWatchService().getWaveDirectionText(
                wavePoint.wind_wave_direction
              )
            : null,

        // Water temperature
        water_temp:
          useBuoyData && buoyData.water_temperature
            ? `${Math.round((buoyData.water_temperature * 9) / 5 + 32)}°F`
            : this.estimateWaterTemperature(beach.lat ?? 32.7, forecastTime),

        // Wind data
        wind_speed: weatherPoint
          ? this.extractWindSpeed(weatherPoint.windSpeed)
          : "10 mph",
        wind_direction: weatherPoint?.windDirection || "SW",
        wind_direction_deg: cardinalToDegrees(weatherPoint?.windDirection || "SW"),

        // Tide information
        tide_status: tideInfo.status,
        tide_height: tideInfo.currentHeight,
        next_tide_time: tideInfo.nextTideTime,
        next_tide_type: tideInfo.nextTideType,
        next_tide_height: tideInfo.nextTideHeight,

        // Weather conditions
        weather_condition: weatherPoint?.shortForecast || "Partly Cloudy",
        air_temperature: weatherPoint
          ? `${weatherPoint.temperature}°F`
          : this.estimateAirTemperature(beach.lat ?? 32.7, forecastTime),

        beach_id: beach.id,
        confidence_score: confidenceScore,
        data_source: timepointDataSource,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),

        // Raw forecast (compact) to satisfy DB constraint and avoid oversized JSON
        raw_forecast: {
          data_sources: dataSources,
          // Include CDIP raw snapshot for transparency/debugging only when CDIP
          // data was actually used for this timepoint.
          ...(useCDIPData && cdipData && {
            cdip_data: {
              stationId: (cdipData as any).stationId,
              stationName: (cdipData as any).stationName,
              lastUpdated: (cdipData as any).lastUpdated,
              dataSource: "CDIP",
              // Store a small sample of recent points to satisfy tests and aid debugging
              data: Array.isArray((cdipData as any).data)
                ? (cdipData as any).data.slice(0, 2)
                : [],
            },
          }),
          quality_scores: {
            cdip: cdipData
              ? this.dataSourceManager.getCDIPService().getDataQualityScore(cdipData)
              : undefined,
            noaa: waveData ? 75 : undefined,
            overall: confidenceScore,
          },
          fetch_timestamps: {
            cdip: cdipData?.lastUpdated,
            noaa: now.toISOString(),
          },
        },
      } as EnhancedForecastWithRawData;

      // Validate forecast values for San Diego area and flag unrealistic conditions
      const { warnings: validationWarnings } = this.validateForecastValues(
        forecast,
        beach.name
      );
      if (validationWarnings.length > 0) {
        const payload = {
          date: forecast.forecast_date,
          time: forecast.forecast_time,
          dataSource: forecast.data_source,
          warnings: validationWarnings,
          values: {
            waveHeight: forecast.wave_height ?? null,
            wavePeriod: forecast.wave_period ?? null,
            swell1Height: forecast.swell_1_height ?? null,
            swell1Period: forecast.swell_1_period ?? null,
          },
        };

        if (verboseLogs) {
          console.warn(
            `🌊 Forecast validation warnings for ${beach.name || "unknown beach"}:`,
            payload
          );
        } else {
          validationTimepointsWithWarnings += 1;
          validationTotalWarnings += validationWarnings.length;
          const dsKey = String(payload.dataSource || "UNKNOWN");
          validationDataSourceCounts.set(
            dsKey,
            (validationDataSourceCounts.get(dsKey) ?? 0) + validationWarnings.length
          );

          for (const message of validationWarnings) {
            const type = message.split(":")[0]?.trim() || message;
            const existing = validationWarningTypes.get(type);
            if (existing) {
              existing.count += 1;
              continue;
            }

            validationWarningTypes.set(type, {
              count: 1,
              sample: {
                date: payload.date ?? null,
                time: payload.time ?? null,
                dataSource: payload.dataSource ?? null,
                values: payload.values,
                sampleWarningMessage: message,
              },
            });
          }
        }
      }

      // Apply expert weighting silently (no visible attribution)
      const weightedForecast = await this.applyExpertWeighting(
        forecast,
        beach.name,
        forecastTime
      );

      forecasts.push(weightedForecast);
    }

    if (!verboseLogs && validationWarningTypes.size > 0) {
      console.warn(`🌊 Forecast validation summary for ${beach.name}:`, {
        beachId: beach.id,
        beachName: beach.name,
        totalForecasts: TOTAL_FORECASTS,
        timepointsWithWarnings: validationTimepointsWithWarnings,
        totalWarnings: validationTotalWarnings,
        dataSourceCounts: Object.fromEntries(validationDataSourceCounts),
        warningTypes: Array.from(validationWarningTypes.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .map(([type, info]) => ({
            type,
            count: info.count,
            sample: info.sample,
          })),
      });
    }

    return forecasts;
  }

  /**
   * Get CDIP data for a specific time
   * CDIP provides real-time buoy measurements, not forecasts
   * Only use for current/recent conditions (within 6 hours)
   */
  private getCDIPDataForTime(cdipData: CDIPBuoyData | null, targetTime: Date) {
    if (!cdipData?.data || cdipData.data.length === 0) return null;

    const now = new Date();
    const hoursFromNow =
      (targetTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Only use CDIP data for current conditions (within 6 hours)
    // Beyond that, NOAA forecasts are more appropriate
    if (hoursFromNow > 6) {
      // This function is called per-forecast timepoint; avoid noisy production logs.
      if (this.isVerboseLoggingEnabled()) {
        console.log(
          `📊 Target time ${targetTime.toISOString()} is ${hoursFromNow.toFixed(
            1
          )}h from now - using NOAA forecast instead of CDIP current conditions`
        );
      }
      return null;
    }

    // For current/recent times, use the most recent CDIP measurement
    const sortedData = [...cdipData.data].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const recentData = sortedData[0];
    // This function is called per-forecast timepoint; avoid noisy production logs.
    if (this.isVerboseLoggingEnabled()) {
      console.log(
        `🌊 Using CDIP current conditions for ${targetTime.toISOString()}: ${
          recentData.significantWaveHeight
        }m from ${recentData.timestamp}`
      );
    }

    return recentData;
  }

  /**
   * Get wave data for a specific time
   */
  private getWaveDataForTime(waveData: any, targetTime: Date) {
    if (!waveData?.forecast) return null;

    // Find the closest wave forecast point
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

  /**
   * Get tide information for a specific time
   */
  private getTideInfoForTime(tideData: any, targetTime: Date) {
    const defaultTideInfo = {
      status: "Unknown",
      currentHeight: "2.5 ft",
      nextTideTime: "Unknown",
      nextTideType: "Unknown",
      nextTideHeight: "Unknown",
    };

    if (!tideData?.tides) return defaultTideInfo;

    const status = this.dataSourceManager.getCOOPSService().getTideStatusAtTime(
      tideData.tides,
      targetTime
    );
    const currentHeight = this.dataSourceManager.getCOOPSService().getTideHeightAtTime(
      tideData.tides,
      targetTime
    );
    const nextTide = this.dataSourceManager.getCOOPSService().getNextTideFromTime(
      tideData.tides,
      targetTime
    );

    return {
      status,
      currentHeight: currentHeight ? `${currentHeight} ft` : "2.5 ft",
      nextTideTime: nextTide
        ? new Date(nextTide.time * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Unknown",
      nextTideType: nextTide?.name || "Unknown",
      nextTideHeight: nextTide ? `${nextTide.height} ft` : "Unknown",
    };
  }

  /**
   * Get weather data for a specific time
   */
  private getWeatherDataForTime(weatherData: any[], targetTime: Date) {
    if (!weatherData || weatherData.length === 0) return null;

    // Find the closest weather forecast point
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

  // calculateConfidenceScore moved to lib/services/forecast/confidence-scorer.ts

  /**
   * Helper functions
   */
  private metersToFeet(meters: number): string {
    const feet = meters * 3.28084;
    if (feet < 1) {
      return `${Math.round(feet * 10) / 10} ft`;
    }
    // Use decimal precision to show actual NOAA variation
    // Round to nearest 0.1 feet for maximum precision
    const rounded = Math.round(feet * 10) / 10;
    return `${rounded} ft`;
  }

  private extractWindSpeed(windSpeedStr: string): string {
    if (!windSpeedStr) return "10 mph";
    const match = windSpeedStr.match(/(\d+)/);
    return match ? `${match[1]} mph` : "10 mph";
  }

  private estimateWaterTemperature(lat: number, date: Date): string {
    // Simplified water temperature estimation based on location and season
    const month = date.getMonth();
    let baseTemp = 65; // Base temperature for California coast

    // Seasonal variation
    const seasonalAdjustment = 10 * Math.sin(((month - 3) * Math.PI) / 6);
    const estimatedTemp = Math.round(baseTemp + seasonalAdjustment);

    return `${estimatedTemp}°F`;
  }

  private estimateAirTemperature(lat: number, date: Date): string {
    // Simplified air temperature estimation
    const month = date.getMonth();
    let baseTemp = 70; // Base temperature for California coast

    // Seasonal variation
    const seasonalAdjustment = 15 * Math.sin(((month - 3) * Math.PI) / 6);
    const estimatedTemp = Math.round(baseTemp + seasonalAdjustment);

    return `${estimatedTemp}°F`;
  }

  /**
   * Validate forecast values for San Diego area and flag unrealistic conditions
   */
  private validateForecastValues(
    forecast: EnhancedForecastEntity,
    beachName?: string
  ): { isValid: boolean; warnings: string[] } {
    const waveHeight = parseFloat(forecast.wave_height || "0");
    const wavePeriod = parseFloat(
      forecast.wave_period?.replace("s", "") || "0"
    );
    const swell1Period = parseFloat(
      forecast.swell_1_period?.replace("s", "") || "0"
    );

    let isValid = true;
    const warnings: string[] = [];

    // San Diego typical conditions validation
    if (waveHeight > 8) {
      warnings.push(
        `Unusually large waves: ${forecast.wave_height} (typical max: 8ft)`
      );
      isValid = false;
    }

    if (waveHeight < 0.5) {
      warnings.push(
        `Unusually small waves: ${forecast.wave_height} (typical min: 1ft)`
      );
    }

    if (wavePeriod > 0 && wavePeriod < 6) {
      warnings.push(
        `Very short wave period: ${forecast.wave_period} (Pacific swells typically 10-18s)`
      );
    }

    if (swell1Period > 0 && swell1Period < 8) {
      warnings.push(
        `Short swell period: ${forecast.swell_1_period} (Pacific swells typically 12-18s)`
      );
    }

    return { isValid, warnings };
  }

  /**
   * Apply expert weighting to forecasts silently
   * Uses calibration data to improve forecast accuracy without exposing sources
   */
  private async applyExpertWeighting(
    forecast: EnhancedForecastWithRawData,
    beachName: string,
    forecastTime: Date
  ): Promise<EnhancedForecastWithRawData> {
    try {
      const weightingService = getForecastWeightingService();

      // Parse current forecast values
      const parseHeight = (str: string | null): number => {
        if (!str) return 0;
        const match = str.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const parsePeriod = (str: string | null): number => {
        if (!str) return 0;
        const match = str.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const parseDirection = (str: string | null): number => {
        return cardinalToDegrees(str) ?? 0;
      };

      // Create automated forecast data object
      const automatedForecast = {
        wave_height_ft: parseHeight(forecast.wave_height ?? null),
        wave_period_s: parsePeriod(forecast.wave_period ?? null),
        wave_direction_deg: parseDirection(forecast.wave_direction ?? null),
        wind_speed_mph: forecast.wind_speed ? parseFloat(forecast.wind_speed) : undefined,
        wind_direction_deg: parseDirection(forecast.wind_direction ?? null),
        confidence: forecast.confidence_score || 0.7,
      };

      // Skip weighting if forecast has no data
      if (automatedForecast.wave_height_ft === 0) {
        return forecast;
      }

      // Get weighted forecast from expert calibration
      const weightedForecast = await weightingService.blendForecast(
        automatedForecast,
        beachName,
        forecastTime
      );

      // Format values back to strings
      const formatHeight = (ft: number): string => {
        return `${Math.round(ft * 10) / 10} ft`;
      };

      const formatPeriod = (s: number): string => {
        return `${Math.round(s * 10) / 10}s`;
      };

      // Apply weighted values back to forecast
      const updatedForecast = {
        ...forecast,
        wave_height: formatHeight(weightedForecast.wave_height_ft),
        wave_period: formatPeriod(weightedForecast.wave_period_s),
        confidence_score: weightedForecast.confidence,
        // Note: No visible attribution to expert sources - silent integration
      };

      return updatedForecast;
    } catch (error) {
      // If weighting fails, return original forecast
      console.warn('Expert weighting failed, using original forecast:', error);
      return forecast;
    }
  }

  /**
   * Store enhanced forecasts in database
   * Delegates to ForecastStorageService
   */
  async storeEnhancedForecasts(
    beach: Beach,
    forecasts: EnhancedForecastEntity[]
  ) {
    return this.storageService.storeEnhancedForecasts(beach, forecasts);
  }

  /**
   * Legacy implementation - replaced by ForecastStorageService
   * Kept for reference, will be removed after verification
   * @deprecated
   */
  private async _legacyStoreEnhancedForecasts(
    beach: Beach,
    forecasts: EnhancedForecastEntity[]
  ) {
    const supabase = await createSupabaseServiceRoleClient();

    try {
      const verboseLogsEnabled = this.isVerboseLoggingEnabled();

      const extractMissingColumnName = (err: any): string | null => {
        const msg = typeof err?.message === "string" ? err.message : "";
        const match = msg.match(/Could not find the '([^']+)' column/);
        return match?.[1] ?? null;
      };

      const stripColumnFromRows = (
        rows: Array<Record<string, unknown>>,
        columnName: string
      ): { rows: Array<Record<string, unknown>>; didStrip: boolean } => {
        let didStrip = false;
        const nextRows = rows.map((row) => {
          if (!Object.prototype.hasOwnProperty.call(row, columnName)) {
            return row;
          }
          didStrip = true;
          const copy: Record<string, unknown> = { ...row };
          delete copy[columnName];
          return copy;
        });
        return { rows: nextRows, didStrip };
      };

      // Deduplicate forecasts by unique key (beach_id, forecast_date, forecast_time)
      // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" errors
      const uniqueForecasts = new Map<string, EnhancedForecastEntity>();
      forecasts.forEach((forecast) => {
        const key = `${forecast.beach_id}|${forecast.forecast_date}|${forecast.forecast_time}`;
        if (!uniqueForecasts.has(key)) {
          uniqueForecasts.set(key, forecast);
        } else {
          if (verboseLogsEnabled) {
            console.log(`⚠️ Skipping duplicate forecast: ${key}`);
          }
        }
      });

      if (verboseLogsEnabled) {
        console.log(
          `📊 Deduplicated ${forecasts.length} forecasts to ${uniqueForecasts.size} unique entries`
        );
      }

      // Upsert in chunks to avoid exceeding PostgREST payload limits
      // Increased from 24 to 100 to reduce total number of database calls
      const toRows = Array.from(uniqueForecasts.values()).map((forecast) => {
        const { id, ...forecastWithoutId } = forecast;
        return { ...forecastWithoutId, updated_at: new Date().toISOString() };
      });
      const chunkSize = 100;
      let lastData: any = null;
      for (let i = 0; i < toRows.length; i += chunkSize) {
        let chunk: Array<Record<string, unknown>> = toRows.slice(i, i + chunkSize);
        let lastError: any = null;

        // Allow a few "schema strip" retries in case multiple new columns
        // are missing in the target environment.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const { data, error } = await supabase
            .from("enhanced_forecasts")
            .upsert(chunk, {
              onConflict: "beach_id,forecast_date,forecast_time",
            });

          if (!error) {
            lastData = data;
            lastError = null;
            break;
          }

          lastError = error;

          const missingColumn = extractMissingColumnName(error);
          const canAttemptStrip =
            error?.code === "PGRST204" && !!missingColumn;

          if (!canAttemptStrip) {
            console.error("Enhanced forecast upsert error:", {
              message: (error as any).message,
              details: (error as any).details,
              hint: (error as any).hint,
              code: (error as any).code,
            });
            throw error;
          }

          if (missingColumn && !this.warnedSchemaColumns.has(missingColumn)) {
            console.warn(
              `⚠️ Enhanced forecast schema mismatch (missing column '${missingColumn}'). Retrying store without that column.`
            );
            this.warnedSchemaColumns.add(missingColumn);
          }

          const { rows: strippedRows, didStrip } = stripColumnFromRows(
            chunk,
            missingColumn
          );

          // If stripping didn't change anything, retrying would loop forever.
          if (!didStrip) {
            console.error("Enhanced forecast upsert error:", {
              message: (error as any).message,
              details: (error as any).details,
              hint: (error as any).hint,
              code: (error as any).code,
            });
            throw error;
          }

          chunk = strippedRows;
        }

        if (lastError) {
          console.error("Enhanced forecast upsert error:", {
            message: (lastError as any).message,
            details: (lastError as any).details,
            hint: (lastError as any).hint,
            code: (lastError as any).code,
          });
          throw lastError;
        }
      }

      return { success: true, data: lastData };
    } catch (error) {
      console.error("Error storing enhanced forecasts:", error);
      return {
        success: false,
        error:
          (error as any)?.message ||
          (error as any)?.details ||
          JSON.stringify(error) ||
          "Unknown error",
      };
    }
  }

  /**
   * Update all beaches with enhanced forecasts
   * Uses batch processing to avoid overwhelming external APIs and preventing timeouts
   * Pre-fetches shared data (tide stations) to avoid duplicate API calls
   */
  async updateAllEnhancedForecasts(options: { deadlineMs?: number } = {}) {
    console.log("📊 EnhancedForecastService.updateAllEnhancedForecasts() starting (v3 with stale-only updates)");
    const supabase = await createSupabaseServiceRoleClient();
    const deadlineMs = options.deadlineMs;
    const hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);
    const msRemaining = () =>
      hasDeadline ? (deadlineMs as number) - Date.now() : Number.POSITIVE_INFINITY;
    const shouldStop = () => hasDeadline && msRemaining() <= 0;
    // Process beaches in small batches
    const BATCH_SIZE = Number(process.env.FORECAST_BATCH_SIZE ?? 3);
    // Delay between batches to avoid rate limiting
    const BATCH_DELAY_MS = Number(process.env.FORECAST_BATCH_DELAY_MS ?? 1000);
    // Maximum beaches to process per cron run to avoid timeout
    // Default is tuned to stay under Vercel's 5 minute cron limit while improving overall rotation throughput.
    // Override via FORECAST_MAX_BEACHES_PER_RUN if needed.
    const MAX_BEACHES_PER_RUN = Number(process.env.FORECAST_MAX_BEACHES_PER_RUN ?? 45);
    /**
     * Freshness window for deciding what is "stale enough" to refresh.
     *
     * IMPORTANT: This MUST be >= the cron interval (currently 2h) or else the same
     * beaches will be re-selected every run and overall coverage will never catch up.
     */
    const FRESHNESS_WINDOW_HOURS = Number(process.env.FORECAST_FRESHNESS_WINDOW_HOURS ?? 12);

    try {
      const staleThresholdMs = Date.now() - FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000;

      // Get all beaches (authoritative list)
      const { data: allBeaches, error: beachError } = await supabase
        .from("beaches")
        .select("*");

      if (beachError) {
        throw beachError;
      }

      if (!allBeaches || allBeaches.length === 0) {
        console.log("📭 No beaches found to update");
        return { success: true, results: [] };
      }

      const totalBeaches = allBeaches.length;

      /**
       * Build a per-beach "latest updated_at" map.
       * Use a DB view that returns a single latest row per beach to avoid PostgREST row caps.
       */
      const latestUpdatedAtByBeachMs = new Map<string, number>();
      const { data: latestRows, error: latestError } = await supabase
        .from("v_enhanced_forecast_latest")
        .select("beach_id, updated_at");

      if (latestError) {
        throw latestError;
      }

      for (const row of (latestRows ?? []) as Array<{ beach_id: string; updated_at: string | null }>) {
        if (!row?.beach_id || !row.updated_at) continue;
        const ts = new Date(row.updated_at).getTime();
        if (!Number.isFinite(ts)) continue;
        latestUpdatedAtByBeachMs.set(row.beach_id, ts);
      }

      const missingBeaches = allBeaches.filter((b) => !latestUpdatedAtByBeachMs.has(b.id));
      const staleBeaches = allBeaches
        .filter((b) => {
          const updatedAtMs = latestUpdatedAtByBeachMs.get(b.id);
          return Boolean(updatedAtMs && updatedAtMs < staleThresholdMs);
        })
        // Oldest first so we systematically catch up coverage/freshness
        .sort((a, b) => {
          const aUpdated = latestUpdatedAtByBeachMs.get(a.id) ?? 0;
          const bUpdated = latestUpdatedAtByBeachMs.get(b.id) ?? 0;
          return aUpdated - bUpdated;
        });

      // Prioritize missing coverage first, then oldest stale
      let beachesToUpdate = [...missingBeaches, ...staleBeaches];

      // If everything is fresh and present, rotate a few oldest anyway
      if (beachesToUpdate.length === 0) {
        console.log(
          "✅ All beaches have fresh forecasts, updating oldest 5 for rotation"
        );
        beachesToUpdate = allBeaches
          .filter((b) => latestUpdatedAtByBeachMs.has(b.id))
          .sort((a, b) => {
            const aUpdated = latestUpdatedAtByBeachMs.get(a.id) ?? 0;
            const bUpdated = latestUpdatedAtByBeachMs.get(b.id) ?? 0;
            return aUpdated - bUpdated;
          })
          .slice(0, 5);
      }

      // Limit to max beaches per run
      const beaches = beachesToUpdate.slice(0, MAX_BEACHES_PER_RUN);
      const selectedMissing = beaches.filter((b) => !latestUpdatedAtByBeachMs.has(b.id)).length;

      console.log(
        `🌊 Starting batch forecast update for ${beaches.length}/${allBeaches.length} beaches (missing: ${missingBeaches.length}, stale>${FRESHNESS_WINDOW_HOURS}h: ${staleBeaches.length}, selectedMissing: ${selectedMissing}, max ${MAX_BEACHES_PER_RUN} per run, batch size: ${BATCH_SIZE})`
      );
      const startTime = Date.now();

      if (shouldStop()) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.warn("⏱️ Time budget exhausted before processing started; stopping early", {
          selected: beaches.length,
          attempted: 0,
          remainingMs: msRemaining(),
        });
        return {
          success: true,
          results: [],
          summary: {
            total: beaches.length,
            attempted: 0,
            successful: 0,
            failed: 0,
            duration: `${duration}s`,
            stoppedEarly: true,
            stopReason: "time_budget",
            remainingMs: msRemaining(),
          },
        };
      }

      // Pre-fetch tide data for unique stations to avoid duplicate API calls
      // This significantly reduces the number of CO-OPS API calls
      await this.prefetchTideStations(beaches);

      // Split beaches into batches
      const batches: typeof beaches[] = [];
      for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
        batches.push(beaches.slice(i, i + BATCH_SIZE));
      }

      const allResults: Array<{
        beach: string;
        success: boolean;
        error?: any;
      }> = [];
      let successCount = 0;
      let failCount = 0;

      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (shouldStop()) {
          console.warn("⏱️ Stopping early due to time budget (before starting next batch)", {
            batchIndex,
            totalBatches: batches.length,
            attempted: allResults.length,
            successful: successCount,
            failed: failCount,
            remainingMs: msRemaining(),
          });
          break;
        }

        const batch = batches[batchIndex];
        const batchNum = batchIndex + 1;
        const totalBatches = batches.length;

        console.log(
          `📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} beaches)`
        );

        // Process beaches within batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (beach) => {
            try {
              const forecasts =
                await this.generateComprehensiveForecast(beach);
              const result = await this.storeEnhancedForecasts(
                beach,
                forecasts
              );
              if (result.success) {
                console.log(
                  `✅ ${beach.name}: ${forecasts.length} forecasts stored`
                );
              } else {
                console.warn(
                  `⚠️ ${beach.name}: store failed - ${result.error}`
                );
              }
              return {
                beach: beach.name,
                success: result.success,
                error: result.error,
              };
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              console.error(`❌ ${beach.name}: ${errorMsg}`);
              return { beach: beach.name, success: false, error: errorMsg };
            }
          })
        );

        // Collect results
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            allResults.push(result.value);
            if (result.value.success) {
              successCount++;
            } else {
              failCount++;
            }
          } else {
            allResults.push({
              beach: "unknown",
              success: false,
              error: "Promise rejected",
            });
            failCount++;
          }
        }

        console.log(
          `📊 Batch ${batchNum} complete: ${successCount} success, ${failCount} failed so far`
        );

        // Add delay between batches to avoid rate limiting (except after last batch)
        if (batchIndex < batches.length - 1) {
          if (hasDeadline && msRemaining() <= BATCH_DELAY_MS) {
            console.warn("⏱️ Skipping batch delay and stopping early due to time budget", {
              batchIndex,
              attempted: allResults.length,
              remainingMs: msRemaining(),
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const attempted = allResults.length;
      const stoppedEarly = attempted < beaches.length && hasDeadline;
      console.log(
        `🏁 Forecast update complete in ${duration}s: ${successCount}/${beaches.length} successful${
          stoppedEarly ? " (stopped early)" : ""
        }`
      );

      return {
        success: true,
        results: allResults,
        summary: {
          total: beaches.length,
          attempted,
          successful: successCount,
          failed: failCount,
          duration: `${duration}s`,
          stoppedEarly,
          stopReason: stoppedEarly ? "time_budget" : undefined,
          remainingMs: hasDeadline ? msRemaining() : undefined,
        },
      };
    } catch (error) {
      console.error("Error updating all enhanced forecasts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Pre-fetch tide data for all unique stations to populate the cache
   * This avoids duplicate API calls when multiple beaches share the same station
   */
  private async prefetchTideStations(beaches: Beach[]): Promise<void> {
    // Get unique station IDs for all beaches
    const stationIds = new Set<string>();
    for (const beach of beaches) {
      const stationId = this.dataSourceManager.getCOOPSService().getStationForLocation(
        beach.name,
        beach.lat ?? 0,
        beach.lon ?? 0
      );
      stationIds.add(stationId);
    }

    const uniqueStations = Array.from(stationIds);
    console.log(
      `📡 Pre-fetching tide data for ${uniqueStations.length} unique stations (covering ${beaches.length} beaches)`
    );

    // Fetch in small batches to avoid overwhelming the API
    const STATION_BATCH_SIZE = 5;
    for (let i = 0; i < uniqueStations.length; i += STATION_BATCH_SIZE) {
      const batch = uniqueStations.slice(i, i + STATION_BATCH_SIZE);
      await Promise.allSettled(
        batch.map((stationId) =>
          this.dataSourceManager.getCOOPSService().fetchCOOPSData(stationId, FORECAST_CONSTANTS.DAYS)
        )
      );
      // Small delay between station batches
      if (i + STATION_BATCH_SIZE < uniqueStations.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Tide station pre-fetch complete`);
  }
}
