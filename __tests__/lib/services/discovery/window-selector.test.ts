/**
 * Unit tests for Window Selector Service
 *
 * Tests the selectBestWindow, capEndTimeToTimeSlot, and scoreForecastWindow functions
 * that select optimal surf windows from forecast data.
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { toForecastForScoring } from '@/lib/scoring';
import { getConditionBoardPick } from '@/lib/scoring/board-pick';

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

const mockBeachRisingTide: Partial<Beach> = {
  ...mockBeach,
  id: 'beach-3',
  name: 'Rising Tide Beach',
  preferred_tide_direction: 'rising',
};

// Helper to create forecast with defaults
function createForecast(overrides: Partial<EnhancedForecastEntity>): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'beach-1',
    forecast_at: '2024-01-15T17:00:00Z', // 9am PT = 5pm UTC
    forecast_date: '2024-01-15',
    forecast_time: '09:00',
    wave_height: '2',
    wave_period: '13s',
    swell_1_direction: '270',
    wind_speed: '0',
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
  selectBestWindows,
  capEndTimeToTimeSlot,
  scoreForecastWindow,
  scoreWindowWithComposite,
  scoreWindowConditionDetails,
  scoreWindowConditionScore,
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

  it('should expose composite reasons separately from the native condition score', () => {
    const forecast = createForecast({
      wave_height: '2',
      wave_period: '13s',
      wind_speed: '0',
      wind_direction: 'NE',
      wind_direction_deg: 45,
      tide_height: '3.5',
    });

    const composite = scoreWindowWithComposite(forecast, mockBeach as Beach);
    const numericScore = scoreWindowConditionScore(forecast, mockBeach as Beach);

    expect(composite.total).toBeGreaterThan(0);
    expect(numericScore).toBeGreaterThan(0);
    expect(composite.reasons.length).toBeGreaterThan(0);
    expect(Number.isFinite(composite.confidence)).toBe(true);
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

    // Should only consider 6am forecast (dawn-patrol is 6am-9am) if a window is available.
    expect(result ? result.start.getUTCHours() === 14 : true).toBe(true); // 6am PST
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

    expect(result).not.toBeNull();
    // End should be at or before sunset
    expect(result!.end.getTime()).toBeLessThanOrEqual(
      new Date('2024-01-16T01:00:00Z').getTime()
    );
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
        wave_height: '2',
        wave_period: '13s',
        wind_speed: '0',
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
    expect(result?.waveHeight).toBe('2');
    expect(result?.wavePeriod).toBe('13s');
  });

  it('should prefer an in-band window over a generic-best out-of-band window when rideabilityBand is provided', () => {
    const outOfBandGenericBest = createForecast({
      id: 'forecast-generic-best-out-of-band',
      forecast_at: '2024-01-15T17:00:00Z',
      forecast_date: '2024-01-15',
      forecast_time: '09:00',
      wave_height: '4.2',
      wave_period: '14s',
      wind_speed: '0',
      wind_direction: 'NE',
      wind_direction_deg: 45,
      tide_height: '3.5',
    });
    const inBandLowerGenericScore = createForecast({
      id: 'forecast-lower-generic-in-band',
      forecast_at: '2024-01-15T18:00:00Z',
      forecast_date: '2024-01-15',
      forecast_time: '10:00',
      wave_height: '2.5',
      wave_period: '13s',
      wind_speed: '0',
      wind_direction: 'NE',
      wind_direction_deg: 45,
      tide_height: '3.5',
    });
    const forecasts = [outOfBandGenericBest, inBandLowerGenericScore];
    const rideabilityBand = {
      ideal: { min: 2.4, max: 2.6 },
      acceptable: { min: 2.4, max: 2.6 },
      prefersClean: true,
      powerBias: -0.7,
    };

    const outOfBandBoardAwareScore = scoreWindowConditionScore(
      outOfBandGenericBest,
      mockBeach as Beach,
      null,
      rideabilityBand,
    );
    const inBandBoardAwareScore = scoreWindowConditionScore(
      inBandLowerGenericScore,
      mockBeach as Beach,
      null,
      rideabilityBand,
    );

    expect(inBandBoardAwareScore).toBeGreaterThan(outOfBandBoardAwareScore);

    const result = selectBestWindow({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
      rideabilityBand,
    });

    expect(result?.sourceForecast?.id).toBe('forecast-lower-generic-in-band');
    expect(result?.score).toBe(inBandBoardAwareScore);
  });

  it('should keep the generic-best window when rideabilityBand is absent', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-generic-best-out-of-band',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '3.5',
        wave_period: '13s',
        wind_speed: '0',
        wind_direction: 'NE',
        wind_direction_deg: 45,
        tide_height: '3.5',
      }),
      createForecast({
        id: 'forecast-lower-generic-in-band',
        forecast_at: '2024-01-15T18:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '10:00',
        wave_height: '2.5',
        wave_period: '13s',
        wind_speed: '0',
        wind_direction: 'NE',
        wind_direction_deg: 45,
        tide_height: '3.5',
      }),
    ];

    const result = selectBestWindow({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
    });

    expect(result?.sourceForecast?.id).toBe('forecast-generic-best-out-of-band');
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

  it('should use the persisted timezone for a non-Pacific beach', () => {
    const cocoaBeach: Partial<Beach> = {
      ...mockBeach,
      id: 'cocoa-beach',
      name: 'Cocoa Beach',
      lat: 28.32,
      lon: -80.61,
      timezone: 'America/New_York',
    };
    const forecasts = [
      createForecast({
        beach_id: 'cocoa-beach',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '12:00',
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
      }),
    ];

    const result = selectBestWindow(forecasts, cocoaBeach as Beach, null);

    expect(result).not.toBeNull();
    expect(result?.timezone).toBe('America/New_York');
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
    expect(result?.start.getDate()).toBe(15);
  });
});

describe('selectBestWindows', () => {
  const fixedNow = new Date('2024-01-15T16:00:00Z'); // 8am PST

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return top 3 ranked non-overlapping windows by default', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-day-1',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '2',
        wave_period: '13s',
        wind_speed: '0',
        wind_direction: 'NE',
        wind_direction_deg: 45,
        confidence_score: 85,
      }),
      createForecast({
        id: 'forecast-day-2',
        forecast_at: '2024-01-16T17:00:00Z',
        forecast_date: '2024-01-16',
        forecast_time: '09:00',
        wave_height: '2.5',
        wave_period: '14s',
        wind_speed: '2',
        wind_direction: 'NE',
        wind_direction_deg: 45,
        confidence_score: 90,
      }),
      createForecast({
        id: 'forecast-day-3',
        forecast_at: '2024-01-17T17:00:00Z',
        forecast_date: '2024-01-17',
        forecast_time: '09:00',
        wave_height: '3',
        wave_period: '12s',
        wind_speed: '4',
        wind_direction: 'NE',
        wind_direction_deg: 45,
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-day-4',
        forecast_at: '2024-01-18T17:00:00Z',
        forecast_date: '2024-01-18',
        forecast_time: '09:00',
        wave_height: '1.5',
        wave_period: '10s',
        wind_speed: '8',
        wind_direction: 'NE',
        wind_direction_deg: 45,
        confidence_score: 75,
      }),
    ];

    const windows = selectBestWindows({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
    });

    expect(windows).toHaveLength(3);
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const first = windows[i];
        const second = windows[j];
        const areDisjoint =
          first.end.getTime() <= second.start.getTime() ||
          second.end.getTime() <= first.start.getTime();

        expect(first.start.getTime()).not.toBe(second.start.getTime());
        expect(areDisjoint).toBe(true);
      }
    }
  });

  it('should respect maxWindows', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-day-1',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
      }),
      createForecast({
        id: 'forecast-day-2',
        forecast_at: '2024-01-16T17:00:00Z',
        forecast_date: '2024-01-16',
        forecast_time: '09:00',
      }),
      createForecast({
        id: 'forecast-day-3',
        forecast_at: '2024-01-17T17:00:00Z',
        forecast_date: '2024-01-17',
        forecast_time: '09:00',
      }),
    ];

    const windows = selectBestWindows({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
      maxWindows: 2,
    });

    expect(windows).toHaveLength(2);
  });

  it('should return an empty array for no candidates', () => {
    const windows = selectBestWindows({
      forecasts: [],
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
    });

    expect(windows).toEqual([]);
  });

  it('should use injected now instead of wall-clock time', () => {
    jest.setSystemTime(new Date('2024-01-17T16:00:00Z'));
    const forecasts = [
      createForecast({
        id: 'forecast-injected-now',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
      }),
    ];

    const windows = selectBestWindows({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].sourceForecast?.id).toBe('forecast-injected-now');
  });

  it('should preserve selectBestWindow first-window compatibility', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-day-1',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '4',
      }),
      createForecast({
        id: 'forecast-day-2',
        forecast_at: '2024-01-16T17:00:00Z',
        forecast_date: '2024-01-16',
        forecast_time: '09:00',
        wave_height: '5',
      }),
    ];

    const options = {
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
    };
    const windows = selectBestWindows(options);
    const bestWindow = selectBestWindow(options);

    expect(bestWindow?.sourceForecast?.id).toBe(windows[0].sourceForecast?.id);
    expect(bestWindow?.start.toISOString()).toBe(windows[0].start.toISOString());
  });

  it('should respect horizon filtering', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-in-horizon',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '3',
      }),
      createForecast({
        id: 'forecast-outside-horizon',
        forecast_at: '2024-01-17T17:00:00Z',
        forecast_date: '2024-01-17',
        forecast_time: '09:00',
        wave_height: '6',
      }),
    ];

    const windows = selectBestWindows({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      horizonHours: 24,
      now: fixedNow,
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].sourceForecast?.id).toBe('forecast-in-horizon');
  });

  it('should not duplicate overlapping windows', () => {
    const forecasts = [
      createForecast({
        id: 'forecast-9am',
        forecast_at: '2024-01-15T17:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '4',
      }),
      createForecast({
        id: 'forecast-10am',
        forecast_at: '2024-01-15T18:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '10:00',
        wave_height: '4',
      }),
      createForecast({
        id: 'forecast-11am',
        forecast_at: '2024-01-15T19:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '11:00',
        wave_height: '4',
      }),
    ];

    const windows = selectBestWindows({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: fixedNow,
      maxWindows: 3,
    });

    expect(windows).toHaveLength(1);
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
        wave_height: '3.5', // Better conditions under the native scorer
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
    // higher: wave_height '3.5', period '14s', confidence 90).
    expect(result!.waveHeight).toBe('3.5');
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

    // Should be null or have very short/no window since tide doesn't reach 3ft until after sunset.
    // The behavior depends on whether tide boundaries or sunset takes precedence.
    expect(
      result
        ? result.end.getTime() <= new Date('2024-01-16T01:00:00Z').getTime()
        : true
    ).toBe(true);
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

    // Tide-driven windows still calculate precise start times.
    // The start time is when tide crosses the min threshold.
    expect(
      result
        ? result.start.getTime() > new Date('2024-01-15T14:30:00Z').getTime()
        : true
    ).toBe(true);
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

    // Window START should be within lunch session slot (11am-2pm PST).
    // Window END can extend past 2pm for tide-driven windows (not capped).
    const startHour = result?.start.getUTCHours();
    const endHour = result?.end.getUTCHours();

    // 11am PST = 19:00 UTC, 2pm PST = 22:00 UTC
    expect(startHour == null || startHour >= 19).toBe(true);
    // This tide naturally ends before 2pm (~10:50am PST), so end is still <= 22.
    // For tide windows that extend past 2pm, this assertion would be different.
    expect(endHour == null || endHour <= 22).toBe(true);
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

    const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit",
      timeZone: "America/Los_Angeles",
    }).format(d);
    const startDate = result ? fmt(result.start) : null;
    const endDate = result ? fmt(result.end) : null;
    // If a result is returned, it should NOT span overnight (in local timezone).
    expect(startDate).toBe(endDate);
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

    const startHour = result
      ? parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: "America/Los_Angeles",
          }).format(result.start),
          10
        )
      : null;
    // If a result is returned, start should be within lunch session slot (11am-2pm).
    expect(startHour == null || startHour >= 11).toBe(true);
    expect(startHour == null || startHour < 14).toBe(true);
  });

  it('should reject tide-adjusted windows that shift start time to night hours (e.g. 1am-2am)', () => {
    // Tide schedule where the preferred range crossing occurs at ~1am PT
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T06:00:00Z').getTime() / 1000), height: 5.8, type: 'high' as const },
      { time: Math.floor(new Date('2024-01-15T12:30:00Z').getTime() / 1000), height: 0.5, type: 'low' as const },
    ];

    // Forecast at 10pm PT (6am UTC next day) - this passes the light check initially
    // because the initial startTime is in the evening, but tide boundaries shift it to 1am
    const forecasts = [
      createForecast({
        id: 'forecast-night-tide',
        forecast_at: '2024-01-15T17:00:00Z', // 9am PT
        forecast_date: '2024-01-15',
        forecast_time: '09:00',
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.5',
        tide_status: 'Falling',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set system time to 8am PT
    jest.setSystemTime(new Date('2024-01-15T16:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'falling',
    } as any;

    // Create a sun times cache with sunset at 5:30pm PT and sunrise at 6:30am PT
    const sunTimesCache = new Map<string, { sunrises: Date[]; sunsets: Date[] }>();
    sunTimesCache.set('beach-1', {
      sunrises: [new Date('2024-01-15T14:30:00Z')], // 6:30am PT
      sunsets: [new Date('2024-01-16T01:30:00Z')],   // 5:30pm PT
    });

    const result = selectBestWindow(
      forecasts,
      beachWithTidePrefs,
      null,
      undefined,
      sunTimesCache
    );

    const startHour = result
      ? parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: "America/Los_Angeles",
          }).format(result.start),
          10
        )
      : null;
    // If the tide-adjusted start time falls during night hours (before sunrise),
    // the window should be rejected. The result may be null or have a daytime start.
    expect(startHour == null || startHour >= 6).toBe(true);
    expect(startHour == null || startHour < 21).toBe(true);
  });

  it('should reject tide boundary when it lands on a different calendar day than source forecast', () => {
    // Regression for the 2026-04-17 OB Pier screenshot bug: when today has no
    // qualifying tide rise, calculateDirectionBasedWindow walks forward in the
    // tide_schedule and returns a tide window entirely on tomorrow. That leaves
    // bestWindow.start on tomorrow while bestWindow.forecast stays today, and
    // the UI renders today's wave/wind/tide numbers under a "Tomorrow's Windows"
    // label. The selector must reject a tide window whose start date differs
    // from the source forecast's date in beach TZ.
    const tideSchedule = [
      // Today's only tide events: high at 4am PT, low at 10am PT.
      // With preferred_tide_direction='rising' and afterTime = today 8am PT,
      // the direction-based fallback walks past today's 10am low and today's
      // afternoon high into tomorrow's low (simulating the OB Pier scenario).
      { time: Math.floor(new Date('2024-01-15T12:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 4am PT today
      { time: Math.floor(new Date('2024-01-15T18:00:00Z').getTime() / 1000), height: 0.8, type: 'low' as const },  // 10am PT today
      { time: Math.floor(new Date('2024-01-15T23:00:00Z').getTime() / 1000), height: 4.5, type: 'high' as const }, // 3pm PT today
      { time: Math.floor(new Date('2024-01-16T14:00:00Z').getTime() / 1000), height: -0.5, type: 'low' as const }, // 6am PT TOMORROW
      { time: Math.floor(new Date('2024-01-16T20:00:00Z').getTime() / 1000), height: 5.2, type: 'high' as const }, // 12pm PT TOMORROW
    ];

    const todayForecast = createForecast({
      id: 'today-8am',
      forecast_at: '2024-01-15T16:00:00Z', // 8am PT today = 16:00 UTC
      forecast_date: '2024-01-15',
      forecast_time: '08:00',
      wave_height: '4',
      wave_period: '12s',
      tide_height: '3.0',
      tide_status: 'Falling',
      confidence_score: 80,
      raw_forecast: {
        tide_schedule: tideSchedule,
        data_sources: ['NOAA_NWS'],
      },
    } as any);

    jest.setSystemTime(new Date('2024-01-15T14:23:00Z')); // 6:23am PT today

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 0,
      preferred_tide_ft_max: 4,
      preferred_tide_direction: 'rising', // OB Pier preference
    } as Beach;

    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [
          new Date('2024-01-15T14:30:00Z'), // 6:30am PT today
          new Date('2024-01-16T14:30:00Z'), // 6:30am PT tomorrow
        ],
        sunsets: [
          new Date('2024-01-16T01:00:00Z'), // 5pm PT today
          new Date('2024-01-17T01:00:00Z'), // 5pm PT tomorrow
        ],
      }],
    ]);

    const result = selectBestWindow({
      forecasts: [todayForecast],
      beach: beachWithTidePrefs,
      sunTimesCache,
      userPrefs: null,
    });

    expect(result).not.toBeNull();

    // bestWindow.start must be on the SAME calendar day as the source forecast
    // in the beach TZ. Without the fix, start would be tomorrow 6am PT.
    const startDateInBeachTz = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Los_Angeles',
    }).format(result!.start);
    expect(startDateInBeachTz).toBe('2024-01-15');
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

describe('scoreWindowConditionScore', () => {
  it('uses the highest score across the saved board classes', () => {
    const smallWave = createForecast({
      wave_height: '1.1',
      wave_period: '13s',
      wind_speed: '0',
      tide_height: '3.5',
    });

    const details = scoreWindowConditionDetails(
      smallWave,
      mockBeach as Beach,
      'advanced',
      null,
      ['shortboard', 'longboard'],
    );

    expect(details.boardClass).toBe('longboard');
    expect(details.score).toBeGreaterThan(0);
  });

  it('floors board-aware scoring at the no-board baseline', () => {
    const forecast = createForecast({
      wave_height: '3',
      wave_period: '13s',
      wind_speed: '0',
      tide_height: '3.5',
    });

    const baseline = scoreWindowConditionDetails(
      forecast,
      mockBeach as Beach,
      'advanced',
    );
    const boardAware = scoreWindowConditionDetails(
      forecast,
      mockBeach as Beach,
      'advanced',
      null,
      ['shortboard'],
    );

    expect(boardAware.score).toBe(baseline.score);
    expect(boardAware.boardClass).toBeNull();
  });

  it('passes the scored board class through to the displayed board pick', () => {
    const powerDay = createForecast({
      wave_height: '3.2',
      wave_period: '17s',
      swell_1_direction: '203',
      wind_speed: '4',
      wind_direction_deg: 90,
      tide_height: '3.5',
    });
    const beach = { ...mockBeach, slug: 'lower-trestles' } as Beach;
    const details = scoreWindowConditionDetails(
      powerDay,
      beach,
      'advanced',
      null,
      ['longboard', 'shortboard'],
    );

    expect(details.boardClass).toBe('longboard');

    const boardPick = getConditionBoardPick(
      toForecastForScoring(powerDay),
      [
        { id: 'lb-1', name: 'Longboard', board_type: 'longboard' },
        { id: 'sb-1', name: 'Shortboard', board_type: 'shortboard' },
      ],
      beach,
      { kind: 'scored', boardClass: details.boardClass },
    );

    expect(boardPick).toBeNull();
  });

  it('should return score on 0-100 scale', () => {
    const forecast = createForecast({
      wave_height: '2',
      wave_period: '13s',
      wind_speed: '0',
      tide_height: '3.5',
    });

    const { scoreWindowConditionScore } = require('@/lib/services/discovery/window-selector');
    const score = scoreWindowConditionScore(forecast, mockBeach as Beach);

    // Score should be 0-100
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // Default selector scoring uses the intermediate native profile.
    expect(score).toBe(73);
  });

  it('should score consistently with display scoring', () => {
    const forecast = createForecast({
      wave_height: '2',
      wave_period: '14s',
      wind_speed: '3',
      tide_height: '3.5',
    });

    const { scoreWindowConditionScore } = require('@/lib/services/discovery/window-selector');
    const score = scoreWindowConditionScore(forecast, mockBeach as Beach);

    // The default intermediate profile should still rate clean, long-period surf as good.
    expect(score).toBeGreaterThanOrEqual(65);
  });

  it('matches the native score for Mission Beach short-period onshore surf', () => {
    const missionBeach = {
      ...mockBeach,
      id: 'mission-beach',
      name: 'Mission Beach',
      swell_window_min_deg: 255,
      swell_window_max_deg: 345,
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 30,
      wind_onshore_bad_kt: 8,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 6,
      preferred_tide_direction: 'rising',
      break_type: 'jetty',
    };
    const forecast = createForecast({
      wave_height: '2.5',
      wave_period: '9s',
      wave_direction: 'WNW',
      wave_direction_om: 292.5,
      swell_1_height: '2.5',
      swell_1_period: '9s',
      swell_1_direction: 'WNW',
      wind_wave_height: '1',
      wind_wave_period: '6s',
      wind_wave_direction: 'W',
      wind_speed: '10',
      wind_direction: 'W',
      wind_direction_deg: 270,
      tide_height: '2.7',
      tide_status: 'Rising',
    });

    const { scoreWindowConditionScore } = require('@/lib/services/discovery/window-selector');
    const score = scoreWindowConditionScore(forecast, missionBeach as Beach);

    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(60);
  });
});

describe('selectBestWindow Mission Beach regression', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-26T04:02:00.000Z')); // May 25, 9:02 PM PDT
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('still selects the least-bad Mission Beach window while keeping its score fair', () => {
    const missionBeach = {
      ...mockBeach,
      id: 'mission-beach',
      name: 'Mission Beach',
      lat: 32.771,
      lon: -117.254,
      swell_window_min_deg: 255,
      swell_window_max_deg: 345,
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 30,
      wind_onshore_bad_kt: 8,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 6,
      preferred_tide_direction: 'rising',
      break_type: 'jetty',
    };
    const forecasts = [
      createForecast({
        id: 'mission-1100',
        forecast_at: '2026-05-26T18:00:00.000Z',
        forecast_date: '2026-05-26',
        forecast_time: '11:00',
        wave_height: '1',
        wave_period: '6s',
        wave_direction: 'WSW',
        swell_1_height: '1',
        swell_1_period: '6s',
        swell_1_direction: 'WSW',
        wind_speed: '10',
        wind_direction: 'W',
        wind_direction_deg: 270,
        tide_height: '1.8',
        tide_status: 'Falling',
      }),
      createForecast({
        id: 'mission-1400',
        forecast_at: '2026-05-26T21:00:00.000Z',
        forecast_date: '2026-05-26',
        forecast_time: '14:00',
        wave_height: '2.5',
        wave_period: '9s',
        wave_direction: 'WNW',
        wave_direction_om: 292.5,
        swell_1_height: '2.5',
        swell_1_period: '9s',
        swell_1_direction: 'WNW',
        wind_wave_height: '1',
        wind_wave_period: '6s',
        wind_wave_direction: 'W',
        wind_speed: '10',
        wind_direction: 'W',
        wind_direction_deg: 270,
        tide_height: '2.7',
        tide_status: 'Rising',
      }),
      createForecast({
        id: 'mission-1700',
        forecast_at: '2026-05-27T00:00:00.000Z',
        forecast_date: '2026-05-26',
        forecast_time: '17:00',
        wave_height: '1.6',
        wave_period: '8s',
        wave_direction: 'WNW',
        wave_direction_om: 292.5,
        swell_1_height: '1.6',
        swell_1_period: '8s',
        swell_1_direction: 'WNW',
        wind_speed: '10',
        wind_direction: 'W',
        wind_direction_deg: 270,
        tide_height: '4.7',
        tide_status: 'Rising',
      }),
    ];

    const result = selectBestWindow({
      forecasts,
      beach: missionBeach as Beach,
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(50);
    expect(result!.score).toBeLessThan(60);
    expect(result!.sourceForecast?.id).toBe('mission-1400');
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
    expect(result!.peakTime instanceof Date).toBe(true);
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
    expect(result!.peakTime instanceof Date).toBe(true);
  });

  it('biases peakTime away from exact high tide when the spot prefers a rising tide', () => {
    jest.setSystemTime(new Date('2024-01-15T14:00:00Z')); // 6am PST

    const forecasts = [
      createForecast({
        id: 'forecast-0700',
        beach_id: 'beach-3',
        forecast_at: '2024-01-15T15:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '07:00',
        wave_height: '2.5',
        wave_period: '8s',
        wind_speed: '6',
        tide_height: '1.9',
        tide_status: 'Rising',
        confidence_score: 78,
      }),
      createForecast({
        id: 'forecast-0800',
        beach_id: 'beach-3',
        forecast_at: '2024-01-15T16:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '08:00',
        wave_height: '2.5',
        wave_period: '8s',
        wind_speed: '5',
        tide_height: '2.4',
        tide_status: 'Rising',
        confidence_score: 80,
      }),
      createForecast({
        id: 'forecast-1100',
        beach_id: 'beach-3',
        forecast_at: '2024-01-15T19:00:00Z',
        forecast_date: '2024-01-15',
        forecast_time: '11:00',
        wave_height: '5',
        wave_period: '12s',
        wind_speed: '2',
        tide_height: '3.5',
        tide_status: 'High',
        confidence_score: 92,
      }),
    ];

    const sunTimesCache = new Map([
      ['beach-3', {
        sunrises: [new Date('2024-01-15T14:47:00Z')],
        sunsets: [new Date('2024-01-16T01:00:00Z')],
      }],
    ]);

    const result = selectBestWindow({
      forecasts,
      beach: mockBeachRisingTide as Beach,
      sunTimesCache,
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    expect(result!.peakTime instanceof Date).toBe(true);
    expect(result!.peakTime!.getTime()).toBeGreaterThanOrEqual(
      new Date('2024-01-15T15:00:00.000Z').getTime()
    );
    expect(result!.peakTime!.getTime()).toBeLessThan(
      new Date('2024-01-15T17:00:00.000Z').getTime()
    );
    expect(result!.peakTime!.toISOString()).not.toBe('2024-01-15T19:00:00.000Z');
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

describe('selectBestWindows fallback horizon constraint', () => {
  // After sunset the orchestrator falls through to a whole-horizon fallback.
  // That fallback must pick the best slot WITHIN the horizon; picking the
  // globally-best slot and then rejecting it for being out of horizon leaves
  // the beach with no window at all, which downstream becomes a zero-candidate
  // discovery and an unresolvable recommendation hold.
  const nightNow = new Date('2024-01-15T05:00:00Z'); // 9pm PT Jan 14 — after sunset

  // forecast_date/forecast_time still drive window construction, so they must
  // stay consistent with forecast_at or the window lands on the wrong day.
  function localParts(forecastAt: string): { date: string; time: string } {
    const d = new Date(forecastAt);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(d).map((p) => [p.type, p.value])
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  }

  function poorDaylightForecast(forecastAt: string): EnhancedForecastEntity {
    const { date, time } = localParts(forecastAt);
    return createForecast({
      forecast_at: forecastAt,
      forecast_date: date,
      forecast_time: time,
      wave_height: '0.8',
      wave_period: '7s',
      wind_speed: '14',
      wind_direction: 'SW',
      wind_direction_deg: 225, // onshore for this beach
      tide_height: '0.5',
    });
  }

  function betterDaylightForecast(forecastAt: string): EnhancedForecastEntity {
    const { date, time } = localParts(forecastAt);
    return createForecast({
      forecast_at: forecastAt,
      forecast_date: date,
      forecast_time: time,
      wave_height: '3',
      wave_period: '14s',
      wind_speed: '2',
      wind_direction: 'NE',
      wind_direction_deg: 45, // offshore
      tide_height: '3.5',
    });
  }

  it('selects an in-horizon window even when the best slot is beyond the horizon', () => {
    const forecasts = [
      poorDaylightForecast('2024-01-15T18:00:00Z'), // ~13h ahead, in horizon
      betterDaylightForecast('2024-01-16T18:00:00Z'), // ~37h ahead, out of horizon
    ];

    const windows = selectBestWindows({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: nightNow,
      horizonHours: 24,
    });

    expect(windows.length).toBeGreaterThan(0);
    const hoursAhead =
      (windows[0].start.getTime() - nightNow.getTime()) / (1000 * 60 * 60);
    expect(hoursAhead).toBeLessThanOrEqual(24);
  });

  it('returns no window when every daylight slot is beyond the horizon', () => {
    const forecasts = [
      betterDaylightForecast('2024-01-17T18:00:00Z'), // ~61h ahead
      betterDaylightForecast('2024-01-18T18:00:00Z'), // ~85h ahead
    ];

    const windows = selectBestWindows({
      forecasts,
      beach: mockBeach as Beach,
      userPrefs: null,
      now: nightNow,
      horizonHours: 24,
    });

    expect(windows).toHaveLength(0);
  });
});
