/**
 * Forecast Data Source Manager
 * 
 * Manages all forecast data sources (WaveWatch, COOPS, CDIP, NOAA Weather)
 * and coordinates multi-source data fetching with failover logic.
 * 
 * Extracted from lib/services/enhanced-forecast-service.ts as part of P1 refactoring
 * to reduce file size and improve maintainability.
 */

import { NOAAWaveWatchService } from "../noaa-wavewatch-service";
import { NOAACOOPSService } from "../noaa-coops-service";
import { CDIPService } from "../cdip-service";
import {
  createConfidenceScore,
  type Location,
  type TimeRange,
  type WaveDataSource,
  type TideDataSource,
  type WeatherDataSource,
  type WaveData,
  type WeatherData,
} from "@/types/forecast";
import {
  ForecastError,
  ApiError,
  DataSourceError,
  isNoaaMarineForecastNotSupportedError,
} from "@/lib/errors/forecast-errors";

/**
 * WaveWatch III Data Source
 * 
 * Fetches wave forecast data from NOAA WaveWatch III model.
 * Provides significant wave height, period, and direction forecasts.
 */
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

/**
 * NOAA CO-OPS Tidal Data Source
 * 
 * Fetches tide predictions from NOAA Center for Operational Oceanographic
 * Products and Services.
 */
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

/**
 * NOAA Weather Service Data Source
 * 
 * Fetches weather forecasts from NOAA National Weather Service API.
 * Provides hourly weather conditions including wind and temperature.
 */
export class NOAAWeatherDataSource implements WeatherDataSource {
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
      const hourlyUrl: string | null =
        pointsData?.properties?.forecastHourly ?? null;
      const nonHourlyUrl: string | null = pointsData?.properties?.forecast ?? null;

      // Some points (especially marine/offshore) do not have hourly or any forecast URLs.
      // Treat as "no coverage" rather than throwing and spamming cron logs.
      if (!hourlyUrl && !nonHourlyUrl) {
        return { periods: [] };
      }

      const fetchForecast = async (url: string): Promise<any> => {
        const forecastResponse = await fetch(url, {
          headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
        });

        if (!forecastResponse.ok) {
          throw new ApiError(url, forecastResponse.status, await forecastResponse.text());
        }

        return await forecastResponse.json();
      };

      // Prefer hourly, but gracefully fall back for "Marine Forecast Not Supported".
      try {
        if (hourlyUrl) {
          const forecastData = await fetchForecast(hourlyUrl);
          return { periods: forecastData?.properties?.periods || [] };
        }
      } catch (error) {
        // If hourly is unsupported in marine areas, fall back to non-hourly.
        if (!isNoaaMarineForecastNotSupportedError(error)) {
          throw error;
        }
      }

      if (nonHourlyUrl) {
        const forecastData = await fetchForecast(nonHourlyUrl);
        return { periods: forecastData?.properties?.periods || [] };
      }

      return { periods: [] };
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

/**
 * Forecast Data Source Manager
 * 
 * Centralizes management of all forecast data sources and provides
 * a unified interface for fetching wave, tide, and weather data.
 * 
 * Handles:
 * - Service initialization
 * - Data source selection and coordination
 * - Failover logic between sources
 * 
 * @example
 * ```typescript
 * const manager = new ForecastDataSourceManager();
 * const waveData = await manager.fetchWaveData(location, 12);
 * const tideData = await manager.fetchTideData(location, 12);
 * const weatherData = await manager.fetchWeatherData(location, 12);
 * ```
 */
export class ForecastDataSourceManager {
  private waveDataSource: WaveWatchDataSource;
  private tideDataSource: TidalDataSource;
  private weatherDataSource: NOAAWeatherDataSource;

  private waveWatchService: NOAAWaveWatchService;
  private coopsService: NOAACOOPSService;
  private cdipService: CDIPService;

  constructor() {
    // Initialize underlying services
    this.waveWatchService = new NOAAWaveWatchService();
    this.coopsService = new NOAACOOPSService();
    this.cdipService = new CDIPService();

    // Initialize data sources
    this.waveDataSource = new WaveWatchDataSource(this.waveWatchService);
    this.tideDataSource = new TidalDataSource(this.coopsService);
    this.weatherDataSource = new NOAAWeatherDataSource();
  }

  /**
   * Fetch wave forecast data
   */
  async fetchWaveData(location: Location, days: number): Promise<WaveData> {
    return this.waveDataSource.fetchWaveData(location, days);
  }

  /**
   * Fetch tide forecast data
   */
  async fetchTideData(location: Location, days: number): Promise<any> {
    return this.tideDataSource.fetchTideData(location, days);
  }

  /**
   * Fetch weather forecast data
   */
  async fetchWeatherData(location: Location, days: number): Promise<WeatherData> {
    return this.weatherDataSource.fetchWeatherData(location, days);
  }

  /**
   * Get underlying CDIP service for buoy data fetching
   * 
   * Provides access to CDIP-specific methods like getNearestStation()
   */
  getCDIPService(): CDIPService {
    return this.cdipService;
  }

  /**
   * Get underlying WaveWatch service
   * 
   * Provides access to WaveWatch-specific methods like getWaveDirectionText()
   */
  getWaveWatchService(): NOAAWaveWatchService {
    return this.waveWatchService;
  }

  /**
   * Get underlying COOPS service
   * 
   * Provides access to CO-OPS-specific methods like getStationForLocation()
   */
  getCOOPSService(): NOAACOOPSService {
    return this.coopsService;
  }

  /**
   * Get all data sources for testing/inspection
   */
  getDataSources() {
    return {
      wave: this.waveDataSource,
      tide: this.tideDataSource,
      weather: this.weatherDataSource,
    };
  }
}

