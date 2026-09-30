import { getLocalDateString, resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import { usableLightIntervalForDate, type BeachSunTimes } from './daylight-eligibility';

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

type WindowDaypart = 'morning' | 'midday' | 'evening';

interface BeachDayWindowAuthority {
  bestDayWindow: AuthoritativeWindow | null;
  dayparts: Record<WindowDaypart, AuthoritativeWindow | null>;
}

export const WINDOW_AUTHORITY_MAX_WINDOWS = 6;

export function containsTime(start: Date, end: Date, time: Date): boolean {
  return start.getTime() <= time.getTime() && time.getTime() <= end.getTime();
}

function displayWindowAroundPeak(
  peak: Date,
  timezone: string,
  sunTimes?: BeachSunTimes,
): { start: Date; end: Date } {
  let start = new Date(peak.getTime() - DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000);
  let end = new Date(peak.getTime() + DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000);

  const localDate = getLocalDateString(peak, timezone);
  const light = usableLightIntervalForDate(localDate, timezone, sunTimes);

  if (containsTime(light.start, light.end, peak)) {
    if (start < light.start) {
      start = light.start;
      end = new Date(start.getTime() + DISPLAY_WINDOW_MINUTES * 60 * 1000);
    }
    if (end > light.end) {
      end = light.end;
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

interface DisplayWindowArgs {
  rawStart: Date;
  rawEnd: Date;
  peak: Date;
  timezone: string;
  sunTimes?: BeachSunTimes;
}

/**
 * Shifting the band forward to the raw start (or an immediate bucket that
 * outlives the light) can push the end past last light again. A peak inside
 * usable light never presents an end after it; a dark peak keeps its window
 * (Now is never gated by the clock). Only a known sunset for the peak's day
 * counts, so the 18:00 fallback never trims a real evening window.
 */
function clampEndToLastLight(
  display: { start: Date; end: Date },
  { peak, timezone, sunTimes }: Pick<DisplayWindowArgs, 'peak' | 'timezone' | 'sunTimes'>,
): { start: Date; end: Date } {
  if (!sunTimes) return display;
  const localDate = getLocalDateString(peak, timezone);
  if (!sunTimes.sunsets.some((sunset) => getLocalDateStr(sunset, timezone) === localDate)) {
    return display;
  }
  const light = usableLightIntervalForDate(localDate, timezone, sunTimes);
  if (!containsTime(light.start, light.end, peak) || display.end <= light.end) return display;
  if (light.end <= display.start) return display;
  return { start: display.start, end: light.end };
}

export function deriveDisplayWindow(args: DisplayWindowArgs): { start: Date; end: Date } {
  return clampEndToLastLight(bandDisplayWindow(args), args);
}

function bandDisplayWindow({
  rawStart,
  rawEnd,
  peak,
  timezone,
  sunTimes,
}: DisplayWindowArgs): { start: Date; end: Date } {
  const rawDurationMinutes = (rawEnd.getTime() - rawStart.getTime()) / (60 * 1000);
  const rawContainsPeak = rawDurationMinutes > 0 && containsTime(rawStart, rawEnd, peak);

  if (rawContainsPeak && rawDurationMinutes <= DISPLAY_WINDOW_MINUTES) {
    return { start: rawStart, end: rawEnd };
  }

  let display = displayWindowAroundPeak(peak, timezone, sunTimes);

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
    return displayWindowAroundPeak(peak, timezone, sunTimes);
  }

  return display;
}

export function withDisplayWindow(
  window: PersonalizedForecastWindow,
  sunTimes?: BeachSunTimes,
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
    sunTimes,
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
  }).map((window) => withDisplayWindow(
    window,
    options.sunTimesCache?.get(options.beach.id),
  ));

  for (const window of rankedWindows) {
    const daypart = daypartForTime(window.peakTime, timezone);
    if (daypart && !dayparts[daypart]) dayparts[daypart] = window;
  }

  return {
    bestDayWindow: rankedWindows[0] ?? null,
    dayparts,
  };
}
