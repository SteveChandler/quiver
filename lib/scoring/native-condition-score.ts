import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  DEFAULT_SKILL_LEVEL,
  parseSkillLevel,
  SKILL_WAVE_RANGES,
  type SkillLevel,
} from "@/lib/domains/user-preferences/skill-level";
import {
  DAYLIGHT_END_HOUR,
  DAYLIGHT_START_HOUR,
} from "@/lib/services/magic-hour/constants";
import { getLocalHour } from "@/lib/utils/timezone-utils";
import { isFallbackForecastRow } from "@/lib/utils/forecast-row-source";
import {
  getRideabilityBand,
  type BoardClass,
  type RideabilityBand,
} from '@/lib/domains/rideability';
import { classifyWindQuality } from '@/lib/utils/wind-quality';
import { alignmentFactor } from '@/lib/utils/wave-height-transformer';
import { parseWindSpeedOrNull } from '@/lib/utils/number-parsing';
import { resolveTideBand, TIDE_BAND_TOLERANCE_FT, type TideBand } from '@/lib/domains/scoring/tide-swing';
import { isTideSwingEnabled } from '@/lib/flags/tide-swing';

interface NativeSkillThresholds {
  waveMinFt: number;
  waveMaxFt: number;
  idealMinFt: number;
  idealMaxFt: number;
  maxWindMph: number;
}

interface NativeScoreInputs {
  waveHeightFt: number;
  /** Null when the forecast has no wind: left out of the score, not scored as calm. */
  windSpeedMph: number | null;
  periodSec: number;
  tideHeightFt: number | null;
  tideStatus: string | null;
  /** Curated band; null/absent keeps the fixed tide term every beach gets today. */
  tideBand?: TideBand | null;
}

interface NativeTideTermInput {
  heightFt: number | null;
  status: string | null;
  band?: TideBand | null;
}

export interface NativeDirectionScoreInput {
  windDirectionDeg: number | null;
  swellDirectionDeg: number | null;
  offshoreDeg: number | null;
  offshoreToleranceDeg: number;
  windowCenterDeg: number | null;
  windowHalfwidthDeg: number | null;
}

export interface NativeConditionScoreBreakdown {
  score: number;
  components: {
    waveFit: number;
    period: number;
    wind: number;
    tide: number;
    windQuality?: number;
    swellAlignment?: number;
  };
  outOfBand: boolean;
}

export interface NativeScoredForecast {
  forecast: EnhancedForecastEntity;
  score: number;
}

const NATIVE_MAX_WIND_POINTS = 25;
// Reported for unknown wind so the `wind` component stays a number; the score
// itself leaves unknown wind out and rescales, so it neither helps nor hurts.
const NATIVE_UNKNOWN_WIND_POINTS = NATIVE_MAX_WIND_POINTS / 2;
const NATIVE_BASE_MAX_POINTS = 100;
const NATIVE_DIRECTION_MAX_POINTS = 115;

const NATIVE_MAX_WIND_MPH: Record<SkillLevel, number> = {
  beginner: 12,
  intermediate: 14,
  advanced: 16,
  expert: 18,
};

// The RIDEABLE verdict starts at 40, so out-of-band days must stay below it.
export const OUT_OF_BAND_SCORE_CEILING = 39;

export const NATIVE_SKILL_THRESHOLDS: Record<SkillLevel, NativeSkillThresholds> = {
  beginner: nativeThresholdsForSkill("beginner"),
  intermediate: nativeThresholdsForSkill("intermediate"),
  advanced: nativeThresholdsForSkill("advanced"),
  expert: nativeThresholdsForSkill("expert"),
};

function nativeThresholdsForSkill(skillLevel: SkillLevel): NativeSkillThresholds {
  const waveRange = SKILL_WAVE_RANGES[skillLevel];
  return {
    waveMinFt: waveRange.acceptable.min,
    waveMaxFt: waveRange.acceptable.max,
    idealMinFt: waveRange.ideal.min,
    idealMaxFt: waveRange.ideal.max,
    maxWindMph: NATIVE_MAX_WIND_MPH[skillLevel],
  };
}

export function resolveNativeSkillLevel(
  skillLevel?: SkillLevel | string | null,
  fallback: SkillLevel = DEFAULT_SKILL_LEVEL
): SkillLevel {
  return parseSkillLevel(skillLevel) ?? fallback;
}

export function parseMaxWaveHeightFt(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const matches = value.match(/[\d.]+/g);
  if (!matches || matches.length === 0) return 0;
  const nums = matches.map(Number).filter((n) => Number.isFinite(n));
  return nums.length === 0 ? 0 : Math.max(...nums);
}

function parseFirstNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const match = value.match(/[\d.]+/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
}

function parseSignedNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/** The beach columns that hold its curated tide band. */
interface TideBandColumns {
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
}

/**
 * The beach's curated tide band for the displayed tide term; same rule as the engine's
 * explicitRange. Null with TIDE_SWING_ENABLED off or a band not fully set, which keeps the
 * fixed 1.5-4.5 ft table. Every displayed-score path reads the band through this.
 */
export function displayTideBand(beach: TideBandColumns | null | undefined): TideBand | null {
  if (!isTideSwingEnabled() || !beach) return null;
  const { preferred_tide_ft_min: minHeightFt, preferred_tide_ft_max: maxHeightFt } = beach;
  if (minHeightFt == null || maxHeightFt == null) return null;
  return resolveTideBand({ minHeightFt, maxHeightFt, explicitRange: true });
}

export function nativeScoreInputsFromForecast(
  forecast: EnhancedForecastEntity,
  tideBand?: TideBand | null,
): NativeScoreInputs {
  return {
    waveHeightFt: parseMaxWaveHeightFt(forecast.wave_height),
    windSpeedMph: parseWindSpeedOrNull(forecast.wind_speed),
    periodSec: parseFirstNumber(forecast.swell_1_period ?? forecast.wave_period),
    tideHeightFt: parseSignedNumber(forecast.tide_height),
    tideStatus: forecast.tide_status ?? null,
    ...(tideBand ? { tideBand } : {}),
  };
}

const NATIVE_TIDE_IN_BAND_POINTS = 8;
const NATIVE_TIDE_UNKNOWN_POINTS = 7;
const NATIVE_TIDE_FLOOR_POINTS = 2;
/** Today's fixed table steps 8 -> 5 -> 2 a foot and two feet off its 1.5-4.5 ft core. */
const NATIVE_TIDE_POINTS_PER_FT = 3;

function nativeTideHeightPoints(heightFt: number, band: TideBand | null | undefined): number {
  if (!band) {
    if (heightFt >= 1.5 && heightFt <= 4.5) return 8;
    if (heightFt >= 0.5 && heightFt <= 6) return 5;
    return 2;
  }
  const outsideFt = heightFt > band.maxFt
    ? heightFt - band.maxFt
    : heightFt < band.minFt ? band.minFt - heightFt : 0;
  // Same quarter-foot tolerance as the verdict ceiling, so both agree on "in band".
  // No break-type slope: the curated band already encodes how tide-sensitive the break is.
  const excessFt = Math.max(0, outsideFt - TIDE_BAND_TOLERANCE_FT);
  return Math.max(
    NATIVE_TIDE_FLOOR_POINTS,
    NATIVE_TIDE_IN_BAND_POINTS - NATIVE_TIDE_POINTS_PER_FT * excessFt,
  );
}

/**
 * The 0-10 tide term of the displayed score. A curated band replaces the fixed
 * 1.5-4.5 ft core with the beach's own band and a continuous taper. Pure, so
 * native can port it as is.
 */
export function nativeTideTermPoints({ heightFt, status, band }: NativeTideTermInput): number {
  let points = heightFt == null
    ? NATIVE_TIDE_UNKNOWN_POINTS
    : nativeTideHeightPoints(heightFt, band);
  const normalizedStatus = status?.toLowerCase() ?? "";
  if (normalizedStatus.includes("rising") || normalizedStatus.includes("falling")) points += 2;
  if (normalizedStatus.includes("high") || normalizedStatus.includes("low")) points -= 1;
  return Math.max(0, Math.min(10, points));
}

export function scoreNativeConditionInputs(
  inputs: NativeScoreInputs,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
  direction?: NativeDirectionScoreInput,
): number {
  return scoreNativeConditionBreakdownForBand(
    inputs,
    skillLevel,
    rideabilityBand,
    direction,
  ).score;
}

export function scoreNativeConditionBreakdown(
  inputs: NativeScoreInputs,
  skillLevel?: SkillLevel | string | null,
  boardClass?: BoardClass | null,
  direction?: NativeDirectionScoreInput,
): NativeConditionScoreBreakdown {
  return scoreNativeConditionBreakdownForBand(
    inputs,
    skillLevel,
    boardClass ? getRideabilityBand(resolveNativeSkillLevel(skillLevel), boardClass) : null,
    direction,
  );
}

function scoreNativeConditionBreakdownForBand(
  inputs: NativeScoreInputs,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
  direction?: NativeDirectionScoreInput,
): NativeConditionScoreBreakdown {
  const skill = resolveNativeSkillLevel(skillLevel);
  const nativeThresholds = NATIVE_SKILL_THRESHOLDS[skill];
  const thresholds = rideabilityBand
    ? {
        ...nativeThresholds,
        waveMinFt: rideabilityBand.acceptable.min,
        waveMaxFt: rideabilityBand.acceptable.max,
        idealMinFt: rideabilityBand.ideal.min,
        idealMaxFt: rideabilityBand.ideal.max,
      }
    : nativeThresholds;
  const { waveHeightFt, windSpeedMph, periodSec, tideHeightFt } = inputs;

  if (waveHeightFt <= 0) {
    return {
      score: 0,
      components: { waveFit: 0, period: 0, wind: 0, tide: 0 },
      outOfBand: false,
    };
  }

  const isBelowBand = waveHeightFt < thresholds.waveMinFt;
  const isAboveBand = waveHeightFt > thresholds.waveMaxFt;
  const isOutOfBand = isBelowBand || isAboveBand;

  const peak = (thresholds.idealMinFt + thresholds.idealMaxFt) / 2;
  const rawWaveScore =
    waveHeightFt <= peak
      ? 45 * ((waveHeightFt - thresholds.waveMinFt) / Math.max(peak - thresholds.waveMinFt, 0.01))
      : 45 * ((thresholds.waveMaxFt - waveHeightFt) / Math.max(thresholds.waveMaxFt - peak, 0.01));
  const waveScore = isOutOfBand
    ? 0
    : Math.max(0, Math.min(45, rawWaveScore));

  const energyScore =
    periodSec >= 13
      ? 20
      : periodSec > 0
        ? Math.min(18, (periodSec / 13) * 18)
        : 0;
  const windScore = windSpeedMph === null
    ? NATIVE_UNKNOWN_WIND_POINTS
    : Math.max(0, NATIVE_MAX_WIND_POINTS * (1 - windSpeedMph / thresholds.maxWindMph));

  const tideScore = nativeTideTermPoints({
    heightFt: tideHeightFt,
    status: inputs.tideStatus,
    band: inputs.tideBand,
  });

  // Direction cannot judge a wind whose strength is unknown.
  const windQuality = direction
    ? windSpeedMph === null ? windScore : windScore * windQualityMultiplier(direction)
    : undefined;
  const swellAlignment = direction
    ? 15 * swellAlignmentFactor(periodSec, direction)
    : undefined;
  const windKnown = windSpeedMph !== null;
  const effectiveWindScore = windKnown ? (windQuality ?? windScore) : 0;
  const maxPoints = (direction ? NATIVE_DIRECTION_MAX_POINTS : NATIVE_BASE_MAX_POINTS)
    - (windKnown ? 0 : NATIVE_MAX_WIND_POINTS);
  const components = {
    waveFit: waveScore,
    period: energyScore,
    wind: windScore,
    tide: tideScore,
    ...(direction ? { windQuality, swellAlignment } : {}),
  };

  if (!isOutOfBand) {
    const rawScore = waveScore + energyScore + effectiveWindScore + tideScore + (swellAlignment ?? 0);
    return {
      score: Math.round((rawScore * 100) / maxPoints),
      components,
      outOfBand: false,
    };
  }

  const relativeDistance = isAboveBand
    ? (waveHeightFt - thresholds.waveMaxFt) / thresholds.waveMaxFt
    : (thresholds.waveMinFt - waveHeightFt) / Math.max(thresholds.waveMinFt, 0.5);
  const attenuation = Math.max(0, 1 - relativeDistance / 0.75);
  const nonWaveScore = energyScore + effectiveWindScore + tideScore + (swellAlignment ?? 0);
  const attenuatedScore = (nonWaveScore * attenuation * 100) / maxPoints;

  return {
    score: Math.round(Math.min(OUT_OF_BAND_SCORE_CEILING, attenuatedScore)),
    components,
    outOfBand: true,
  };
}

function windQualityMultiplier(direction: NativeDirectionScoreInput): number {
  if (direction.windDirectionDeg == null || direction.offshoreDeg == null) return 1;
  const label = classifyWindQuality(
    direction.windDirectionDeg,
    direction.offshoreDeg,
    direction.offshoreToleranceDeg,
  ).label;
  return {
    offshore: 1,
    'cross-offshore': 0.85,
    'cross-shore': 0.6,
    onshore: 0.35,
  }[label];
}

function swellAlignmentFactor(
  periodSec: number,
  direction: NativeDirectionScoreInput,
): number {
  if (
    direction.swellDirectionDeg == null ||
    direction.windowCenterDeg == null ||
    direction.windowHalfwidthDeg == null
  ) {
    return 1;
  }
  return Math.max(
    0,
    alignmentFactor(
      direction.swellDirectionDeg,
      periodSec,
      direction.windowCenterDeg,
      direction.windowHalfwidthDeg,
    ),
  );
}

export function scoreNativeForecastSlot(
  forecast: EnhancedForecastEntity,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
  direction?: NativeDirectionScoreInput,
): number {
  return scoreNativeConditionInputs(
    nativeScoreInputsFromForecast(forecast),
    skillLevel,
    rideabilityBand,
    direction,
  );
}

export function pickBestNativeForecastSlot(
  forecasts: EnhancedForecastEntity[],
  skillLevel?: SkillLevel | string | null,
  options: { beachTz?: string; tideBand?: TideBand | null } = {}
): NativeScoredForecast | null {
  const { beachTz, tideBand } = options;
  // A FALLBACK row's null wave height parses as 0 ft and would score as a
  // real flat slot.
  const modelForecasts = forecasts.filter((forecast) => !isFallbackForecastRow(forecast));
  const daylightForecasts = beachTz
    ? modelForecasts.filter((forecast) => {
        const localHour = getLocalHour(
          new Date(forecast.forecast_at),
          beachTz,
        );
        return (
          localHour >= DAYLIGHT_START_HOUR &&
          localHour < DAYLIGHT_END_HOUR
        );
      })
    : modelForecasts;
  const candidates = daylightForecasts.length > 0
    ? daylightForecasts
    : modelForecasts;
  let best: NativeScoredForecast | null = null;

  for (const forecast of candidates) {
    const score = scoreNativeConditionInputs(nativeScoreInputsFromForecast(forecast, tideBand), skillLevel);
    if (!best || score > best.score) {
      best = { forecast, score };
    }
  }

  return best;
}

export function scoreNativeForecastDay(
  forecasts: EnhancedForecastEntity[],
  skillLevel?: SkillLevel | string | null,
  options: { tideBand?: TideBand | null } = {}
): number {
  return pickBestNativeForecastSlot(forecasts, skillLevel, options)?.score ?? 0;
}

export function getNativeConditionMatchQuality(
  score: number
): "perfect" | "excellent" | "good" | "fair" | "minimal" | "skip" {
  if (score >= 95) return "perfect";
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  if (score > 0) return "minimal";
  return "skip";
}
