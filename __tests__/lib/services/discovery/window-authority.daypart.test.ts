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
  const time = (value: string, date = localDate): Date => localDateTimeToUTC(date, `${value}:00`, timezone);
  const beach = { id: 'daypart-beach', name: 'Daypart Beach', timezone } as Beach;

  // Real native scoring: wave fit supplies the variable points, without tides
  // that would replace score-driven session bounds with tide-driven bounds.
  function rows(hours: string[], scores: number[], date = localDate): EnhancedForecastEntity[] {
    return hours.map((value, index) => {
      const score = scores[index];
      const row = {
        id: `row-${value}`, beach_id: beach.id, forecast_at: time(value, date).toISOString(),
        wave_height: score === 0 ? '0' : String(1 + (score - (score >= 52 ? 52 : 7)) / 18),
        wave_period: score >= 52 ? '13s' : '0s',
        wind_speed: score >= 52 ? '0' : '14', wind_direction: 'E',
        confidence_score: 82, data_source: 'NOAA_NWS',
      } as EnhancedForecastEntity;
      expect(scoreWindowForSelection(row, beach)).toBe(score);
      return row;
    });
  }

  function options(profile: typeof profiles[number], now: string, date = localDate): WindowSelectorOptions & { localDate: string } {
    return {
      beach, forecasts: rows(profile.hours, profile.scores, date), userPrefs: null, localDate: date,
      now: time(now), sunTimesCache: new Map([[beach.id, {
        sunrises: [time('06:30', date)], sunsets: [time('18:30', date)],
      }]]),
    };
  }

  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(time('09:16')); });
  afterEach(() => { jest.useRealTimers(); });

  it.each([0, 1].flatMap((profile) => ['08:50', '09:16', '10:29'].map((now) => ({ profile, now }))))(
    'selects flat profile $profile independently at $now', ({ profile, now }) => {
      const result = selectBeachDayWindows({ ...options(profiles[profile], now), rowLiveness: 'until-next-row' });
      expect(result.dayparts.morning).toMatchObject({
        start: time('08:00'), end: time('12:00'),
        displayWindowStart: time('08:00'), displayWindowEnd: time('10:30'),
      });
      expect(result.dayparts.midday).toMatchObject({ start: time('11:00'), end: time('15:00') });
      expect(result.dayparts.evening).toMatchObject({ start: time('14:00'), end: time('18:00') });
      expect(result.bestDayWindow).toBe(result.dayparts.midday);
    },
  );

  it.each([0, 1])('drops flat profile %s morning once its 08:00–10:30 band has ended', (profile) => {
    const result = selectBeachDayWindows({ ...options(profiles[profile], '10:30'), rowLiveness: 'until-next-row' });
    expect(result.dayparts.morning).toBeNull();
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00'), end: time('15:00') });
    expect(result.dayparts.evening).toMatchObject({ start: time('14:00'), end: time('18:00') });
    expect(result.bestDayWindow).toBe(result.dayparts.midday);
  });

  it('keeps both flat-score midday and evening at 12:30', () => {
    const result = selectBeachDayWindows({ ...options(profiles[0], '12:30'), rowLiveness: 'until-next-row' });
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00') });
    expect(result.dayparts.evening).toMatchObject({ start: time('14:00'), end: time('18:00') });
  });

  it('does not extend a short above-floor evening candidate via fallback when midday qualifies', () => {
    const args = options(profiles[3], '12:30');
    // Main has no other candidate and falls back to 14:00–18:00. The extended
    // 11:00 candidate is live in Week Scout, so whole-day fallback is suppressed.
    expect(selectBeachDayWindows(args).dayparts.evening)
      .toMatchObject({ start: time('14:00'), end: time('18:00') });
    const result = selectBeachDayWindows({ ...args, rowLiveness: 'until-next-row' });
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00'), end: time('14:30') });
    expect(result.dayparts.evening).toBeNull();
    expect(result.bestDayWindow).toBe(result.dayparts.midday);
  });

  it('retains a morning session on the hourly noon-peak grid at 09:16', () => {
    const result = selectBeachDayWindows({ ...options(profiles[4], '09:16'), rowLiveness: 'until-next-row' });
    expect(result.dayparts.morning).toMatchObject({ start: time('09:00') });
  });

  it.each(['07:55', '08:05', '08:50', '09:16'])(
    'shows the 09:00–12:45 morning session on morning hours from the 09:00 row at %s', (now) => {
      const result = selectBeachDayWindows({ ...options(profiles[5], now), rowLiveness: 'until-next-row' });
      expect(result.dayparts.morning).toMatchObject({
        start: time('09:00'), end: time('12:45'), peakTime: time(now === '09:16' ? '09:16' : '09:20'),
        displayWindowStart: time('09:00'), displayWindowEnd: time('11:30'),
        sourceForecast: expect.objectContaining({ forecast_at: time('09:00').toISOString() }),
      });
      expect(result.dayparts.midday).toMatchObject({
        start: time('12:00'), displayWindowStart: time('12:00'),
        sourceForecast: expect.objectContaining({ forecast_at: time('12:00').toISOString() }),
      });
    },
  );

  it.each(['07:55', '08:05', '09:16'])('keeps the 08:00 peak-profile window in morning at %s', (now) => {
    const result = selectBeachDayWindows({ ...options(profiles[2], now), rowLiveness: 'until-next-row' });
    expect(result.dayparts.morning).toMatchObject({
      start: time('08:00'), end: time('12:00'),
      displayWindowStart: time('08:00'), displayWindowEnd: time('10:30'),
      sourceForecast: expect.objectContaining({ forecast_at: time('08:00').toISOString() }),
    });
    expect(result.dayparts.morning!.peakTime).toEqual(time(now === '07:55' ? '08:30' : now));
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

  it('does not populate below-floor morning or score-10 evening slots when midday qualifies', () => {
    const result = selectBeachDayWindows({
      ...options({ name: 'fallback', hours: threeHourly, scores: [0, 30, 70, 10] }, '09:16'),
      rowLiveness: 'until-next-row',
    });
    expect(result.dayparts.morning).toBeNull();
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00') });
    expect(result.dayparts.evening).toBeNull();
    expect(result.bestDayWindow).toBe(result.dayparts.midday);
  });

  it.each([
    { date: '2026-10-18', scores: [70, 70, 47, 47, 47], sunrise: '06:40', start: '06:10' },
    { date: '2026-10-18', scores: [65, 65, 45, 45, 45], sunrise: '06:30', start: '06:00' },
    { date: '2026-10-17', scores: [60, 60, 45, 45, 45], sunrise: '06:30', start: '06:00' },
    { date: '2026-10-17', scores: [0, 0, 49, 70, 70], sunrise: '06:30', start: '14:00' },
  ].flatMap((profile) => ['09:16', '14:10'].map((now) => ({ ...profile, now }))))(
    'keeps the real future-day winner for $scores on $date at $now', ({ date, scores, sunrise, start, now }) => {
      const args = options({ name: 'future', hours: [...threeHourly, '17:00'], scores }, now, date);
      args.sunTimesCache = new Map([[beach.id, {
        sunrises: [time(sunrise, date)], sunsets: [time('18:30', date)],
      }]]);
      const main = selectBeachDayWindows(args);
      expect(main.bestDayWindow).toMatchObject({ start: time(start, date) });
      const result = selectBeachDayWindows({ ...args, rowLiveness: 'until-next-row' });
      expect(result.bestDayWindow).toEqual(main.bestDayWindow);
      expect(Object.values(result.dayparts).filter((window) => window !== null)).toEqual([result.bestDayWindow]);
      expect(result.dayparts[daypartForTime(time(start, date), timezone)!]).toBe(result.bestDayWindow);
    },
  );

  it.each([10, 30, 47])('falls back once for the whole day when all rows are below the floor (score %s)', (score) => {
    const args = options({ name: 'all below', hours: [...threeHourly, '17:00'], scores: Array(5).fill(score) }, '09:16', '2026-10-18');
    const main = selectBeachDayWindows(args);
    expect(main.bestDayWindow).not.toBeNull();
    expect(selectBeachDayWindows({ ...args, rowLiveness: 'until-next-row' })).toEqual(main);
  });

  it('records the cross-daypart overlap on the real flat-score fixture relative to main', () => {
    const args = options(profiles[0], '07:55');
    const main = selectBeachDayWindows(args);
    const result = selectBeachDayWindows({ ...args, rowLiveness: 'until-next-row' });
    const overlaps = (windows: typeof main.dayparts): boolean => {
      const selected = Object.values(windows).filter((window) => window !== null);
      return selected.some((window, index) => selected.slice(index + 1).some((other) => (
        window.start < other.end && other.start < window.end
      )));
    };
    expect(overlaps(main.dayparts)).toBe(false);
    expect(overlaps(result.dayparts)).toBe(true);
    expect(result.dayparts.morning).toMatchObject({ start: time('08:00'), end: time('12:00') });
    expect(result.dayparts.midday).toMatchObject({ start: time('11:00'), end: time('15:00') });
  });

  it('ignores candidate-scoping hooks in default mode', () => {
    const args = options(profiles[0], '09:16');
    const onWindowRanked = jest.fn();
    expect(selectBestWindows({ ...args, acceptWindowStart: () => false, onWindowRanked }))
      .toEqual(selectBestWindows(args));
    expect(onWindowRanked).not.toHaveBeenCalled();
  });

  it('keeps default fallback enabled even when internal Week Scout options are supplied', () => {
    const args = options({ name: 'below floor', hours: threeHourly, scores: [30, 30, 30, 30] }, '07:55');
    const expected = selectBestWindows(args);
    expect(expected).toHaveLength(1);
    expect(selectBestWindows({ ...args, disableBelowFloorFallback: true, forecastPreparationCache: new Map() }))
      .toEqual(expected);
    expect(selectBestWindows({ ...args, rowLiveness: 'until-next-row', disableBelowFloorFallback: true }))
      .toEqual([]);
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
