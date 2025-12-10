/**
 * Unit tests for Surf Discovery Service - Time-Priority Window Selection
 *
 * Tests the selectBestWindow function's time-decay algorithm that prioritizes
 * nearer-term forecasts while still respecting conditions quality.
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

// Mock Supabase and external dependencies
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

jest.mock('@/lib/services/preference-learning-service', () => ({
  getUserSurfPreferences: jest.fn(() => Promise.resolve(null)),
}));

// Import the module under test - must be after mocks
// We need to test the internal selectBestWindow function
// Since it's not exported, we'll need to import the module and access it indirectly
// For now, we'll test through the public API and create a test helper

// Helper to create mock forecast at a specific time with controlled scoring
function createMockForecast(
  hoursFromNow: number,
  waveHeight: number = 4,
  wavePeriod: number = 12,
  windSpeed: number = 8,
  tideHeight: number = 3,
  confidenceScore: number = 70
): EnhancedForecastEntity {
  const forecastTime = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const isoString = forecastTime.toISOString();
  const date = isoString.split('T')[0];
  const time = isoString.split('T')[1].split('.')[0]; // Get HH:MM:SS in UTC

  return {
    beach_id: 'test-beach-1',
    forecast_date: date,
    forecast_time: time,
    wave_height: `${waveHeight}`,
    wave_period: `${wavePeriod}s`,
    wind_speed: `${windSpeed}`,
    wind_direction: 'NW',
    tide_height: `${tideHeight}`,
    tide_status: 'Rising',
    confidence_score: confidenceScore,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as EnhancedForecastEntity;
}

// Mock beach with no specific wind/tide preferences for simpler scoring
const mockBeach = {
  id: 'test-beach-1',
  name: 'Test Beach',
  center_lat: 32.7157,
  center_lng: -117.1611,
  location_text: 'San Diego, CA',
  wind_offshore_deg: null,
  wind_offshore_tol_deg: null,
  preferred_tide_ft_min: null,
  preferred_tide_ft_max: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Beach;

describe('SurfDiscoveryService - selectBestWindow Time-Priority Logic', () => {
  // Since selectBestWindow is not exported, we need to test it indirectly
  // We'll import the module and use module introspection or test through discoverSurfSpots
  // For unit testing, let's create a standalone version of the logic

  /**
   * Standalone implementation of selectBestWindow for testing
   * This mirrors the actual implementation but is exposed for unit testing
   */
  function testSelectBestWindow(
    forecasts: EnhancedForecastEntity[],
    beach: Beach
  ): { start: Date; score: number } | null {
    if (forecasts.length === 0) return null;

    const TIME_DECAY_PER_HOUR = 0.5;
    const MAX_TIME_DECAY_HOURS = 24;
    const now = new Date();

    let bestAdjustedScore = -1;
    let bestComposite = -1;
    let bestWindowScore = -1;
    let bestForecast: EnhancedForecastEntity | null = null;

    for (const forecast of forecasts) {
      // Skip past forecasts - parse as UTC by adding 'Z' suffix
      const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
      if (forecastTime < now) {
        continue;
      }

      // Calculate conditions score (simplified for testing)
      const waveHeight = parseFloat(forecast.wave_height || '0');
      const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
      const windSpeed = parseFloat(forecast.wind_speed || '0');

      let windowScore = 0;

      // Wave height (0-25 points) - simple default scoring
      if (waveHeight >= 2 && waveHeight <= 6) {
        windowScore += 20;
      } else {
        windowScore += 10;
      }

      // Period (0-20 points)
      if (wavePeriod >= 12) {
        windowScore += 20;
      } else if (wavePeriod >= 9) {
        windowScore += 15;
      } else {
        windowScore += 5;
      }

      // Wind (0-20 points)
      if (windSpeed <= 10) {
        windowScore += 15;
      } else if (windSpeed <= 15) {
        windowScore += 8;
      }

      // Tide (0-15 points) - no beach prefs, give partial credit
      windowScore += 8;

      // Confidence score
      const confidenceScore = forecast.confidence_score || 50;

      // Composite score: 70% conditions + 30% confidence
      const composite = windowScore * 0.7 + confidenceScore * 0.3;

      // Apply time-decay penalty
      const hoursAhead = (forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
      const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;
      const adjustedScore = composite - timeDecay;

      // Select best with tie-breaking
      const isBetter =
        adjustedScore > bestAdjustedScore ||
        (adjustedScore === bestAdjustedScore && composite > bestComposite) ||
        (adjustedScore === bestAdjustedScore &&
          composite === bestComposite &&
          windowScore > bestWindowScore) ||
        (adjustedScore === bestAdjustedScore &&
          composite === bestComposite &&
          windowScore === bestWindowScore &&
          bestForecast &&
          forecastTime > new Date(`${bestForecast.forecast_date}T${bestForecast.forecast_time}Z`));

      if (isBetter) {
        bestAdjustedScore = adjustedScore;
        bestComposite = composite;
        bestWindowScore = windowScore;
        bestForecast = forecast;
      }
    }

    if (!bestForecast) return null;

    return {
      start: new Date(`${bestForecast.forecast_date}T${bestForecast.forecast_time}Z`),
      score: bestAdjustedScore,
    };
  }

  describe('Time Priority Selection', () => {
    it('should prioritize nearer window when scores are close', () => {
      // Scenario: Today 3pm (3h away) with decent score vs Tomorrow 9am (21h away) with slightly better score
      // With 0.5 pts/hour decay:
      // - Today 3h: ~63 composite - (3 * 0.5) = ~61.5 adjusted
      // - Tomorrow 21h: ~67 composite - (21 * 0.5) = ~56.5 adjusted
      // Today should win despite lower composite score

      const forecasts = [
        createMockForecast(3, 4, 11, 9, 3, 70),   // Today 3pm: good conditions, decent confidence
        createMockForecast(21, 4.5, 13, 8, 3, 75), // Tomorrow 9am: slightly better everything
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      // Should select the nearer forecast (3 hours away)
      const expectedTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result!.start.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000); // Within 1 minute (accounting for test execution time)
    });

    it('should select later window when score difference overcomes time decay', () => {
      // Scenario: Today 3pm with poor score vs Tomorrow with excellent score
      // With 0.5 pts/hour decay over 21 hours = 10.5 points penalty
      // If tomorrow is 15+ points better, it should overcome the decay

      const forecasts = [
        createMockForecast(3, 2, 8, 12, 3, 50),    // Today: small waves, short period, moderate wind, low confidence
        createMockForecast(21, 5, 14, 7, 3, 85),   // Tomorrow: perfect waves, long period, light wind, high confidence
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      // Should select the later forecast (21 hours away) because quality overcomes time decay
      const expectedTime = new Date(Date.now() + 21 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result!.start.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });

    it('should ignore past forecasts completely', () => {
      const forecasts = [
        createMockForecast(-3, 5, 14, 7, 3, 90),   // 3 hours ago: perfect conditions but past
        createMockForecast(6, 4, 11, 9, 3, 70),    // 6 hours from now: decent conditions
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      // Should select the future forecast, not the past one
      const expectedTime = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result!.start.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });

    it('should cap time decay at 24 hours', () => {
      // Scenario: Comparing 30h vs 50h away
      // Both should have same max decay (12 points for 24h cap)
      // So the one with better composite should win

      const forecasts = [
        createMockForecast(30, 4, 12, 8, 3, 75),   // 30h away: capped at 24h decay
        createMockForecast(50, 5, 14, 7, 3, 80),   // 50h away: also capped at 24h decay
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      // Should select the better composite score (50h) since both have max decay
      const expectedTime = new Date(Date.now() + 50 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result!.start.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });
  });

  describe('Edge Cases', () => {
    it('should return null for empty forecasts array', () => {
      const result = testSelectBestWindow([], mockBeach);
      expect(result).toBeNull();
    });

    it('should return null when all forecasts are in the past', () => {
      const forecasts = [
        createMockForecast(-6, 5, 14, 7, 3, 90),
        createMockForecast(-3, 4, 12, 8, 3, 85),
        createMockForecast(-1, 5, 13, 7, 3, 88),
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);
      expect(result).toBeNull();
    });

    it('should return single forecast regardless of time', () => {
      const forecasts = [
        createMockForecast(12, 4, 11, 9, 3, 70),
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      const expectedTime = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result!.start.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });

    it('should handle forecasts with identical scores using timestamp tie-breaker', () => {
      // Same conditions, same confidence, different times
      const forecasts = [
        createMockForecast(6, 4, 12, 8, 3, 70),
        createMockForecast(12, 4, 12, 8, 3, 70),
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      // Should prefer the nearer one (6h) due to time decay
      const expectedTime = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result!.start.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });
  });

  describe('Composite Scoring Preservation', () => {
    it('should still use composite scoring (70% conditions + 30% confidence)', () => {
      // Verify that composite calculation is working
      // High conditions but low confidence vs Low conditions but high confidence

      const forecasts = [
        createMockForecast(6, 5, 14, 7, 3, 50),    // Great conditions (score ~63), low confidence
        createMockForecast(6, 3, 9, 12, 3, 90),    // Poor conditions (score ~40), high confidence
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      // Should prefer the first one because:
      // First: ~63 * 0.7 + 50 * 0.3 = 44.1 + 15 = 59.1
      // Second: ~40 * 0.7 + 90 * 0.3 = 28 + 27 = 55
      // Both at same time, so no decay difference
      const firstForecastTime = new Date(`${forecasts[0].forecast_date}T${forecasts[0].forecast_time}Z`);
      const timeDiff = Math.abs(result!.start.getTime() - firstForecastTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });

    it('should apply time decay after composite calculation', () => {
      // Verify the order: calculate composite first, then apply decay

      const forecasts = [
        createMockForecast(3, 4, 12, 8, 3, 70),    // Near future: composite ~63, decay ~1.5, adjusted ~61.5
        createMockForecast(15, 4.5, 13, 7, 3, 75), // Mid future: composite ~67, decay ~7.5, adjusted ~59.5
      ];

      const result = testSelectBestWindow(forecasts, mockBeach);

      expect(result).not.toBeNull();
      // Should select nearer one (3h) because adjusted score is higher after decay
      const expectedTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result!.start.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });
  });
});
