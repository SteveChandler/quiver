import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { NOAAWaveWatchService } from "./noaa-wavewatch-service";
import { NOAACOOPSService } from "./noaa-coops-service";
import { CDIPService } from "./cdip-service";
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
  withErrorHandling,
  withRetry,
  logError,
} from "@/lib/errors/forecast-errors";

// Data source implementations
class WaveWatchDataSource implements WaveDataSource {
  readonly name = "WaveWatch III";

  constructor(private service: NOAAWaveWatchService) {}

  async fetchData(location: Location, timeRange: TimeRange): Promise<any> {
    const days = Math.ceil(
      (timeRange.end.getTime() - timeRange.start.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return this.service.fetchWaveWatchForecast(
      location.latitude,
      location.longitude,
      days
    );
  }

  async fetchWaveData(location: Location, days: number): Promise<WaveData> {
    const result = await this.service.fetchWaveWatchForecast(
      location.latitude,
      location.longitude,
      days
    );

    if (!result || !result.forecast) {
      return {
        forecast: [],
        data_source: "FALLBACK",
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      };
    }

    // Transform the service response to match the WaveData interface
    const forecast = result.forecast.map((point) => ({
      timestamp: new Date(point.timestamp),
      significantWaveHeight: point.significant_wave_height,
      peakWavePeriod: point.peak_wave_period,
      peakWaveDirection: point.peak_wave_direction,
      swell1Height: point.swell_1_height,
      swell1Period: point.swell_1_period,
      swell1Direction: point.swell_1_direction,
      swell2Height: point.swell_2_height,
      swell2Period: point.swell_2_period,
      swell2Direction: point.swell_2_direction,
      windWaveHeight: point.wind_wave_height,
      windWavePeriod: point.wind_wave_period,
      windWaveDirection: point.wind_wave_direction,
      data_source: point.data_source,
    }));

    return {
      forecast,
      data_source: result.data_source,
      location: {
        latitude: result.lat,
        longitude: result.lng,
      },
    };
  }

  isAvailable(): boolean {
    return true;
  }

  getReliabilityScore(): any {
    return createConfidenceScore(85);
  }
}

class TidalDataSource implements TideDataSource {
  readonly name = "NOAA CO-OPS";

  constructor(private service: NOAACOOPSService) {}

  async fetchData(location: Location, timeRange: TimeRange): Promise<any> {
    const days = Math.ceil(
      (timeRange.end.getTime() - timeRange.start.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const stationId = this.service.getStationForLocation(
      "",
      location.latitude,
      location.longitude
    );
    return this.service.fetchCOOPSData(stationId, days);
  }

  async fetchTideData(location: Location, days: number): Promise<any> {
    const stationId = this.service.getStationForLocation(
      "",
      location.latitude,
      location.longitude
    );
    const result = await this.service.fetchCOOPSData(stationId, days);
    return result || { tides: [], currents: [] };
  }

  isAvailable(): boolean {
    return true;
  }

  getReliabilityScore(): any {
    return createConfidenceScore(90);
  }
}

class NOAAWeatherDataSource implements WeatherDataSource {
  readonly name = "NOAA Weather Service";

  async fetchData(location: Location, timeRange: TimeRange): Promise<any> {
    return this.fetchWeatherData(location, 12);
  }

  async fetchWeatherData(
    location: Location,
    days: number
  ): Promise<WeatherData> {
    try {
      const pointsUrl = `https://api.weather.gov/points/${location.latitude},${location.longitude}`;
      const pointsResponse = await fetch(pointsUrl, {
        headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
      });

      if (!pointsResponse.ok) {
        throw new ApiError(
          pointsUrl,
          pointsResponse.status,
          await pointsResponse.text()
        );
      }

      const pointsData = await pointsResponse.json();
      const forecastUrl = pointsData.properties.forecastHourly;

      if (!forecastUrl) {
        throw new DataSourceError(
          "NOAA Weather",
          new Error("No forecast URL available")
        );
      }

      const forecastResponse = await fetch(forecastUrl, {
        headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
      });

      if (!forecastResponse.ok) {
        throw new ApiError(
          forecastUrl,
          forecastResponse.status,
          await forecastResponse.text()
        );
      }

      const forecastData = await forecastResponse.json();
      return { periods: forecastData.properties.periods || [] };
    } catch (error) {
      if (error instanceof ForecastError) {
        throw error;
      }
      throw new DataSourceError("NOAA Weather", error as Error, {
        location: { lat: location.latitude, lng: location.longitude },
      });
    }
  }

  isAvailable(): boolean {
    return true;
  }

  getReliabilityScore(): any {
    return createConfidenceScore(80);
  }
}

export class EnhancedForecastService {
  private waveWatchService: NOAAWaveWatchService;
  private coopsService: NOAACOOPSService;
  private cdipService: CDIPService;

  constructor() {
    this.waveWatchService = new NOAAWaveWatchService();
    this.coopsService = new NOAACOOPSService();
    this.cdipService = new CDIPService();
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
      const result = await this.waveWatchService.fetchWaveWatchForecast(
        beach.lat,
        beach.lon,
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
        const stationId = this.coopsService.getStationForLocation(
          beach.name,
          beach.lat,
          beach.lon
        );
        const result = await this.coopsService.fetchCOOPSData(
          stationId,
          FORECAST_CONSTANTS.DAYS
        );
        return result;
      } catch (error) {
        throw new DataSourceError("CO-OPS", error as Error, {
          beachId: beach.id,
          location: { lat: beach.lat, lng: beach.lon },
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
      const result = await weatherSource.fetchWeatherData(
        location,
        FORECAST_CONSTANTS.DAYS
      );
      return result.periods;
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
    console.log(
      `🏖️ fetchCDIPDataWithRetry called for beach: ${beach.name} (${beach.lat}, ${beach.lon})`
    );
    return withRetry(async () => {
      try {
        // Prefer explicit override when present
        let selectedStation: string | null = null;
        if (beach.cdip_station) {
          selectedStation = beach.cdip_station;
          console.log(
            `✅ Using CDIP override station ${selectedStation} for ${beach.name}`
          );
        } else {
          console.log(`🔍 Looking for nearest CDIP station for ${beach.name}`);
          selectedStation = await this.cdipService.getNearestStation(
            beach.lat,
            beach.lon,
            50 // 50km radius
          );
        }

        if (!selectedStation) {
          console.warn(
            `❌ No nearby CDIP station found for ${beach.name} within 50km`
          );
          return null;
        }

        console.log(
          `✅ Selected CDIP station ${selectedStation} for ${beach.name}`
        );

        // Fetch CDIP data for the nearest station
        console.log(
          `🌊 Fetching CDIP data from station ${selectedStation} for ${beach.name}`
        );
        const cdipData = await this.cdipService.fetchBuoyData(selectedStation);

        if (cdipData) {
          console.log(
            `✅ Successfully fetched CDIP data for ${beach.name} from station ${selectedStation}`
          );
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
          location: { lat: beach.lat, lng: beach.lon },
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
      if (beach.ndbc_station) {
        const { data: overrideBuoy } = await supabase
          .from("buoys")
          .select("*")
          .eq("buoy_uuid", beach.ndbc_station)
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

      // Calculate confidence score based on data availability and freshness
      const confidenceScore = this.calculateConfidenceScore({
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
            ? this.waveWatchService.getWaveDirectionText(
                cdipPoint.peakWaveDirection
              )
            : wavePoint
            ? this.waveWatchService.getWaveDirectionText(
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
            ? this.waveWatchService.getWaveDirectionText(
                cdipPoint.swellDirection
              )
            : wavePoint
            ? this.waveWatchService.getWaveDirectionText(
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
          ? this.waveWatchService.getWaveDirectionText(
              wavePoint.swell_2_direction
            )
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
            ? this.waveWatchService.getWaveDirectionText(
                cdipPoint.windWaveDirection
              )
            : wavePoint
            ? this.waveWatchService.getWaveDirectionText(
                wavePoint.wind_wave_direction
              )
            : null,

        // Water temperature
        water_temp:
          useBuoyData && buoyData.water_temperature
            ? `${Math.round((buoyData.water_temperature * 9) / 5 + 32)}°F`
            : this.estimateWaterTemperature(beach.lat, forecastTime),

        // Wind data
        wind_speed: weatherPoint
          ? this.extractWindSpeed(weatherPoint.windSpeed)
          : "10 mph",
        wind_direction: weatherPoint?.windDirection || "SW",

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
          : this.estimateAirTemperature(beach.lat, forecastTime),

        beach_id: beach.id,
        confidence_score: confidenceScore,
        data_source: primaryDataSource,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),

        // Raw forecast (compact) to satisfy DB constraint and avoid oversized JSON
        raw_forecast: {
          data_sources: dataSources,
          // Include CDIP raw snapshot for transparency/debugging when available
          ...(cdipData && {
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
              ? this.cdipService.getDataQualityScore(cdipData)
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
      this.validateForecastValues(forecast, beach.name);

      // Apply expert weighting silently (no visible attribution)
      const weightedForecast = await this.applyExpertWeighting(
        forecast,
        beach.name,
        forecastTime
      );

      forecasts.push(weightedForecast);
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
      console.log(
        `📊 Target time ${targetTime.toISOString()} is ${hoursFromNow.toFixed(
          1
        )}h from now - using NOAA forecast instead of CDIP current conditions`
      );
      return null;
    }

    // For current/recent times, use the most recent CDIP measurement
    const sortedData = [...cdipData.data].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const recentData = sortedData[0];
    console.log(
      `🌊 Using CDIP current conditions for ${targetTime.toISOString()}: ${
        recentData.significantWaveHeight
      }m from ${recentData.timestamp}`
    );

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

    const status = this.coopsService.getTideStatusAtTime(
      tideData.tides,
      targetTime
    );
    const currentHeight = this.coopsService.getTideHeightAtTime(
      tideData.tides,
      targetTime
    );
    const nextTide = this.coopsService.getNextTideFromTime(
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

  /**
   * Calculate confidence score based on data availability
   */
  private calculateConfidenceScore({
    hasWaveData,
    hasTideData,
    hasWeatherData,
    hasBuoyData,
    hasCDIPData,
    forecastHoursAhead,
  }: {
    hasWaveData: boolean;
    hasTideData: boolean;
    hasWeatherData: boolean;
    hasBuoyData: boolean;
    hasCDIPData?: boolean;
    forecastHoursAhead: number;
  }): number {
    let score = 50; // Base score

    // Data availability bonuses - CDIP gets highest bonus for quality
    if (hasCDIPData) score += 25; // Premium for high-quality CDIP buoy data
    else if (hasWaveData) score += 20; // Standard wave model data

    if (hasTideData) score += 15;
    if (hasWeatherData) score += 10;
    if (hasBuoyData) score += 15;

    // Time penalty (forecasts get less reliable over time)
    // CDIP data is real-time so less time penalty for recent forecasts
    const timePenalty = hasCDIPData
      ? Math.min(20, forecastHoursAhead * 0.3) // Reduced penalty for CDIP data
      : Math.min(30, forecastHoursAhead * 0.5);
    score -= timePenalty;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

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
  ): boolean {
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

    if (warnings.length > 0) {
      console.warn(
        `🌊 Forecast validation warnings for ${beachName || "unknown beach"}:`,
        {
          date: forecast.forecast_date,
          time: forecast.forecast_time,
          dataSource: forecast.data_source,
          warnings,
          values: {
            waveHeight: forecast.wave_height,
            wavePeriod: forecast.wave_period,
            swell1Height: forecast.swell_1_height,
            swell1Period: forecast.swell_1_period,
          },
        }
      );
    }

    return isValid;
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
        if (!str) return 0;
        // Convert text direction to degrees if needed
        const directionMap: { [key: string]: number } = {
          'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
          'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
          'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
          'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
        };
        return directionMap[str] || 0;
      };

      // Create automated forecast data object
      const automatedForecast = {
        wave_height_ft: parseHeight(forecast.wave_height),
        wave_period_s: parsePeriod(forecast.wave_period),
        wave_direction_deg: parseDirection(forecast.wave_direction),
        wind_speed_mph: forecast.wind_speed ? parseFloat(forecast.wind_speed) : undefined,
        wind_direction_deg: parseDirection(forecast.wind_direction),
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
   */
  async storeEnhancedForecasts(
    beach: Beach,
    forecasts: EnhancedForecastEntity[]
  ) {
    const supabase = await createSupabaseServiceRoleClient();

    try {
      // Deduplicate forecasts by unique key (beach_id, forecast_date, forecast_time)
      // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" errors
      const uniqueForecasts = new Map<string, EnhancedForecastEntity>();
      forecasts.forEach((forecast) => {
        const key = `${forecast.beach_id}|${forecast.forecast_date}|${forecast.forecast_time}`;
        if (!uniqueForecasts.has(key)) {
          uniqueForecasts.set(key, forecast);
        } else {
          console.log(`⚠️ Skipping duplicate forecast: ${key}`);
        }
      });

      console.log(
        `📊 Deduplicated ${forecasts.length} forecasts to ${uniqueForecasts.size} unique entries`
      );

      // Upsert in chunks to avoid exceeding PostgREST payload limits
      // Increased from 24 to 100 to reduce total number of database calls
      const toRows = Array.from(uniqueForecasts.values()).map((forecast) => {
        const { id, ...forecastWithoutId } = forecast;
        return { ...forecastWithoutId, updated_at: new Date().toISOString() };
      });
      const chunkSize = 100;
      let lastData: any = null;
      for (let i = 0; i < toRows.length; i += chunkSize) {
        const chunk = toRows.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("enhanced_forecasts")
          .upsert(chunk, {
            onConflict: "beach_id,forecast_date,forecast_time",
          });
        if (error) {
          console.error("Enhanced forecast upsert error:", {
            message: (error as any).message,
            details: (error as any).details,
            hint: (error as any).hint,
            code: (error as any).code,
          });
          throw error;
        }
        lastData = data;
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
   */
  async updateAllEnhancedForecasts() {
    const supabase = await createSupabaseServiceRoleClient();

    try {
      // Get all beaches
      const { data: beaches, error } = await supabase
        .from("beaches")
        .select("*");

      if (error) {
        throw error;
      }

      // Update forecasts for each beach
      const results = await Promise.allSettled(
        beaches.map(async (beach) => {
          try {
            const forecasts = await this.generateComprehensiveForecast(beach);
            const result = await this.storeEnhancedForecasts(beach, forecasts);
            return { beach: beach.name, success: result.success };
          } catch (error) {
            console.error(`Error updating forecasts for ${beach.name}:`, error);
            return { beach: beach.name, success: false, error };
          }
        })
      );

      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;
      const failed = results.length - successful;

      return {
        success: true,
        results: results.map((r) =>
          r.status === "fulfilled"
            ? r.value
            : { success: false, error: "Promise rejected" }
        ),
      };
    } catch (error) {
      console.error("Error updating all enhanced forecasts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
