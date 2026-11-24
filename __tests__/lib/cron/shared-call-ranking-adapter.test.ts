/** @jest-environment node */

jest.mock('@/lib/services/discovery/week-scout', () => ({
  generateWeekScoutForecastForDays: jest.fn(async () => ({ days: [] })),
  weekScoutDependenciesAt: jest.fn((now: Date) => ({ now })),
}));

import { rankDayWithWeekScout } from '@/lib/cron/daily-call-runner';
import { generateWeekScoutForecastForDays } from '@/lib/services/discovery/week-scout';

it('passes the capped IDs, drive range, preference and anchor to the one-day judge', async () => {
  const result = await rankDayWithWeekScout({
    userId: 'user', poolBeachIds: ['home', 'saved', 'nearby'], driveRadiusMiles: 45,
    timezone: 'America/Los_Angeles', localDate: '2026-10-11', sessionTime: 'morning',
    anchor: { lat: 32.89, lon: -117.25 },
  });
  expect(result).toEqual({ days: [] });
  expect(generateWeekScoutForecastForDays).toHaveBeenCalledWith('user', {
    candidateBeachIds: ['home', 'saved', 'nearby'], driveRadiusMiles: 45,
    localTimezone: 'America/Los_Angeles', startLocalDate: '2026-10-11', dayCount: 1,
    sessionTime: 'morning', userLocation: { lat: 32.89, lon: -117.25 },
  });
});

it('runs the one-day judge on the given clock when one is passed', async () => {
  const now = new Date('2026-11-16T14:00:00.000Z');
  await rankDayWithWeekScout({
    userId: 'user', poolBeachIds: ['home'], driveRadiusMiles: 45,
    timezone: 'America/Los_Angeles', localDate: '2026-11-16', sessionTime: null, anchor: null, now,
  });
  expect(generateWeekScoutForecastForDays).toHaveBeenLastCalledWith('user', expect.objectContaining({
    startLocalDate: '2026-11-16', dayCount: 1,
  }), { now });
});
