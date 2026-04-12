import { isAfterSunset, buildRestOfToday } from '@/lib/services/discovery/evening-transition';

describe('isAfterSunset', () => {
  it('returns true when current time is past sunset', () => {
    const now = new Date('2026-04-11T03:30:00Z'); // 8:30pm PDT
    const sunTimesCache = new Map([
      ['beach-1', { sunrises: [new Date('2026-04-11T13:30:00Z')], sunsets: [new Date('2026-04-11T02:45:00Z')] }],
    ]);
    expect(isAfterSunset('beach-1', now, sunTimesCache)).toBe(true);
  });

  it('returns false when current time is before sunset', () => {
    const now = new Date('2026-04-11T00:00:00Z'); // 5:00pm PDT
    const sunTimesCache = new Map([
      ['beach-1', { sunrises: [new Date('2026-04-11T13:30:00Z')], sunsets: [new Date('2026-04-11T02:45:00Z')] }],
    ]);
    expect(isAfterSunset('beach-1', now, sunTimesCache)).toBe(false);
  });

  it('returns false when no sunset data available', () => {
    const now = new Date('2026-04-11T03:30:00Z');
    expect(isAfterSunset('beach-1', now, new Map())).toBe(false);
  });
});

describe('buildRestOfToday', () => {
  it('builds summary from remaining window', () => {
    const window = {
      start: new Date('2026-04-11T00:00:00Z'),
      end: new Date('2026-04-11T03:00:00Z'),
      waveHeight: '2-3ft',
      wind: '5 mph offshore',
      tide: '2.1ft Falling',
      wavePeriod: '12s',
      dataSource: 'test',
      confidence: 85,
      timezone: 'America/Los_Angeles',
    };
    const result = buildRestOfToday(window as any, 'America/Los_Angeles');
    expect(result.waveHeight).toBe('2-3ft');
    expect(result.conditions).toContain('5 mph');
  });

  it('returns "Done for today" when no window provided', () => {
    const result = buildRestOfToday(null, 'America/Los_Angeles');
    expect(result.summary).toBe('Done for today');
  });
});
