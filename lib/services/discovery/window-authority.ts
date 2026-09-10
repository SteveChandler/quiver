import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import { getLocalDateString, resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { PersonalizedForecastWindow } from '@/types/personalization';

import { selectBestWindows } from './window-selector';
import { getLocalDateStr, getLocalHour } from './window-selector/time-slot-utils';
import type { WindowSelectorOptions } from './window-selector/types';

export const DISPLAY_WINDOW_MINUTES = 150;
const DISPLAY_WINDOW_HALF_MINUTES = DISPLAY_WINDOW_MINUTES / 2;

export type AuthoritativeWindow = PersonalizedForecastWindow & {
  peakTime: Date;
  displayWindowStart: Date;
  displayWindowEnd: Date;
};

export type WindowDaypart = 'morning' | 'midday' | 'evening';

export interface BeachDayWindowAuthority {
  bestDayWindow: AuthoritativeWindow | null;
  dayparts: Record<WindowDaypart, AuthoritativeWindow | null>;
}

export const WINDOW_AUTHORITY_MAX_WINDOWS = 6;

export function containsTime(start: Date, end: Date, time: Date): boolean {
  return start.getTime() <= time.getTime() && time.getTime() <= end.getTime();
}

function displayWindowAroundPeak(peak: Date, timezone: string): { start: Date; end: Date } {
  let start = new Date(peak.getTime() - DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000);
  let end = new Date(peak.getTime() + DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000);

  const localDate = getLocalDateString(peak, timezone);
  const daylightStart = localDateTimeToUTC(localDate, '06:00:00', timezone);
  const daylightEnd = localDateTimeToUTC(localDate, '19:00:00', timezone);

  if (containsTime(daylightStart, daylightEnd, peak)) {
    if (start < daylightStart) {
      start = daylightStart;
      end = new Date(start.getTime() + DISPLAY_WINDOW_MINUTES * 60 * 1000);
    }
    if (end > daylightEnd) {
      end = daylightEnd;
      start = new Date(end.getTime() - DISPLAY_WINDOW_MINUTES * 60 * 1000);
    }
  }

  if (!containsTime(start, end, peak)) {
    return {
      start: new Date(peak.getTime() - DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000),
      end: new Date(peak.getTime() + DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000),
    };
  }

  return { start, end };
}

export function deriveDisplayWindow({
  rawStart,
  rawEnd,
  peak,
  timezone,
}: {
  rawStart: Date;
  rawEnd: Date;
  peak: Date;
  timezone: string;
}): { start: Date; end: Date } {
  const rawDurationMinutes = (rawEnd.getTime() - rawStart.getTime()) / (60 * 1000);
  const rawContainsPeak = rawDurationMinutes > 0 && containsTime(rawStart, rawEnd, peak);

  if (rawContainsPeak && rawDurationMinutes <= DISPLAY_WINDOW_MINUTES) {
    return { start: rawStart, end: rawEnd };
  }

  let display = displayWindowAroundPeak(peak, timezone);

  if (rawContainsPeak) {
    if (display.start < rawStart) {
      const shiftMs = rawStart.getTime() - display.start.getTime();
      display = {
        start: rawStart,
        end: new Date(display.end.getTime() + shiftMs),
      };
    }

    if (display.end > rawEnd) {
      const shiftMs = display.end.getTime() - rawEnd.getTime();
      display = {
        start: new Date(display.start.getTime() - shiftMs),
        end: rawEnd,
      };
    }
  }

  if (!containsTime(display.start, display.end, peak)) {
    return displayWindowAroundPeak(peak, timezone);
  }

  return display;
}

export function withDisplayWindow(
  window: PersonalizedForecastWindow,
): AuthoritativeWindow {
  const resolvedTimezone = resolveBeachTimezone(window.timezone);
  const peakTime = window.peakTime && containsTime(window.start, window.end, window.peakTime)
    ? window.peakTime
    : new Date((window.start.getTime() + window.end.getTime()) / 2);
  const displayWindow = deriveDisplayWindow({
    rawStart: window.start,
    rawEnd: window.end,
    peak: peakTime,
    timezone: resolvedTimezone,
  });

  return {
    ...window,
    timezone: resolvedTimezone,
    peakTime,
    displayWindowStart: displayWindow.start,
    displayWindowEnd: displayWindow.end,
  };
}

function daypartForLocalHour(hour: number): WindowDaypart {
  if (hour < 10) return 'morning';
  if (hour < 14) return 'midday';
  return 'evening';
}

export function daypartForTime(time: Date, timezone: string): WindowDaypart | null {
  const hour = getLocalHour(time, timezone);
  return hour === null ? null : daypartForLocalHour(hour);
}

export function selectBeachDayWindows(
  options: Omit<WindowSelectorOptions, 'maxWindows'> & {
    localDate: string;
    selectWindows?: typeof selectBestWindows;
  },
): BeachDayWindowAuthority {
  const {
    localDate,
    selectWindows = selectBestWindows,
    ...selectorOptions
  } = options;
  const timezone = resolveBeachTimezone(options.beach.timezone);
  const dayparts: BeachDayWindowAuthority['dayparts'] = {
    morning: null,
    midday: null,
    evening: null,
  };
  const dayRows = options.forecasts.filter(
    (forecast) => getLocalDateStr(new Date(forecast.forecast_at), timezone) === localDate,
  );

  if (dayRows.length === 0) {
    return {
      bestDayWindow: null,
      dayparts,
    };
  }

  const rankedWindows = selectWindows({
    ...selectorOptions,
    forecasts: dayRows,
    maxWindows: WINDOW_AUTHORITY_MAX_WINDOWS,
  }).map(withDisplayWindow);

  for (const window of rankedWindows) {
    const daypart = daypartForTime(window.peakTime, timezone);
    if (daypart && !dayparts[daypart]) dayparts[daypart] = window;
  }

  return {
    bestDayWindow: rankedWindows[0] ?? null,
    dayparts,
  };
}
