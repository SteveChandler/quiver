/** @jest-environment node */
import { createHash } from 'node:crypto';
import { selectBeachDayWindows, daypartForTime } from '@/lib/services/discovery/window-authority';
import { selectBestWindows } from '@/lib/services/discovery/window-selector/window-selector-core';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';
import { scoreWindowForSelection } from '@/lib/services/discovery/window-selector/window-scorer';
import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const threeHourly = ['05:00', '08:00', '11:00', '14:00'];
const hourly = Array.from({ length: 13 }, (_, i) => `${String(i + 5).padStart(2, '0')}:00`);
const profiles = [
  { name: 'flat', hours: threeHourly, scores: [70, 70, 70, 70] },
  { name: 'flat after dawn', hours: threeHourly, scores: [0, 70, 70, 70] },
  { name: 'morning peak', hours: threeHourly, scores: [0, 90, 70, 70] },
  { name: 'midday peak', hours: [...threeHourly, '17:00'], scores: [45, 60, 90, 60, 45] },
  { name: 'hourly noon peak', hours: hourly, scores: [40, 55, 60, 62, 65, 70, 80, 92, 80, 70, 60, 55, 50] },
  { name: 'display crosses midday', hours: hourly, scores: [30, 30, 30, 30, 80, 70, 75, 85, 40, 40, 40, 40, 40] },
];
const clocks = ['07:55', '08:05', '08:50', '09:16', '10:30', '11:30', '12:30', '14:10'];

describe.each(['Pacific/Honolulu', 'America/Los_Angeles'])('Week Scout dayparts in %s', (timezone) => {
  const localDate = '2026-10-16';
  const time = (value: string): Date => localDateTimeToUTC(localDate, `${value}:00`, timezone);
  const beach = { id: 'daypart-beach', name: 'Daypart Beach', timezone } as Beach;

  // Real native scoring: wave fit supplies the variable points, without tides
  // that would replace score-driven session bounds with tide-driven bounds.
  function rows(hours: string[], scores: number[]): EnhancedForecastEntity[] {
    return hours.map((value, index) => {
      const score = scores[index];
      const row = {
        id: `row-${value}`, beach_id: beach.id, forecast_at: time(value).toISOString(),
        wave_height: score === 0 ? '0' : String(1 + (score - (score >= 52 ? 52 : 7)) / 18),
        wave_period: score >= 52 ? '13s' : '0s',
        wind_speed: score >= 52 ? '0' : '14', wind_direction: 'E',
        confidence_score: 82, data_source: 'NOAA_NWS',
      } as EnhancedForecastEntity;
      expect(scoreWindowForSelection(row, beach)).toBe(score);
      return row;
    });
  }

  function options(profile: typeof profiles[number], now: string): WindowSelectorOptions & { localDate: string } {
    return {
      beach, forecasts: rows(profile.hours, profile.scores), userPrefs: null, localDate,
      now: time(now), sunTimesCache: new Map([[beach.id, {
        sunrises: [time('06:30')], sunsets: [time('18:30')],
      }]]),
    };
  }

  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(time('09:16')); });
  afterEach(() => { jest.useRealTimers(); });

  it.each([0, 1].flatMap((profile) => ['08:50', '09:16', '10:30'].map((now) => ({ profile, now }))))(
    'selects flat profile $profile independently at $now', ({ profile, now }) => {
      const result = selectBeachDayWindows({ ...options(profiles[profile], now), rowLiveness: 'until-next-row' });
      expect(result.dayparts.morning).toMatchObject({ start: time('08:00'), end: time('12:00') });
      expect(result.dayparts.midday).toMatchObject({ start: time('11:00'), end: time('15:00') });
      expect(result.dayparts.evening).toMatchObject({ start: time('14:00'), end: time('18:00') });
      expect(result.bestDayWindow).toBe(result.dayparts.midday);
    },
  );

  it.each([0, 3])('keeps both midday and evening at 12:30 (profile %s)', (profile) => {
    const result = selectBeachDayWindows({ ...options(profiles[profile], '12:30'), rowLiveness: 'until-next-row' });
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00') });
    expect(result.dayparts.evening).toMatchObject({ start: time('14:00'), end: time('18:00') });
  });

  it('retains a morning session on the hourly noon-peak grid at 09:16', () => {
    const result = selectBeachDayWindows({ ...options(profiles[4], '09:16'), rowLiveness: 'until-next-row' });
    expect(result.dayparts.morning).toMatchObject({ start: time('09:00') });
  });

  it.each(['07:55', '08:05', '08:50', '09:16'])(
    'buckets the 09:00–12:45 raw session in morning despite its 10:15 display start at %s', (now) => {
      const result = selectBeachDayWindows({ ...options(profiles[5], now), rowLiveness: 'until-next-row' });
      expect(result.dayparts.morning).toMatchObject({
        start: time('09:00'), end: time('12:45'), peakTime: new Date(time('11:40').getTime() + 54_545),
        displayWindowStart: time('10:15'), displayWindowEnd: time('12:45'),
      });
    },
  );

  it.each(['07:55', '08:05', '09:16'])('keeps the 08:00 peak-profile window in morning at %s', (now) => {
    const result = selectBeachDayWindows({ ...options(profiles[2], now), rowLiveness: 'until-next-row' });
    expect(result.dayparts.morning).toMatchObject({ start: time('08:00'), end: time('12:00') });
    expect(result.dayparts.morning!.peakTime).toEqual(time(now === '07:55' ? '08:30' : '11:00'));
    expect(result.bestDayWindow).toBe(result.dayparts.morning);
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00') });
  });

  it('never duplicates a session or returns an ended session across the complete probe matrix', () => {
    for (const profile of profiles) {
      for (const now of clocks) {
        const result = selectBeachDayWindows({ ...options(profile, now), rowLiveness: 'until-next-row' });
        const windows = Object.values(result.dayparts).filter((window) => window !== null);
        expect(new Set(windows.map((window) => `${window.start.toISOString()}/${window.end.toISOString()}`)).size)
          .toBe(windows.length);
        for (const [bucket, window] of Object.entries(result.dayparts)) {
          if (!window) continue;
          expect(daypartForTime(window.start, timezone)).toBe(bucket);
          expect(window.end.getTime()).toBeGreaterThan(time(now).getTime());
          expect(window.displayWindowEnd.getTime()).toBeGreaterThan(time(now).getTime());
        }
      }
    }
  });

  // SHA-256 pins include every response field, generated with the origin/main
  // authority, selector and daylight sources (not the opt-in implementation).
  it('pins complete default selector and authority output to origin/main across all probe grids', () => {
    const outputs = profiles.flatMap((profile) => clocks.map((now) => {
      const args = options(profile, now);
      const selector = selectBestWindows({ ...args, maxWindows: 6 });
      const authority = selectBeachDayWindows(args);
      expect(selectBestWindows({ ...args, maxWindows: 6, rowLiveness: 'default' })).toEqual(selector);
      expect(selectBeachDayWindows({ ...args, rowLiveness: 'default' })).toEqual(authority);
      return { selector, authority };
    }));
    expect(createHash('sha256').update(JSON.stringify(outputs)).digest('hex')).toBe(
      timezone === 'Pacific/Honolulu' ? 'd0722cf2e05c90f71702032b869af55c7f495f4244920a4ad19e3ecaf56d812b' : 'ed1d81f3b2f41f69392137783781d033c28153515892182dc6b42332f27cd2a2',
    );
  });

  it('selects a below-floor morning fallback without borrowing midday and keeps the selector ranking', () => {
    const result = selectBeachDayWindows({
      ...options({ name: 'fallback', hours: threeHourly, scores: [0, 30, 70, 40] }, '09:16'),
      rowLiveness: 'until-next-row',
    });
    expect(result.dayparts.morning).toMatchObject({ start: time('08:00'), end: time('12:00') });
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00') });
    expect(result.dayparts.evening).toMatchObject({ start: time('14:00') });
    expect(result.bestDayWindow).toBe(result.dayparts.midday);
  });

  it('ignores candidate-scoping hooks in default mode', () => {
    const args = options(profiles[0], '09:16');
    const onWindowRanked = jest.fn();
    expect(selectBestWindows({ ...args, acceptWindowStart: () => false, onWindowRanked }))
      .toEqual(selectBestWindows(args));
    expect(onWindowRanked).not.toHaveBeenCalled();
  });

  it.each([
    { scores: [74, 70], winner: '11:00' },
    { scores: [78, 70], winner: '08:00' },
  ])('underway +4 alone cannot promote an extended row: $scores', ({ scores, winner }) => {
    const args = { ...options({ name: 'bonus', hours: ['08:00', '11:00'], scores }, '09:16'), maxWindows: 1 };
    expect(selectBestWindows({ ...args, rowLiveness: 'until-next-row' })[0]?.start).toEqual(time(winner));
    expect(selectBeachDayWindows({ ...args, rowLiveness: 'until-next-row' }).bestDayWindow?.start).toEqual(time(winner));
  });

  it('expires the 08:00 row across a five-hour gap at 11:30 without a dawn-patrol cap', () => {
    const args = options({ name: 'gap', hours: ['03:00', '08:00', '13:00'], scores: [0, 90, 50] }, '11:30');
    expect(selectBestWindows({ ...args, rowLiveness: 'until-next-row' })[0]?.start).toEqual(time('13:00'));
    expect(selectBeachDayWindows({ ...args, rowLiveness: 'until-next-row' }).dayparts.morning).toBeNull();
  });
});
