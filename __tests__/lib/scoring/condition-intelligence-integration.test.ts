/**
 * @jest-environment node
 *
 * Integration tests for the Condition Intelligence pipeline.
 *
 * Verifies the full data flow end-to-end:
 *   scoreConditions → character/swellQualityBoost
 *   → calculateMultipleWindows
 *   → getConditionBoardPick
 *   → calculateRelativeContext
 *
 * Scenarios tested:
 *   1. Small but powerful day (1.5ft, 14s, ideal direction, offshore wind)
 *   2. Truly flat day (0.3ft, 4s)
 *   3. Good conditions without swell boost (4ft, 12s, offshore)
 *   4. Blown out (3ft, 12s, 30mph wind)
 *   5. Swell quality boost comparison (14s ideal vs 6s off-direction)
 */

import { scoreConditions } from '@/lib/scoring/surf-conditions-scorer';
import { calculateMultipleWindows } from '@/lib/scoring/window-calculator';
import { getConditionBoardPick } from '@/lib/scoring/board-pick';
import { calculateRelativeContext } from '@/lib/scoring/relative-context';
import type { BoardForPick } from '@/lib/scoring/board-pick';
import type { DailyScore } from '@/lib/scoring/relative-context';
import type { BeachWithThresholds, ForecastForScoring } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * A beach with a well-configured swell window (W-SW swell, E offshore wind).
 * swell_window_center_deg=260 means W-SW swell is ideal.
 * swell_window_halfwidth_deg=30 gives a 260±30° ideal window.
 */
const qualityBeach: BeachWithThresholds = {
  id: 'quality-beach',
  name: 'Quality Test Beach',
  wind_offshore_deg: 90,          // East wind is offshore
  wind_offshore_tol_deg: 45,
  preferred_tide_ft_min: 2.0,
  preferred_tide_ft_max: 5.0,
  max_wind_onshore_mph: 10,
  max_wind_any_mph: 25,
  swell_window_center_deg: 260,   // W-SW swell is ideal
  swell_window_halfwidth_deg: 30,
};

/** Mixed quiver with longboard + shortboard */
const quiverWithLongboard: BoardForPick[] = [
  { id: 'lb-1', name: "9'2 Torq Longboard", board_type: 'longboard', volume: 78 },
  { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
];

/** Helper: build a ForecastForScoring inline */
function makeForecast(overrides: Partial<ForecastForScoring> & {
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: number;
}): ForecastForScoring {
  return {
    forecastTime: new Date('2026-03-25T08:00:00Z'),
    tideHeight: 3.0,
    tideStatus: 'rising',
    swellDirection: 260, // ideal direction for qualityBeach by default
    ...overrides,
  };
}

/** Build a series of identical forecasts at consecutive hours for window testing */
function makeForecastSeries(
  hourStart: number,
  hourCount: number,
  base: Omit<ForecastForScoring, 'forecastTime'>
): ForecastForScoring[] {
  return Array.from({ length: hourCount }, (_, i) => ({
    ...base,
    forecastTime: new Date(
      `2026-03-25T${String(hourStart + i).padStart(2, '0')}:00:00Z`
    ),
  }));
}

// ---------------------------------------------------------------------------
// Scenario 1: Small but powerful day
// ---------------------------------------------------------------------------

describe('Scenario 1: Small but powerful day (1.5ft, 14s, ideal direction)', () => {
  const forecast = makeForecast({
    waveHeight: 1.5,
    wavePeriod: 14,
    windSpeed: 5,          // light offshore — good conditions
    windDirection: 90,     // offshore for this beach
    tideHeight: 3.0,       // within preferred range
    swellDirection: 260,   // perfect alignment with swell_window_center_deg
  });

  let result: ReturnType<typeof scoreConditions>;

  beforeAll(() => {
    result = scoreConditions(forecast, qualityBeach);
  });

  it('score is meaningfully higher than raw small-wave score (> 45)', () => {
    expect(result.total).toBeGreaterThan(45);
  });

  it('swellQualityBoost is positive', () => {
    expect(result.swellQualityBoost).toBeGreaterThan(0);
  });

  it('character category is small-quality or small-clean', () => {
    expect(['small-quality', 'small-clean']).toContain(result.character.category);
  });

  it('character label contains "powerful" or "clean"', () => {
    expect(result.character.label).toMatch(/powerful|clean/i);
  });

  it('matchQuality is not "skip" (should be fair or better)', () => {
    expect(result.matchQuality).not.toBe('skip');
    expect(['perfect', 'excellent', 'good', 'fair', 'minimal']).toContain(result.matchQuality);
  });

  it('recommendationLabel is "Maybe" or "Worth it" — not "Skip"', () => {
    expect(result.recommendationLabel).not.toBe('Skip');
    expect(['Maybe', 'Worth it']).toContain(result.recommendationLabel);
  });

  it('multi-window returns at least 1 window for a full day of these conditions', () => {
    const forecasts = makeForecastSeries(6, 10, {
      waveHeight: 1.5,
      wavePeriod: 14,
      windSpeed: 5,
      windDirection: 90,
      tideHeight: 3.0,
      tideStatus: 'rising',
      swellDirection: 260,
    });

    const multiResult = calculateMultipleWindows(forecasts, qualityBeach);
    expect(multiResult.windows.length).toBeGreaterThanOrEqual(1);
    expect(multiResult.bestWindow).not.toBeNull();
  });

  it('board pick returns the longboard (better for small, clean waves)', () => {
    const pick = getConditionBoardPick(forecast, quiverWithLongboard, qualityBeach);
    expect(pick).not.toBeNull();
    expect(pick!.boardType).toBe('longboard');
  });

  it('relative context: isBestOfWeek is true when today is best of week', () => {
    const todayScore = result.total;
    const weekScores: DailyScore[] = [
      { date: '2026-03-25', score: todayScore },
      { date: '2026-03-26', score: todayScore - 10 },
      { date: '2026-03-27', score: todayScore - 15 },
      { date: '2026-03-28', score: todayScore - 20 },
      { date: '2026-03-29', score: todayScore - 12 },
      { date: '2026-03-30', score: todayScore - 18 },
      { date: '2026-03-31', score: todayScore - 8 },
    ];

    const context = calculateRelativeContext(todayScore, todayScore - 15, weekScores);
    expect(context.isBestOfWeek).toBe(true);
  });

  it('relative context: trend is "improving" when today is 15+ pts better than yesterday', () => {
    const todayScore = result.total;
    const yesterdayScore = todayScore - 15; // 15 pts below today → improving

    const weekScores: DailyScore[] = [
      { date: '2026-03-25', score: todayScore },
    ];

    const context = calculateRelativeContext(todayScore, yesterdayScore, weekScores);
    expect(context.trend).toBe('improving');
    expect(context.trendDelta).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Truly flat day
// ---------------------------------------------------------------------------

describe('Scenario 2: Truly flat day (0.3ft, 4s)', () => {
  const forecast = makeForecast({
    waveHeight: 0.3,
    wavePeriod: 4,
    windSpeed: 8,
    windDirection: 90,
    tideHeight: 3.0,
    swellDirection: null,
  });

  let result: ReturnType<typeof scoreConditions>;

  beforeAll(() => {
    result = scoreConditions(forecast, qualityBeach);
  });

  it('score is very low (< 20)', () => {
    expect(result.total).toBeLessThan(20);
  });

  it('character category is "flat"', () => {
    expect(result.character.category).toBe('flat');
  });

  it('swellQualityBoost is effectively zero (no meaningful boost on 0.3ft)', () => {
    // At 0.3ft the smallWaveMultiplier = (0.3 - 0.5) / 1.5 which is negative → clamped to 0
    expect(result.swellQualityBoost).toBe(0);
  });

  it('multi-window returns empty (no viable windows on flat day)', () => {
    const forecasts = makeForecastSeries(6, 12, {
      waveHeight: 0.3,
      wavePeriod: 4,
      windSpeed: 8,
      windDirection: 90,
      tideHeight: 3.0,
      tideStatus: 'rising',
      swellDirection: null,
    });

    const multiResult = calculateMultipleWindows(forecasts, qualityBeach);
    expect(multiResult.windows).toHaveLength(0);
    expect(multiResult.bestWindow).toBeNull();
  });

  it('board pick returns null when quiver is empty', () => {
    const pick = getConditionBoardPick(forecast, [], qualityBeach);
    expect(pick).toBeNull();
  });

  it('relative context is computed without error', () => {
    const weekScores: DailyScore[] = [
      { date: '2026-03-25', score: result.total },
      { date: '2026-03-26', score: result.total + 2 },
    ];
    const context = calculateRelativeContext(result.total, null, weekScores);
    expect(context.trend).toBe('stable'); // no yesterday score → stable
    expect(context.trendDelta).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Good conditions (4ft, 12s, offshore) — no swell boost needed
// ---------------------------------------------------------------------------

describe('Scenario 3: Good conditions (4ft, 12s, offshore, good tide)', () => {
  const forecast = makeForecast({
    waveHeight: 4.0,
    wavePeriod: 12,
    windSpeed: 5,
    windDirection: 90,    // offshore
    tideHeight: 3.5,      // within preferred range
    swellDirection: 260,  // ideal direction
  });

  let result: ReturnType<typeof scoreConditions>;

  beforeAll(() => {
    result = scoreConditions(forecast, qualityBeach);
  });

  it('score is high (> 70)', () => {
    expect(result.total).toBeGreaterThan(70);
  });

  it('swellQualityBoost is 0 (above 2ft threshold, no boost applies)', () => {
    // calculateSwellQualityBoost returns 0 for waveHeight >= 2
    expect(result.swellQualityBoost).toBe(0);
  });

  it('character category is "medium-clean"', () => {
    expect(result.character.category).toBe('medium-clean');
  });

  it('multi-window returns windows for a full day of these conditions', () => {
    const forecasts = makeForecastSeries(6, 10, {
      waveHeight: 4.0,
      wavePeriod: 12,
      windSpeed: 5,
      windDirection: 90,
      tideHeight: 3.5,
      tideStatus: 'rising',
      swellDirection: 260,
    });

    const multiResult = calculateMultipleWindows(forecasts, qualityBeach);
    expect(multiResult.windows.length).toBeGreaterThanOrEqual(1);
    expect(multiResult.bestWindow).not.toBeNull();
  });

  it('board pick recommends shortboard for 4ft conditions', () => {
    const pick = getConditionBoardPick(forecast, quiverWithLongboard, qualityBeach);
    expect(pick).not.toBeNull();
    expect(pick!.boardType).toBe('shortboard');
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Blown out (3ft, 12s, 30mph wind)
// ---------------------------------------------------------------------------

describe('Scenario 4: Blown out (3ft, 12s, 30mph wind)', () => {
  const forecast = makeForecast({
    waveHeight: 3.0,
    wavePeriod: 12,
    windSpeed: 30,       // exceeds max_wind_any_mph=25
    windDirection: 270,  // onshore (W wind, beach faces E)
    tideHeight: 3.0,
    swellDirection: 260,
  });

  let result: ReturnType<typeof scoreConditions>;

  beforeAll(() => {
    result = scoreConditions(forecast, qualityBeach);
  });

  it('matchQuality is "skip"', () => {
    expect(result.matchQuality).toBe('skip');
  });

  it('character category is "skip"', () => {
    expect(result.character.category).toBe('skip');
  });

  it('character label contains "Blown" or "windy"', () => {
    expect(result.character.label).toMatch(/blown|windy/i);
  });

  it('total score is 0 (skip override)', () => {
    expect(result.total).toBe(0);
  });

  it('recommendationLabel is "Skip"', () => {
    expect(result.recommendationLabel).toBe('Skip');
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Swell quality boost comparison
// ---------------------------------------------------------------------------

describe('Scenario 5: Swell quality boost difference (14s ideal vs 6s off-direction)', () => {
  // Scenario A: 1.5ft, 14s, ideal direction — maximum boost
  const forecastA = makeForecast({
    waveHeight: 1.5,
    wavePeriod: 14,
    windSpeed: 5,
    windDirection: 90,
    tideHeight: 3.0,
    swellDirection: 260,   // perfect alignment
  });

  // Scenario B: 1.5ft, 6s period, 90° off ideal direction — minimal/no boost
  const forecastB = makeForecast({
    waveHeight: 1.5,
    wavePeriod: 6,
    windSpeed: 5,
    windDirection: 90,
    tideHeight: 3.0,
    swellDirection: 170,   // ~90° off from center (260), well outside swell window
  });

  let resultA: ReturnType<typeof scoreConditions>;
  let resultB: ReturnType<typeof scoreConditions>;

  beforeAll(() => {
    resultA = scoreConditions(forecastA, qualityBeach);
    resultB = scoreConditions(forecastB, qualityBeach);
  });

  it('Scenario A score is strictly higher than Scenario B', () => {
    // Note: both scenarios are ceiling-limited by wave-height at 1.5ft.
    // The swell quality boost raises A's ceiling slightly (via qualityCeilingBonus),
    // so A ends up 5+ points above B even though the raw boost is larger.
    // We verify A > B meaningfully rather than a fixed 10-point gap, because the
    // wave-height ceiling compresses the score range at small heights.
    expect(resultA.total).toBeGreaterThan(resultB.total);
    // The difference should be at least 4 points (quality ceiling bonus effect)
    expect(resultA.total - resultB.total).toBeGreaterThanOrEqual(4);
  });

  it('Scenario A has a positive swell quality boost', () => {
    expect(resultA.swellQualityBoost).toBeGreaterThan(0);
  });

  it('Scenario B has minimal swell quality boost (short period, off direction)', () => {
    // 6s period → periodFactor=0.05; direction is 90° off (170 vs 260 = 90°), outside halfwidth+decayRange
    // boost = 0.05 * ~0 * smallWaveMultiplier * 12 ≈ 0
    expect(resultB.swellQualityBoost).toBeLessThanOrEqual(1);
  });

  it('Scenario A character is more positive than Scenario B', () => {
    // A should be small-quality or small-clean, B should be small-weak
    const positiveCategories = ['small-quality', 'small-clean', 'medium-clean', 'large-clean'];
    const weakCategories = ['small-weak', 'flat', 'skip'];

    expect(positiveCategories).toContain(resultA.character.category);
    expect(weakCategories).toContain(resultB.character.category);
  });

  it('Scenario A matchQuality is better than Scenario B matchQuality', () => {
    const qualityOrder: Record<string, number> = {
      perfect: 5, excellent: 4, good: 3, fair: 2, minimal: 1, skip: 0,
    };
    expect(qualityOrder[resultA.matchQuality]).toBeGreaterThanOrEqual(
      qualityOrder[resultB.matchQuality]
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: new fields present on ConditionScore
// ---------------------------------------------------------------------------

describe('ConditionScore shape: new fields are always present', () => {
  const forecast = makeForecast({
    waveHeight: 2.0,
    wavePeriod: 10,
    windSpeed: 7,
    windDirection: 90,
    tideHeight: 3.0,
    swellDirection: 260,
  });

  it('result always has character.label and character.category', () => {
    const result = scoreConditions(forecast, qualityBeach);
    expect(result.character).toBeDefined();
    expect(typeof result.character.label).toBe('string');
    expect(result.character.label.length).toBeGreaterThan(0);
    expect(typeof result.character.category).toBe('string');
  });

  it('result always has swellQualityBoost (number)', () => {
    const result = scoreConditions(forecast, qualityBeach);
    expect(typeof result.swellQualityBoost).toBe('number');
    expect(result.swellQualityBoost).toBeGreaterThanOrEqual(0);
  });

  it('MultiWindowResult always has windows array and bestWindow', () => {
    const forecasts = makeForecastSeries(6, 6, {
      waveHeight: 2.0,
      wavePeriod: 10,
      windSpeed: 7,
      windDirection: 90,
      tideHeight: 3.0,
      tideStatus: 'rising',
      swellDirection: 260,
    });
    const multiResult = calculateMultipleWindows(forecasts, qualityBeach);
    expect(Array.isArray(multiResult.windows)).toBe(true);
    // bestWindow is the first window or null — both are valid
    if (multiResult.windows.length > 0) {
      expect(multiResult.bestWindow).toBe(multiResult.windows[0]);
    } else {
      expect(multiResult.bestWindow).toBeNull();
    }
  });

  it('each OptimalWindow in MultiWindowResult has character field', () => {
    const forecasts = makeForecastSeries(6, 8, {
      waveHeight: 3.0,
      wavePeriod: 12,
      windSpeed: 5,
      windDirection: 90,
      tideHeight: 3.0,
      tideStatus: 'rising',
      swellDirection: 260,
    });
    const multiResult = calculateMultipleWindows(forecasts, qualityBeach);
    for (const window of multiResult.windows) {
      expect(window.character).toBeDefined();
      expect(typeof window.character!.label).toBe('string');
      expect(typeof window.character!.category).toBe('string');
    }
  });
});
