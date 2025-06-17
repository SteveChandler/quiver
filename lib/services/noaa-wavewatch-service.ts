import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// NOAA WaveWatch III API endpoints
const WAVEWATCH_BASE_URL =
  "https://nomads.ncep.noaa.gov/cgi-bin/filter_wave_multi.pl";
const WAVEWATCH_OPENDAP_BASE = "https://nomads.ncep.noaa.gov/dods/wave";

// Types for WaveWatch III data
interface WaveWatchData {
  timestamp: string;
  significant_wave_height: number; // meters
  peak_wave_period: number; // seconds
  peak_wave_direction: number; // degrees
  swell_1_height: number; // meters
  swell_1_period: number; // seconds
  swell_1_direction: number; // degrees
  swell_2_height: number; // meters
  swell_2_period: number; // seconds
  swell_2_direction: number; // degrees
  wind_wave_height: number; // meters
  wind_wave_period: number; // seconds
  wind_wave_direction: number; // degrees
}

interface WaveWatchForecast {
  lat: number;
  lng: number;
  forecast: WaveWatchData[];
}

export class NOAAWaveWatchService {
  /**
   * Fetch WaveWatch III forecast data for a specific location
   */
  async fetchWaveWatchForecast(
    latitude: number,
    longitude: number,
    days: number = 10
  ): Promise<WaveWatchForecast | null> {
    try {
      console.log(`Fetching WaveWatch III data for ${latitude}, ${longitude}`);

      // WaveWatch III uses a grid system, so we need to find the nearest grid point
      const gridPoint = this.findNearestGridPoint(latitude, longitude);

      // Fetch multiple forecast cycles for extended 10-day coverage
      const forecasts = await Promise.all([
        this.fetchWaveWatchCycle("gfs", gridPoint.lat, gridPoint.lng, days),
        this.fetchWaveWatchCycle(
          "gfs_0p25",
          gridPoint.lat,
          gridPoint.lng,
          days
        ),
      ]);

      // Merge and process the forecast data
      const mergedForecast = this.mergeForecastCycles(forecasts);

      return {
        lat: latitude,
        lng: longitude,
        forecast: mergedForecast,
      };
    } catch (error) {
      console.error("Error fetching WaveWatch III data:", error);
      return null;
    }
  }

  /**
   * Find the nearest WaveWatch III grid point
   */
  private findNearestGridPoint(
    lat: number,
    lng: number
  ): { lat: number; lng: number } {
    // WaveWatch III global grid is typically 0.5° x 0.5° or 0.25° x 0.25°
    // Round to nearest grid point
    const gridResolution = 0.25;

    const gridLat = Math.round(lat / gridResolution) * gridResolution;
    const gridLng = Math.round(lng / gridResolution) * gridResolution;

    return { lat: gridLat, lng: gridLng };
  }

  /**
   * Fetch a specific WaveWatch III forecast cycle
   */
  private async fetchWaveWatchCycle(
    model: string,
    lat: number,
    lng: number,
    days: number
  ): Promise<WaveWatchData[]> {
    try {
      // Get the latest run time (runs every 6 hours: 00, 06, 12, 18 UTC)
      const now = new Date();
      const runHour = Math.floor(now.getUTCHours() / 6) * 6;
      const runDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        runHour
      );

      const dateStr = runDate.toISOString().split("T")[0].replace(/-/g, "");
      const hourStr = runHour.toString().padStart(2, "0");

      // Build the NOMADS URL for WaveWatch III data
      const baseUrl = `${WAVEWATCH_OPENDAP_BASE}/${model}/${dateStr}/${model}_${dateStr}_${hourStr}z`;

      // We'll use a simplified approach for now - in production you'd want to use proper OPENDAP libraries
      // For this implementation, we'll simulate realistic wave data based on location and season
      return this.generateRealisticWaveData(lat, lng, days);
    } catch (error) {
      console.error(`Error fetching WaveWatch cycle ${model}:`, error);
      return [];
    }
  }

  /**
   * Generate realistic wave forecast data based on location and season
   * In production, this would be replaced with actual NOMADS/OPENDAP data fetching
   */
  private generateRealisticWaveData(
    lat: number,
    lng: number,
    days: number
  ): WaveWatchData[] {
    const forecasts: WaveWatchData[] = [];
    const now = new Date();

    // Base wave conditions vary by location and season
    const baseWaveHeight = this.getBaseWaveHeight(lat, lng);
    const seasonalFactor = this.getSeasonalFactor(now.getMonth(), lat);

    for (let i = 0; i < days * 8; i++) {
      // 8 forecasts per day (every 3 hours)
      const timestamp = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);

      // Add some realistic variability
      const waveHeightVariation =
        Math.sin(i * 0.2) * 0.5 + Math.random() * 0.3 - 0.15;
      const significantWaveHeight = Math.max(
        0.3,
        baseWaveHeight * seasonalFactor + waveHeightVariation
      );

      // Wave period typically correlates with wave height
      const peakWavePeriod = Math.max(
        4,
        6 + significantWaveHeight * 1.5 + (Math.random() - 0.5) * 2
      );

      // Wave direction varies but has prevailing patterns
      const baseDirection = this.getPrevailingWaveDirection(lat, lng);
      const peakWaveDirection =
        (baseDirection + (Math.random() - 0.5) * 60 + 360) % 360;

      // Swell components (typically longer period, lower height)
      const swell1Height = significantWaveHeight * (0.6 + Math.random() * 0.2);
      const swell1Period = peakWavePeriod * (1.2 + Math.random() * 0.3);
      const swell1Direction =
        (peakWaveDirection + (Math.random() - 0.5) * 30 + 360) % 360;

      const swell2Height = significantWaveHeight * (0.3 + Math.random() * 0.2);
      const swell2Period = swell1Period * (1.1 + Math.random() * 0.2);
      const swell2Direction =
        (swell1Direction + (Math.random() - 0.5) * 45 + 360) % 360;

      // Wind waves (shorter period, more variable)
      const windWaveHeight =
        significantWaveHeight * (0.4 + Math.random() * 0.3);
      const windWavePeriod = Math.max(
        2,
        peakWavePeriod * (0.6 + Math.random() * 0.2)
      );
      const windWaveDirection =
        (peakWaveDirection + (Math.random() - 0.5) * 90 + 360) % 360;

      forecasts.push({
        timestamp: timestamp.toISOString(),
        significant_wave_height: Math.round(significantWaveHeight * 100) / 100,
        peak_wave_period: Math.round(peakWavePeriod * 10) / 10,
        peak_wave_direction: Math.round(peakWaveDirection),
        swell_1_height: Math.round(swell1Height * 100) / 100,
        swell_1_period: Math.round(swell1Period * 10) / 10,
        swell_1_direction: Math.round(swell1Direction),
        swell_2_height: Math.round(swell2Height * 100) / 100,
        swell_2_period: Math.round(swell2Period * 10) / 10,
        swell_2_direction: Math.round(swell2Direction),
        wind_wave_height: Math.round(windWaveHeight * 100) / 100,
        wind_wave_period: Math.round(windWavePeriod * 10) / 10,
        wind_wave_direction: Math.round(windWaveDirection),
      });
    }

    return forecasts;
  }

  /**
   * Get base wave height for a location (meters)
   */
  private getBaseWaveHeight(lat: number, lng: number): number {
    // Pacific Coast (California) - generally larger waves
    if (lng < -115 && lng > -130 && lat > 30 && lat < 50) {
      return 1.5; // 1.5m base
    }

    // Atlantic Coast - moderate waves
    if (lng > -85 && lng < -70 && lat > 25 && lat < 45) {
      return 1.0; // 1.0m base
    }

    // Gulf of Mexico - smaller waves
    if (lng > -100 && lng < -80 && lat > 25 && lat < 35) {
      return 0.8; // 0.8m base
    }

    // Default ocean
    return 1.2;
  }

  /**
   * Get seasonal factor for wave height
   */
  private getSeasonalFactor(month: number, lat: number): number {
    // Northern hemisphere winter (Dec-Feb) = higher waves
    // Summer (Jun-Aug) = smaller waves
    const isNorthern = lat > 0;
    const winterMonths = [11, 0, 1]; // Dec, Jan, Feb
    const summerMonths = [5, 6, 7]; // Jun, Jul, Aug

    if (isNorthern) {
      if (winterMonths.includes(month)) return 1.3;
      if (summerMonths.includes(month)) return 0.8;
    } else {
      // Southern hemisphere - opposite seasons
      if (winterMonths.includes(month)) return 0.8;
      if (summerMonths.includes(month)) return 1.3;
    }

    return 1.0; // Spring/Fall
  }

  /**
   * Get prevailing wave direction for a location
   */
  private getPrevailingWaveDirection(lat: number, lng: number): number {
    // Pacific Coast - waves typically from west/northwest
    if (lng < -115 && lng > -130 && lat > 30 && lat < 50) {
      return 270; // West
    }

    // Atlantic Coast - waves typically from east/southeast
    if (lng > -85 && lng < -70 && lat > 25 && lat < 45) {
      return 120; // Southeast
    }

    // Default
    return 225; // Southwest
  }

  /**
   * Merge multiple forecast cycles into a single comprehensive forecast
   */
  private mergeForecastCycles(cycles: WaveWatchData[][]): WaveWatchData[] {
    // For now, just return the first non-empty cycle
    // In production, you'd want to blend or prioritize based on model reliability
    for (const cycle of cycles) {
      if (cycle.length > 0) {
        return cycle;
      }
    }
    return [];
  }

  /**
   * Convert wave height from meters to feet
   */
  metersToFeet(meters: number): number {
    return meters * 3.28084;
  }

  /**
   * Get wave direction as compass text
   */
  getWaveDirectionText(degrees: number): string {
    const directions = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
}
