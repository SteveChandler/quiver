/** @jest-environment node */

jest.mock('@/lib/services/discovery/week-scout', () => ({
  generateWeekScoutForecastForDays: jest.fn(async () => ({ days: [] })),
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
