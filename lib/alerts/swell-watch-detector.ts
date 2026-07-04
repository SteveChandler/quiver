import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  parsePeriodSeconds,
  parseWaveHeightRangeFt,
} from "@/lib/alerts/forecast-parsers";
import { getLocalDateString, getLocalHour } from "@/lib/utils/timezone-utils";

export const SWELL_WATCH_MIN_PEAK_FT = 3;
export const SWELL_WATCH_MIN_RISE_FT = 2;
export const SWELL_WATCH_MIN_PERIOD_S = 11;

const DAYLIGHT_START_HOUR = 6;
const DAYLIGHT_END_HOUR = 19;
const MAX_SCAN_DAY_OFFSET = 9;

export interface SwellWatchEvent {
  eventStartDate: string;
  peakDate: string;
  peakHeightFt: number;
  peakPeriodS: number;
  peakForecastAt: string;
  baselineHeightFt: number;
}

interface ParsedForecastHour {
  localDate: string;
  heightFt: number;
  periodS: number;
  forecastAt: string;
}

interface DailyPeak {
  localDate: string;
  peakHeightFt: number;
  periodS: number;
  forecastAt: string;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseForecastHour(
  forecast: EnhancedForecastEntity,
  timezone: string
): ParsedForecastHour | null {
  const height = parseWaveHeightRangeFt(forecast.wave_height);
  const period =
    parsePeriodSeconds(forecast.swell_1_period) ??
    parsePeriodSeconds(forecast.wave_period);

  if (!height || period == null) return null;

  const forecastDate = new Date(forecast.forecast_at);
  const hour = getLocalHour(forecastDate, timezone);
  if (hour < DAYLIGHT_START_HOUR || hour >= DAYLIGHT_END_HOUR) return null;

  return {
    localDate: getLocalDateString(forecastDate, timezone),
    heightFt: height.max,
    periodS: period,
    forecastAt: forecast.forecast_at,
  };
}

function buildDailyPeaks(
  forecasts: EnhancedForecastEntity[],
  timezone: string
): Map<string, DailyPeak> {
  const peaks = new Map<string, DailyPeak>();

  for (const forecast of forecasts) {
    const parsed = parseForecastHour(forecast, timezone);
    if (!parsed) continue;

    const current = peaks.get(parsed.localDate);
    if (!current || parsed.heightFt > current.peakHeightFt) {
      peaks.set(parsed.localDate, {
        localDate: parsed.localDate,
        peakHeightFt: parsed.heightFt,
        periodS: parsed.periodS,
        forecastAt: parsed.forecastAt,
      });
    }
  }

  return peaks;
}

function countFutureDaysWithData(
  peaks: Map<string, DailyPeak>,
  todayKey: string
): number {
  let count = 0;
  for (let offset = 2; offset <= MAX_SCAN_DAY_OFFSET; offset++) {
    if (peaks.has(addDaysToDateKey(todayKey, offset))) {
      count++;
    }
  }
  return count;
}

function findRunPeak(
  peaks: Map<string, DailyPeak>,
  eventStartDate: string,
  baselineHeightFt: number
): DailyPeak {
  let peak = peaks.get(eventStartDate);
  if (!peak) {
    throw new Error("Swell Watch run must start on a parsed peak day");
  }

  for (let offset = 1; offset <= MAX_SCAN_DAY_OFFSET; offset++) {
    const dateKey = addDaysToDateKey(eventStartDate, offset);
    const next = peaks.get(dateKey);
    if (!next) break;
    if (next.peakHeightFt < baselineHeightFt + SWELL_WATCH_MIN_RISE_FT) {
      break;
    }
    if (next.peakHeightFt > peak.peakHeightFt) {
      peak = next;
    }
  }

  return peak;
}

export function detectSwellWatch(args: {
  forecasts: EnhancedForecastEntity[];
  timezone: string;
  now: Date;
}): SwellWatchEvent | null {
  const todayKey = getLocalDateString(args.now, args.timezone);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const peaks = buildDailyPeaks(args.forecasts, args.timezone);
  const todayPeak = peaks.get(todayKey);
  const tomorrowPeak = peaks.get(tomorrowKey);

  if (!todayPeak || !tomorrowPeak) return null;
  if (countFutureDaysWithData(peaks, todayKey) < 2) return null;

  const baselineHeightFt = Math.max(
    todayPeak.peakHeightFt,
    tomorrowPeak.peakHeightFt
  );

  for (let offset = 2; offset <= MAX_SCAN_DAY_OFFSET; offset++) {
    const dateKey = addDaysToDateKey(todayKey, offset);
    const peak = peaks.get(dateKey);
    if (!peak) continue;

    const hasEnoughSize = peak.peakHeightFt >= SWELL_WATCH_MIN_PEAK_FT;
    const hasEnoughRise =
      peak.peakHeightFt >= baselineHeightFt + SWELL_WATCH_MIN_RISE_FT;
    const hasEnoughPeriod = peak.periodS >= SWELL_WATCH_MIN_PERIOD_S;

    if (!hasEnoughSize || !hasEnoughRise || !hasEnoughPeriod) continue;

    const runPeak = findRunPeak(peaks, dateKey, baselineHeightFt);
    return {
      eventStartDate: dateKey,
      peakDate: runPeak.localDate,
      peakHeightFt: runPeak.peakHeightFt,
      peakPeriodS: runPeak.periodS,
      peakForecastAt: runPeak.forecastAt,
      baselineHeightFt,
    };
  }

  return null;
}
