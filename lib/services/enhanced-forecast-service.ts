import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { NOAAWaveWatchService } from "./noaa-wavewatch-service";
import { NOAACOOPSService } from "./noaa-coops-service";
import type { Beach } from "@/types/database";

// Enhanced forecast data structure
interface EnhancedForecastData {
  forecast_date: string;
  forecast_time: string;
  wave_height: string | null;
  wave_period: string | null;
  wave_direction: string | null;
  swell_1_height: string | null;
  swell_1_period: string | null;
  swell_1_direction: string | null;
  swell_2_height: string | null;
  swell_2_period: string | null;
  swell_2_direction: string | null;
  wind_wave_height: string | null;
  wind_wave_period: string | null;
  wind_wave_direction: string | null;
  water_temp: string;
  wind_speed: string;
  wind_direction: string;
  tide_status: string;
  tide_height: string;
  next_tide_time: string;
  next_tide_type: string;
  next_tide_height: string;
  current_speed: string;
  current_direction: string;
  weather_condition: string;
  air_temperature: string;
  beach_id: string;
  confidence_score: number; // 0-100, based on data quality and age
}

export class EnhancedForecastService {
  private waveWatchService: NOAAWaveWatchService;
  private coopsService: NOAACOOPSService;

  constructor() {
    this.waveWatchService = new NOAAWaveWatchService();
    this.coopsService = new NOAACOOPSService();
  }

  /**
   * Generate comprehensive 10-day forecast for a beach
   */
  async generateComprehensiveForecast(
    beach: Beach
  ): Promise<EnhancedForecastData[]> {
    try {
      console.log(`Generating comprehensive forecast for ${beach.name}`);

      // Fetch all data sources in parallel
      const [waveData, tideData, weatherData, buoyData] = await Promise.all([
        this.waveWatchService.fetchWaveWatchForecast(
          beach.latitude,
          beach.longitude,
          10
        ),
        this.fetchTidalData(beach),
        this.fetchWeatherData(beach),
        this.fetchNearbyBuoyData(beach),
      ]);

      // Process and combine all data sources
      const forecasts = this.combineDataSources({
        beach,
        waveData,
        tideData,
        weatherData,
        buoyData,
      });

      console.log(
        `Generated ${forecasts.length} comprehensive forecast points for ${beach.name}`
      );
      return forecasts;
    } catch (error) {
      console.error(
        `Error generating comprehensive forecast for ${beach.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch tidal data using CO-OPS service
   */
  private async fetchTidalData(beach: Beach) {
    try {
      const stationId = this.coopsService.getStationForLocation(
        beach.name,
        beach.latitude,
        beach.longitude
      );

      return await this.coopsService.fetchCOOPSData(stationId, 10);
    } catch (error) {
      console.error("Error fetching tidal data:", error);
      return null;
    }
  }

  /**
   * Fetch weather data from NOAA
   */
  private async fetchWeatherData(beach: Beach) {
    try {
      console.log(
        `Fetching NOAA weather data for ${beach.latitude}, ${beach.longitude}`
      );

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
        console.log("No buoys with live data found");
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

          const distance = this.calculateDistance(
            beach.latitude,
            beach.longitude,
            buoyLat,
            buoyLng
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
  }): EnhancedForecastData[] {
    const forecasts: EnhancedForecastData[] = [];
    const now = new Date();

    // Generate forecasts for 10 days, every 3 hours
    for (let i = 0; i < 10 * 8; i++) {
      const forecastTime = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);

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
        forecastHoursAhead: i * 3,
      });

      forecasts.push({
        forecast_date: forecastTime.toISOString().split("T")[0],
        forecast_time: forecastTime.toISOString().split("T")[1].substring(0, 8),

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

        // Current information
        current_speed: tideInfo.currentSpeed,
        current_direction: tideInfo.currentDirection,

        // Weather conditions
        weather_condition: weatherPoint?.shortForecast || "Partly Cloudy",
        air_temperature: weatherPoint
          ? `${weatherPoint.temperature}°F`
          : this.estimateAirTemperature(beach.latitude, forecastTime),

        beach_id: beach.id,
        confidence_score: confidenceScore,
      });
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
      currentSpeed: "0 knots",
      currentDirection: "Unknown",
    };

    if (!tideData?.tides) return defaultTideInfo;

    const status = this.coopsService.getTideStatusAtTime(
      tideData.tides,
      targetTime
    );
    const currentHeight = this.coopsService.getCurrentTideHeight(
      tideData.tides
    );
    const nextTide = this.coopsService.getNextTide(tideData.tides);

    // Find current data for this time
    const targetTimestamp = targetTime.getTime() / 1000;
    let currentInfo = null;

    if (tideData.currents && tideData.currents.length > 0) {
      currentInfo = tideData.currents.find(
        (current: any) => Math.abs(current.time - targetTimestamp) < 3600 // Within 1 hour
      );
    }

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
      currentSpeed: currentInfo ? `${currentInfo.speed} knots` : "0 knots",
      currentDirection: currentInfo
        ? this.waveWatchService.getWaveDirectionText(currentInfo.direction)
        : "Unknown",
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
    return `${Math.round(feet)} ft`;
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

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Store enhanced forecasts in database
   */
  async storeEnhancedForecasts(
    beach: Beach,
    forecasts: EnhancedForecastData[]
  ) {
    const supabase = await createSupabaseServiceRoleClient();

    try {
      // Delete existing forecasts for this beach
      await supabase
        .from("enhanced_forecasts")
        .delete()
        .eq("beach_id", beach.id);

      // Insert new enhanced forecasts
      const { data, error } = await supabase.from("enhanced_forecasts").insert(
        forecasts.map((forecast) => ({
          // Let PostgreSQL generate the UUID automatically
          ...forecast,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      );

      if (error) {
        throw error;
      }

      console.log(
        `Stored ${forecasts.length} enhanced forecasts for ${beach.name}`
      );
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

      console.log(`Updating enhanced forecasts for ${beaches.length} beaches`);

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

      console.log(
        `Enhanced forecast update complete: ${successful} successful, ${failed} failed`
      );

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
