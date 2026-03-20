import type { EnhancedForecastEntity } from "@/types/forecast";
import type { ConditionsData } from "@/types/conditions";
import type { Beach } from "@/types/database";
import { calculateRideableWaves } from "@/lib/domains/wave-frequency";
import { degreeToCardinal } from "@/lib/utils/geo-utils";

/** Convert numeric degree strings (e.g. "109") to cardinal (e.g. "ESE"), pass through existing cardinals. */
function normalizeDirection(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = parseFloat(trimmed);
  if (!isNaN(num) && /^\d+(\.\d+)?$/.test(trimmed)) {
    return degreeToCardinal(num);
  }
  return trimmed;
}

/**
 * Maps an EnhancedForecastEntity (snake_case DB row) to the
 * shared ConditionsData shape (camelCase) used by ticker components.
 *
 * When `beach` is provided, also calculates rideable waves per hour.
 */
export function forecastToConditionsData(
  forecast: EnhancedForecastEntity,
  beach?: Beach | null,
): ConditionsData {
  const base: ConditionsData = {
    waveHeight: forecast.wave_height ?? null,
    wavePeriod: forecast.wave_period ?? null,
    waveDirection: normalizeDirection(forecast.wave_direction),
    windSpeed: forecast.wind_speed ?? null,
    windDirection: normalizeDirection(forecast.wind_direction),
    waterTemp: forecast.water_temp ?? null,
    tideStatus: forecast.tide_status ?? null,
    tideHeight: forecast.tide_height ?? null,
  };

  if (beach) {
    const result = calculateRideableWaves(forecast, beach);
    base.rideableWavesPerHour = result.rideableWavesPerHour;
    base.swellTrains = result.swellTrains;
    base.dominantBeatIntervalS = result.dominantBeatIntervalS;
  }

  return base;
}
