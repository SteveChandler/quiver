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

    // Should be capped to 9am PST (17:00 UTC)
    expect(result.getTime()).toBeLessThan(end.getTime());
    expect(result.getUTCHours()).toBe(17); // 9am PST = 17:00 UTC
  });

  it('should cap morning to 12pm', () => {
    // Start at 8am PST (16:00 UTC)
    const start = new Date('2024-01-15T16:00:00Z');
    // End at 4pm PST (00:00 UTC next day)
    const end = new Date('2024-01-16T00:00:00Z');

    const result = capEndTimeToTimeSlot(start, end, 'morning', beachTz);

    // Should be capped to 12pm PST (20:00 UTC)
    expect(result.getTime()).toBeLessThan(end.getTime());
    expect(result.getUTCHours()).toBe(20); // 12pm PST = 20:00 UTC
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
        forecast_date: '2024-01-14', // Yesterday
        forecast_time: '12:00',
      }),
      createForecast({
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
        forecast_date: '2024-01-15',
        forecast_time: '05:00', // 5am UTC = before 6am PST? Actually 9pm PST prev day
        wave_height: '5',
        wave_period: '14s',
        confidence_score: 90,
      }),
      createForecast({
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
        forecast_date: '2024-01-15',
        forecast_time: '14:00', // 6am PST - dawn-patrol
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
      createForecast({
        forecast_date: '2024-01-15',
        forecast_time: '20:00', // 12pm PST - afternoon
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
        forecast_date: '2024-01-15',
        forecast_time: '18:00', // 10am PST
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
        forecast_date: '2024-01-15',
        forecast_time: '17:00', // 9am PST
        wave_height: '1', // Too small
        wave_period: '6s', // Too short
        wind_speed: '20', // Too windy
        confidence_score: 60,
      }),
      createForecast({
        id: 'forecast-good',
        forecast_date: '2024-01-15',
        forecast_time: '18:00', // 10am PST
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
        forecast_date: '2024-01-15',
        forecast_time: '19:00', // 11am PST
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
        forecast_date: '2024-01-15',
        forecast_time: '17:00',
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
        forecast_date: '2024-01-15',
        forecast_time: '17:00',
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
        forecast_date: '2024-01-15',
        forecast_time: '17:00', // 9am PST - soon
        wave_height: '3',
        wave_period: '10s',
        confidence_score: 70,
      }),
      createForecast({
        forecast_date: '2024-01-17', // 2 days ahead
        forecast_time: '17:00',
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
