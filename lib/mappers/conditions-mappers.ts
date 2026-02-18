import type { EnhancedForecastEntity } from "@/types/forecast";
import type { ConditionsData } from "@/types/conditions";

/**
 * Maps an EnhancedForecastEntity (snake_case DB row) to the
 * shared ConditionsData shape (camelCase) used by ticker components.
 */
export function forecastToConditionsData(
  forecast: EnhancedForecastEntity
): ConditionsData {
  return {
    waveHeight: forecast.wave_height ?? null,
    wavePeriod: forecast.wave_period ?? null,
    waveDirection: forecast.wave_direction ?? null,
    windSpeed: forecast.wind_speed ?? null,
    windDirection: forecast.wind_direction ?? null,
    waterTemp: forecast.water_temp ?? null,
    tideStatus: forecast.tide_status ?? null,
    tideHeight: forecast.tide_height ?? null,
  };
}
