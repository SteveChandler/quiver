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
import type { RideabilityBand } from '@/lib/domains/rideability';

export interface NativeSkillThresholds {
  waveMinFt: number;
  waveMaxFt: number;
  idealMinFt: number;
  idealMaxFt: number;
  maxWindMph: number;
}

export interface NativeScoreInputs {
  waveHeightFt: number;
  windSpeedMph: number;
  periodSec: number;
  tideHeightFt: number | null;
  tideStatus: string | null;
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

export function nativeScoreInputsFromForecast(
  forecast: EnhancedForecastEntity
): NativeScoreInputs {
  return {
    waveHeightFt: parseMaxWaveHeightFt(forecast.wave_height),
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
): number {
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

  if (waveHeightFt <= 0) return 0;

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

  if (!isOutOfBand) {
    return Math.round(waveScore + energyScore + windScore + tideScore);
  }

  const relativeDistance = isAboveBand
    ? (waveHeightFt - thresholds.waveMaxFt) / thresholds.waveMaxFt
    : (thresholds.waveMinFt - waveHeightFt) / Math.max(thresholds.waveMinFt, 0.5);
  const attenuation = Math.max(0, 1 - relativeDistance / 0.75);
  const nonWaveScore = energyScore + windScore + tideScore;

  return Math.round(
    Math.min(OUT_OF_BAND_SCORE_CEILING, nonWaveScore * attenuation),
  );
}

export function scoreNativeForecastSlot(
  forecast: EnhancedForecastEntity,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
): number {
  return scoreNativeConditionInputs(
    nativeScoreInputsFromForecast(forecast),
    skillLevel,
    rideabilityBand,
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
