import { isAfterSunset, buildRestOfToday } from '@/lib/services/discovery/evening-transition';

describe('isAfterSunset', () => {
  // Anchor: San Diego ~April 2026. Sunrise ~6:20 AM PDT, sunset ~7:30 PM PDT.
  //   2026-04-14 sunrise UTC: 13:22Z   (6:22 AM PDT)
  //   2026-04-14 sunset  UTC: 02:30Z+1 (7:30 PM PDT → stored as 2026-04-15T02:30:00Z)
  //   2026-04-15 sunrise UTC: 13:21Z   (6:21 AM PDT)
  //   2026-04-15 sunset  UTC: 02:31Z+1 (7:31 PM PDT → stored as 2026-04-16T02:31:00Z)
  const sunrises = [
    new Date('2026-04-14T13:22:00Z'),
    new Date('2026-04-15T13:21:00Z'),
  ];
  const sunsets = [
    new Date('2026-04-15T02:30:00Z'),
    new Date('2026-04-16T02:31:00Z'),
  ];

  function cache() {
    return new Map([['beach-1', { sunrises, sunsets }]]);
  }

  it('returns true between sunset and midnight', () => {
    // 2026-04-14 8:00 PM PDT = 2026-04-15T03:00:00Z (past sunset 02:30Z)
    const now = new Date('2026-04-15T03:00:00Z');
    expect(isAfterSunset('beach-1', now, cache())).toBe(true);
  });

  it('returns true in the pre-dawn hours (last event was sunset)', () => {
    // 2026-04-15 3:00 AM PDT = 2026-04-15T10:00:00Z (past sunset, pre-sunrise)
    const now = new Date('2026-04-15T10:00:00Z');
    expect(isAfterSunset('beach-1', now, cache())).toBe(true);
  });

  it('returns false at 6:31 AM after sunrise (regression: no more "Rest of Today" in the morning)', () => {
    // 2026-04-15 6:31 AM PDT = 2026-04-15T13:31:00Z
    // Yesterday's sunset (02:30Z, ~11h ago) would trip the old 12h heuristic.
    // Today's sunrise at 13:21Z is 10 min before now — last event was a sunrise,
    // so it's morning, not night.
    const now = new Date('2026-04-15T13:31:00Z');
    expect(isAfterSunset('beach-1', now, cache())).toBe(false);
  });

  it('returns false in the afternoon', () => {
    // 2026-04-15 2:00 PM PDT = 2026-04-15T21:00:00Z
    const now = new Date('2026-04-15T21:00:00Z');
    expect(isAfterSunset('beach-1', now, cache())).toBe(false);
  });

  it('returns false when no sunset data available', () => {
    const now = new Date('2026-04-15T03:30:00Z');
    expect(isAfterSunset('beach-1', now, new Map())).toBe(false);
  });

  it('returns false when the only sunsets are in the future', () => {
    const now = new Date('2026-04-14T00:00:00Z'); // before any cached sunset
    const futureOnly = new Map([
      ['beach-1', { sunrises, sunsets }],
    ]);
    expect(isAfterSunset('beach-1', now, futureOnly)).toBe(false);
  });
});

describe('buildRestOfToday', () => {
  const tz = 'America/Los_Angeles';

  function makeWindow(startIso: string, peakIso?: string) {
    return {
      start: new Date(startIso),
      end: new Date(new Date(startIso).getTime() + 3 * 60 * 60 * 1000),
      peakTime: peakIso ? new Date(peakIso) : undefined,
      waveHeight: '2-3ft',
      wind: '5 mph offshore',
      tide: '2.1ft Falling',
      wavePeriod: '12s',
      dataSource: 'test',
      confidence: 85,
      timezone: tz,
    };
  }

  it('returns "Done for today" when no window provided', () => {
    const result = buildRestOfToday(null, tz);
    expect(result.summary).toBe('Done for today');
  });

  it('labels an 8am window as "Morning session"', () => {
    // 2026-04-15 8:00 AM PDT = 2026-04-15T15:00:00Z
    const w = makeWindow('2026-04-15T15:00:00Z');
    expect(buildRestOfToday(w as never, tz).summary).toBe('Morning session');
  });

  it('labels a 6am window as "Dawn patrol"', () => {
    // 2026-04-15 6:00 AM PDT = 2026-04-15T13:00:00Z
    const w = makeWindow('2026-04-15T13:00:00Z');
    expect(buildRestOfToday(w as never, tz).summary).toBe('Dawn patrol');
  });

  it('labels a noon window as "Midday session"', () => {
    // 2026-04-15 12:00 PM PDT = 2026-04-15T19:00:00Z
    const w = makeWindow('2026-04-15T19:00:00Z');
    expect(buildRestOfToday(w as never, tz).summary).toBe('Midday session');
  });

  it('labels a 3pm window as "Afternoon session"', () => {
    // 2026-04-15 3:00 PM PDT = 2026-04-15T22:00:00Z
    const w = makeWindow('2026-04-15T22:00:00Z');
    expect(buildRestOfToday(w as never, tz).summary).toBe('Afternoon session');
  });

  it('labels a 6pm window as "Evening session"', () => {
    // 2026-04-15 6:00 PM PDT = 2026-04-16T01:00:00Z
    const w = makeWindow('2026-04-16T01:00:00Z');
    expect(buildRestOfToday(w as never, tz).summary).toBe('Evening session');
  });

  it('prefers peakTime over start when labeling', () => {
    // Window starts at 5am (Dawn patrol) but peaks at 9am (Morning session)
    const w = makeWindow('2026-04-15T12:00:00Z', '2026-04-15T16:00:00Z');
    expect(buildRestOfToday(w as never, tz).summary).toBe('Morning session');
  });

  it('includes wind and tide in the conditions line', () => {
    const w = makeWindow('2026-04-15T15:00:00Z');
    const result = buildRestOfToday(w as never, tz);
    expect(result.waveHeight).toBe('2-3ft');
    expect(result.conditions).toContain('5 mph');
    expect(result.conditions).toContain('Falling');
  });
});
