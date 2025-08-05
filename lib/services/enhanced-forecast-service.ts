import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { NOAAWaveWatchService } from "./noaa-wavewatch-service";
import { NOAACOOPSService } from "./noaa-coops-service";
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
} from "@/types/forecast";
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

  constructor() {
    this.waveWatchService = new NOAAWaveWatchService();
    this.coopsService = new NOAACOOPSService();
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
        if (!beach.id || !beach.latitude || !beach.longitude) {
          throw new ValidationError(
            "beach",
            beach,
            "Beach must have valid ID, latitude, and longitude"
          );
        }

        // Fetch all data sources in parallel with error handling
        const [waveData, tideData, weatherData, buoyData] =
          await Promise.allSettled([
            this.fetchWaveDataWithRetry(beach),
            this.fetchTidalDataWithRetry(beach),
            this.fetchWeatherDataWithRetry(beach),
            this.fetchNearbyBuoyDataWithRetry(beach),
          ]);

        // Process results and handle failures gracefully
        const processedData = {
          beach,
          waveData: waveData.status === "fulfilled" ? waveData.value : null,
          tideData: tideData.status === "fulfilled" ? tideData.value : null,
          weatherData:
            weatherData.status === "fulfilled" ? weatherData.value : [],
          buoyData: buoyData.status === "fulfilled" ? buoyData.value : null,
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

        // Process and combine all data sources
        const forecasts = this.combineDataSources(processedData);

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
        beach.latitude,
        beach.longitude,
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
          beach.latitude,
          beach.longitude
        );
        const result = await this.coopsService.fetchCOOPSData(
          stationId,
          FORECAST_CONSTANTS.DAYS
        );
        return result;
      } catch (error) {
        throw new DataSourceError("CO-OPS", error as Error, {
          beachId: beach.id,
          location: { lat: beach.latitude, lng: beach.longitude },
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
        latitude: beach.latitude as any, // Type assertion for now
        longitude: beach.longitude as any,
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
   * Fetch weather data from NOAA
   */
  private async fetchWeatherData(beach: Beach) {
    try {
      // Get grid coordinates
      const pointsUrl = `https://api.weather.gov/points/${beach.latitude},${beach.longitude}`;
      const pointsResponse = await fetch(pointsUrl, {
        headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
      });

      if (!pointsResponse.ok) {
        throw new Error(`NOAA points API error: ${pointsResponse.status}`);
      }

      const pointsData = await pointsResponse.json();
      const forecastUrl = pointsData.properties.forecastHourly;

      if (!forecastUrl) {
        throw new Error("No forecast URL available");
      }

      // Fetch hourly forecast
      const forecastResponse = await fetch(forecastUrl, {
        headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
      });

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

      // Get nearby buoys with recent data
      const { data: buoys, error } = await supabase
        .from("buoys")
        .select("*")
        .eq("active", true)
        .not("wave_height", "is", null)
        .not("water_temperature", "is", null);

      if (error || !buoys) {
        return null;
      }

      // Find the closest buoy
      const buoysWithDistance = buoys
        .map((buoy) => {
          let buoyLat, buoyLng;

          // Handle different coordinate formats
          if (buoy.coordinates) {
            try {
              const coords = JSON.parse(buoy.coordinates);
              if (coords.coordinates && Array.isArray(coords.coordinates)) {
                buoyLng = coords.coordinates[0];
                buoyLat = coords.coordinates[1];
              }
            } catch (e) {
              const pointMatch = buoy.coordinates.match(/POINT\(([^)]+)\)/);
              if (pointMatch) {
                const parts = pointMatch[1].split(" ");
                if (parts.length === 2) {
                  buoyLng = parseFloat(parts[0]);
                  buoyLat = parseFloat(parts[1]);
                }
              }
            }
          }

          if (!buoyLat || !buoyLng) return null;

          const distance = calculateDistance(
            beach.latitude,
            beach.longitude,
            buoyLat,
            buoyLng,
            "km"
          );

          return { ...buoy, distance, lat: buoyLat, lng: buoyLng };
        })
        .filter(Boolean)
        .sort((a, b) => a!.distance - b!.distance);

      return buoysWithDistance[0] || null;
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
  private combineDataSources({
    beach,
    waveData,
    tideData,
    weatherData,
    buoyData,
  }: {
    beach: Beach;
    waveData: any;
    tideData: any;
    weatherData: any[];
    buoyData: any;
  }): EnhancedForecastEntity[] {
    const forecasts: EnhancedForecastEntity[] = [];
    const now = new Date();

    // Determine the primary data source based on wave data availability
    const primaryDataSource = waveData?.data_source || "FALLBACK";

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

      // Calculate confidence score based on data availability and freshness
      const confidenceScore = this.calculateConfidenceScore({
        hasWaveData: !!wavePoint,
        hasTideData: !!tideInfo,
        hasWeatherData: !!weatherPoint,
        hasBuoyData: useBuoyData,
        forecastHoursAhead: i * FORECAST_CONSTANTS.INTERVAL_HOURS,
      });

      const forecast = {
        id: `forecast-${beach.id}-${i}`, // Temporary ID for now
        forecast_date: this.getNormalizedDateString(forecastTime),
        forecast_time: this.getNormalizedTimeString(forecastTime),

        // Wave data from WaveWatch III or buoy
        wave_height:
          useBuoyData && buoyData.wave_height
            ? this.metersToFeet(buoyData.wave_height)
            : wavePoint
            ? this.metersToFeet(wavePoint.significant_wave_height)
            : null,
        wave_period:
          useBuoyData && buoyData.wave_period
            ? `${buoyData.wave_period}s`
            : wavePoint
            ? `${wavePoint.peak_wave_period}s`
            : null,
        wave_direction: wavePoint
          ? this.waveWatchService.getWaveDirectionText(
              wavePoint.peak_wave_direction
            )
          : null,

        // Detailed swell information
        swell_1_height: wavePoint
          ? this.metersToFeet(wavePoint.swell_1_height)
          : null,
        swell_1_period: wavePoint ? `${wavePoint.swell_1_period}s` : null,
        swell_1_direction: wavePoint
          ? this.waveWatchService.getWaveDirectionText(
              wavePoint.swell_1_direction
            )
          : null,

        swell_2_height: wavePoint
          ? this.metersToFeet(wavePoint.swell_2_height)
          : null,
        swell_2_period: wavePoint ? `${wavePoint.swell_2_period}s` : null,
        swell_2_direction: wavePoint
          ? this.waveWatchService.getWaveDirectionText(
              wavePoint.swell_2_direction
            )
          : null,

        // Wind waves
        wind_wave_height: wavePoint
          ? this.metersToFeet(wavePoint.wind_wave_height)
          : null,
        wind_wave_period: wavePoint ? `${wavePoint.wind_wave_period}s` : null,
        wind_wave_direction: wavePoint
          ? this.waveWatchService.getWaveDirectionText(
              wavePoint.wind_wave_direction
            )
          : null,

        // Water temperature
        water_temp:
          useBuoyData && buoyData.water_temperature
            ? `${Math.round((buoyData.water_temperature * 9) / 5 + 32)}°F`
            : this.estimateWaterTemperature(beach.latitude, forecastTime),

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
          : this.estimateAirTemperature(beach.latitude, forecastTime),

        beach_id: beach.id,
        confidence_score: confidenceScore,
        data_source: primaryDataSource,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      // Validate forecast values for San Diego area and flag unrealistic conditions
      this.validateForecastValues(forecast, beach.name);

      forecasts.push(forecast);
    }

    return forecasts;
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
    forecastHoursAhead,
  }: {
    hasWaveData: boolean;
    hasTideData: boolean;
    hasWeatherData: boolean;
    hasBuoyData: boolean;
    forecastHoursAhead: number;
  }): number {
    let score = 50; // Base score

    // Data availability bonuses
    if (hasWaveData) score += 20;
    if (hasTideData) score += 15;
    if (hasWeatherData) score += 10;
    if (hasBuoyData) score += 15;

    // Time penalty (forecasts get less reliable over time)
    const timePenalty = Math.min(30, forecastHoursAhead * 0.5);
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
   * Store enhanced forecasts in database
   */
  async storeEnhancedForecasts(
    beach: Beach,
    forecasts: EnhancedForecastEntity[]
  ) {
    const supabase = await createSupabaseServiceRoleClient();

    try {
      // Use upsert to prevent race conditions and duplicate data
      const { data, error } = await supabase.from("enhanced_forecasts").upsert(
        forecasts.map((forecast) => {
          // Remove the temporary ID and let PostgreSQL generate proper UUIDs
          const { id, ...forecastWithoutId } = forecast;
          return {
            ...forecastWithoutId,
            updated_at: new Date().toISOString(),
          };
        }),
        { onConflict: "beach_id,forecast_date,forecast_time" }
      );

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error("Error storing enhanced forecasts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
