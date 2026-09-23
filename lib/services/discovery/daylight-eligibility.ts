import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import { getLocalDateStr } from './window-selector/time-slot-utils';

export interface BeachSunTimes {
  sunrises: Date[];
  sunsets: Date[];
}

interface UsableLightInterval {
  start: Date;
  end: Date;
}

const FIRST_LIGHT_BEFORE_SUNRISE_MS = 30 * 60_000;
const LAST_LIGHT_AFTER_SUNSET_MS = 20 * 60_000;
const FORECAST_ROW_FALLBACK_DURATION_MS = 60 * 60_000;
const MAX_FORECAST_ROW_GAP_MS = 3 * 60 * 60_000;

export function forecastRowIntervalEnd(start: Date, nextStart?: Date): Date {
  if (nextStart) {
    const gap = nextStart.getTime() - start.getTime();
    if (Number.isFinite(gap) && gap > 0 && gap <= MAX_FORECAST_ROW_GAP_MS) {
      return nextStart;
    }
  }
  return new Date(start.getTime() + FORECAST_ROW_FALLBACK_DURATION_MS);
}

function localTimeToDate(date: string, time: string, timezone: string): Date {
  try {
    return localDateTimeToUTC(date, time, timezone);
  } catch {
    return new Date(`${date}T${time}Z`);
  }
}

function addLocalDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function usableLightIntervalForDate(
  date: string,
  timezone: string,
  sunTimes?: BeachSunTimes,
): UsableLightInterval {
  const sunrise = sunTimes?.sunrises.find(
    (time) => getLocalDateStr(time, timezone) === date,
  );
  const sunset = sunTimes?.sunsets.find(
    (time) => getLocalDateStr(time, timezone) === date,
  );

  return {
    start: sunrise
      ? new Date(sunrise.getTime() - FIRST_LIGHT_BEFORE_SUNRISE_MS)
      : localTimeToDate(date, '06:00:00', timezone),
    end: sunset
      ? new Date(sunset.getTime() + LAST_LIGHT_AFTER_SUNSET_MS)
      : localTimeToDate(date, '18:00:00', timezone),
  };
}

export function isDaylightInterval(
  start: Date,
  end: Date,
  timezone: string,
  sunTimes?: BeachSunTimes,
): boolean {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return false;
  }

  const firstDate = getLocalDateStr(start, timezone);
  const lastDate = getLocalDateStr(new Date(end.getTime() - 1), timezone);
  let date = firstDate;

  while (date <= lastDate) {
    const light = usableLightIntervalForDate(date, timezone, sunTimes);
    if (start < light.end && end > light.start) return true;
    date = addLocalDays(date, 1);
  }

  return false;
}

/**
 * Trim a window to the usable light of the first local day it overlaps, so a
 * daylight-only window never presents a start before first light or an end
 * after last light. Returns null when the window has no usable light.
 */
export function clampToUsableLight(
  start: Date,
  end: Date,
  timezone: string,
  sunTimes?: BeachSunTimes,
): UsableLightInterval | null {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return null;
  }

  const lastDate = getLocalDateStr(new Date(end.getTime() - 1), timezone);
  let date = getLocalDateStr(start, timezone);

  while (date <= lastDate) {
    const light = usableLightIntervalForDate(date, timezone, sunTimes);
    if (start < light.end && end > light.start) {
      return {
        start: start < light.start ? light.start : start,
        end: end > light.end ? light.end : end,
      };
    }
    date = addLocalDays(date, 1);
  }

  return null;
}

export function nextFirstLight(
  after: Date,
  timezone: string,
  sunTimes?: BeachSunTimes,
): Date | null {
  if (!Number.isFinite(after.getTime())) return null;

  let date = getLocalDateStr(after, timezone);
  for (let day = 0; day < 8; day++) {
    const firstLight = usableLightIntervalForDate(date, timezone, sunTimes).start;
    if (firstLight > after) return firstLight;
    date = addLocalDays(date, 1);
  }

  return null;
}

export function lightMetadata(
  at: Date,
  timezone: string,
  sunTimes?: BeachSunTimes,
): { firstLight: string; lastLight: string; isDark: boolean; nextWindowStart?: string } {
  const light = usableLightIntervalForDate(getLocalDateStr(at, timezone), timezone, sunTimes);
  const isDark = at < light.start || at >= light.end;
  const next = isDark ? nextFirstLight(at, timezone, sunTimes) : null;
  return {
    firstLight: light.start.toISOString(),
    lastLight: light.end.toISOString(),
    isDark,
    ...(next ? { nextWindowStart: next.toISOString() } : {}),
  };
}
