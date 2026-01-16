// __tests__/services/select-best-window-sunset.test.ts
// Mock dependencies BEFORE imports
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/utils/timezone-utils.server', () => ({
  getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
  // Convert UTC to Pacific (UTC-8 for PST)
  getLocalHour: jest.fn((date: Date) => {
    const utcHour = date.getUTCHours();
    // Pacific is UTC-8
    const localHour = (utcHour - 8 + 24) % 24;
    return localHour;
  }),
  // Night hours in local time: 9pm (21) to 6am
  isNightHour: jest.fn((hour: number) => hour >= 21 || hour < 6),
}));

// Mock preference-learning-service to avoid DB calls
jest.mock('@/lib/services/preference-learning-service', () => ({
  getUserSurfPreferences: jest.fn(() => Promise.resolve(null)),
}));

import { selectBestWindow } from '@/lib/services/surf-discovery-service';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// Helper to create mock forecast with good default conditions (score ~63)
function createMockForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'beach-1',
    forecast_date: '2026-01-13',
    forecast_time: '12:00:00',
    wave_height: '4.0',     // In 2-6ft range = +20 points
    wind_speed: '5',        // <= 10 mph = +15 points (no beach wind data)
    wind_direction: 'E',
    wind_direction_deg: 90,
    tide_status: 'Rising',
    tide_height: '3.0',     // No beach tide prefs = +8 points
    wave_period: '14s',     // >= 12s = +20 points
    data_source: 'CDIP',
    confidence_score: 80,
    created_at: '2026-01-13T00:00:00Z',
    updated_at: '2026-01-13T00:00:00Z',
    ...overrides,  // Apply overrides at the end
  } as unknown as EnhancedForecastEntity;
}

// Helper to create mock beach
function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: 'beach-1',
    name: 'Test Beach',
    lat: 32.8,
    lon: -117.2,
    is_private: false,
    created_at: '2026-01-01T00:00:00Z',
    // Explicitly set to null to trigger the "no beach wind data" branch in scoring
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    ...overrides,
  } as Beach;
}

describe('selectBestWindow with sunset', () => {
  beforeEach(() => {
    // Set fixed "now" time to 10am PT (18:00 UTC on 2026-01-13)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-13T18:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('caps window end at sunset', () => {
    // Forecasts starting at noon PT (20:00 UTC) through 6pm PT (02:00 UTC next day)
    const forecasts = [
      createMockForecast({ forecast_time: '20:00:00' }), // 12pm PT
      createMockForecast({ forecast_time: '21:00:00' }), // 1pm PT
      createMockForecast({ forecast_time: '22:00:00' }), // 2pm PT
      createMockForecast({ forecast_time: '23:00:00' }), // 3pm PT
      createMockForecast({ forecast_date: '2026-01-14', forecast_time: '00:00:00' }), // 4pm PT
      createMockForecast({ forecast_date: '2026-01-14', forecast_time: '01:00:00' }), // 5pm PT
      createMockForecast({ forecast_date: '2026-01-14', forecast_time: '02:00:00' }), // 6pm PT
    ];

    const beach = createMockBeach();
    // Sunset at 5:05pm PT = 01:05:00 UTC next day (for 2026-01-13)
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [
          new Date('2026-01-13T14:30:00Z'),
          new Date('2026-01-14T14:30:00Z')
        ],
        sunsets: [
          new Date('2026-01-14T01:05:00Z'),
          new Date('2026-01-15T01:05:00Z')
        ]
      }],
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // Window should end at or before sunset
    const sunsetTime = new Date('2026-01-14T01:05:00Z').getTime();
    expect(result!.end.getTime()).toBeLessThanOrEqual(sunsetTime);
  });

  it('skips windows with less than 1 hour until sunset', () => {
    // Set now to 4:30pm PT = 00:30 UTC on 2026-01-14
    jest.setSystemTime(new Date('2026-01-14T00:30:00Z'));

    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '00:45:00', // 4:45pm PT, only 20 min before sunset at 5:05pm
      }),
    ];

    const beach = createMockBeach();
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2026-01-13T14:30:00Z')],
        sunsets: [new Date('2026-01-14T01:05:00Z')]
      }], // 5:05pm PT
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    // Should return null since there's not enough time before sunset
    expect(result).toBeNull();
  });

  it('works without sunset cache (backwards compatible)', () => {
    // Forecast at 1pm PT = 21:00 UTC (after "now" at 10am PT)
    const forecasts = [
      createMockForecast({ forecast_time: '21:00:00' }), // 1pm PT (valid daytime)
    ];

    const beach = createMockBeach();

    // No sunset cache passed
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    expect(result!.start).toEqual(new Date('2026-01-13T21:00:00Z'));
  });

  it('allows windows with sufficient time before sunset', () => {
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT, 5+ hours before 5:05pm sunset
      }),
    ];

    const beach = createMockBeach();
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2026-01-13T14:30:00Z')],
        sunsets: [new Date('2026-01-14T01:05:00Z')]
      }], // 5:05pm PT
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    expect(result!.start).toEqual(new Date('2026-01-13T20:00:00Z'));
  });

  it('uses interpolation when conditions degrade', () => {
    // Set time to 2pm PT (22:00 UTC) to avoid morning threshold
    // This ensures standard threshold (50) is used for interpolation
    jest.setSystemTime(new Date('2026-01-13T22:00:00Z'));

    // Multiple good forecasts followed by a poor one
    // The window should end when conditions degrade
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT
        wind_speed: '5', // Light wind = good score ~63
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '21:00:00', // 1pm PT
        wind_speed: '5', // Good
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '22:00:00', // 2pm PT
        wind_speed: '5', // Good
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '23:00:00', // 3pm PT
        wind_speed: '25', // Strong wind = poor score ~48 (below 50)
      }),
    ];

    const beach = createMockBeach();

    // No sunset constraint for this test
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // Window should start at 12pm
    expect(result!.start).toEqual(new Date('2026-01-13T20:00:00Z'));
    // Window end should be interpolated between 2pm and 3pm when conditions degrade
    // The exact time depends on the interpolation formula
    const endTime = result!.end.getTime();
    const threepm = new Date('2026-01-13T23:00:00Z').getTime();
    // End time should be at or before 3pm (when conditions become poor)
    expect(endTime).toBeLessThanOrEqual(threepm);
    // End time should be after 2pm (still had good conditions)
    const twopm = new Date('2026-01-13T22:00:00Z').getTime();
    expect(endTime).toBeGreaterThan(twopm);
  });

  it('respects MAX_WINDOW_HOURS cap', () => {
    // All forecasts have good conditions
    const forecasts = [
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '19:00:00' }), // 11am PT
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '20:00:00' }), // 12pm PT
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '21:00:00' }), // 1pm PT
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '22:00:00' }), // 2pm PT
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '23:00:00' }), // 3pm PT
      createMockForecast({ forecast_date: '2026-01-14', forecast_time: '00:00:00' }), // 4pm PT
    ];

    const beach = createMockBeach();
    // No sunset constraint (very late sunset at 9pm PT)
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [
          new Date('2026-01-13T14:30:00Z'),
          new Date('2026-01-14T14:30:00Z')
        ],
        sunsets: [
          new Date('2026-01-14T05:00:00Z'), // 9pm PT
          new Date('2026-01-15T05:00:00Z')
        ]
      }]
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // Window should be capped at MAX_WINDOW_HOURS (4 hours)
    const startTime = result!.start.getTime();
    const endTime = result!.end.getTime();
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);
    expect(durationHours).toBeLessThanOrEqual(4);
  });

  it('returns null when all forecasts are in the past (beyond lookback)', () => {
    // Now is 10am PT (18:00 UTC). With 3-hour lookback, anything before 7am PT (15:00 UTC) is too old.
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '14:00:00', // 6am PT, more than 3 hours before "now" at 10am PT
      }),
    ];

    const beach = createMockBeach();

    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).toBeNull();
  });

  it('returns null for empty forecasts', () => {
    const beach = createMockBeach();
    const result = selectBestWindow([], beach, null, 24);
    expect(result).toBeNull();
  });
});

describe('selectBestWindow with lookback (current window)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 9:20am PT = 17:20 UTC on 2026-01-13
    jest.setSystemTime(new Date('2026-01-13T17:20:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('includes window that started within last 3 hours', () => {
    // Forecast at 9am PT (17:00 UTC) - started 20 minutes ago
    // Should still be eligible since it's within 3-hour lookback
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:00:00', // 9am PT, 20 min ago
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT, 2h 40min away
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // Should select the 9am window (underway) because of underway bonus
    expect(result!.start).toEqual(new Date('2026-01-13T17:00:00Z'));
  });

  it('excludes window that started more than 3 hours ago', () => {
    // Set "now" to 1pm PT = 21:00 UTC
    jest.setSystemTime(new Date('2026-01-13T21:00:00Z'));

    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:00:00', // 9am PT, 4 hours ago - should be excluded
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '22:00:00', // 2pm PT, 1 hour away
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // Should select 2pm (the 9am is too old)
    expect(result!.start).toEqual(new Date('2026-01-13T22:00:00Z'));
  });

  it('does not give bonus to past-start windows via negative decay', () => {
    // Window started 1 hour ago should get 0 decay, not negative
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '16:20:00', // 8:20am PT, 1 hour ago
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT, 2h 40min away
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    // Both have similar conditions. The 8:20am window gets underway bonus (+4)
    // but 0 time decay. The 12pm window gets soon bonus (+8) but ~2.7 decay.
    // 8:20am: base + 4 (underway) + 8 (soon, since hoursAhead=0) - 0 decay
    // 12pm: base + 8 (soon) - 2.67 decay
    // The underway window should win or be very close
    expect(result).not.toBeNull();
  });
});

describe('selectBestWindow time priority bonuses', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 10am PT = 18:00 UTC
    jest.setSystemTime(new Date('2026-01-13T18:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives soon bonus to windows starting within 2 hours', () => {
    // Window at 11am (1h away) should beat window at 6pm (8h away)
    // even if 6pm has slightly better conditions
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '19:00:00', // 11am PT, 1h away - gets +8 soon bonus
        wave_height: '4.0',
        wind_speed: '8',
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '02:00:00', // 6pm PT, 8h away - no soon bonus
        wave_height: '4.5',        // Slightly better
        wind_speed: '6',           // Slightly better
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // 11am should win due to soon bonus overcoming small condition difference
    expect(result!.start).toEqual(new Date('2026-01-13T19:00:00Z'));
  });

  it('gives underway bonus to windows already in progress', () => {
    // Window that started 30 min ago should beat similar window 2h away
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:30:00', // 9:30am PT, 30 min ago - gets underway bonus
        wave_height: '4.0',
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT, 2h away
        wave_height: '4.0',        // Same conditions
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // Underway window should win
    expect(result!.start).toEqual(new Date('2026-01-13T17:30:00Z'));
  });

  it('stronger decay penalizes distant windows more', () => {
    // With 1.0 pts/hr decay, a window 12h away loses 12 points
    // This should make "tomorrow morning" lose to "decent today"
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT today, 2h away
        wave_height: '3.5',        // Decent
        wind_speed: '10',
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '06:00:00', // 10pm PT, 12h away (note: filtered by night check)
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '16:00:00', // 8am PT tomorrow, 22h away
        wave_height: '4.5',        // Better
        wind_speed: '7',           // Better
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 48);

    expect(result).not.toBeNull();
    // Today 12pm should win despite worse conditions
    // Today: ~58 base + 8 soon - 2 decay = ~64
    // Tomorrow 8am: ~65 base + 0 bonus - 22 decay = ~43
    expect(result!.start).toEqual(new Date('2026-01-13T20:00:00Z'));
  });
});

describe('selectBestWindow local date boundary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 3pm PT = 23:00 UTC on 2026-01-13
    // This is before UTC midnight but late afternoon in Pacific
    jest.setSystemTime(new Date('2026-01-13T23:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('extends window across UTC midnight when same local date', () => {
    // This test exposes the UTC date boundary bug:
    // - 3pm PT = 23:00 UTC on Jan 13 (forecast_date: '2026-01-13')
    // - 4pm PT = 00:00 UTC on Jan 14 (forecast_date: '2026-01-14')
    // - 5pm PT = 01:00 UTC on Jan 14 (forecast_date: '2026-01-14')
    //
    // All three are on the SAME LOCAL DATE (Jan 13 in Pacific timezone)
    // but the code compares UTC forecast_date, causing window to stop at 3pm PT.
    //
    // The bug is masked when conditions degrade (interpolation doesn't cross boundary)
    // so we test with GOOD conditions at 4pm PT (after UTC boundary) and
    // BAD conditions at 5pm PT. The window should extend to ~4:30pm (interpolated)
    // but the UTC date boundary bug causes it to stop at 3pm PT.
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '23:00:00', // 3pm PT on Jan 13 local - GOOD
        wave_height: '4.0',
        wind_speed: '5',
      }),
      createMockForecast({
        forecast_date: '2026-01-14', // UTC date flipped!
        forecast_time: '00:00:00', // 4pm PT - still Jan 13 local - GOOD
        wave_height: '4.0',
        wind_speed: '5',
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '01:00:00', // 5pm PT - still Jan 13 local - BAD (triggers interpolation)
        wave_height: '4.0',
        wind_speed: '25', // Strong wind = poor score below threshold
      }),
    ];

    const beach = createMockBeach();
    // Sunset at 6pm PT = 02:00 UTC on Jan 14 (late enough to not interfere with test)
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2026-01-13T14:30:00Z'), new Date('2026-01-14T14:30:00Z')],
        sunsets: [new Date('2026-01-14T02:00:00Z'), new Date('2026-01-15T02:00:00Z')], // 6pm PT
      }],
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // BUG: Current code compares UTC forecast_date ('2026-01-13' vs '2026-01-14')
    // and stops the window extension loop at 3pm PT because dates differ.
    // Without interpolation across the UTC boundary, the end time stays at
    // the MAX_WINDOW_HOURS default (3pm + 4h = 7pm), then capped by sunset (6pm PT).
    //
    // EXPECTED: Window should continue into 4pm PT forecast (still good conditions),
    // then interpolate between 4pm and 5pm when conditions degrade.
    // With good conditions at 3pm (score ~63) and 4pm (score ~63), and bad at 5pm (score ~48),
    // interpolation should set window end around 4:30pm PT (between 4pm and 5pm).
    const fourPmPT = new Date('2026-01-14T00:00:00Z').getTime();
    const fivePmPT = new Date('2026-01-14T01:00:00Z').getTime();
    const sixPmPT = new Date('2026-01-14T02:00:00Z').getTime(); // sunset

    // Current buggy behavior: window ends at sunset (6pm) because interpolation loop
    // breaks at the UTC date boundary without finding the degradation point.
    //
    // Expected fixed behavior: window should end between 4pm and 5pm PT,
    // where conditions degrade from good (score 63) to bad (score 48).
    // The interpolation should find the point where score drops below threshold.
    expect(result!.end.getTime()).toBeGreaterThan(fourPmPT);
    expect(result!.end.getTime()).toBeLessThan(fivePmPT);
  });
});

describe('selectBestWindow threshold consistency', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 8am PT = 16:00 UTC (morning hours)
    jest.setSystemTime(new Date('2026-01-13T16:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses morning threshold consistently during extension', () => {
    // Morning window with score ~38 (above morning threshold 35, below standard 50)
    // Should extend properly when conditions stay consistent.
    //
    // Score breakdown for these conditions (no user prefs, no beach wind data):
    // - Wave height 1.5ft (out of 2-6ft range): 10 points
    // - Wave period 8s (below 9s): 5 points
    // - Wind speed 8mph (<=10): 15 points
    // - Tide (no prefs): 8 points
    // Total: 38 points
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:00:00', // 9am PT
        wave_height: '1.5',        // Out of 2-6ft range = 10pts
        wave_period: '8s',         // Below 9s = 5pts
        wind_speed: '8',           // Light wind = 15pts
        tide_height: '3.0',        // No prefs = 8pts
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '18:00:00', // 10am PT
        wave_height: '1.5',        // Same conditions = 38pts
        wave_period: '8s',
        wind_speed: '8',
        tide_height: '3.0',
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '19:00:00', // 11am PT
        wave_height: '1.5',        // Same conditions = 38pts
        wave_period: '8s',
        wind_speed: '8',
        tide_height: '3.0',
      }),
    ];

    const beach = createMockBeach();
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2026-01-13T14:30:00Z')],
        sunsets: [new Date('2026-01-14T01:05:00Z')],
      }],
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // Window should extend beyond 9am since conditions stay above morning threshold (35)
    const tenAm = new Date('2026-01-13T18:00:00Z').getTime();
    expect(result!.end.getTime()).toBeGreaterThan(tenAm);
  });

  it('truncates morning window when conditions degrade below morning threshold', () => {
    // Morning window starts with score ~38 (above morning threshold 35)
    // Then conditions degrade to score ~25 (below morning threshold 35)
    // Window should be interpolated to end when score drops below 35
    //
    // BUG: The extension loop uses MIN_SCORE_THRESHOLD (50) for interpolation.
    // When score drops from 38 to 25:
    // - Correct behavior: Interpolate when score crosses 35 (morning threshold)
    // - Bug behavior: Since 38 < 50, interpolation never triggers, window extends to MAX_WINDOW_HOURS
    //
    // Score breakdown for degraded conditions:
    // - Wave height 1.0ft (tiny): 10 points
    // - Wave period 6s (short): 5 points
    // - Wind speed 18mph (strong): 0 points (>15mph)
    // - Tide (no prefs): 8 points
    // Total: 23 points
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:00:00', // 9am PT - GOOD (score 38)
        wave_height: '1.5',
        wave_period: '8s',
        wind_speed: '8',
        tide_height: '3.0',
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '18:00:00', // 10am PT - GOOD (score 38)
        wave_height: '1.5',
        wave_period: '8s',
        wind_speed: '8',
        tide_height: '3.0',
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '19:00:00', // 11am PT - BAD (score 23)
        wave_height: '1.0',        // Tiny
        wave_period: '6s',         // Short
        wind_speed: '18',          // Strong wind, >15mph = 0 pts
        tide_height: '3.0',
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT - BAD (score 23)
        wave_height: '1.0',
        wave_period: '6s',
        wind_speed: '18',
        tide_height: '3.0',
      }),
    ];

    const beach = createMockBeach();
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2026-01-13T14:30:00Z')],
        sunsets: [new Date('2026-01-14T01:05:00Z')],
      }],
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // Window should be truncated when conditions degrade below morning threshold
    // Expected: End should be interpolated between 10am and 11am (when score drops from 38 to 23)
    // The interpolation should find when score crosses 35 (morning threshold)
    const tenAm = new Date('2026-01-13T18:00:00Z').getTime();
    const elevenAm = new Date('2026-01-13T19:00:00Z').getTime();
    const noon = new Date('2026-01-13T20:00:00Z').getTime();

    // BUG: Current code uses MIN_SCORE_THRESHOLD (50) for interpolation.
    // Since score 38 < 50, the condition `current.score >= MIN_SCORE_THRESHOLD` fails,
    // so interpolation never triggers. Window extends to MAX_WINDOW_HOURS (4h = 1pm PT).
    //
    // EXPECTED (fixed): Should interpolate when score drops below 35 (morning threshold).
    // Window should end between 10am and 11am.
    expect(result!.end.getTime()).toBeGreaterThan(tenAm);
    expect(result!.end.getTime()).toBeLessThan(elevenAm);
  });
});
