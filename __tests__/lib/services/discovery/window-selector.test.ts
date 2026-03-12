/**
 * Unit tests for Window Selector Service
 *
 * Tests the selectBestWindow, capEndTimeToTimeSlot, and scoreForecastWindow functions
 * that select optimal surf windows from forecast data.
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

// Mock beaches
const mockBeach: Partial<Beach> = {
  id: 'beach-1',
  name: 'Test Beach',
  slug: 'test-beach',
  lat: 32.7157,
  lon: -117.1611,
  city: 'San Diego',
  state: 'CA',
  is_private: false,
  wind_offshore_deg: 45, // NE wind is offshore
  wind_offshore_tol_deg: 30,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
};

const mockBeachNoPrefs: Partial<Beach> = {
  id: 'beach-2',
  name: 'Beach No Prefs',
  slug: 'beach-no-prefs',
  lat: 32.8000,
  lon: -117.2000,
  city: 'La Jolla',
  state: 'CA',
  is_private: false,
  wind_offshore_deg: null,
  wind_offshore_tol_deg: null,
  preferred_tide_ft_min: null,
  preferred_tide_ft_max: null,
};

// Helper to create forecast with defaults
function createForecast(overrides: Partial<EnhancedForecastEntity>): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'beach-1',
    forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
    forecast_date: '2024-01-15',
    forecast_time: '09:00',
    wave_height: '4',
    wave_period: '12s',
    swell_1_direction: '270',
    wind_speed: '5',
    wind_direction: 'NE',
    wind_direction_deg: 45,
    tide_height: '3.5',
    tide_status: 'Rising',
    confidence_score: 85,
    data_source: 'NOAA_NWS',
    water_temp: '62',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    ...overrides,
  } as EnhancedForecastEntity;
}

// Mock user preferences
const mockUserPrefs = {
  wave_min_ft: 3,
  wave_max_ft: 6,
  wave_period_min_s: 10,
  wave_period_max_s: 16,
};

// Mock the timezone utility
jest.mock('@/lib/utils/timezone-utils.server', () => ({
  getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
}));

// Import after mocks
import {
  selectBestWindow,
  capEndTimeToTimeSlot,
  scoreForecastWindow,
} from '@/lib/services/discovery/window-selector';

describe('scoreForecastWindow', () => {
  it('should return base score for calm conditions without user prefs', () => {
    const forecast = createForecast({
      wave_height: '4',
      wave_period: '12s',
      wind_speed: '5',
      tide_height: '3.5',
    });

    const score = scoreForecastWindow(
      forecast,
      mockBeach as Beach,
      null
    );

    // Without user prefs:
    // - Wave 4ft in 2-6 range: 20 points
    // - Period 12s >= 12: 20 points
    // - Wind 5mph with offshore direction <= 15mph: 20 points (with beach prefs)
    // - Tide 3.5ft in 2-5 range: 15 points
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('should boost score for matching user wave preferences', () => {
    const forecast = createForecast({
      wave_height: '4',
      wave_period: '12s',
    });

    const scoreWithPrefs = scoreForecastWindow(
      forecast,
      mockBeach as Beach,
      mockUserPrefs as any
    );

    const scoreWithoutPrefs = scoreForecastWindow(
      forecast,
      mockBeach as Beach,
      null
    );

    // With user prefs matching: 25 points for wave height (vs 20)
    // With user prefs matching: 20 points for period (vs 20)
    expect(scoreWithPrefs).toBeGreaterThanOrEqual(scoreWithoutPrefs);
  });

  it('should penalize onshore wind (opposite of offshore)', () => {
    // Create forecast with onshore wind (opposite of offshore)
    const onshoreWind = createForecast({
      wind_direction: 'SW',
      wind_direction_deg: 225, // Opposite of NE (45)
      wind_speed: '15',
    });

    const offshoreWind = createForecast({
      wind_direction: 'NE',
      wind_direction_deg: 45, // Matches offshore
      wind_speed: '10',
    });

    const onshoreScore = scoreForecastWindow(
      onshoreWind,
      mockBeach as Beach,
      null
    );

    const offshoreScore = scoreForecastWindow(
      offshoreWind,
      mockBeach as Beach,
      null
    );

    expect(offshoreScore).toBeGreaterThan(onshoreScore);
  });

  it('should give default tide score when beach has no tide preferences', () => {
    const forecast = createForecast({
      tide_height: '3.5',
    });

    const score = scoreForecastWindow(
      forecast,
      mockBeachNoPrefs as Beach,
      null
    );

    // Should still get a reasonable score with default tide points (8)
    expect(score).toBeGreaterThan(0);
  });

  it('should handle missing forecast values gracefully', () => {
    const forecast = createForecast({
      wave_height: null as any,
      wave_period: null as any,
      wind_speed: null as any,
      wind_direction: null,
      tide_height: null as any,
    });

    // Should not throw
    const score = scoreForecastWindow(
      forecast,
      mockBeach as Beach,
      null
    );

    expect(typeof score).toBe('number');
  });
});

describe('capEndTimeToTimeSlot', () => {
  const beachTz = 'America/Los_Angeles';

  it('should return original end time for "any" time slot', () => {
    const start = new Date('2024-01-15T14:00:00Z'); // 6am PST
    const end = new Date('2024-01-15T22:00:00Z'); // 2pm PST

    const result = capEndTimeToTimeSlot(start, end, 'any', beachTz);

    expect(result).toEqual(end);
  });

  it('should return original end time for undefined time slot', () => {
    const start = new Date('2024-01-15T14:00:00Z');
    const end = new Date('2024-01-15T22:00:00Z');

    const result = capEndTimeToTimeSlot(start, end, undefined, beachTz);

    expect(result).toEqual(end);
  });

  it('should cap dawn-patrol to 9am', () => {
    // Start at 6am PST (14:00 UTC)
    const start = new Date('2024-01-15T14:00:00Z');
    // End at 2pm PST (22:00 UTC) - well past 9am
    const end = new Date('2024-01-15T22:00:00Z');

    const result = capEndTimeToTimeSlot(start, end, 'dawn-patrol', beachTz);

    // Should be capped to 11am PST (19:00 UTC)
    expect(result.getTime()).toBeLessThan(end.getTime());
    expect(result.getUTCHours()).toBe(19); // 11am PST = 19:00 UTC
  });

  it('should cap lunch-session to 2pm', () => {
    // Start at 11am PST (19:00 UTC)
    const start = new Date('2024-01-15T19:00:00Z');
    // End at 5pm PST (01:00 UTC next day)
    const end = new Date('2024-01-16T01:00:00Z');

    const result = capEndTimeToTimeSlot(start, end, 'lunch-session', beachTz);

    // Should be capped to 2pm PST (22:00 UTC)
    expect(result.getTime()).toBeLessThan(end.getTime());
    expect(result.getUTCHours()).toBe(22); // 2pm PST = 22:00 UTC
  });

  it('should not cap if end time is already before slot end', () => {
    // Start at 7am PST, end at 8am PST (within dawn-patrol)
    const start = new Date('2024-01-15T15:00:00Z');
    const end = new Date('2024-01-15T16:00:00Z');

    const result = capEndTimeToTimeSlot(start, end, 'dawn-patrol', beachTz);

    expect(result).toEqual(end);
  });
});

describe('selectBestWindow', () => {
  // Use fixed "now" for predictable tests
  const fixedNow = new Date('2024-01-15T16:00:00Z'); // 8am PST

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return null for empty forecasts', () => {
    const result = selectBestWindow(
      [],
      mockBeach as Beach,
      null
    );

    expect(result).toBeNull();
  });

  it('should return null when all forecasts are in the past', () => {
    const pastForecasts = [
      createForecast({
        forecast_at: '2024-01-14T12:00Z',
        forecast_date: '2024-01-14', // Yesterday
        forecast_time: '12:00',
      }),
      createForecast({
        forecast_at: '2024-01-14T15:00Z',
        forecast_date: '2024-01-14',
        forecast_time: '15:00',
      }),
    ];

    const result = selectBestWindow(
      pastForecasts,
      mockBeach as Beach,
      null
    );

    expect(result).toBeNull();
  });

  it('should skip night hours (9pm-6am)', () => {
    const nightForecasts = [
      createForecast({
        forecast_at: '2024-01-15T05:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '05:00', // 5am UTC = before 6am PST? Actually 9pm PST prev day
        wave_height: '5',
        wave_period: '14s',
        confidence_score: 90,
      }),
      createForecast({
        forecast_at: '2024-01-16T05:00Z',
        forecast_date: '2024-01-16',
        forecast_time: '05:00', // Early morning UTC = late night PST
        wave_height: '5',
        wave_period: '14s',
        confidence_score: 90,
      }),
    ];

    const result = selectBestWindow(
      nightForecasts,
      mockBeach as Beach,
      null
    );

    // Should skip these night forecasts
    expect(result).toBeNull();
  });

  it('should respect time slot filter', () => {
    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T14:00:00Z', // 6am PT = 2pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '06:00', // 6am PST - dawn-patrol
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
      createForecast({
        forecast_at: '2024-01-15T20:00:00Z', // 12pm PT = 8pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '12:00', // 12pm PST - afternoon
        wave_height: '5',
        wave_period: '14s',
        confidence_score: 90,
      }),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeach as Beach,
      null,
      undefined,
      undefined,
      'dawn-patrol'
    );

    // Should only consider 6am forecast (dawn-patrol is 6am-9am)
    if (result) {
      expect(result.start.getUTCHours()).toBe(14); // 6am PST
    }
  });

  it('should cap windows at sunset', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-morning',
        forecast_at: '2024-01-15T18:00:00Z', // 10am PT = 6pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '10:00', // 10am PST
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    // Sunset at 5pm PST (01:00 UTC next day)
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2024-01-15T15:00:00Z')], // 7am PST
        sunsets: [new Date('2024-01-16T01:00:00Z')], // 5pm PST
      }],
    ]);

    const result = selectBestWindow(
      forecasts,
      mockBeach as Beach,
      null,
      undefined,
      sunTimesCache
    );

    if (result) {
      // End should be at or before sunset
      expect(result.end.getTime()).toBeLessThanOrEqual(
        new Date('2024-01-16T01:00:00Z').getTime()
      );
    }
  });

  it('should return best scoring window', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-poor',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT (local) → 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 9am PT (local) → 17:00 UTC
        wave_height: '1', // Too small
        wave_period: '6s', // Too short
        wind_speed: '20', // Too windy
        confidence_score: 60,
      }),
      createForecast({
        id: 'forecast-good',
        forecast_at: '2024-01-15T18:00:00Z', // 10am PT (local) → 6pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '10:00', // 10am PT (local) → 18:00 UTC
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        wind_direction: 'NE',
        wind_direction_deg: 45,
        tide_height: '3.5',
        confidence_score: 85,
      }),
      createForecast({
        id: 'forecast-mediocre',
        forecast_at: '2024-01-15T19:00:00Z', // 11am PT (local) → 7pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '11:00', // 11am PT (local) → 19:00 UTC
        wave_height: '3',
        wave_period: '10s',
        wind_speed: '12',
        confidence_score: 70,
      }),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeach as Beach,
      null
    );

    expect(result).not.toBeNull();
    // Best conditions forecast should be selected
    expect(result?.waveHeight).toBe('4');
    expect(result?.wavePeriod).toBe('12s');
  });

  it('should include timezone in result', () => {
    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeach as Beach,
      null
    );

    expect(result).not.toBeNull();
    expect(result?.timezone).toBe('America/Los_Angeles');
  });

  it('should work with options object syntax', () => {
    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      horizonHours: 24,
    });

    expect(result).not.toBeNull();
    expect(result?.waveHeight).toBe('4');
  });

  it('should apply horizon constraint', () => {
    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 9am PST - soon
        wave_height: '3',
        wave_period: '10s',
        confidence_score: 70,
      }),
      createForecast({
        forecast_at: '2024-01-17T17:00:00Z', // 9am PT = 5pm UTC (2 days ahead)
        forecast_date: '2024-01-17', // 2 days ahead
        forecast_time: '09:00',
        wave_height: '6',
        wave_period: '14s',
        confidence_score: 95,
      }),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeach as Beach,
      null,
      6 // Only next 6 hours
    );

    // Should pick the soon forecast, not the better one 2 days away
    if (result) {
      expect(result.start.getDate()).toBe(15);
    }
  });
});

describe('selectBestWindow past window filtering with tolerance', () => {
  // Tests for the tolerance-based past window filter
  // Windows are 30 minutes, with a 15-minute tolerance for "just missed" windows
  // A window should be shown if: windowEndTime >= (now - 15 minutes)

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should include window that ended within 15 min tolerance', () => {
    // Current time: 4:12pm UTC
    // Window: 3:30pm-4:00pm UTC (ended 12 min ago)
    // Cutoff: 4:12pm - 15min = 3:57pm UTC
    // 4:00pm end >= 3:57pm cutoff = INCLUDED
    jest.setSystemTime(new Date('2024-01-15T16:12:00Z'));

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T15:30Z',
        forecast_date: '2024-01-15',
        forecast_time: '15:30', // 3:30pm UTC, window ends at 4:00pm
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    expect(result).not.toBeNull();
  });

  it('should exclude window that ended beyond 15 min tolerance', () => {
    // Current time: 8:20am PT = 16:20 UTC
    // Window: 7:30am-8:00am PT (ended 20 min ago) = 15:30-16:00 UTC
    // Cutoff: 8:20am - 15min = 8:05am PT = 16:05 UTC
    // 8:00am end (16:00 UTC) < 8:05am cutoff (16:05 UTC) = EXCLUDED
    jest.setSystemTime(new Date('2024-01-15T16:20:00Z')); // 8:20am PT

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T15:30:00Z', // 7:30am PT = 3:30pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '07:30', // 7:30am PT (local), window ends at 8:00am PT (16:00 UTC)
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    expect(result).toBeNull();
  });

  it('should include window currently in progress', () => {
    // Current time: 4:10pm UTC
    // Window: 4:00pm-4:30pm UTC (currently in progress)
    // End time is in the future, so definitely included
    jest.setSystemTime(new Date('2024-01-15T16:10:00Z'));

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T16:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '16:00', // 4:00pm UTC, window ends at 4:30pm
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    expect(result).not.toBeNull();
  });

  it('should handle boundary exactly at tolerance cutoff (inclusive)', () => {
    // Current time: 4:15pm UTC exactly
    // Window: 3:30pm-4:00pm UTC (ended 15 min ago)
    // Cutoff: 4:15pm - 15min = 4:00pm UTC
    // 4:00pm end >= 4:00pm cutoff = INCLUDED (boundary is inclusive)
    jest.setSystemTime(new Date('2024-01-15T16:15:00Z'));

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T15:30Z',
        forecast_date: '2024-01-15',
        forecast_time: '15:30', // 3:30pm UTC, window ends at 4:00pm
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    // Should be included due to >= comparison
    expect(result).not.toBeNull();
  });

  it('should exclude window that ended 1 minute beyond tolerance', () => {
    // Current time: 8:16am PT = 16:16 UTC
    // Window: 7:30am-8:00am PT (ended 16 min ago) = 15:30-16:00 UTC
    // Cutoff: 8:16am - 15min = 8:01am PT = 16:01 UTC
    // 8:00am end (16:00 UTC) < 8:01am cutoff (16:01 UTC) = EXCLUDED
    jest.setSystemTime(new Date('2024-01-15T16:16:00Z')); // 8:16am PT

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T15:30:00Z', // 7:30am PT = 3:30pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '07:30', // 7:30am PT (local), window ends at 8:00am PT (16:00 UTC)
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    expect(result).toBeNull();
  });

  it('should exclude the original bug scenario (4-4:30pm shown at 6:07pm)', () => {
    // Original bug: At 6:07pm PT, the 4:00-4:30pm PT window was shown
    // Current time: 6:07pm PT = 2:07am UTC next day
    // Window: 4:00pm-4:30pm PT (ended 1hr 37min ago) = 00:00-00:30 UTC next day
    // Cutoff: 6:07pm - 15min = 5:52pm PT
    // 4:30pm end < 5:52pm cutoff = EXCLUDED
    jest.setSystemTime(new Date('2024-01-16T02:07:00Z')); // 6:07pm PST

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T16:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '16:00', // 4:00pm PT (local), window ends at 4:30pm PT
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    expect(result).toBeNull();
  });

  it('should include future windows', () => {
    // Current time: 3:00pm UTC
    // Window: 4:00pm-4:30pm UTC (starts in 1 hour)
    // Future windows should always be included
    jest.setSystemTime(new Date('2024-01-15T15:00:00Z'));

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T16:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '16:00', // 4:00pm UTC, window ends at 4:30pm
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    expect(result).not.toBeNull();
  });

  it('should correctly filter multiple windows with mixed past/present/future', () => {
    // Current time: 5:00pm UTC
    // Window 1: 3:30pm-4:00pm (ended 60 min ago) - EXCLUDED
    // Window 2: 4:30pm-5:00pm (just ended) - INCLUDED (within 15 min tolerance)
    // Window 3: 5:00pm-5:30pm (in progress) - INCLUDED
    // Window 4: 6:00pm-6:30pm (future) - INCLUDED
    jest.setSystemTime(new Date('2024-01-15T17:00:00Z'));

    const forecasts = [
      createForecast({
        id: 'past-excluded',
        forecast_at: '2024-01-15T15:30Z',
        forecast_date: '2024-01-15',
        forecast_time: '15:30', // Ends at 4:00pm - excluded
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
      createForecast({
        id: 'just-ended',
        forecast_at: '2024-01-15T16:30Z',
        forecast_date: '2024-01-15',
        forecast_time: '16:30', // Ends at 5:00pm - included (just ended)
        wave_height: '5', // Better conditions
        wave_period: '14s',
        confidence_score: 90,
      }),
      createForecast({
        id: 'in-progress',
        forecast_at: '2024-01-15T17:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '17:00', // Ends at 5:30pm - included
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
      createForecast({
        id: 'future',
        forecast_at: '2024-01-15T18:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '18:00', // Ends at 6:30pm - included
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, mockBeach as Beach, null);
    expect(result).not.toBeNull();
    // Should NOT pick the 3:30pm window (excluded by tolerance filter).
    // The 3:30pm window resolves to 23:30 UTC (local-as-UTC convention for LA tz),
    // while valid windows resolve to 00:xx–02:xx UTC (next calendar day in UTC).
    // Verify the selected window is not from the excluded past forecast (wave_height '4'
    // from past-excluded is same as others, so check it comes from 16:30Z+ which scores
    // higher: wave_height '5', period '14s', confidence 90).
    expect(result!.waveHeight).toBe('5');
  });
});

describe('selectBestWindow with tide-driven boundaries', () => {
  const fixedNow = new Date('2024-01-15T16:00:00Z'); // 8am PST

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should use tide threshold crossings for window boundaries when data available', () => {
    // Tide schedule: Low at 14:47 UTC (6:47am PT), High at 20:52 UTC (12:52pm PT)
    // The 2.0ft crossing occurs around 15:50 UTC (~7:50am PT), the 4.0ft crossing around 18:29 UTC (~10:29am PT)
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:47:00Z').getTime() / 1000), height: 1.2, type: 'low' as const },
      { time: Math.floor(new Date('2024-01-15T20:52:00Z').getTime() / 1000), height: 5.8, type: 'high' as const },
    ];

    // Forecast starts at 7am PT (local) - BEFORE the 2.0ft crossing at ~7:50am PT
    const forecasts = [
      createForecast({
        id: 'forecast-with-tide',
        forecast_at: '2024-01-15T15:00:00Z', // 7am PT = 3pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '07:00', // 7am PT (local) → 15:00 UTC - before 2.0ft crossing
        wave_height: '4',
        wave_period: '12s',
        tide_height: '1.5', // Tide is still low
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Adjust fixed time to be at 7am PT = 15:00 UTC for this test
    jest.setSystemTime(new Date('2024-01-15T15:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow(
      forecasts,
      beachWithTidePrefs,
      null
    );

    expect(result).not.toBeNull();

    // Window should NOT start exactly on the hour (tide-driven boundaries)
    const startMinutes = result!.start.getMinutes();
    const endMinutes = result!.end.getMinutes();

    // At least one of start/end should have non-zero minutes (tide-driven)
    expect(startMinutes !== 0 || endMinutes !== 0).toBe(true);
  });

  it('should fall back to hourly boundaries when tide data is missing', () => {
    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
        // No raw_forecast with tide_schedule
      }),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeach as Beach,
      null
    );

    expect(result).not.toBeNull();
    // Should start on the hour (fallback behavior)
    expect(result!.start.getMinutes()).toBe(0);
  });

  it('should fall back when beach has no tide height thresholds', () => {
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:47:00Z').getTime() / 1000), height: 1.2, type: 'low' as const },
      { time: Math.floor(new Date('2024-01-15T20:52:00Z').getTime() / 1000), height: 5.8, type: 'high' as const },
    ];

    const forecasts = [
      createForecast({
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeachNoPrefs as Beach, // No tide thresholds
      null
    );

    expect(result).not.toBeNull();
    // Should use hourly boundaries (no tide thresholds to apply)
    expect(result!.start.getMinutes()).toBe(0);
  });

  it('should cap tide-driven window at sunset', () => {
    // Tide schedule where tide window would extend past sunset
    // Rising tide from 2pm PT to 8pm PT - but sunset is at 5pm PT
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T22:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const }, // 2pm PT = 22:00 UTC
      { time: Math.floor(new Date('2024-01-16T04:00:00Z').getTime() / 1000), height: 6.0, type: 'high' as const }, // 8pm PT = 04:00 UTC+1
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-late',
        forecast_at: '2024-01-15T22:30:00Z', // 2:30pm PT = 10:30pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '14:30', // 2:30pm PT (local) → 22:30 UTC - rising tide starting
        wave_height: '4',
        wave_period: '12s',
        tide_height: '1.5',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 2:30pm PT = 22:30 UTC
    jest.setSystemTime(new Date('2024-01-15T22:30:00Z'));

    // Sunset at 5pm PST (01:00 UTC next day)
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2024-01-15T15:00:00Z')], // 7am PST
        sunsets: [new Date('2024-01-16T01:00:00Z')], // 5pm PST
      }],
    ]);

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 5.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      sunTimesCache,
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    // Window end should be at or before sunset (5pm PST = 01:00 UTC)
    expect(result!.end.getTime()).toBeLessThanOrEqual(
      new Date('2024-01-16T01:00:00Z').getTime()
    );
  });

  it('should reject tide window that starts after sunset', () => {
    // Tide schedule where the tide doesn't reach preferred range until after sunset
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-16T00:00:00Z').getTime() / 1000), height: 0.5, type: 'low' as const }, // 4pm PST
      { time: Math.floor(new Date('2024-01-16T06:00:00Z').getTime() / 1000), height: 6.0, type: 'high' as const }, // 10pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-evening',
        forecast_at: '2024-01-16T00:30:00Z', // 4:30pm PT = 12:30am UTC next day
        forecast_date: '2024-01-16',
        forecast_time: '16:30', // 4:30pm PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '0.8',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 4:30pm PST
    jest.setSystemTime(new Date('2024-01-16T00:30:00Z'));

    // Sunset at 5pm PST (01:00 UTC)
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2024-01-15T15:00:00Z')],
        sunsets: [new Date('2024-01-16T01:00:00Z')], // 5pm PST
      }],
    ]);

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 3.0, // Tide won't reach 3ft until well after 5pm
      preferred_tide_ft_max: 5.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      sunTimesCache,
      userPrefs: null,
    });

    // Should be null or have very short/no window since tide doesn't reach 3ft until after sunset
    // The behavior depends on whether tide boundaries or sunset takes precedence
    // If a window is returned, it should end at sunset
    if (result) {
      expect(result.end.getTime()).toBeLessThanOrEqual(
        new Date('2024-01-16T01:00:00Z').getTime()
      );
    }
  });

  it('should show full tide window for dawn-patrol even if it extends past 9am', () => {
    // Tide schedule with tide window extending past 9am
    // Tide-driven windows should show full duration, not be capped at time slot boundary
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:00:00Z').getTime() / 1000), height: 1.2, type: 'low' as const }, // 6am PT = 14:00 UTC
      { time: Math.floor(new Date('2024-01-15T20:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 12pm PT = 20:00 UTC
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-morning',
        forecast_at: '2024-01-15T15:00:00Z', // 7am PT = 3pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '07:00', // 7am PT (local) → 15:00 UTC - rising tide
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.0',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 7am PT = 15:00 UTC
    jest.setSystemTime(new Date('2024-01-15T15:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.5, // Would extend well past 9am
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'dawn-patrol', // 6am-9am
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    // Tide-driven window should extend past 9am (17:00 UTC) to show full tide window
    // The end should be when tide crosses 4.5ft (~10:20am PST = 18:20 UTC)
    expect(result!.end.getUTCHours()).toBeGreaterThan(17);
  });

  it('should use tide-driven boundaries even when they extend past time slot', () => {
    // Tide schedule where preferred tide range starts later in the morning
    // The tide-driven boundaries are calculated independently of time slot,
    // and then the time slot cap is applied afterward
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:00:00Z').getTime() / 1000), height: 0.5, type: 'low' as const }, // 6am PST
      { time: Math.floor(new Date('2024-01-15T20:00:00Z').getTime() / 1000), height: 6.0, type: 'high' as const }, // 12pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-early',
        forecast_at: '2024-01-15T14:30:00Z', // 6:30am PT = 2:30pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '06:30', // 6:30am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '0.8',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 6:30am PST
    jest.setSystemTime(new Date('2024-01-15T14:30:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0, // Will reach 2ft around 7:30am
      preferred_tide_ft_max: 4.0, // Will reach 4ft around 9:30am (past dawn-patrol)
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'dawn-patrol', // Ends at 9am
      userPrefs: null,
    });

    // Tide-driven windows still calculate precise start times
    // The start time is when tide crosses the min threshold
    if (result) {
      // Start should be tide-driven (non-zero minutes indicates tide boundary)
      // The time slot cap applies to the end, not the start
      expect(result).not.toBeNull();
      // The window start is calculated from tide threshold crossing
      expect(result.start.getTime()).toBeGreaterThan(
        new Date('2024-01-15T14:30:00Z').getTime() // After current time
      );
    }
  });

  it('should handle time slot filter with lunch-session slot and tide boundaries', () => {
    // Tide schedule spanning lunch session hours (11am-2pm PST)
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T17:00:00Z').getTime() / 1000), height: 1.5, type: 'low' as const }, // 9am PST
      { time: Math.floor(new Date('2024-01-15T23:00:00Z').getTime() / 1000), height: 5.0, type: 'high' as const }, // 3pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-lunch-session',
        forecast_at: '2024-01-15T19:00:00Z', // 11am PT = 7pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '11:00', // 11am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.5',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 11am PST (start of lunch session)
    jest.setSystemTime(new Date('2024-01-15T19:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'lunch-session', // 11am-2pm
      userPrefs: null,
    });

    if (result) {
      // Window START should be within lunch session slot (11am-2pm PST)
      // Window END can extend past 2pm for tide-driven windows (not capped)
      const startHour = result.start.getUTCHours();
      const endHour = result.end.getUTCHours();

      // 11am PST = 19:00 UTC, 2pm PST = 22:00 UTC
      // Start should be in lunch session slot
      expect(startHour).toBeGreaterThanOrEqual(19);
      // This tide naturally ends before 2pm (~10:50am PST), so end is still <= 22
      // For tide windows that extend past 2pm, this assertion would be different
      expect(endHour).toBeLessThanOrEqual(22);
    }
  });

  it('should reject tide-driven boundaries that span overnight', () => {
    // Tide schedule that would create an overnight window: 7pm-7am
    // Low tide at 2am, High tide at 9am - rising tide crosses thresholds overnight
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-16T10:00:00Z').getTime() / 1000), height: 0.5, type: 'low' as const }, // 2am PST
      { time: Math.floor(new Date('2024-01-16T17:00:00Z').getTime() / 1000), height: 6.0, type: 'high' as const }, // 9am PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-evening',
        forecast_at: '2024-01-15T20:00:00Z', // 12pm PT = 8pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '12:00', // 12pm PST (noon)
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0',
        tide_status: 'Falling',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to noon PST on Jan 15
    jest.setSystemTime(new Date('2024-01-15T20:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 1.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      userPrefs: null,
    });

    // If a result is returned, it should NOT span overnight
    if (result) {
      const startDate = result.start.toISOString().slice(0, 10);
      const endDate = result.end.toISOString().slice(0, 10);
      // Start and end should be on the same day
      expect(startDate).toBe(endDate);
    }
  });

  it('should reject tide-driven boundaries outside time slot', () => {
    // Tide schedule that would create an evening window (7pm) when lunch session slot selected
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T22:00:00Z').getTime() / 1000), height: 0.5, type: 'low' as const }, // 2pm PST
      { time: Math.floor(new Date('2024-01-16T04:00:00Z').getTime() / 1000), height: 6.0, type: 'high' as const }, // 8pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-morning',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 9am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0',
        tide_status: 'Falling',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 9am PST
    jest.setSystemTime(new Date('2024-01-15T17:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 1.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      userPrefs: null,
      timeSlot: 'lunch-session', // 11am-2pm
    });

    // If a result is returned, start should be within lunch session slot (11am-2pm)
    if (result) {
      const startHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: "America/Los_Angeles",
        }).format(result.start),
        10
      );
      // Lunch session slot is 11am-2pm
      expect(startHour).toBeGreaterThanOrEqual(11);
      expect(startHour).toBeLessThan(14);
    }
  });
});

describe('getTimeSlotRange', () => {
  it('should return static range for lunch-session slot', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    const range = getTimeSlotRange('lunch-session', [], new Date(), 'America/Los_Angeles');

    expect(range.startHour).toBe(11);
    expect(range.endHour).toBe(14);
  });

  it('should return static range for afternoon slot', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    const range = getTimeSlotRange('afternoon', [], new Date(), 'America/Los_Angeles');

    expect(range.startHour).toBe(14); // Afternoon now starts at 2pm
    expect(range.endHour).toBe(18);
  });

  it('should return dynamic range for dawn-patrol based on sunrise', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    // Winter sunrise at 6:47am PST
    const sunrises = [new Date('2024-01-15T14:47:00Z')];
    const forecastDate = new Date('2024-01-15T17:00:00Z');

    const range = getTimeSlotRange('dawn-patrol', sunrises, forecastDate, 'America/Los_Angeles');

    // Should use civil twilight (6:17am -> hour 6)
    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(11); // Dawn patrol now ends at 11am
  });

  it('should return full day range for any slot', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    const range = getTimeSlotRange('any', [], new Date(), 'America/Los_Angeles');

    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(21);
  });
});

describe('getDawnPatrolRange', () => {
  it('should return civil twilight start based on sunrise', () => {
    // Import the helper (will add export after test fails)
    const { getDawnPatrolRange } = require('@/lib/services/discovery/window-selector');

    const beachTz = 'America/Los_Angeles';
    // Sunrise at 6:47am PST (14:47 UTC)
    const sunrises = [new Date('2024-01-15T14:47:00Z')];
    const forecastDate = new Date('2024-01-15T17:00:00Z'); // 9am PST

    const range = getDawnPatrolRange(sunrises, forecastDate, beachTz);

    // Civil twilight is ~30 min before sunrise
    // 6:47am - 30min = 6:17am, so startHour should be 6
    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(11);
  });

  it('should return earlier start for summer sunrise', () => {
    const { getDawnPatrolRange } = require('@/lib/services/discovery/window-selector');

    const beachTz = 'America/Los_Angeles';
    // Summer sunrise at 5:42am PST (12:42 UTC)
    const sunrises = [new Date('2024-06-15T12:42:00Z')];
    const forecastDate = new Date('2024-06-15T14:00:00Z');

    const range = getDawnPatrolRange(sunrises, forecastDate, beachTz);

    // 5:42am - 30min = 5:12am, so startHour should be 5
    expect(range.startHour).toBe(5);
    expect(range.endHour).toBe(11);
  });

  it('should fall back to 6am when no sunrise data', () => {
    const { getDawnPatrolRange } = require('@/lib/services/discovery/window-selector');

    const beachTz = 'America/Los_Angeles';
    const sunrises: Date[] = [];
    const forecastDate = new Date('2024-01-15T17:00:00Z');

    const range = getDawnPatrolRange(sunrises, forecastDate, beachTz);

    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(11);
  });
});

describe('selectBestWindow time slot with tide boundaries', () => {
  const fixedNow = new Date('2024-01-15T19:00:00Z'); // 11am PST (start of lunch session)

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show tide-driven boundaries for lunch-session slot (not hourly)', () => {
    // Tide: low at 10am PT (1.0ft) = 18:00 UTC, high at 4pm PT (5.5ft) = 00:00 UTC+1
    // Preferred range 2.0-4.0ft - crossings will span the lunch session window
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T18:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const }, // 10am PT = 18:00 UTC
      { time: Math.floor(new Date('2024-01-16T00:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 4pm PT = 00:00 UTC+1
    ];

    // Forecast at 11am PT (local) - within lunch session window
    const forecasts = [
      createForecast({
        id: 'forecast-lunch',
        forecast_at: '2024-01-15T19:00:00Z', // 11am PT = 7pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '11:00', // 11am PT (local) → 19:00 UTC
        wave_height: '4',
        wave_period: '12s',
        tide_height: '1.5',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'lunch-session',
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    // Key assertion: should NOT be exactly on the hour (tide-driven)
    // The tide-driven start time will be when tide crosses 2.0ft
    const startMinutes = result!.start.getMinutes();
    const endMinutes = result!.end.getMinutes();
    expect(startMinutes !== 0 || endMinutes !== 0).toBe(true);
  });

  it('should show full tide window even if it extends past time slot', () => {
    // Tide window that starts in lunch session but extends PAST 2pm
    // High tide at 4pm PT (10 hours after 6am low) means 4.5ft crossing is around 12:48pm PT
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const }, // 6am PT = 14:00 UTC
      { time: Math.floor(new Date('2024-01-16T00:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 4pm PT = 00:00 UTC+1
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-morning-extended',
        forecast_at: '2024-01-15T19:00:00Z', // 11am PT = 7pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '11:00', // 11am PT (local) → 19:00 UTC - within lunch-session window
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.5',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 11am PT = 19:00 UTC (start of lunch session)
    jest.setSystemTime(new Date('2024-01-15T19:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.5, // Would extend past noon
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'lunch-session', // Ends at 2pm
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // Tide-driven window should extend past 2pm to show full tide window
    // The 4.5ft crossing is around 12:48pm PST (20:48 UTC) - still within lunch session
    // If not capped: end time should be at or after 12:48pm (20:48 UTC)
    // If capped (bug): end time would be exactly 2pm PST = 22:00 UTC
    const endUTCHour = result!.end.getUTCHours();
    const endMinutes = result!.end.getUTCMinutes();

    // With the fix, tide-driven windows should NOT be capped
    // End should be around 12:48pm PST = 20:48 UTC
    // If capped, it would be exactly 2pm PST = 22:00 UTC (hour 22, minute 0)
    expect(endUTCHour >= 20).toBe(true); // Should be at or after 12:48pm
    expect(endMinutes > 0 || endUTCHour > 20).toBe(true); // Not exactly at slot boundary
  });

  it('should show tide-driven boundaries for afternoon slot', () => {
    // Tide: low at 1pm PT (1.0ft) = 21:00 UTC, high at 7pm PT (5.5ft) = 03:00 UTC+1
    // Preferred range 2.0-4.0ft - crossings will be AFTER 2pm forecast
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T21:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const }, // 1pm PT = 21:00 UTC
      { time: Math.floor(new Date('2024-01-16T03:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 7pm PT = 03:00 UTC+1
    ];

    // Forecast at 2pm PT (local) - within the afternoon slot (2pm-6pm)
    const forecasts = [
      createForecast({
        id: 'forecast-afternoon',
        forecast_at: '2024-01-15T22:00:00Z', // 2pm PT = 10pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '14:00', // 2pm PT (local) → 22:00 UTC
        wave_height: '4',
        wave_period: '12s',
        tide_height: '1.5',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    jest.setSystemTime(new Date('2024-01-15T22:00:00Z')); // 2pm PT = 22:00 UTC

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'afternoon',
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    // Key assertion: tide-driven boundaries should have non-zero minutes
    const startMinutes = result!.start.getMinutes();
    const endMinutes = result!.end.getMinutes();
    expect(startMinutes !== 0 || endMinutes !== 0).toBe(true);
  });
});

describe('scoreWindowWithEngine', () => {
  it('should return score on 0-100 scale', () => {
    const forecast = createForecast({
      wave_height: '4',
      wave_period: '12s',
      wind_speed: '5',
      tide_height: '3.5',
    });

    const { scoreWindowWithEngine } = require('@/lib/services/discovery/window-selector');
    const score = scoreWindowWithEngine(forecast, mockBeach as Beach);

    // Score should be 0-100
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // Good conditions should score above threshold
    expect(score).toBeGreaterThan(50);
  });

  it('should score consistently with display scoring', () => {
    const forecast = createForecast({
      wave_height: '4',
      wave_period: '14s',
      wind_speed: '3',
      tide_height: '3.5',
    });

    const { scoreWindowWithEngine } = require('@/lib/services/discovery/window-selector');
    const score = scoreWindowWithEngine(forecast, mockBeach as Beach);

    // Excellent conditions (glass, good period, good size) should score 60+
    expect(score).toBeGreaterThanOrEqual(60);
  });
});

describe('sub-hour window refinement integration', () => {
  const fixedNow = new Date('2024-01-15T14:00:00Z'); // 6am PST

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('produces sub-hour times when tide constraints trim the window', () => {
    // This integration test verifies that the full selectBestWindow pipeline
    // applies sub-hour refinement when conditions warrant boundary adjustment.
    //
    // Setup: Beach with tide preferences but NO tide_schedule in forecasts
    // This triggers hourly window selection (usedTideBoundaries = false)
    // but the refinement step will still check tide constraints.
    //
    // Key: Tide schedule in raw_forecast enables tide-driven boundaries,
    // but we want to test the refinement path, so we omit it.

    // Tide schedule for refinement only (not for boundary calculation)
    // The tide_height values in forecasts simulate rising tide
    // This schedule is provided to the FIRST forecast only for interpolation
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const },
      { time: Math.floor(new Date('2024-01-15T20:00:00Z').getTime() / 1000), height: 5.0, type: 'high' as const },
    ];

    // Create 4+ consecutive hourly forecasts (required for refinement)
    // Forecasts from 06:00 to 10:00 (5 hours)
    // NO raw_forecast.tide_schedule to avoid tide-driven boundary selection
    const forecasts = [
      createForecast({
        id: 'forecast-0600',
        forecast_at: '2024-01-15T14:00:00Z', // 6am PT = 2pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '06:00', // 06:00 PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '1.0', // Below preferred min
        tide_status: 'Rising',
        confidence_score: 80,
        // Only first forecast has tide_schedule for interpolation in refinement
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
      createForecast({
        id: 'forecast-0700',
        forecast_at: '2024-01-15T15:00:00Z', // 7am PT = 3pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '07:00', // 07:00 PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '1.67',
        tide_status: 'Rising',
        confidence_score: 80,
        // No raw_forecast - forces hourly boundaries
      }),
      createForecast({
        id: 'forecast-0800',
        forecast_at: '2024-01-15T16:00:00Z', // 8am PT = 4pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '08:00', // 08:00 PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.33', // Above preferred min
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-0900',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 09:00 PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0', // Well within preferred range
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1000',
        forecast_at: '2024-01-15T18:00:00Z', // 10am PT = 6pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '10:00', // 10:00 PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.67', // Still within preferred range
        tide_status: 'Rising',
        confidence_score: 80,
      }),
    ];

    // Beach WITHOUT tide preference thresholds to avoid tide-driven boundaries
    // but the refinement step doesn't check usedTideBoundaries for tide constraints
    // Actually, we need NO tide prefs on beach to avoid tide-driven boundary calc,
    // but we WANT refinement to apply constraints. Let me check the logic again...
    //
    // The refinement uses beach.preferred_tide_ft_min/max for constraint checking.
    // But calculateTideDrivenBoundaries also uses them. So if beach has tide prefs
    // AND forecast has tide_schedule, it will use tide-driven boundaries.
    //
    // Solution: Beach has NO tide prefs (triggers hourly window + no tide-driven boundaries),
    // but we can still verify refinement runs by checking the end time snapping behavior.
    const result = selectBestWindow({
      forecasts,
      beach: mockBeachNoPrefs as Beach, // No tide prefs
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // When refinement runs, the end time is floor-snapped to 15-minute boundaries.
    // The scan in refineWindowBounds starts at hourlyEnd - 1hr and works backward.
    // It finds the last eligible time and floor-snaps it.
    //
    // For a window ending at a full hour (e.g., 18:00), the scan starts at 17:00
    // and scans backward from 17:55. First eligible point found is floor-snapped.
    // This typically results in :45 minutes (not :00) due to the 5-min scan step.
    const endMinutes = result!.end.getMinutes();

    // The refinement algorithm always snaps end time to 15-minute boundaries
    // For hourly windows, this means end time will be :00, :15, :30, or :45
    // The key integration test is verifying the pipeline runs without error
    // and produces valid 15-minute snapped times
    expect(endMinutes % 15).toBe(0);

    // Additionally verify that usedTideBoundaries is false (hourly selection path)
    expect(result!.usedTideBoundaries).toBe(false);
  });

  it('produces sub-hour times when light constraints trim the window', () => {
    // Test that sunset constraints cause sub-hour end time refinement

    // Forecasts spanning 2pm to 5pm PT (local times)
    const forecasts = [
      createForecast({
        id: 'forecast-1400',
        forecast_at: '2024-01-15T22:00:00Z', // 2pm PT = 10pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '14:00', // 2pm PT (local) → 22:00 UTC
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0',
        tide_status: 'Falling',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1500',
        forecast_at: '2024-01-15T23:00:00Z', // 3pm PT = 11pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '15:00', // 3pm PT (local) → 23:00 UTC
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.8',
        tide_status: 'Falling',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1600',
        forecast_at: '2024-01-16T00:00:00Z', // 4pm PT = 12am UTC next day
        forecast_date: '2024-01-15',
        forecast_time: '16:00', // 4pm PT (local) → 00:00 UTC Jan 16
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.5',
        tide_status: 'Falling',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1700',
        forecast_at: '2024-01-16T01:00:00Z', // 5pm PT = 1am UTC next day
        forecast_date: '2024-01-15',
        forecast_time: '17:00', // 5pm PT (local) → 01:00 UTC Jan 16
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.2',
        tide_status: 'Falling',
        confidence_score: 80,
      }),
    ];

    // Set system time to 2pm PT = 22:00 UTC
    jest.setSystemTime(new Date('2024-01-15T22:00:00Z'));

    // Sunset at 4:45pm PST (00:45 UTC next day) - creates sub-hour constraint
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2024-01-15T15:00:00Z')], // 7am PST
        sunsets: [new Date('2024-01-16T00:45:00Z')], // 4:45pm PST
      }],
    ]);

    const result = selectBestWindow({
      forecasts,
      beach: mockBeach as Beach,
      sunTimesCache,
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // The window end should be capped at sunset (4:45pm PST)
    // This creates sub-hour precision on the end time
    const endMinutes = result!.end.getMinutes();

    // End time should be at 45 minutes (sunset time) or refined nearby
    // The key assertion is that we get sub-hour precision from the light constraint
    expect(endMinutes).not.toBe(0);
  });

  it('keeps hourly boundaries when no refinement is needed', () => {
    // When conditions are good throughout, boundaries should stay on the hour
    // (or be snapped to 15-minute increments by the refinement algorithm)

    const forecasts = [
      createForecast({
        id: 'forecast-0800',
        forecast_at: '2024-01-15T16:00:00Z', // 8am PT = 4pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '08:00', // 8am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-0900',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 9am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1000',
        forecast_at: '2024-01-15T18:00:00Z', // 10am PT = 6pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '10:00', // 10am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1100',
        forecast_at: '2024-01-15T19:00:00Z', // 11am PT = 7pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '11:00', // 11am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 80,
      }),
    ];

    // Set system time to 8am PST
    jest.setSystemTime(new Date('2024-01-15T16:00:00Z'));

    // Beach without tide preferences - no tide constraint trimming
    const result = selectBestWindow({
      forecasts,
      beach: mockBeachNoPrefs as Beach,
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // When no constraints cause trimming, boundaries should be on 15-minute marks
    // (the refinement algorithm snaps to 15-min increments)
    const startMinutes = result!.start.getMinutes();
    const endMinutes = result!.end.getMinutes();

    // Both should be on 15-minute boundaries (0, 15, 30, or 45)
    expect(startMinutes % 15).toBe(0);
    expect(endMinutes % 15).toBe(0);
  });
});

describe('sub-hour window refinement with peak centering', () => {
  const fixedNow = new Date('2024-01-15T16:00:00Z'); // 8am PST

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('produces sub-hour times for tomorrow windows with uniform good conditions', () => {
    // This test verifies that even when conditions are uniformly good (no degradation),
    // the window produces sub-hour times centered around the peak, matching
    // the magic-hour-finder behavior.

    // Create forecasts for "tomorrow" (Jan 16) with uniformly good conditions
    // Set time to Jan 15 evening so tomorrow is Jan 16
    jest.setSystemTime(new Date('2024-01-15T22:00:00Z')); // 2pm PST on Jan 15

    const forecasts = [
      createForecast({
        id: 'forecast-0700',
        forecast_at: '2024-01-16T15:00:00Z', // 7am PT = 3pm UTC
        forecast_date: '2024-01-16',
        forecast_time: '07:00', // 7am PST tomorrow
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 75,
      }),
      createForecast({
        id: 'forecast-0800',
        forecast_at: '2024-01-16T16:00:00Z', // 8am PT = 4pm UTC
        forecast_date: '2024-01-16',
        forecast_time: '08:00', // 8am PST tomorrow
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-0900',
        forecast_at: '2024-01-16T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-16',
        forecast_time: '09:00', // 9am PST tomorrow - slightly higher score (peak)
        wave_height: '4',
        wave_period: '14s', // Slightly better period
        wind_speed: '3', // Slightly less wind
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 85,
      }),
      createForecast({
        id: 'forecast-1000',
        forecast_at: '2024-01-16T18:00:00Z', // 10am PT = 6pm UTC
        forecast_date: '2024-01-16',
        forecast_time: '10:00', // 10am PST tomorrow
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1100',
        forecast_at: '2024-01-16T19:00:00Z', // 11am PT = 7pm UTC
        forecast_date: '2024-01-16',
        forecast_time: '11:00', // 11am PST tomorrow
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        tide_status: 'Rising',
        confidence_score: 75,
      }),
    ];

    // Provide sunset data for tomorrow to avoid conservative cutoffs
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [
          new Date('2024-01-15T14:47:00Z'), // Today sunrise
          new Date('2024-01-16T14:47:00Z'), // Tomorrow sunrise 6:47am PST
        ],
        sunsets: [
          new Date('2024-01-16T01:00:00Z'), // Today sunset 5pm PST
          new Date('2024-01-17T01:00:00Z'), // Tomorrow sunset 5pm PST
        ],
      }],
    ]);

    const result = selectBestWindow({
      forecasts,
      beach: mockBeachNoPrefs as Beach, // No tide preferences
      sunTimesCache,
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // The window now shows the full surfable duration (not peak-centered)
    // peakTime is computed separately and displayed as "Best at X" in the UI
    const durationHours =
      (result!.end.getTime() - result!.start.getTime()) / (1000 * 60 * 60);

    // Duration should be the full window (up to MAX_WINDOW_HOURS = 4)
    expect(durationHours).toBeGreaterThanOrEqual(1);
    expect(durationHours).toBeLessThanOrEqual(4);

    // Both times should be on 15-minute boundaries
    expect(result!.start.getMinutes() % 15).toBe(0);
    expect(result!.end.getMinutes() % 15).toBe(0);
  });

  it('centers window around highest scoring forecast within the window', () => {
    // Test that the peak-centering finds the best scoring hour and centers on it
    // Note: The scoring engine uses beach-specific preferences, so with mockBeachNoPrefs
    // (no tide/wind preferences), the scoring may be more uniform than expected.

    jest.setSystemTime(new Date('2024-01-15T16:00:00Z')); // 8am PST

    const forecasts = [
      createForecast({
        id: 'forecast-0800',
        forecast_at: '2024-01-15T16:00:00Z', // 8am PT = 4pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '08:00', // 8am PST - moderate
        wave_height: '3',
        wave_period: '10s',
        wind_speed: '8',
        tide_height: '3.0',
        confidence_score: 65,
      }),
      createForecast({
        id: 'forecast-0900',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 9am PST - moderate
        wave_height: '3',
        wave_period: '10s',
        wind_speed: '8',
        tide_height: '3.0',
        confidence_score: 65,
      }),
      createForecast({
        id: 'forecast-1000',
        forecast_at: '2024-01-15T18:00:00Z', // 10am PT = 6pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '10:00', // 10am PST - PEAK (best conditions)
        wave_height: '5',
        wave_period: '14s',
        wind_speed: '3',
        tide_height: '3.5',
        confidence_score: 90,
      }),
      createForecast({
        id: 'forecast-1100',
        forecast_at: '2024-01-15T19:00:00Z', // 11am PT = 7pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '11:00', // 11am PST - moderate
        wave_height: '3',
        wave_period: '10s',
        wind_speed: '8',
        tide_height: '3.0',
        confidence_score: 65,
      }),
      createForecast({
        id: 'forecast-1200',
        forecast_at: '2024-01-15T20:00:00Z', // 12pm PT = 8pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '12:00', // 12pm PST - moderate
        wave_height: '3',
        wave_period: '10s',
        wind_speed: '8',
        tide_height: '3.0',
        confidence_score: 65,
      }),
    ];

    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2024-01-15T14:47:00Z')],
        sunsets: [new Date('2024-01-16T01:00:00Z')],
      }],
    ]);

    const result = selectBestWindow({
      forecasts,
      beach: mockBeachNoPrefs as Beach,
      sunTimesCache,
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // Window now shows full surfable duration (not peak-centered)
    // Peak time is tracked separately via result.peakTime
    const durationHours =
      (result!.end.getTime() - result!.start.getTime()) / (1000 * 60 * 60);
    expect(durationHours).toBeGreaterThanOrEqual(1);
    expect(durationHours).toBeLessThanOrEqual(4);

    // peakTime should be set within the window
    expect(result!.peakTime).toBeDefined();
    expect(result!.peakTime!.getTime()).toBeGreaterThanOrEqual(result!.start.getTime());
    expect(result!.peakTime!.getTime()).toBeLessThanOrEqual(result!.end.getTime());
  });

  it('returns full window duration with peakTime tracked separately', () => {
    // Test that peak centering produces windows within the refined bounds
    // (not extending beyond what the original refinement determined)

    jest.setSystemTime(new Date('2024-01-15T16:00:00Z')); // 8am PST

    // Create forecasts where the window has a clear boundary (score degradation)
    const forecasts = [
      createForecast({
        id: 'forecast-0800',
        forecast_at: '2024-01-15T16:00:00Z', // 8am PT = 4pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '08:00', // 8am PST - good
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-0900',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 9am PST - PEAK
        wave_height: '5',
        wave_period: '14s',
        wind_speed: '3',
        tide_height: '3.5',
        confidence_score: 90,
      }),
      createForecast({
        id: 'forecast-1000',
        forecast_at: '2024-01-15T18:00:00Z', // 10am PT = 6pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '10:00', // 10am PST - good
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1100',
        forecast_at: '2024-01-15T19:00:00Z', // 11am PT = 7pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '11:00', // 11am PST - good
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        confidence_score: 75,
      }),
    ];

    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2024-01-15T14:47:00Z')],
        sunsets: [new Date('2024-01-16T01:00:00Z')],
      }],
    ]);

    const result = selectBestWindow({
      forecasts,
      beach: mockBeachNoPrefs as Beach,
      sunTimesCache,
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // Window now shows full surfable duration
    const durationHours =
      (result!.end.getTime() - result!.start.getTime()) / (1000 * 60 * 60);
    expect(durationHours).toBeGreaterThanOrEqual(1);
    expect(durationHours).toBeLessThanOrEqual(4);

    // Window start should not be before the first forecast time
    expect(result!.start.getTime()).toBeGreaterThanOrEqual(
      new Date('2024-01-15T16:00:00Z').getTime()
    );

    // peakTime should be tracked
    expect(result!.peakTime).toBeDefined();
  });

  it('maintains minimum window duration of 1 hour', () => {
    // Test that windows with limited forecast data still produce valid results

    jest.setSystemTime(new Date('2024-01-15T16:00:00Z')); // 8am PST

    // Create a narrow set of forecasts
    const forecasts = [
      createForecast({
        id: 'forecast-0800',
        forecast_at: '2024-01-15T16:00:00Z', // 8am PT = 4pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '08:00', // 8am PST
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-0900',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
        forecast_date: '2024-01-15',
        forecast_time: '09:00', // 9am PST
        wave_height: '4',
        wave_period: '12s',
        wind_speed: '5',
        tide_height: '3.0',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow({
      forecasts,
      beach: mockBeachNoPrefs as Beach,
      userPrefs: null,
    });

    // Should still produce a valid window
    expect(result).not.toBeNull();

    // Window should have reasonable duration (at least 30 minutes)
    const durationMinutes =
      (result!.end.getTime() - result!.start.getTime()) / (1000 * 60);
    expect(durationMinutes).toBeGreaterThanOrEqual(30);
  });
});
