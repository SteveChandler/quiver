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
import {
  getRideabilityBand,
  type BoardClass,
  type RideabilityBand,
} from '@/lib/domains/rideability';
import { classifyWindQuality } from '@/lib/utils/wind-quality';
import { alignmentFactor } from '@/lib/utils/wave-height-transformer';
import { parseWaveHeightMidpointFt } from '@/lib/alerts/forecast-parsers';

interface NativeSkillThresholds {
  waveMinFt: number;
  waveMaxFt: number;
  idealMinFt: number;
  idealMaxFt: number;
  maxWindMph: number;
}

interface NativeScoreInputs {
  waveHeightFt: number;
  windSpeedMph: number;
  periodSec: number;
  tideHeightFt: number | null;
  tideStatus: string | null;
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

export function nativeScoreInputsFromForecast(
  forecast: EnhancedForecastEntity
): NativeScoreInputs {
  return {
    waveHeightFt: parseWaveHeightMidpointFt(forecast.wave_height) ?? 0,
    windSpeedMph: parseFirstNumber(forecast.wind_speed),
    periodSec: parseFirstNumber(forecast.swell_1_period ?? forecast.wave_period),
    tideHeightFt: parseSignedNumber(forecast.tide_height),
    tideStatus: forecast.tide_status ?? null,
  };
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
  const windScore = Math.max(0, 25 * (1 - windSpeedMph / thresholds.maxWindMph));

  let tideScore = 7;
  if (tideHeightFt != null) {
    if (tideHeightFt >= 1.5 && tideHeightFt <= 4.5) tideScore = 8;
    else if (tideHeightFt >= 0.5 && tideHeightFt <= 6) tideScore = 5;
    else tideScore = 2;
  }

  const tideStatus = inputs.tideStatus?.toLowerCase() ?? "";
  if (tideStatus.includes("rising") || tideStatus.includes("falling")) tideScore += 2;
  if (tideStatus.includes("high") || tideStatus.includes("low")) tideScore -= 1;
  tideScore = Math.max(0, Math.min(10, tideScore));

  const windQuality = direction
    ? windScore * windQualityMultiplier(direction)
    : undefined;
  const swellAlignment = direction
    ? 15 * swellAlignmentFactor(periodSec, direction)
    : undefined;
  const effectiveWindScore = windQuality ?? windScore;
  const components = {
    waveFit: waveScore,
    period: energyScore,
    wind: windScore,
    tide: tideScore,
    ...(direction ? { windQuality, swellAlignment } : {}),
  };

  if (!isOutOfBand) {
    const rawScore = direction
      ? waveScore + energyScore + effectiveWindScore + tideScore + (swellAlignment ?? 0)
      : waveScore + energyScore + windScore + tideScore;
    return {
      score: direction ? Math.round((rawScore * 100) / 115) : Math.round(rawScore),
      components,
      outOfBand: false,
    };
  }

  const relativeDistance = isAboveBand
    ? (waveHeightFt - thresholds.waveMaxFt) / thresholds.waveMaxFt
    : (thresholds.waveMinFt - waveHeightFt) / Math.max(thresholds.waveMinFt, 0.5);
  const attenuation = Math.max(0, 1 - relativeDistance / 0.75);
  const nonWaveScore = direction
    ? energyScore + effectiveWindScore + tideScore + (swellAlignment ?? 0)
    : energyScore + windScore + tideScore;
  const attenuatedScore = direction
    ? (nonWaveScore * attenuation * 100) / 115
    : nonWaveScore * attenuation;

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
  options: { beachTz?: string } = {}
): NativeScoredForecast | null {
  const { beachTz } = options;
  const daylightForecasts = beachTz
    ? forecasts.filter((forecast) => {
        const localHour = getLocalHour(
          new Date(forecast.forecast_at),
          beachTz,
        );
        return (
          localHour >= DAYLIGHT_START_HOUR &&
          localHour < DAYLIGHT_END_HOUR
        );
      })
    : forecasts;
  const candidates = daylightForecasts.length > 0
    ? daylightForecasts
    : forecasts;
  let best: NativeScoredForecast | null = null;

  for (const forecast of candidates) {
    const score = scoreNativeForecastSlot(forecast, skillLevel);
    if (!best || score > best.score) {
      best = { forecast, score };
    }
  }

  return best;
}

export function scoreNativeForecastDay(
  forecasts: EnhancedForecastEntity[],
  skillLevel?: SkillLevel | string | null
): number {
  return pickBestNativeForecastSlot(forecasts, skillLevel)?.score ?? 0;
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
