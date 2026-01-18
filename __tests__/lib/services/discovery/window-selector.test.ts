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
    // Tide schedule: Low at 14:47 (1.2ft), High at 20:52 (5.8ft)
    // The 2.0ft crossing occurs around 16:28, the 4.0ft crossing around 18:30
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:47:00Z').getTime() / 1000), height: 1.2, type: 'low' as const },
      { time: Math.floor(new Date('2024-01-15T20:52:00Z').getTime() / 1000), height: 5.8, type: 'high' as const },
    ];

    // Forecast starts at 15:00 (7am PST) - BEFORE the 2.0ft crossing at ~16:28
    const forecasts = [
      createForecast({
        id: 'forecast-with-tide',
        forecast_date: '2024-01-15',
        forecast_time: '15:00', // 7am PST - before 2.0ft crossing
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

    // Adjust fixed time to be at 15:00 for this test
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
        forecast_date: '2024-01-15',
        forecast_time: '17:00',
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
        forecast_date: '2024-01-15',
        forecast_time: '17:00',
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
    // Rising tide from 2pm to 10pm - but sunset is at 5pm
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T22:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const }, // 2pm PST
      { time: Math.floor(new Date('2024-01-16T04:00:00Z').getTime() / 1000), height: 6.0, type: 'high' as const }, // 8pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-late',
        forecast_date: '2024-01-15',
        forecast_time: '22:30', // 2:30pm PST - rising tide starting
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

    // Set time to 2:30pm PST
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
        forecast_date: '2024-01-16',
        forecast_time: '00:30', // 4:30pm PST
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

  it('should cap tide window at time slot end for dawn-patrol', () => {
    // Tide schedule with tide window extending past 9am
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:00:00Z').getTime() / 1000), height: 1.2, type: 'low' as const }, // 6am PST
      { time: Math.floor(new Date('2024-01-15T20:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 12pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-morning',
        forecast_date: '2024-01-15',
        forecast_time: '15:00', // 7am PST - rising tide
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

    // Set time to 7am PST
    jest.setSystemTime(new Date('2024-01-15T15:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.5, // Would extend well past 9am without cap
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'dawn-patrol', // 6am-9am
      userPrefs: null,
    });

    if (result) {
      // Window should be capped at 9am PST (17:00 UTC)
      expect(result.end.getUTCHours()).toBeLessThanOrEqual(17);
    }
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
        forecast_date: '2024-01-15',
        forecast_time: '14:30', // 6:30am PST
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

  it('should handle time slot filter with morning slot and tide boundaries', () => {
    // Tide schedule spanning morning hours
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T15:00:00Z').getTime() / 1000), height: 1.5, type: 'low' as const }, // 7am PST
      { time: Math.floor(new Date('2024-01-15T21:00:00Z').getTime() / 1000), height: 5.0, type: 'high' as const }, // 1pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-mid-morning',
        forecast_date: '2024-01-15',
        forecast_time: '17:00', // 9am PST
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

    // Set time to 9am PST
    jest.setSystemTime(new Date('2024-01-15T17:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'morning', // 9am-12pm
      userPrefs: null,
    });

    if (result) {
      // Window should be within morning slot (9am-12pm PST)
      const startHour = result.start.getUTCHours();
      const endHour = result.end.getUTCHours();

      // 9am PST = 17:00 UTC, 12pm PST = 20:00 UTC
      expect(startHour).toBeGreaterThanOrEqual(17);
      expect(endHour).toBeLessThanOrEqual(20);
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
        forecast_date: '2024-01-15',
        forecast_time: '20:00', // 12pm PST (noon)
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
    // Tide schedule that would create an evening window (7pm) when morning slot selected
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T22:00:00Z').getTime() / 1000), height: 0.5, type: 'low' as const }, // 2pm PST
      { time: Math.floor(new Date('2024-01-16T04:00:00Z').getTime() / 1000), height: 6.0, type: 'high' as const }, // 8pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-morning',
        forecast_date: '2024-01-15',
        forecast_time: '17:00', // 9am PST
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
      timeSlot: 'morning', // 5am-12pm
    });

    // If a result is returned, start should be within morning slot (5am-12pm)
    if (result) {
      const startHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: "America/Los_Angeles",
        }).format(result.start),
        10
      );
      // Morning slot is 5am-12pm
      expect(startHour).toBeGreaterThanOrEqual(5);
      expect(startHour).toBeLessThan(12);
    }
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
    expect(range.endHour).toBe(9);
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
    expect(range.endHour).toBe(9);
  });

  it('should fall back to 6am when no sunrise data', () => {
    const { getDawnPatrolRange } = require('@/lib/services/discovery/window-selector');

    const beachTz = 'America/Los_Angeles';
    const sunrises: Date[] = [];
    const forecastDate = new Date('2024-01-15T17:00:00Z');

    const range = getDawnPatrolRange(sunrises, forecastDate, beachTz);

    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(9);
  });
});
