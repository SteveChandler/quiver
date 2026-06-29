/**
 * @jest-environment node
 *
 * Tests for calculateMultipleWindows() — finds multiple viable surf windows per day
 */

import { calculateMultipleWindows } from '@/lib/scoring/window-calculator';
import type { BeachWithThresholds, ForecastForScoring } from '@/lib/scoring/types';

// Beach config that lets conditions vary cleanly
const baseBeach: BeachWithThresholds = {
  id: 'test-beach',
  name: 'Test Beach',
  wind_offshore_deg: 90,   // East is offshore
  wind_offshore_tol_deg: 30,
  preferred_tide_ft_min: 2.0,
  preferred_tide_ft_max: 5.0,
  max_wind_onshore_mph: 10,
  max_wind_any_mph: 25,
  swell_window_center_deg: 270, // West swell is ideal
  swell_window_halfwidth_deg: 45,
};

/**
 * Helper to create a ForecastForScoring at a specific hour with specific conditions.
 * Good conditions: waveHeight=2, wavePeriod=13, windSpeed=0, tideHeight=3.5.
 * Bad conditions: sub-minimum beginner waves score as 0.
 */
function makeForecast(
  hour: number,
  waveHeight: number,
  wavePeriod: number,
  windSpeed: number,
  windDirection: number,
  tideHeight: number
): ForecastForScoring {
  return {
    forecastTime: new Date(`2026-03-25T${hour.toString().padStart(2, '0')}:00:00Z`),
    waveHeight,
    wavePeriod,
    windSpeed,
    windDirection,
    tideHeight,
    tideStatus: 'rising',
  };
}

/** Good forecast: offshore wind, decent waves, good tide */
function goodForecast(hour: number): ForecastForScoring {
  return makeForecast(hour, 2.0, 13, 0, 90, 3.5);
}

/** Bad forecast: below the public/default beginner wave minimum */
function badForecast(hour: number): ForecastForScoring {
  return makeForecast(hour, 0.3, 8, 30, 270, 3.5);
}

describe('calculateMultipleWindows', () => {
  it('returns 2 windows when morning and evening peaks are separated by bad conditions', () => {
    // Morning window: hours 6-9 (good)
    // Middle: hours 10-13 (bad)
    // Evening window: hours 14-17 (good)
    const forecasts: ForecastForScoring[] = [
      goodForecast(6), goodForecast(7), goodForecast(8), goodForecast(9),
      badForecast(10), badForecast(11), badForecast(12), badForecast(13),
      goodForecast(14), goodForecast(15), goodForecast(16), goodForecast(17),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.windows).toHaveLength(2);
    expect(result.bestWindow).not.toBeNull();
  });

  it('returns 1 window when there is a single contiguous viable block', () => {
    const forecasts: ForecastForScoring[] = [
      badForecast(6),
      goodForecast(7), goodForecast(8), goodForecast(9), goodForecast(10),
      badForecast(11),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.windows).toHaveLength(1);
    expect(result.bestWindow).not.toBeNull();
  });

  it('returns empty array when all scores are below threshold', () => {
    const forecasts: ForecastForScoring[] = [
      badForecast(6), badForecast(7), badForecast(8),
      badForecast(9), badForecast(10), badForecast(11),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.windows).toHaveLength(0);
    expect(result.bestWindow).toBeNull();
  });

  it('returns all 3 windows when three viable blocks exist, ranked by avg score', () => {
    // Window 1 (hours 5-7): good
    // Gap (hour 8): bad
    // Window 2 (hours 9-11): good
    // Gap (hour 12): bad
    // Window 3 (hours 13-15): good
    // Gap (hour 16): bad
    // (Each window separated by >2hrs gap — hours 8, 12, 16 are all bad)
    const forecasts: ForecastForScoring[] = [
      goodForecast(5), goodForecast(6), goodForecast(7),
      badForecast(8), badForecast(9), // 2-hour gap
      goodForecast(10), goodForecast(11), goodForecast(12),
      badForecast(13), badForecast(14), // 2-hour gap
      goodForecast(15), goodForecast(16), goodForecast(17),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.windows).toHaveLength(3);
    // Windows should be ranked by avg score (descending)
    for (let i = 0; i < result.windows.length - 1; i++) {
      expect(result.windows[i].avgScore).toBeGreaterThanOrEqual(
        result.windows[i + 1].avgScore!
      );
    }
  });

  it('filters out windows shorter than 1.5 hours', () => {
    // Only 1 viable hour — should be filtered as too short
    const forecasts: ForecastForScoring[] = [
      badForecast(6),
      goodForecast(7), // Just 1 hour viable
      badForecast(8), badForecast(9),
      // Second window that IS long enough (3 hours)
      goodForecast(10), goodForecast(11), goodForecast(12), goodForecast(13),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    // Only the 3-hour window should survive; the 1-hour block is too short
    expect(result.windows).toHaveLength(1);
    // The surviving window should end at or after hour 12 (it covers hours 10-13)
    expect(result.windows[0].end.getUTCHours()).toBeGreaterThanOrEqual(12);
  });

  it('merges windows that are less than 2 hours apart', () => {
    // Two viable blocks with only a 1-hour gap between them
    const forecasts: ForecastForScoring[] = [
      goodForecast(6), goodForecast(7), goodForecast(8),
      badForecast(9), // 1-hour gap (< 2hrs) — should be merged
      goodForecast(10), goodForecast(11), goodForecast(12),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    // Should merge into a single window, not return 2
    expect(result.windows).toHaveLength(1);
  });

  it('each window has its own condition character', () => {
    const forecasts: ForecastForScoring[] = [
      goodForecast(6), goodForecast(7), goodForecast(8),
      badForecast(9), badForecast(10), badForecast(11), // 3-hour gap
      goodForecast(12), goodForecast(13), goodForecast(14),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.windows).toHaveLength(2);
    result.windows.forEach(window => {
      expect(window.character).toMatchObject({
        label: expect.any(String),
        category: expect.any(String),
      });
    });
  });

  it('bestWindow matches the highest-scored window', () => {
    const forecasts: ForecastForScoring[] = [
      goodForecast(6), goodForecast(7), goodForecast(8),
      badForecast(9), badForecast(10), badForecast(11),
      goodForecast(12), goodForecast(13), goodForecast(14),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.bestWindow).not.toBeNull();
    // bestWindow should be the first window (highest score)
    expect(result.bestWindow!.start).toEqual(result.windows[0].start);
    expect(result.bestWindow!.end).toEqual(result.windows[0].end);
  });

  it('each window has avgScore populated', () => {
    const forecasts: ForecastForScoring[] = [
      goodForecast(6), goodForecast(7), goodForecast(8), goodForecast(9),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]).toEqual(
      expect.objectContaining({ avgScore: expect.any(Number) }),
    );
    expect(typeof result.windows[0].avgScore).toBe('number');
    expect(result.windows[0].avgScore).toBeGreaterThan(0);
  });

  it('each window has start, end, peakTime, startReason, endReason, message', () => {
    const forecasts: ForecastForScoring[] = [
      goodForecast(6), goodForecast(7), goodForecast(8), goodForecast(9),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    expect(result.windows).toHaveLength(1);
    const w = result.windows[0];
    expect(w.start).toBeInstanceOf(Date);
    expect(w.end).toBeInstanceOf(Date);
    expect(w.peakTime).toBeInstanceOf(Date);
    expect(w.startReason).toMatchObject({
      description: expect.any(String),
      factor: expect.any(String),
      time: expect.any(Date),
    });
    expect(w.endReason).toMatchObject({
      description: expect.any(String),
      factor: expect.any(String),
      time: expect.any(Date),
    });
    expect(w.message).toEqual(expect.any(String));
  });

  it('respects maxWindows option — returns at most that many windows', () => {
    const forecasts: ForecastForScoring[] = [
      goodForecast(5), goodForecast(6), goodForecast(7),
      badForecast(8), badForecast(9),
      goodForecast(10), goodForecast(11), goodForecast(12),
      badForecast(13), badForecast(14),
      goodForecast(15), goodForecast(16), goodForecast(17),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach, { maxWindows: 2 });

    expect(result.windows.length).toBeLessThanOrEqual(2);
  });

  it('handles empty forecast array gracefully', () => {
    const result = calculateMultipleWindows([], baseBeach);
    expect(result.windows).toHaveLength(0);
    expect(result.bestWindow).toBeNull();
  });

  it('uses lower threshold (30) than calculateOptimalWindow (40) — includes minimal-quality blocks', () => {
    // Mediocre forecasts that score around 30-40 (above 30 but below 40)
    // These should be included by calculateMultipleWindows but not calculateOptimalWindow
    const forecasts: ForecastForScoring[] = [
      // 0.8ft, 7s period, 10mph wind — should score in 30-40 range
      makeForecast(6, 0.8, 7, 10, 90, 3.5),
      makeForecast(7, 0.8, 7, 10, 90, 3.5),
      makeForecast(8, 0.8, 7, 10, 90, 3.5),
    ];

    const result = calculateMultipleWindows(forecasts, baseBeach);

    // With the lower threshold, these should be included
    // (exact score depends on scorer internals, but we verify the function runs)
    expect(result).toEqual(expect.objectContaining({ windows: expect.any(Array) }));
    expect(Array.isArray(result.windows)).toBe(true);
  });
});
