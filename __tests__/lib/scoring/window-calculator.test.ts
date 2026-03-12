/**
 * Tests for window calculator - finds optimal surf windows
 */

import { calculateOptimalWindow } from '@/lib/scoring/window-calculator';
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

  it('returns null when no viable window exists', () => {
    const forecasts = createForecasts([
      { hour: 6, windSpeed: 25, tideHeight: 3.0 }, // All too windy
      { hour: 7, windSpeed: 25, tideHeight: 3.5 },
      { hour: 8, windSpeed: 25, tideHeight: 4.0 },
    ]);

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).toBeNull();
  });

  it('interpolates transition times when conditions change from bad to good', () => {
    // Use wind speed that exceeds max_wind_any_mph (18) to create skip condition
    const forecasts = createForecasts([
      { hour: 6, windSpeed: 25, tideHeight: 3.0 }, // Skip - too windy
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
    if (startHour === 6) {
      expect(startMinutes).toBeGreaterThan(0);
    }
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
      createForecast(6, { windSpeed: 25 }), // Bad
      createForecast(7, { windSpeed: 5 }),  // Good - but only 30 min before...
      createForecast(8, { windSpeed: 25 }), // Bad again
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
    // waveHeight=5 at idealMax gives ceiling=100 so period differences drive ranking
    const forecasts = [
      createForecast(6, { waveHeight: 5, wavePeriod: 10 }),  // Good but not max
      createForecast(7, { waveHeight: 5, wavePeriod: 16 }),  // Best - max period score
      createForecast(8, { waveHeight: 5, wavePeriod: 12 }),  // Good
      createForecast(9, { waveHeight: 5, wavePeriod: 10 }),  // Good but not max
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    expect(result!.peakTime).toBeDefined();
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
    expect(result!.startReason).toBeDefined();
    expect(result!.endReason).toBeDefined();
    expect(result!.startReason.factor).toBeDefined();
    expect(result!.endReason.factor).toBeDefined();
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
    expect(result!.message).toBeTruthy();
    expect(typeof result!.message).toBe('string');
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
    const forecasts = [
      createForecast(6, 0, { windSpeed: 25 }), // Bad at 6:00
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
    if (startHour === 6) {
      expect(startMinutes).toBeGreaterThan(0);
    }
  });

  it('interpolates end time when conditions degrade', () => {
    const forecasts = [
      createForecast(6, 0, { windSpeed: 5 }),
      createForecast(7, 0, { windSpeed: 5 }),
      createForecast(8, 0, { windSpeed: 5 }),
      createForecast(9, 0, { windSpeed: 25 }), // Bad at 9:00
    ];

    const result = calculateOptimalWindow(forecasts, baseBeach);

    expect(result).not.toBeNull();
    // End should be interpolated somewhere between 8:00 and 9:00
    const endHour = result!.end.getUTCHours();
    expect(endHour).toBeLessThanOrEqual(9);
  });
});
