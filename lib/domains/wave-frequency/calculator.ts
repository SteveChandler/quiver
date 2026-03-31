import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { parseWavePeriod, parseWindSpeed, getDirectionDegrees } from "@/lib/utils/number-parsing";
import { parseWaveHeight, FLAT_HEIGHT_METERS } from "@/lib/utils/forecast-parsing";
import {
  BREAK_TYPE_CONFIGS,
  FREQUENCY_CLAMPS,
  THRESHOLDS,
  TIDE_HEIGHT_DEFAULTS,
  TIDE_HEIGHT_FLOORS,
  TIDE_HEIGHT_FALLOFF_FT,
  TIDE_DIRECTION_MISMATCH_PENALTY,
  TIDE_DIRECTION_SLACK_PENALTY,
} from "./constants";
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
 * Cosine-curve tide height factor.
 * Within preferred range → 1.0. Outside → degrades toward break-type floor.
 */
function calculateTideHeightFactor(
  tideHeightRaw: string | null | undefined,
  preferredMin: number | null | undefined,
  preferredMax: number | null | undefined,
  breakType: string
): number {
  const tideHeight = parseFloat(tideHeightRaw ?? "");
  if (isNaN(tideHeight)) return 1.0;

  const min = preferredMin ?? TIDE_HEIGHT_DEFAULTS.MIN_FT;
  const max = preferredMax ?? TIDE_HEIGHT_DEFAULTS.MAX_FT;

  // Within preferred range — no penalty
  if (tideHeight >= min && tideHeight <= max) return 1.0;

  const floor = TIDE_HEIGHT_FLOORS[breakType] ?? TIDE_HEIGHT_FLOORS.other;
  const falloff = TIDE_HEIGHT_FALLOFF_FT[breakType] ?? TIDE_HEIGHT_FALLOFF_FT.other;

  const distOutside = tideHeight < min ? min - tideHeight : tideHeight - max;
  const t = Math.min(distOutside / falloff, 1.0);

  // Cosine interpolation: 1.0 → floor
  return floor + (1.0 - floor) * (0.5 * (1 + Math.cos(Math.PI * t)));
}

/**
 * Derives tide direction sensitivity from break type when not explicitly set.
 */
function deriveTideSensitivity(
  explicit: string | null | undefined,
  breakType: string
): string {
  if (explicit) {
    const normalized = explicit.toLowerCase().trim();
    if (normalized === "low" || normalized === "medium" || normalized === "high") {
      return normalized;
    }
  }
  if (breakType === "reef") return "high";
  if (breakType === "point") return "low";
  return "medium";
}

/**
 * Tide direction factor.
 * Compares forecast tide_status vs beach preferred_tide_direction.
 */
function calculateTideDirectionFactor(
  tideStatus: string | null | undefined,
  preferredDirection: string | null | undefined,
  sensitivity: string | null | undefined,
  breakType: string
): number {
  // No preference or 'either' → always 1.0
  if (!preferredDirection || preferredDirection.toLowerCase() === "either") return 1.0;
  // No tide status data → graceful degradation
  if (!tideStatus) return 1.0;

  const status = tideStatus.toLowerCase().trim();
  const preferred = preferredDirection.toLowerCase().trim();
  const sens = deriveTideSensitivity(sensitivity, breakType);

  // Match → no penalty
  if (status === preferred) return 1.0;

  // Slack when a direction is preferred → intermediate penalty
  if (status === "slack") {
    return TIDE_DIRECTION_SLACK_PENALTY[sens] ?? TIDE_DIRECTION_SLACK_PENALTY.medium;
  }

  // Mismatch (rising vs falling or vice versa)
  return TIDE_DIRECTION_MISMATCH_PENALTY[sens] ?? TIDE_DIRECTION_MISMATCH_PENALTY.medium;
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
  if (T1 <= 0) return { rideableWavesPerHour: 0, confidence: "low", swellTrains: 0, dominantBeatIntervalS: null };

  // Step 1: Height gate — use RSS of swell components when available
  // RSS combines independent swell trains: sqrt(h1² + h2² + h3²)
  // This matches how surf height is derived from offshore swell components.
  const breakType = (beach.break_type?.toLowerCase() as BreakType) || "other";
  const config = BREAK_TYPE_CONFIGS[breakType] || BREAK_TYPE_CONFIGS.other;

  const heightFt = getCombinedHeightFt(forecast);

  if (heightFt < config.thresholdFt) {
    return { rideableWavesPerHour: 0, confidence: resolveConfidence(forecast), swellTrains: 0, dominantBeatIntervalS: null };
  }

  // Step 2: Base wave frequency via pairwise beat analysis
  // Parse all three swell components for grouping.
  // swell component heights are bare numeric strings in feet (e.g. "4", "0.5") — use parseFloat.
  const T2 = parseWavePeriod(forecast.swell_2_period);
  const T3 = parseWavePeriod(forecast.wind_wave_period);
  const swell1HeightFt = parseFloat(forecast.swell_1_height ?? "0") || 0;
  const swell2HeightFt = parseFloat(forecast.swell_2_height ?? "0") || 0;
  const swell3HeightFt = parseFloat(forecast.wind_wave_height ?? "0") || 0;

  // Energy gate — only engage multi-swell math if secondary/tertiary swell is meaningful.
  const hasEnergy = (hFt: number) =>
    hFt >= THRESHOLDS.MULTI_SWELL_MIN_HEIGHT_FT ||
    hFt >= swell1HeightFt * THRESHOLDS.MULTI_SWELL_MIN_HEIGHT_RATIO;
  const swell2HasEnergy = hasEnergy(swell2HeightFt);
  const swell3HasEnergy = hasEnergy(swell3HeightFt);

  // Build valid swell components for grouping analysis
  const swellComponents: Array<{ period: number; heightFt: number }> = [
    { period: T1, heightFt: swell1HeightFt },
  ];
  if (T2 >= THRESHOLDS.MIN_VALID_PERIOD_S && swell2HasEnergy) {
    swellComponents.push({ period: T2, heightFt: swell2HeightFt });
  }
  if (T3 >= THRESHOLDS.MIN_VALID_PERIOD_S && swell3HasEnergy) {
    swellComponents.push({ period: T3, heightFt: swell3HeightFt });
  }

  // Find all valid pairwise beat interactions
  const beatPairs: Array<{ freq: number; weight: number; intervalS: number }> = [];
  for (let i = 0; i < swellComponents.length; i++) {
    for (let j = i + 1; j < swellComponents.length; j++) {
      const a = swellComponents[i], b = swellComponents[j];
      if (Math.abs(a.period - b.period) < THRESHOLDS.SWELL_DIFF_THRESHOLD_S) continue;
      const setInterval = Math.max(
        FREQUENCY_CLAMPS.MIN_SET_INTERVAL_S,
        Math.min(FREQUENCY_CLAMPS.MAX_SET_INTERVAL_S, (a.period * b.period) / Math.abs(a.period - b.period))
      );
      const wavesPerSet = Math.max(
        FREQUENCY_CLAMPS.MIN_WAVES_PER_SET,
        Math.min(FREQUENCY_CLAMPS.MAX_WAVES_PER_SET, Math.round(Math.max(a.period, b.period) / Math.min(a.period, b.period)))
      );
      beatPairs.push({
        freq: (3600 / setInterval) * wavesPerSet,
        weight: Math.sqrt(a.heightFt * b.heightFt),
        intervalS: setInterval,
      });
    }
  }

  let baseFrequency: number;
  const isMultiSwell = beatPairs.length > 0;

  if (isMultiSwell) {
    // Sort by frequency (descending) — most frequent sets dominate
    beatPairs.sort((a, b) => b.freq - a.freq);
    baseFrequency = beatPairs[0].freq;

    // Additional pairwise interactions contribute extra independent wave events.
    // Three swells create quasi-periodic interference with more constructive peaks
    // than any single pair predicts — but not all peaks are independent.
    for (let k = 1; k < beatPairs.length; k++) {
      const energyRatio = beatPairs[0].weight > 0
        ? Math.min(1.0, beatPairs[k].weight / beatPairs[0].weight)
        : 0;
      baseFrequency += beatPairs[k].freq * energyRatio * THRESHOLDS.THREE_SWELL_ADDITIONAL_BEAT_FACTOR;
    }
  } else {
    // Single swell or unified energy
    baseFrequency = 3600 / T1;
  }

  // Step 3: Break type factor
  // When in multi-swell path, blend the break factor to avoid double penalty.
  // The grouping formula already reduces effective frequency; applying raw config.factor
  // on top of a lower base creates a disproportionate drop.
  const breakFactor = isMultiSwell
    ? config.factor + (1 - config.factor) * THRESHOLDS.MULTI_SWELL_BREAK_FACTOR_REDUCTION
    : config.factor;

  // Step 4: Short period penalty
  // Task 6: Quadratic penalty for short periods — penalises sub-8s swells more aggressively.
  const penalty = T1 < THRESHOLDS.SHORT_PERIOD_DEGRADATION_S
    ? Math.pow(T1 / THRESHOLDS.SHORT_PERIOD_DEGRADATION_S, 2)
    : 1.0;

  // Step 5: Swell direction access
  // Consider all swell directions and use the best (max) access factor
  // when each swell has meaningful energy.
  const swellDeg1 = getDirectionDegrees(null, forecast.swell_1_direction);
  const swellDeg2 = getDirectionDegrees(null, forecast.swell_2_direction);
  const swellDeg3 = getDirectionDegrees(null, forecast.wind_wave_direction);
  let accessFactor = 0.7; // Fallback

  if (swellDeg1 !== null && beach.swell_access_factors) {
    const bin1 = Math.round(swellDeg1 / 5) % 72;
    const factor1 = beach.swell_access_factors[bin1];
    if (typeof factor1 === "number") accessFactor = factor1;

    // Use the best access factor across all swells with meaningful energy
    if (swell2HasEnergy && swellDeg2 !== null) {
      const bin2 = Math.round(swellDeg2 / 5) % 72;
      const factor2 = beach.swell_access_factors[bin2];
      if (typeof factor2 === "number") {
        accessFactor = Math.max(accessFactor, factor2);
      }
    }
    if (swell3HasEnergy && swellDeg3 !== null) {
      const bin3 = Math.round(swellDeg3 / 5) % 72;
      const factor3 = beach.swell_access_factors[bin3];
      if (typeof factor3 === "number") {
        accessFactor = Math.max(accessFactor, factor3);
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

  // Step 7: Tide height factor
  const tideHeightFactor = calculateTideHeightFactor(
    forecast.tide_height,
    beach.preferred_tide_ft_min,
    beach.preferred_tide_ft_max,
    breakType
  );

  // Step 8: Tide direction factor
  const tideDirectionFactor = calculateTideDirectionFactor(
    forecast.tide_status,
    beach.preferred_tide_direction,
    beach.tide_direction_sensitivity,
    breakType
  );

  // Step 9: Final
  const raw = baseFrequency * breakFactor * penalty * accessFactor * windPenalty * tideHeightFactor * tideDirectionFactor;
  const rideableWavesPerHour = Math.max(
    0,
    Math.min(FREQUENCY_CLAMPS.MAX_FINAL_FREQUENCY, Math.round(raw))
  );

  return {
    rideableWavesPerHour,
    confidence: resolveConfidence(forecast),
    swellTrains: swellComponents.length,
    dominantBeatIntervalS: isMultiSwell ? beatPairs[0].intervalS : null,
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
