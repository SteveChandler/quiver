import { getLocalDateString, resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import { usableLightIntervalForDate, type BeachSunTimes } from './daylight-eligibility';

import { selectBestWindows } from './window-selector';
import { getLocalDateStr, getLocalHour } from './window-selector/time-slot-utils';
import { compareRankedWindows } from './window-selector/window-selector-core';
import type { WindowSelectionRank, WindowSelectorOptions } from './window-selector/types';

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
 * Last light for the peak's day, only while the peak is inside usable light
 * and a sunset is known for that day, so the 18:00 fallback never trims a real
 * evening window. A dark peak has none: Now is never gated by the clock.
 */
function lastLightWhileLit(
  peak: Date,
  timezone: string,
  sunTimes?: BeachSunTimes,
): Date | null {
  if (!sunTimes) return null;
  const localDate = getLocalDateString(peak, timezone);
  if (!sunTimes.sunsets.some((sunset) => getLocalDateStr(sunset, timezone) === localDate)) {
    return null;
  }
  const light = usableLightIntervalForDate(localDate, timezone, sunTimes);
  return containsTime(light.start, light.end, peak) ? light.end : null;
}

/**
 * Shifting the band forward to the raw start (or an immediate bucket that
 * outlives the light) can push the end past last light again. A peak inside
 * usable light never presents an end after it; a dark peak keeps its window.
 */
function clampEndToLastLight(
  display: { start: Date; end: Date },
  { peak, timezone, sunTimes }: Pick<DisplayWindowArgs, 'peak' | 'timezone' | 'sunTimes'>,
): { start: Date; end: Date } {
  const lastLight = lastLightWhileLit(peak, timezone, sunTimes);
  if (!lastLight || display.end <= lastLight || lastLight <= display.start) return display;
  return { start: display.start, end: lastLight };
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

function windowPeak(window: PersonalizedForecastWindow): Date {
  return window.peakTime && containsTime(window.start, window.end, window.peakTime)
    ? window.peakTime
    : new Date((window.start.getTime() + window.end.getTime()) / 2);
}

/**
 * `displaySource` lends its raw bounds and peak to the display band while
 * `window` keeps its own raw bounds and peak. A NOW window peaks at the
 * request instant, so a band centred on it slides with the clock; the caller
 * passes the window of the row the scoped call anchors on, whose band holds.
 * The window's own light still bounds it: while its peak is in usable light
 * the band never ends after last light, even when the anchor row starts after it.
 */
export function withDisplayWindow(
  window: PersonalizedForecastWindow,
  sunTimes?: BeachSunTimes,
  displaySource: PersonalizedForecastWindow = window,
): AuthoritativeWindow {
  const resolvedTimezone = resolveBeachTimezone(window.timezone);
  const peakTime = windowPeak(window);
  const bandArgs = (source: PersonalizedForecastWindow): DisplayWindowArgs => ({
    rawStart: source.start,
    rawEnd: source.end,
    peak: windowPeak(source),
    timezone: resolvedTimezone,
    sunTimes,
  });
  let displayWindow = deriveDisplayWindow(bandArgs(displaySource));
  const ownLastLight = displaySource === window
    ? null
    : lastLightWhileLit(peakTime, resolvedTimezone, sunTimes);
  if (ownLastLight && displayWindow.end > ownLastLight) {
    displayWindow = ownLastLight > displayWindow.start
      ? { start: displayWindow.start, end: ownLastLight }
      : deriveDisplayWindow(bandArgs(window));
  }

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

  const daySelectorOptions: WindowSelectorOptions = { ...selectorOptions, forecasts: dayRows };
  if (options.rowLiveness === 'until-next-row') {
    daySelectorOptions.now ??= new Date();
    daySelectorOptions.forecastPreparationCache = new Map();
    const ranks = new Map<PersonalizedForecastWindow, WindowSelectionRank>();
    const windows: PersonalizedForecastWindow[] = [];
    for (const daypart of Object.keys(dayparts) as WindowDaypart[]) {
      const window = selectWindows({
        ...daySelectorOptions,
        maxWindows: 1,
        disableBelowFloorFallback: true,
        // Keep the full grid for cadence, peak and boundary interpolation.
        acceptWindowStart: (start) => daypartForTime(start, timezone) === daypart,
        onWindowRanked: (candidate, rank) => {
          ranks.set(candidate, rank);
          selectorOptions.onWindowRanked?.(candidate, rank);
        },
      }).find((candidate) => daypartForTime(candidate.start, timezone) === daypart);
      if (!window) continue;
      const displayed = withDisplayWindow(window, options.sunTimesCache?.get(options.beach.id));
      dayparts[daypart] = displayed;
      windows.push(window);
    }
    if (windows.length > 0) {
      windows.sort((a, b) => {
        const aRank = ranks.get(a);
        const bRank = ranks.get(b);
        return aRank && bRank ? compareRankedWindows(aRank, bRank) : 0;
      });
      const bestDaypart = daypartForTime(windows[0].start, timezone);
      return { bestDayWindow: bestDaypart ? dayparts[bestDaypart] : null, dayparts };
    }
    // Match full-day selection: fallback is available only if no daypart qualifies.
    daySelectorOptions.disableBelowFloorFallback = false;
  }

  const rankedWindows = selectWindows({
    ...daySelectorOptions,
    maxWindows: WINDOW_AUTHORITY_MAX_WINDOWS,
  }).map((window) => withDisplayWindow(
    window,
    options.sunTimesCache?.get(options.beach.id),
  ));

  for (const window of rankedWindows) {
    const daypart = daypartForTime(
      options.rowLiveness === 'until-next-row' ? window.start : window.peakTime, timezone,
    );
    if (daypart && !dayparts[daypart]) dayparts[daypart] = window;
  }

  return {
    bestDayWindow: rankedWindows[0] ?? null,
    dayparts,
  };
}
