import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { parseWavePeriod, parseWindSpeed, getDirectionDegrees } from "@/lib/utils/number-parsing";
import { parseWaveHeight, FLAT_HEIGHT_METERS } from "@/lib/ml/parse-wave-height";
import { BREAK_TYPE_CONFIGS, FREQUENCY_CLAMPS, THRESHOLDS } from "./constants";
import type { BreakType, WaveFrequencyResult } from "./types";

const METERS_TO_FEET = 1 / 0.3048;

/**
 * Compute combined surf height (ft) from swell components using root-sum-of-squares.
 * Falls back to wave_height if no individual components are available.
 */
function getCombinedHeightFt(forecast: EnhancedForecastEntity): number {
  const components: number[] = [];

  for (const field of [forecast.swell_1_height, forecast.swell_2_height, forecast.wind_wave_height]) {
    const meters = parseWaveHeight(field, { useLowerBound: true });
    if (meters != null && meters > FLAT_HEIGHT_METERS) {
      components.push(meters * METERS_TO_FEET);
    }
  }

  if (components.length > 0) {
    return Math.sqrt(components.reduce((sum, h) => sum + h * h, 0));
  }

  // Fall back to wave_height field
  const meters = parseWaveHeight(forecast.wave_height, { useLowerBound: true });
  if (meters != null && meters > FLAT_HEIGHT_METERS) {
    return meters * METERS_TO_FEET;
  }
  return 0;
}

/**
 * Calculates the estimated number of rideable waves per hour at a beach.
 * Based on wave grouping theory and clinical observations of break types.
 */
export function calculateRideableWaves(
  forecast: EnhancedForecastEntity,
  beach: Beach
): WaveFrequencyResult {
  // Step 0: Period guard
  const T1 = parseWavePeriod(forecast.swell_1_period || forecast.wave_period);
  if (T1 <= 0) return { rideableWavesPerHour: 0, confidence: "low" };

  // Step 1: Height gate — use RSS of swell components when available
  // RSS combines independent swell trains: sqrt(h1² + h2² + h3²)
  // This matches how surf height is derived from offshore swell components.
  const breakType = (beach.break_type?.toLowerCase() as BreakType) || "other";
  const config = BREAK_TYPE_CONFIGS[breakType] || BREAK_TYPE_CONFIGS.other;

  const heightFt = getCombinedHeightFt(forecast);

  if (heightFt < config.thresholdFt) {
    return { rideableWavesPerHour: 0, confidence: resolveConfidence(forecast) };
  }

  // Step 2: Base wave frequency
  // Task 1: Guard T2 against sub-1s values to prevent near-zero denominators.
  // swell component heights are bare numeric strings in feet (e.g. "4", "0.5") — use parseFloat.
  const T2 = parseWavePeriod(forecast.swell_2_period);
  const swell1HeightFt = parseFloat(forecast.swell_1_height ?? "0") || 0;
  const swell2HeightFt = parseFloat(forecast.swell_2_height ?? "0") || 0;

  // Task 2: Energy gate — only engage multi-swell math if secondary swell is meaningful.
  const swell2HasEnergy =
    swell2HeightFt >= THRESHOLDS.MULTI_SWELL_MIN_HEIGHT_FT ||
    swell2HeightFt >= swell1HeightFt * THRESHOLDS.MULTI_SWELL_MIN_HEIGHT_RATIO;

  let baseFrequency: number;

  if (
    T2 >= THRESHOLDS.MIN_VALID_PERIOD_S &&
    swell2HasEnergy &&
    Math.abs(T1 - T2) >= THRESHOLDS.SWELL_DIFF_THRESHOLD_S
  ) {
    // Two distinct swells: use grouping formula
    const setInterval = Math.max(
      FREQUENCY_CLAMPS.MIN_SET_INTERVAL_S,
      Math.min(FREQUENCY_CLAMPS.MAX_SET_INTERVAL_S, (T1 * T2) / Math.abs(T1 - T2))
    );
    const wavesPerSet = Math.max(
      FREQUENCY_CLAMPS.MIN_WAVES_PER_SET,
      Math.min(FREQUENCY_CLAMPS.MAX_WAVES_PER_SET, Math.round(Math.max(T1, T2) / Math.min(T1, T2)))
    );
    baseFrequency = (3600 / setInterval) * wavesPerSet;
  } else {
    // Single swell or unified energy
    baseFrequency = 3600 / T1;
  }

  // Step 3: Break type factor
  // Task 3: When in multi-swell path, blend the break factor to avoid double penalty.
  // The grouping formula already reduces effective frequency; applying raw config.factor
  // on top of a lower base creates a disproportionate drop.
  let breakFactor: number;
  if (
    T2 >= THRESHOLDS.MIN_VALID_PERIOD_S &&
    swell2HasEnergy &&
    Math.abs(T1 - T2) >= THRESHOLDS.SWELL_DIFF_THRESHOLD_S
  ) {
    breakFactor = config.factor + (1 - config.factor) * THRESHOLDS.MULTI_SWELL_BREAK_FACTOR_REDUCTION;
  } else {
    breakFactor = config.factor;
  }

  // Step 4: Short period penalty
  // Task 6: Quadratic penalty for short periods — penalises sub-8s swells more aggressively.
  const penalty = T1 < THRESHOLDS.SHORT_PERIOD_DEGRADATION_S
    ? Math.pow(T1 / THRESHOLDS.SHORT_PERIOD_DEGRADATION_S, 2)
    : 1.0;

  // Step 5: Swell direction access
  // Task 4: Consider both swell directions and use the best (max) access factor
  // when the secondary swell has meaningful energy.
  const swellDeg1 = getDirectionDegrees(null, forecast.swell_1_direction);
  const swellDeg2 = getDirectionDegrees(null, forecast.swell_2_direction);
  let accessFactor = 0.7; // Fallback

  if (swellDeg1 !== null && beach.swell_access_factors) {
    const bin1 = Math.round(swellDeg1 / 5) % 72;
    const factor1 = beach.swell_access_factors[bin1];
    if (typeof factor1 === "number") accessFactor = factor1;

    // Use the better access factor if secondary swell has meaningful energy
    if (swell2HasEnergy && swellDeg2 !== null) {
      const bin2 = Math.round(swellDeg2 / 5) % 72;
      const factor2 = beach.swell_access_factors[bin2];
      if (typeof factor2 === "number") {
        accessFactor = Math.max(accessFactor, factor2);
      }
    }
  }

  // Step 6: Wind penalty
  // wind_speed is always stored as "X mph" by forecast-builder.ts (extractWindSpeed)
  let windPenalty = 1.0;
  const windDirDeg = getDirectionDegrees(forecast.wind_direction_deg ?? null, forecast.wind_direction);
  const windSpeedMph = parseWindSpeed(forecast.wind_speed);
  const windSpeedKts = windSpeedMph / 1.151;

  // Task 5: Strengthen guard from !== null to != null to catch undefined as well.
  if (windDirDeg !== null && beach.aspect_deg != null && windSpeedKts > 0) {
    const rad = ((windDirDeg - beach.aspect_deg) * Math.PI) / 180;
    const onshoreComponent = Math.cos(rad);
    if (onshoreComponent > 0) {
      windPenalty = Math.max(
        THRESHOLDS.WIND_MIN_PENALTY,
        1 - (windSpeedKts * onshoreComponent) / THRESHOLDS.WIND_ONSHORE_MAX_KTS
      );
    }
  }

  // Step 7: Final
  const raw = baseFrequency * breakFactor * penalty * accessFactor * windPenalty;
  const rideableWavesPerHour = Math.max(
    0,
    Math.min(FREQUENCY_CLAMPS.MAX_FINAL_FREQUENCY, Math.round(raw))
  );

  return {
    rideableWavesPerHour,
    confidence: resolveConfidence(forecast),
  };
}

/**
 * Resolves confidence level based on forecast staleness and data availability.
 */
function resolveConfidence(forecast: EnhancedForecastEntity): "high" | "medium" | "low" {
  const forecastAt = Date.parse(forecast.forecast_at);
  if (isNaN(forecastAt)) return "low";

  const now = Date.now();
  const hoursFromNow = (forecastAt - now) / 3_600_000;

  if (hoursFromNow > 168 || (forecast.confidence_score !== null && forecast.confidence_score < 40)) {
    return "low";
  }

  const hasSwellComponents = Boolean(forecast.swell_1_period && forecast.swell_1_direction);
  const isRecent = hoursFromNow <= 48;
  const isHighScoring = forecast.confidence_score === null || forecast.confidence_score >= 70;

  if (isRecent && hasSwellComponents && isHighScoring) {
    return "high";
  }

  return "medium";
}
