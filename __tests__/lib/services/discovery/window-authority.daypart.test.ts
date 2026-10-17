import { selectBeachDayWindows } from '@/lib/services/discovery/window-authority';
import { findPeakWithinWindow } from '@/lib/services/discovery/window-selector/peak-finder';
import { selectBestWindows } from '@/lib/services/discovery/window-selector/window-selector-core';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';
import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { PersonalizedForecastWindow } from '@/types/personalization';

jest.mock('@/lib/services/discovery/window-selector/window-scorer', () => ({
  ...jest.requireActual('@/lib/services/discovery/window-selector/window-scorer'),
  scoreWindowForSelection: jest.fn((row: EnhancedForecastEntity) => Number(row.confidence_score)),
}));

describe.each(['Pacific/Honolulu', 'America/Los_Angeles'])('Week Scout dayparts in %s', (timezone) => {
  const localDate = '2026-10-16';
  const time = (value: string): Date => localDateTimeToUTC(localDate, `${value}:00`, timezone);
  const beach = { id: 'daypart-beach', name: 'Daypart Beach', timezone } as Beach;
  const forecasts = ['05:00', '08:00', '11:00', '14:00'].map((value, index) => ({
    id: `row-${value}`, beach_id: beach.id, forecast_at: time(value).toISOString(),
    wave_height: '3', wave_period: '12s', wind_speed: '5', wind_direction: 'E',
    confidence_score: [0, 90, 70, 70][index], data_source: 'NOAA_NWS',
  } as EnhancedForecastEntity));
  const sunTimesCache = new Map([[beach.id, {
    sunrises: [time('06:30')], sunsets: [time('18:30')],
  }]]);

  function options(now: string): WindowSelectorOptions & { localDate: string } {
    return { beach, forecasts, userPrefs: null, localDate, now: time(now), sunTimesCache };
  }

  function window(start: string, end: string, now: string): PersonalizedForecastWindow {
    return {
      start: time(start), end: time(end), timezone,
      peakTime: findPeakWithinWindow(time(start), time(end), forecasts.map((row) => ({
        forecastTime: new Date(row.forecast_at), score: row.confidence_score!,
      })), time(now)),
      tide: 'Rising', wind: '5 mph E', waveHeight: '3 ft', wavePeriod: '12s',
      dataSource: 'NOAA_NWS', confidence: 85,
    };
  }

  it.each(['07:55', '08:05', '09:16'])('keeps the real 08:00–12:00 window in morning at %s', (now) => {
    const result = selectBeachDayWindows({ ...options(now), rowLiveness: 'until-next-row' });

    expect(result.dayparts.morning).toMatchObject({ start: time('08:00'), end: time('12:00') });
    expect(result.dayparts.morning!.peakTime).toEqual(time(now === '07:55' ? '08:30' : '11:00'));
    expect(result.bestDayWindow).toBe(result.dayparts.morning);
    expect(result.dayparts.midday).toBeNull();
    expect(result.dayparts.evening).toMatchObject({ start: time('14:00') });
  });

  it.each(['09:16', '11:30'])('gives midday only its own separate window at %s, preserving rank order', (now) => {
    const morning = window('08:00', '12:00', now);
    const midday = window('12:00', '14:00', now);
    const lowerRankedMorning = window('08:30', '12:00', now);
    const selectWindows = jest.fn(() => [midday, morning, lowerRankedMorning]);
    const result = selectBeachDayWindows({
      ...options(now), rowLiveness: 'until-next-row',
      selectWindows: selectWindows as unknown as typeof selectBestWindows,
    });

    expect(result.dayparts.morning).toMatchObject(morning);
    expect(result.dayparts.morning!.peakTime).toBe(morning.peakTime);
    expect(result.dayparts.morning!.end.getTime()).toBeGreaterThan(time(now).getTime());
    expect(result.dayparts.midday).toMatchObject(midday);
    expect(result.dayparts.midday).not.toBe(result.dayparts.morning);
    expect(result.bestDayWindow).toBe(result.dayparts.midday);
    expect(result.dayparts.evening).toBeNull();
    expect(selectWindows).toHaveBeenCalledTimes(1);
  });

  it('keeps a lone still-open morning window out of midday at 11:30', () => {
    const morning = window('08:00', '12:00', '11:30');
    const result = selectBeachDayWindows({
      ...options('11:30'), rowLiveness: 'until-next-row',
      selectWindows: jest.fn(() => [morning]) as unknown as typeof selectBestWindows,
    });

    expect(result.dayparts.morning).toMatchObject({
      ...morning, peakTime: time('11:30'), displayWindowStart: time('09:30'),
    });
    expect(result.dayparts.midday).toBeNull();
    expect(result.dayparts.evening).toBeNull();
  });

  it.each([undefined, 'default'] as const)('preserves the main peak-based assignment at 08:05 (mode %s)', (rowLiveness) => {
    const result = selectBeachDayWindows({ ...options('08:05'), rowLiveness });

    expect(result.dayparts.morning).toBeNull();
    expect(result.dayparts.midday).toMatchObject({
      start: time('08:00'), end: time('12:00'), peakTime: time('11:00'),
      displayWindowStart: time('09:30'), displayWindowEnd: time('12:00'),
    });
    expect(result.bestDayWindow).toBe(result.dayparts.midday);
  });

  it('uses the display start when the display band crosses from a morning raw start into midday', () => {
    const rawWindow = { ...window('08:00', '14:00', '09:16'), peakTime: time('11:30') };
    const result = selectBeachDayWindows({
      ...options('09:16'), rowLiveness: 'until-next-row',
      selectWindows: jest.fn(() => [rawWindow]) as unknown as typeof selectBestWindows,
    });

    expect(result.dayparts.morning).toBeNull();
    expect(result.dayparts.midday).toMatchObject({
      ...rawWindow, displayWindowStart: time('10:15'), displayWindowEnd: time('12:45'),
    });
  });

  it('uses the sunrise-clamped display start even when the raw start is in morning', () => {
    const rawWindow = { ...window('08:00', '14:00', '07:55'), peakTime: time('11:00') };
    const result = selectBeachDayWindows({
      ...options('07:55'), rowLiveness: 'until-next-row',
      sunTimesCache: new Map([[beach.id, { sunrises: [time('10:30')], sunsets: [time('18:30')] }]]),
      selectWindows: jest.fn(() => [rawWindow]) as unknown as typeof selectBestWindows,
    });

    expect(result.dayparts.morning).toBeNull();
    expect(result.dayparts.midday).toMatchObject({
      ...rawWindow, displayWindowStart: time('10:00'), displayWindowEnd: time('12:30'),
    });
  });

  it.each([
    ['09:59', '10:01', 'morning'],
    ['10:00', '10:02', 'midday'],
    ['13:59', '14:01', 'midday'],
    ['14:00', '14:02', 'evening'],
  ] as const)('keeps the existing boundary for a display start at %s', (start, end, bucket) => {
    const rawWindow = window(start, end, '07:55');
    const result = selectBeachDayWindows({
      ...options('07:55'), rowLiveness: 'until-next-row',
      selectWindows: jest.fn(() => [rawWindow]) as unknown as typeof selectBestWindows,
    });

    expect(result.dayparts[bucket]).toMatchObject({ ...rawWindow, displayWindowStart: time(start) });
    expect(Object.values(result.dayparts).filter(Boolean)).toHaveLength(1);
  });
});
