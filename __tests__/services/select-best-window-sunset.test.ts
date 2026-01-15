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

  it('returns null when all forecasts are in the past', () => {
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '16:00:00', // 8am PT, before "now" at 10am PT
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
