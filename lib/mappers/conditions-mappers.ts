import type { EnhancedForecastEntity } from "@/types/forecast";
import type { ConditionsData } from "@/types/conditions";
import { calculateRideableWaves } from "@/lib/domains/wave-frequency";
import { parseWavePeriod, parseWindSpeed, getDirectionDegrees } from "@/lib/utils/number-parsing";
import { parseWaveHeight } from "@/lib/ml/parse-wave-height";
import { degreeToCardinal } from "@/lib/utils/geo-utils";

const METERS_TO_FEET = 1 / 0.3048;
const MPH_TO_KTS = 1 / 1.151;

/**
 * Compute combined surf height (ft) from swell components using root-sum-of-squares.
 * Falls back to wave_height if no individual components are available.
 *
 * RSS combines independent swell trains: sqrt(h1² + h2² + h3²)
 * This matches how Surfline and NOAA compute "surf height" from swell components.
 */
function getCombinedHeightFt(forecast: EnhancedForecastEntity): number | null {
  const components: number[] = [];

  for (const field of [forecast.swell_1_height, forecast.swell_2_height, forecast.wind_wave_height]) {
    const meters = parseWaveHeight(field, { useLowerBound: true });
    if (meters != null && meters > 0.15) { // 0.15m is the "flat" sentinel from parseWaveHeight
      components.push(meters * METERS_TO_FEET);
    }
  }

  if (components.length > 0) {
    return Math.sqrt(components.reduce((sum, h) => sum + h * h, 0));
  }

  // Fall back to wave_height field
  const meters = parseWaveHeight(forecast.wave_height, { useLowerBound: true });
  return meters != null ? meters * METERS_TO_FEET : null;
}

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

/** Minimal beach shape needed for wave frequency calculation */
export interface BeachForWaveFrequency {
  break_type: string | null;
  aspect_deg: number | null;
  swell_access_factors: number[] | null;
}

/**
 * Maps an EnhancedForecastEntity (snake_case DB row) to the
 * shared ConditionsData shape (camelCase) used by ticker components.
 *
 * When `beach` is provided, also calculates rideable waves per hour.
 */
export function forecastToConditionsData(
  forecast: EnhancedForecastEntity,
  beach?: BeachForWaveFrequency | null,
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
    // Use combined swell height (RSS) for the calculator — individual swell components
    // give a better estimate of actual surf height than the raw wave_height field,
    // which may represent a single offshore swell component.
    const heightFt = getCombinedHeightFt(forecast);

    // parseWindSpeed (number-parsing) returns raw number (units stripped).
    // Forecast wind_speed is typically "X mph". Calculator expects knots, so convert.
    const windSpeedRaw = parseWindSpeed(forecast.wind_speed);
    const windSpeedKts = windSpeedRaw * MPH_TO_KTS;

    const result = calculateRideableWaves({
      dominantPeriodS: parseWavePeriod(forecast.wave_period) || null,
      swell1PeriodS: parseWavePeriod(forecast.swell_1_period) || null,
      swell2PeriodS: parseWavePeriod(forecast.swell_2_period) || null,
      swell1DirectionDeg: getDirectionDegrees(forecast.swell_1_direction),
      waveHeightFt: heightFt,
      windSpeedKts,
      windDirectionDeg: forecast.wind_direction_deg ?? getDirectionDegrees(forecast.wind_direction),
      breakType: beach.break_type,
      aspectDeg: beach.aspect_deg,
      swellAccessFactors: beach.swell_access_factors,
    });

    base.rideableWavesPerHour = result.rideableWavesPerHour;
  }

  return base;
}
