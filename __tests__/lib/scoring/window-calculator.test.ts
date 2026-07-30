/**
 * @jest-environment node
 *
 * Tests for window calculator - finds optimal surf windows
 */

import { calculateOptimalWindow, findPeakTime } from '@/lib/scoring/window-calculator';
import type { BeachWithThresholds, ForecastForScoring } from '@/lib/scoring/types';

describe('calculateOptimalWindow', () => {
  const baseBeach: BeachWithThresholds = {
    id: 'test-beach',
    name: 'Test Beach',
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 2.0,
    preferred_tide_ft_max: 5.0,
    max_wind_onshore_mph: 10,
    max_wind_any_mph: 18,
  } as BeachWithThresholds;

  function createForecasts(configs: Array<{
    hour: number;
    windSpeed: number;
    tideHeight: number;
  }>): ForecastForScoring[] {
    return configs.map(c => ({
      forecastTime: new Date(`2026-01-14T${String(c.hour).padStart(2, '0')}:00:00Z`),
      waveHeight: 3.5,
      wavePeriod: 12,
      windSpeed: c.windSpeed,
      windDirection: 90,
      tideHeight: c.tideHeight,
      tideStatus: 'rising',
    }));
  }

  it('returns window when all conditions are good', () => {
    const forecasts = createForecasts([
      { hour: 6, windSpeed: 5, tideHeight: 3.0 },
      { hour: 7, windSpeed: 5, tideHeight: 3.5 },
      { hour: 8, windSpeed: 5, tideHeight: 4.0 },
      { hour: 9, windSpeed: 5, tideHeight: 4.5 },
    ]);

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    expect(result!.start.getUTCHours()).toBe(6);
  });

  it('caps window when wind picks up', () => {
    const forecasts = createForecasts([
      { hour: 6, windSpeed: 5, tideHeight: 3.0 },
      { hour: 7, windSpeed: 5, tideHeight: 3.5 },
      { hour: 8, windSpeed: 15, tideHeight: 4.0 }, // Wind picks up
      { hour: 9, windSpeed: 20, tideHeight: 4.5 },
    ]);

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    expect(result!.end.getUTCHours()).toBeLessThanOrEqual(8);
  });

  it('caps window at sunset', () => {
    const forecasts = createForecasts([
      { hour: 15, windSpeed: 5, tideHeight: 3.0 },
      { hour: 16, windSpeed: 5, tideHeight: 3.5 },
      { hour: 17, windSpeed: 5, tideHeight: 4.0 },
      { hour: 18, windSpeed: 5, tideHeight: 4.5 },
    ]);

    const sunset = new Date('2026-01-14T17:30:00Z');
    const result = calculateOptimalWindow(forecasts, baseBeach, { sunsetTime: sunset });

    expect(result).not.toBeNull();
    expect(result!.end.getTime()).toBeLessThanOrEqual(sunset.getTime());
  });

  it('selects a daylight window over a higher-scoring night block', () => {
    const forecasts = createForecasts([
      { hour: 9, windSpeed: 1, tideHeight: 3.0 },
      { hour: 10, windSpeed: 1, tideHeight: 3.0 },
      { hour: 11, windSpeed: 1, tideHeight: 3.0 },
      { hour: 21, windSpeed: 10, tideHeight: 3.0 },
      { hour: 22, windSpeed: 10, tideHeight: 3.0 },
      { hour: 23, windSpeed: 10, tideHeight: 3.0 },
    ]);

    const result = calculateOptimalWindow(forecasts, baseBeach, {
      beachTimezone: 'America/Los_Angeles',
    });

    expect(result).not.toBeNull();
    expect(result!.start.getUTCHours()).toBe(21);
    expect(result!.peakTime!.getUTCHours()).toBeGreaterThanOrEqual(21);
  });

  it('returns null when timezone filtering leaves only night forecasts', () => {
    const forecasts = createForecasts([
      { hour: 9, windSpeed: 1, tideHeight: 3.0 },
      { hour: 10, windSpeed: 1, tideHeight: 3.0 },
      { hour: 11, windSpeed: 1, tideHeight: 3.0 },
    ]);

    const result = calculateOptimalWindow(forecasts, baseBeach, {
      beachTimezone: 'America/Los_Angeles',
    });

    expect(result).toBeNull();
  });

  it('returns null when no viable window exists', () => {
    // Wind ≥30 mph offshore (or ≥22 mph onshore/cross) = blown-out tier in the
    // new engine — only blown-out skips, replacing the legacy max_wind_any_mph
    // binary gate.
    const forecasts = createForecasts([
      { hour: 6, windSpeed: 35, tideHeight: 3.0 },
      { hour: 7, windSpeed: 35, tideHeight: 3.5 },
      { hour: 8, windSpeed: 35, tideHeight: 4.0 },
    ]);

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).toBeNull();
  });

  it('interpolates transition times when conditions change from bad to good', () => {
    // 35 mph offshore is blown-out → skip; 5 mph offshore is clean → viable.
    const forecasts = createForecasts([
      { hour: 6, windSpeed: 35, tideHeight: 3.0 }, // Skip - blown-out
      { hour: 7, windSpeed: 5, tideHeight: 3.0 },  // Good
      { hour: 8, windSpeed: 5, tideHeight: 3.5 },
      { hour: 9, windSpeed: 5, tideHeight: 4.0 },
    ]);

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    // Start should be interpolated between 6 and 7 (when conditions become viable)
    const startHour = result!.start.getUTCHours();
    const startMinutes = result!.start.getUTCMinutes();
    expect(startHour).toBeGreaterThanOrEqual(6);
    // Since score at 6:00 is 0 (skip) and at 7:00 is ~94, threshold 40 is crossed
    // early in the interpolation, so start should be shortly after 6:00
    expect(startHour > 6 || startMinutes > 0).toBe(true);
  });
});

describe('window calculator edge cases', () => {
  const baseBeach: BeachWithThresholds = {
    id: 'test-beach',
    name: 'Test Beach',
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 2.0,
    preferred_tide_ft_max: 5.0,
    max_wind_onshore_mph: 10,
    max_wind_any_mph: 18,
  } as BeachWithThresholds;

  function createForecast(hour: number, overrides: Partial<ForecastForScoring> = {}): ForecastForScoring {
    return {
      forecastTime: new Date(`2026-01-14T${String(hour).padStart(2, '0')}:00:00Z`),
      waveHeight: 3.5,
      wavePeriod: 12,
      windSpeed: 5,
      windDirection: 90,
      tideHeight: 3.0,
      tideStatus: 'rising',
      ...overrides,
    };
  }

  it('handles empty forecast array', () => {
    const result = calculateOptimalWindow([], baseBeach);
    expect(result).toBeNull();
  });

  it('handles single forecast point', () => {
    const result = calculateOptimalWindow([createForecast(6)], baseBeach);
    // Single point cannot form a window of minimum duration
    expect(result).toBeNull();
  });

  it('respects minimum session length', () => {
    // Window would be less than 1 hour
    const forecasts = [
      createForecast(6, { windSpeed: 35 }), // Blown out
      createForecast(7, { windSpeed: 5 }),  // Good - but only 30 min before...
      createForecast(8, { windSpeed: 35 }), // Blown out again
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach, { minSessionHours: 2 });
    // With 2-hour minimum, no viable window
    expect(result).toBeNull();
  });

  it('respects maximum window length of 4 hours', () => {
    const forecasts = Array.from({ length: 8 }, (_, i) =>
      createForecast(6 + i)
    );

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    const durationHours = (result!.end.getTime() - result!.start.getTime()) / (1000 * 60 * 60);
    expect(durationHours).toBeLessThanOrEqual(4);
  });

  it('finds peak time within window', () => {
    // Use wave period to differentiate scores (14s+ gives max points, lower gives less)
    // waveHeight=2 is beginner-friendly so period differences drive ranking
    const forecasts = [
      createForecast(6, { waveHeight: 2, wavePeriod: 10 }),  // Good but not max
      createForecast(7, { waveHeight: 2, wavePeriod: 16 }),  // Best - max period score
      createForecast(8, { waveHeight: 2, wavePeriod: 12 }),  // Good
      createForecast(9, { waveHeight: 2, wavePeriod: 10 }),  // Good but not max
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    expect(result!.peakTime).toBeInstanceOf(Date);
    expect(result!.peakTime!.getUTCHours()).toBe(7);
  });

  it('uses custom minScoreThreshold', () => {
    // Use ideal-range waves (2ft) + short period (6s) to get moderate scores
    // Wave-height ceiling caps at 55 for 2ft intermediate, so total ~55
    const forecasts = [
      createForecast(6, { waveHeight: 2, wavePeriod: 6 }),
      createForecast(7, { waveHeight: 2, wavePeriod: 6 }),
      createForecast(8, { waveHeight: 2, wavePeriod: 6 }),
    ];

    // With high threshold (90), should return null since scores are ~55
    const highThresholdResult = calculateOptimalWindow(forecasts, baseBeach, { minScoreThreshold: 90 });

    // With low threshold (50), should find a window
    const lowThresholdResult = calculateOptimalWindow(forecasts, baseBeach, { minScoreThreshold: 50 });

    expect(highThresholdResult).toBeNull();
    expect(lowThresholdResult).not.toBeNull();
  });

  it('includes boundary reason descriptions', () => {
    const forecasts = [
      createForecast(6, { tideHeight: 1.5 }), // Below preferred
      createForecast(7, { tideHeight: 2.5 }), // In range
      createForecast(8, { tideHeight: 3.5 }),
      createForecast(9, { windSpeed: 20 }),   // Wind picks up
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    expect(result!.startReason).toEqual(
      expect.objectContaining({ factor: expect.any(String) }),
    );
    expect(result!.endReason).toEqual(
      expect.objectContaining({ factor: expect.any(String) }),
    );
  });

  it('generates a message for the window', () => {
    const forecasts = [
      createForecast(6),
      createForecast(7),
      createForecast(8),
      createForecast(9),
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    expect(result!.message).toEqual(expect.any(String));
    expect(result!.message.length).toBeGreaterThan(0);
  });
});

describe('interpolateTransition', () => {
  const baseBeach: BeachWithThresholds = {
    id: 'test-beach',
    name: 'Test Beach',
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 2.0,
    preferred_tide_ft_max: 5.0,
    max_wind_onshore_mph: 10,
    max_wind_any_mph: 18,
  } as BeachWithThresholds;

  function createForecast(hour: number, minute: number = 0, overrides: Partial<ForecastForScoring> = {}): ForecastForScoring {
    const timeStr = `2026-01-14T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
    return {
      forecastTime: new Date(timeStr),
      waveHeight: 3.5,
      wavePeriod: 12,
      windSpeed: 5,
      windDirection: 90,
      tideHeight: 3.0,
      tideStatus: 'rising',
      ...overrides,
    };
  }

  it('interpolates start time when conditions improve', () => {
    // 35 mph offshore is blown-out (≥30 mph offshore tier) and skips — the
    // new tier-based skip replaces the legacy max_wind_any_mph binary gate.
    const forecasts = [
      createForecast(6, 0, { windSpeed: 35 }), // Bad at 6:00
      createForecast(7, 0, { windSpeed: 5 }),  // Good at 7:00
      createForecast(8, 0, { windSpeed: 5 }),
      createForecast(9, 0, { windSpeed: 5 }),
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    // Start should be interpolated somewhere between 6:00 and 7:00
    const startHour = result!.start.getUTCHours();
    const startMinutes = result!.start.getUTCMinutes();
    expect(startHour).toBeGreaterThanOrEqual(6);
    expect(startHour > 6 || startMinutes > 0).toBe(true);
  });

  it('interpolates end time when conditions degrade', () => {
    // 35 mph offshore is blown-out; tier-based skip replaces legacy
    // max_wind_any_mph binary gate.
    const forecasts = [
      createForecast(6, 0, { windSpeed: 5 }),
      createForecast(7, 0, { windSpeed: 5 }),
      createForecast(8, 0, { windSpeed: 5 }),
      createForecast(9, 0, { windSpeed: 35 }), // Blown out at 9:00
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    // End should be interpolated somewhere between 8:00 and 9:00
    const endHour = result!.end.getUTCHours();
    expect(endHour).toBeLessThanOrEqual(9);
  });
});

describe('findPeakTime tide-phase guard', () => {
  function makeScored(timeIso: string, tideStatus: string, score: number) {
    return {
      forecast: {
        forecastTime: new Date(timeIso),
        waveHeight: 3,
        wavePeriod: 12,
        windSpeed: 5,
        windDirection: 90,
        tideHeight: 3,
        tideStatus,
      } as ForecastForScoring,
      score,
      isViable: true,
    };
  }

  it('skips slack-high slot when an earlier rising slot is within 5pts', () => {
    const scored = [
      makeScored('2026-05-01T14:00:00Z', 'rising', 76),
      makeScored('2026-05-01T15:00:00Z', 'rising', 78),
      makeScored('2026-05-01T16:00:00Z', 'slack-high', 80),
      makeScored('2026-05-01T17:00:00Z', 'falling', 74),
    ];
    const peak = findPeakTime(scored, 0, 3);
    expect(peak?.toISOString()).toBe('2026-05-01T15:00:00.000Z');
  });

  it('returns slack slot when no non-slack slot is within 5pts', () => {
    const scored = [
      makeScored('2026-05-01T14:00:00Z', 'rising', 60),
      makeScored('2026-05-01T16:00:00Z', 'slack-high', 80),
    ];
    const peak = findPeakTime(scored, 0, 1);
    expect(peak?.toISOString()).toBe('2026-05-01T16:00:00.000Z');
  });
});
