import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';
import { selectBestWindow, selectBestWindows } from '@/lib/services/discovery/window-selector/window-selector-core';
import { hasUsableTodayForecastForFallback } from '@/lib/services/discovery/surf-discovery-orchestrator';
import { selectBeachDayWindows } from '@/lib/services/discovery/window-authority';
import * as windowRefiner from '@/lib/services/discovery/window-selector/window-refiner';
import * as windowScorer from '@/lib/services/discovery/window-selector/window-scorer';

jest.mock('@/lib/services/discovery/window-selector/window-refiner', () => {
  const actual = jest.requireActual('@/lib/services/discovery/window-selector/window-refiner');
  return { ...actual, applySubHourRefinement: jest.fn(actual.applySubHourRefinement) };
});

jest.mock('@/lib/services/discovery/window-selector/window-scorer', () => {
  const actual = jest.requireActual('@/lib/services/discovery/window-selector/window-scorer');
  return { ...actual, scoreWindowForSelection: jest.fn(actual.scoreWindowForSelection) };
});

const beach = {
  id: 'liveness-beach', name: 'Liveness Beach', lat: 36.96, lon: -122.02,
  timezone: 'America/Los_Angeles', wind_offshore_deg: 90, wind_offshore_tol_deg: 45,
} as Beach;

function localTime(time: string, date = '2026-10-16'): Date {
  return new Date(`${date}T${time}:00-07:00`);
}

function forecastAt(time: string, date = '2026-10-16'): EnhancedForecastEntity {
  return {
    id: `forecast-${date}-${time}`, beach_id: beach.id,
    forecast_at: localTime(time, date).toISOString(),
    wave_height: '3', wave_period: '13s', wind_speed: '3', wind_direction: 'E',
    wind_direction_deg: 90, confidence_score: 85, data_source: 'NOAA_NWS',
  } as EnhancedForecastEntity;
}

function options(times: string[], now: string): WindowSelectorOptions {
  return {
    forecasts: times.map((time) => forecastAt(time)), beach, userPrefs: null,
    timeSlot: 'any', now: localTime(now), rowLiveness: 'until-next-row',
    sunTimesCache: new Map([[beach.id, {
      sunrises: [localTime('06:30'), localTime('06:30', '2026-10-17')],
      sunsets: [localTime('18:30'), localTime('18:30', '2026-10-17')],
    }]]),
  };
}

beforeEach(() => {
  jest.mocked(windowScorer.scoreWindowForSelection).mockReturnValue(70);
  jest.mocked(windowRefiner.applySubHourRefinement).mockClear().mockImplementation(
    jest.requireActual('@/lib/services/discovery/window-selector/window-refiner').applySubHourRefinement,
  );
});

it('preserves the default 45-minute row life, including its grace boundary', () => {
  const args = { ...options(['08:00'], '09:16'), rowLiveness: undefined };
  expect(selectBestWindow(args)).toBeNull();
  expect(selectBestWindows({ ...args, rowLiveness: 'default' })).toEqual([]);
  expect(selectBestWindow({ ...args, now: localTime('08:45') })?.start).toEqual(localTime('08:00'));
  expect(selectBestWindow({ ...args, now: localTime('08:46') })).toBeNull();
});

it('keeps the 08:00 row live at 09:16 only when opted in', () => {
  const window = selectBestWindow({ ...options(['05:00', '08:00', '11:00'], '09:16'), timeSlot: 'dawn-patrol' });
  expect(window?.start).toEqual(localTime('08:00'));
  expect(window?.end).toEqual(localTime('11:00'));
});

it('caps row liveness at three hours across a five-hour gap, without grace', () => {
  const args = { ...options(['03:00', '08:00', '13:00'], '10:59'), timeSlot: 'dawn-patrol' as const };
  expect(selectBestWindow(args)?.start).toEqual(localTime('08:00'));
  expect(selectBestWindow({ ...args, now: localTime('11:00') })).toBeNull();
});

it.each([
  ['three-hourly', ['02:00', '05:00', '08:00'], '10:59', '11:00'],
  ['hourly', ['06:00', '07:00', '08:00'], '08:59', '09:00'],
  ['averaged median', ['05:00', '06:00', '08:00'], '09:29', '09:30'],
  ['duplicates and outlier', ['01:00', '06:00', '07:00', '07:00', '08:00'], '08:59', '09:00'],
  ['30-minute floor', ['07:40', '07:50', '08:00'], '08:29', '08:30'],
  ['three-hour ceiling', ['00:00', '04:00', '08:00'], '10:59', '11:00'],
  ['single row', ['08:00'], '08:29', '08:30'],
])('bounds the final row by %s spacing before filtering unsorted input', (_label, times, live, expired) => {
  const args = options([...times].reverse(), live);
  expect(selectBestWindow(args)?.start).toEqual(localTime('08:00'));
  expect(selectBestWindow({ ...args, now: localTime(expired) })).toBeNull();
});

describe('hourly rows', () => {
  const HOURLY_DAY = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

  it('keep the row under way live for an hour, not a 3-hour grid step', () => {
    const args = { ...options(HOURLY_DAY.slice(0, 4), '09:59'), timeSlot: 'dawn-patrol' as const };
    expect(selectBestWindow(args)?.start).toEqual(localTime('09:00'));
    expect(selectBestWindow({ ...args, now: localTime('10:00') })).toBeNull();
  });

  it('build a multi-hour window that the session-duration gate keeps', () => {
    const rejections: string[] = [];
    const window = selectBestWindow({
      ...options(HOURLY_DAY, '09:30'),
      onRejection: (rejection) => rejections.push(rejection.gate),
    });
    expect(window?.start.getTime()).toBeLessThanOrEqual(localTime('09:30').getTime());
    expect((window!.end.getTime() - window!.start.getTime()) / 3_600_000).toBeGreaterThanOrEqual(3);
    expect(rejections).not.toContain('session_duration');
  });

  it('end the window inside the hour the score drops, interpolated across one hour', () => {
    jest.mocked(windowScorer.scoreWindowForSelection).mockImplementation((forecast) => (
      forecast.forecast_at < localTime('10:00').toISOString() ? 70 : 10
    ));
    const window = selectBestWindow(options(HOURLY_DAY, '06:45'));
    expect(window?.start.getTime()).toBeLessThanOrEqual(localTime('07:00').getTime());
    expect(window!.end.getTime()).toBeGreaterThan(localTime('09:00').getTime());
    expect(window!.end.getTime()).toBeLessThanOrEqual(localTime('10:00').getTime());
  });
});

it.each([90, 10])('returns tomorrow when today expired at last light (today score %s)', (todayScore) => {
  jest.mocked(windowScorer.scoreWindowForSelection).mockImplementation((forecast) => (
    forecast.forecast_at >= localTime('00:00', '2026-10-17').toISOString() ? 10 : todayScore
  ));
  const args = options(['11:00', '14:00', '17:00'], '19:10');
  args.forecasts.push(forecastAt('08:00', '2026-10-17'), forecastAt('11:00', '2026-10-17'));
  const windows = selectBestWindows(args);
  expect(windows).toHaveLength(1);
  expect(windows[0].start).toEqual(localTime('08:00', '2026-10-17'));
  expect(windows[0].end).toEqual(localTime('12:00', '2026-10-17'));
  expect(windowRefiner.applySubHourRefinement).toHaveBeenCalledTimes(1);
  expect(jest.mocked(windowRefiner.applySubHourRefinement).mock.calls[0][0].forecast).toEqual(args.forecasts[3]);
});

it.each([70, 10])('strictly rejects the 17:00–18:50 window at 19:04 (score %s)', (score) => {
  jest.mocked(windowScorer.scoreWindowForSelection).mockReturnValue(score);
  expect(selectBestWindows(options(['14:00', '17:00', '20:00'], '19:04'))).toEqual([]);
  expect(selectBestWindows(options(['14:00', '17:00', '20:00'], '18:50'))).toEqual([]);
  expect(windowRefiner.applySubHourRefinement).not.toHaveBeenCalled();
});

it.each([70, 10])('does not grant an underway bonus to extended rows (score %s)', (score) => {
  jest.mocked(windowScorer.scoreWindowForSelection).mockReturnValue(score);
  const window = selectBestWindow(options(['08:00', '11:00', '14:00', '17:00'], '13:50'));
  expect(window?.start).toEqual(localTime('14:00'));
  expect(window?.end).toEqual(localTime('18:00'));
});

it.each([90, 10])('retries remaining rows when refinement expires every candidate (score %s)', (score) => {
  jest.mocked(windowScorer.scoreWindowForSelection).mockImplementation((forecast) => (
    forecast.forecast_at >= localTime('00:00', '2026-10-17').toISOString() ? 10 : score
  ));
  const refine = jest.mocked(windowRefiner.applySubHourRefinement).mockImplementation((candidate) => (
    candidate.forecast.forecast_at >= localTime('00:00', '2026-10-17').toISOString()
      ? { start: candidate.start, end: candidate.end }
      : { start: localTime('17:00'), end: localTime('18:00') }
  ));
  const args = options(['17:00'], '18:30');
  args.forecasts.push(forecastAt('08:00', '2026-10-17'), forecastAt('11:00', '2026-10-17'));
  const windows = selectBestWindows(args);
  expect(refine).toHaveBeenCalledTimes(2);
  expect(refine.mock.calls[0][0].forecast).toEqual(args.forecasts[0]);
  expect(refine.mock.calls[1][0].forecast).toEqual(args.forecasts[1]);
  expect(windows).toHaveLength(1);
  expect(windows[0].start).toEqual(localTime('08:00', '2026-10-17'));
});

it('keeps Home authority and the orchestrator fallback gate on default liveness', () => {
  const args = {
    forecasts: ['05:00', '08:00', '11:00'].map((time) => forecastAt(time)),
    beach, userPrefs: null, now: localTime('09:16'),
  };
  const selectWindows = jest.fn((selectorOptions: WindowSelectorOptions) => selectBestWindows(selectorOptions));
  const authority = selectBeachDayWindows({
    ...args,
    localDate: '2026-10-16',
    selectWindows: selectWindows as unknown as typeof selectBestWindows,
  });
  expect(selectWindows).toHaveBeenCalledTimes(1);
  expect(selectWindows.mock.calls[0][0]).not.toHaveProperty('rowLiveness');
  expect(authority.dayparts.morning).toBeNull();
  expect(hasUsableTodayForecastForFallback({
    forecasts: [forecastAt('08:00')], beachTz: beach.timezone!,
    now: args.now,
  })).toBe(false);
});

it('prepares each row once and refines only its own daypart during Week Scout selection', () => {
  const score = jest.mocked(windowScorer.scoreWindowForSelection).mockImplementation(
    jest.requireActual('@/lib/services/discovery/window-selector/window-scorer').scoreWindowForSelection,
  ).mockClear();
  const args = options(['05:00', '08:00', '11:00', '14:00'], '09:16');
  const result = selectBeachDayWindows({ ...args, localDate: '2026-10-16' });
  expect(Object.values(result.dayparts).filter((window) => window !== null)).toHaveLength(3);
  expect(score).toHaveBeenCalledTimes(args.forecasts.length);
  expect(jest.mocked(windowRefiner.applySubHourRefinement).mock.calls.map(([candidate]) => candidate.start))
    .toEqual(['08:00', '11:00', '14:00'].map((time) => localTime(time)));
});

it('reuses preparation for the single whole-day fallback after all three scoped calls are empty', () => {
  const score = jest.mocked(windowScorer.scoreWindowForSelection).mockImplementation(
    jest.requireActual('@/lib/services/discovery/window-selector/window-scorer').scoreWindowForSelection,
  ).mockClear();
  const args = options(['05:00', '08:00', '11:00', '14:00'], '09:16');
  args.forecasts = args.forecasts.map((row) => ({
    ...row, wave_height: String(1 + 3 / 18), wave_period: '0s', wind_speed: '14',
  }));
  const selectWindows = jest.fn((selectorOptions: WindowSelectorOptions) => selectBestWindows(selectorOptions));
  const result = selectBeachDayWindows({
    ...args, localDate: '2026-10-16',
    selectWindows: selectWindows as unknown as typeof selectBestWindows,
  });
  expect(score).toHaveBeenCalledTimes(args.forecasts.length);
  expect(selectWindows).toHaveBeenCalledTimes(4);
  expect(selectWindows.mock.calls.slice(0, 3).map(([call]) => call.disableBelowFloorFallback)).toEqual([true, true, true]);
  expect(selectWindows.mock.calls[3][0]).toMatchObject({ maxWindows: 6, disableBelowFloorFallback: false });
  expect(selectWindows.mock.calls[3][0]).not.toHaveProperty('acceptWindowStart');
  expect(Object.values(result.dayparts).filter((window) => window !== null)).toEqual([result.bestDayWindow]);
  expect(result.bestDayWindow).toEqual(expect.objectContaining(selectBestWindows(args)[0]));
});
