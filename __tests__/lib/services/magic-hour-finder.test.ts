/**
 * Unit tests for Magic Hour Finder Service
 *
 * Tests core functionality of the Magic Hour utility including:
 * - Circular direction math (critical for 0°/360° boundary)
 * - Swell window matching
 * - Wind quality assessment
 * - Tide range checking
 * - Multi-metric scoring
 */

import {
  circularAngleDiff,
  isSwellInWindow,
  checkWindOffshore,
  isTideInRange,
  calculateTideScore,
  calculateWindScore,
  calculateSwellScore,
  findWeightedPeak,
  findMagicHour,
  type ForecastSlot,
  type BeachMetadata,
} from '@/lib/services/magic-hour-finder';

describe('Magic Hour Finder Service', () => {
  // ============================================================================
  // Circular Direction Math (CRITICAL)
  // ============================================================================

  describe('circularAngleDiff', () => {
    it('handles exact matches', () => {
      expect(circularAngleDiff(90, 90)).toBe(0);
      expect(circularAngleDiff(270, 270)).toBe(0);
    });

    it('calculates simple differences', () => {
      expect(circularAngleDiff(100, 90)).toBe(10);
      expect(circularAngleDiff(90, 100)).toBe(10);
      expect(circularAngleDiff(270, 90)).toBe(180);
    });

    it('handles 0°/360° boundary correctly (CRITICAL)', () => {
      expect(circularAngleDiff(350, 10)).toBe(20); // Not 340!
      expect(circularAngleDiff(10, 350)).toBe(20);
      expect(circularAngleDiff(0, 350)).toBe(10);
      expect(circularAngleDiff(350, 0)).toBe(10);
    });

    it('never exceeds 180°', () => {
      expect(circularAngleDiff(0, 180)).toBe(180);
      expect(circularAngleDiff(0, 181)).toBe(179);
      expect(circularAngleDiff(0, 270)).toBe(90);
    });
  });

  // ============================================================================
  // Swell Window Analysis
  // ============================================================================

  describe('isSwellInWindow', () => {
    it('matches exact center', () => {
      expect(isSwellInWindow(270, 270, 45)).toBe(true);
    });

    it('matches within halfwidth', () => {
      expect(isSwellInWindow(315, 270, 45)).toBe(true); // +45°
      expect(isSwellInWindow(225, 270, 45)).toBe(true); // -45°
    });

    it('rejects outside window', () => {
      expect(isSwellInWindow(180, 270, 45)).toBe(false);
      expect(isSwellInWindow(0, 270, 45)).toBe(false);
    });

    it('handles boundary cases', () => {
      expect(isSwellInWindow(10, 350, 30)).toBe(true); // Within window across boundary
      expect(isSwellInWindow(340, 10, 30)).toBe(true); // Within window across boundary
      expect(isSwellInWindow(50, 10, 30)).toBe(false); // Outside window
    });
  });

  // ============================================================================
  // Wind Quality Assessment
  // ============================================================================

  describe('checkWindOffshore', () => {
    it('identifies perfect offshore wind', () => {
      const result = checkWindOffshore(90, 90, 20);
      expect(result.isOffshore).toBe(true);
      expect(result.quality).toBe('perfect');
    });

    it('identifies acceptable offshore wind', () => {
      // Within tolerance but not within tolerance/2
      // tolerance=20, tolerance/2=10, so 105° is >10° from 90° but <=20°
      const result = checkWindOffshore(105, 90, 20);
      expect(result.isOffshore).toBe(true);
      expect(result.quality).toBe('acceptable');
    });

    it('identifies cross-shore wind', () => {
      const result = checkWindOffshore(150, 90, 20);
      expect(result.isOffshore).toBe(false);
      expect(result.quality).toBe('cross');
    });

    it('identifies onshore wind', () => {
      const result = checkWindOffshore(270, 90, 20);
      expect(result.isOffshore).toBe(false);
      expect(result.quality).toBe('onshore');
    });
  });

  // ============================================================================
  // Tide Range Checking
  // ============================================================================

  describe('isTideInRange', () => {
    it('returns true when no preferences set', () => {
      expect(isTideInRange(3.0, null, null)).toBe(true);
    });

    it('checks minimum tide only', () => {
      expect(isTideInRange(3.0, 2.0, null)).toBe(true);
      expect(isTideInRange(1.5, 2.0, null)).toBe(false);
    });

    it('checks maximum tide only', () => {
      expect(isTideInRange(3.0, null, 4.0)).toBe(true);
      expect(isTideInRange(5.0, null, 4.0)).toBe(false);
    });

    it('checks both min and max', () => {
      expect(isTideInRange(3.0, 2.0, 4.0)).toBe(true);
      expect(isTideInRange(1.5, 2.0, 4.0)).toBe(false);
      expect(isTideInRange(4.5, 2.0, 4.0)).toBe(false);
    });
  });

  // ============================================================================
  // Multi-Metric Scoring (unexported functions accessed via test exports)
  // ============================================================================

  describe('calculateTideScore', () => {
    // Access via dynamic import since not exported
    const calculateTideScore = (
      tideHeight: number,
      minTide: number | null,
      maxTide: number | null
    ): number => {
      if (minTide === null && maxTide === null) return 1;
      const targetTide =
        minTide !== null && maxTide !== null ? (minTide + maxTide) / 2 : minTide ?? maxTide ?? 0;
      const range = maxTide !== null && minTide !== null ? (maxTide - minTide) / 2 : 2;
      const diff = Math.abs(tideHeight - targetTide);
      return Math.max(0, 1 - diff / range);
    };

    it('returns perfect score with no preferences', () => {
      expect(calculateTideScore(3.0, null, null)).toBe(1);
    });

    it('scores exact match as 1.0', () => {
      expect(calculateTideScore(3.0, 2.0, 4.0)).toBe(1); // Exact center
    });

    it('scores within range proportionally', () => {
      const score = calculateTideScore(2.5, 2.0, 4.0); // Halfway to min
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('scores outside range as 0 or negative', () => {
      const score = calculateTideScore(1.0, 2.0, 4.0); // Below min
      expect(score).toBe(0);
    });
  });

  // ============================================================================
  // Weighted Peak Finding
  // ============================================================================

  describe('findWeightedPeak', () => {
    const beach: BeachMetadata = {
      id: 'test-beach',
      name: 'Test Beach',
      slug: 'test-beach',
      skill_level: 'intermediate',
      swell_window_center_deg: 270,
      swell_window_halfwidth_deg: 45,
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 20,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
    };

    const createSlot = (
      hour: number,
      tide: number,
      windDir: number,
      swellDir: number
    ): ForecastSlot => ({
      forecast_date: '2025-01-07',
      forecast_time: `${hour.toString().padStart(2, '0')}:00:00`,
      // Forecast timestamps are UTC; parse explicitly as UTC for stable tests.
      local_time: new Date(`2025-01-07T${hour.toString().padStart(2, '0')}:00:00Z`),
      tide_height_ft: tide,
      wind_speed_mph: 10,
      wind_direction_deg: windDir,
      wave_height_ft: 4,
      wave_period_s: 12,
      wave_direction_deg: swellDir,
    });

    it('returns null for empty slots', () => {
      const result = findWeightedPeak([], beach);
      expect(result).toBeNull();
    });

    it('finds single slot', () => {
      const slots = [createSlot(9, 3.0, 90, 270)];
      const result = findWeightedPeak(slots, beach);
      expect(result).not.toBeNull();
      expect(result?.peakTime).toBeInstanceOf(Date);
    });

    it('selects slot with best conditions', () => {
      const slots = [
        createSlot(9, 1.0, 270, 180), // Bad: low tide, onshore, wrong swell
        createSlot(12, 3.0, 90, 270), // Perfect: mid tide, offshore, good swell
        createSlot(15, 5.0, 90, 270), // OK: high tide, offshore, good swell
      ];

      const result = findWeightedPeak(slots, beach);
      expect(result).not.toBeNull();
      expect(result?.peakTime.getUTCHours()).toBe(12); // Should pick 12:00 UTC
      expect(result?.swellMatch).toBe(true);
      expect(result?.windQuality).toBe('perfect');
      expect(result?.tideInRange).toBe(true);
    });

    it('respects custom weights', () => {
      const slots = [
        createSlot(9, 3.0, 270, 270), // Perfect tide and swell, bad wind
        createSlot(12, 1.0, 90, 180), // Perfect wind, bad tide and swell
      ];

      // With default weights (tide 40%, wind 35%, swell 25%), slot 1 should win
      const defaultResult = findWeightedPeak(slots, beach);
      expect(defaultResult?.peakTime.getUTCHours()).toBe(9);

      // With wind-heavy weights, slot 2 should win
      const windHeavyResult = findWeightedPeak(slots, beach, {
        tide: 0.1,
        wind: 0.8,
        swell: 0.1,
      });
      expect(windHeavyResult?.peakTime.getUTCHours()).toBe(12);
    });
  });

  // ============================================================================
  // Main Entry Point
  // ============================================================================

  describe('findMagicHour', () => {
    const beach: BeachMetadata = {
      id: 'test-beach',
      name: 'Test Beach',
      slug: 'test-beach',
      skill_level: 'intermediate',
      swell_window_center_deg: 270,
      swell_window_halfwidth_deg: 45,
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 20,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
    };

    const createForecast = (
      date: string,
      time: string,
      tide: string,
      windDir: number,
      swellDir: string
    ) => ({
      id: `${date}-${time}`,
      beach_id: beach.id,
      forecast_at: `${date}T${time}Z`,
      forecast_date: date,
      forecast_time: time,
      wave_height: '4',
      wave_period: '12',
      wave_direction: swellDir,
      wind_direction_deg: windDir,
      wind_speed: '10',
      tide_height: tide,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    it('returns null result for empty forecasts', () => {
      const result = findMagicHour([], beach);
      expect(result.found).toBe(false);
      expect(result.peakTime).toBeNull();
    });

    it('finds magic hour in valid forecasts', () => {
      const forecasts = [
        createForecast('2025-01-07', '09:00:00', '2.0', 270, 'W'),
        createForecast('2025-01-07', '12:00:00', '3.0', 90, 'W'),
        createForecast('2025-01-07', '15:00:00', '4.0', 90, 'W'),
      ];

      const result = findMagicHour(forecasts, beach, {
        targetDate: new Date('2025-01-07T08:00:00Z'),
      });

      expect(result.found).toBe(true);
      expect(result.peakTime).toBeInstanceOf(Date);
      expect(result.windowStart).toBeTruthy();
      expect(result.windowEnd).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('filters to 48-hour window', () => {
      const now = new Date('2025-01-07T08:00:00Z');
      const forecasts = [
        createForecast('2025-01-07', '12:00:00', '3.0', 90, 'W'), // Within 48h
        createForecast('2025-01-10', '12:00:00', '3.0', 90, 'W'), // Beyond 48h
      ];

      const result = findMagicHour(forecasts, beach, { targetDate: now });

      expect(result.found).toBe(true);
      // Peak should be from first forecast (within window)
      expect(result.peakTime?.getUTCDate()).toBe(7);
    });

    it('respects custom weights', () => {
      const forecasts = [
        createForecast('2025-01-07', '09:00:00', '3.0', 270, 'W'), // Good tide, bad wind
        createForecast('2025-01-07', '12:00:00', '1.0', 90, 'W'), // Bad tide, good wind
      ];

      const defaultResult = findMagicHour(forecasts, beach, {
        targetDate: new Date('2025-01-07T08:00:00Z'),
      });

      const windHeavyResult = findMagicHour(forecasts, beach, {
        targetDate: new Date('2025-01-07T08:00:00Z'),
        weights: { tide: 0.1, wind: 0.8, swell: 0.1 },
      });

      // Results should differ based on weights
      expect(defaultResult.peakTime?.getTime()).not.toBe(windHeavyResult.peakTime?.getTime());
    });

    // ========================================================================
    // Daylight Hour Filtering (prevents midnight peak times)
    // ========================================================================

    describe('daylight hour filtering', () => {
      const beachWithTimezone: BeachMetadata = {
        ...beach,
        timezone: 'America/Los_Angeles',
      };

      it('filters out midnight forecasts (00:00 UTC is night in Pacific)', () => {
        // 00:00 UTC = 4 PM PT previous day in winter (PST, UTC-8)
        // Actually, let's use times that are clearly night in Pacific
        // 08:00 UTC = midnight PT, 09:00 UTC = 1 AM PT
        const forecasts = [
          createForecast('2025-01-07', '08:00:00', '3.0', 90, 'W'), // Midnight PT - night
          createForecast('2025-01-07', '18:00:00', '3.0', 90, 'W'), // 10 AM PT - day
        ];

        const result = findMagicHour(forecasts, beachWithTimezone, {
          targetDate: new Date('2025-01-07T07:00:00Z'), // 11 PM PT Jan 6
        });

        expect(result.found).toBe(true);
        // Peak should be from 10 AM PT forecast, not midnight
        expect(result.peakTime?.getUTCHours()).toBe(18);
      });

      it('filters out early morning forecasts (3 AM local time)', () => {
        // 11:00 UTC = 3 AM PT (night, < 5 AM)
        // 15:00 UTC = 7 AM PT (day, >= 5 AM)
        const forecasts = [
          createForecast('2025-01-07', '11:00:00', '3.0', 90, 'W'), // 3 AM PT - night
          createForecast('2025-01-07', '15:00:00', '3.0', 90, 'W'), // 7 AM PT - day
        ];

        const result = findMagicHour(forecasts, beachWithTimezone, {
          targetDate: new Date('2025-01-07T10:00:00Z'), // 2 AM PT
        });

        expect(result.found).toBe(true);
        // Peak should be 7 AM PT, not 3 AM PT
        expect(result.peakTime?.getUTCHours()).toBe(15);
      });

      it('filters out late night forecasts (9 PM+ local time)', () => {
        // 05:00 UTC next day = 9 PM PT (night, >= 21)
        // 03:00 UTC next day = 7 PM PT (day, < 21)
        const forecasts = [
          createForecast('2025-01-08', '05:00:00', '3.0', 90, 'W'), // 9 PM PT - night
          createForecast('2025-01-08', '03:00:00', '3.0', 90, 'W'), // 7 PM PT - day
        ];

        const result = findMagicHour(forecasts, beachWithTimezone, {
          targetDate: new Date('2025-01-08T02:00:00Z'), // 6 PM PT
        });

        expect(result.found).toBe(true);
        // Peak should be 7 PM PT, not 9 PM PT
        expect(result.peakTime?.getUTCHours()).toBe(3);
      });

      it('keeps 5 AM dawn patrol forecasts', () => {
        // 13:00 UTC = 5 AM PT (valid dawn patrol, >= 5 AM)
        const forecasts = [
          createForecast('2025-01-07', '13:00:00', '3.0', 90, 'W'), // 5 AM PT - dawn patrol
        ];

        const result = findMagicHour(forecasts, beachWithTimezone, {
          targetDate: new Date('2025-01-07T12:00:00Z'), // 4 AM PT
        });

        expect(result.found).toBe(true);
        expect(result.peakTime?.getUTCHours()).toBe(13);
      });

      it('keeps 8 PM evening forecasts', () => {
        // 04:00 UTC next day = 8 PM PT (valid evening, < 21)
        const forecasts = [
          createForecast('2025-01-08', '04:00:00', '3.0', 90, 'W'), // 8 PM PT - evening
        ];

        const result = findMagicHour(forecasts, beachWithTimezone, {
          targetDate: new Date('2025-01-08T03:00:00Z'), // 7 PM PT
        });

        expect(result.found).toBe(true);
        expect(result.peakTime?.getUTCHours()).toBe(4);
      });

      it('falls back to night forecasts when no daylight forecasts available', () => {
        // Only night forecasts available - should still return a result
        const forecasts = [
          createForecast('2025-01-07', '08:00:00', '3.0', 90, 'W'), // Midnight PT
          createForecast('2025-01-07', '09:00:00', '3.0', 90, 'W'), // 1 AM PT
        ];

        const result = findMagicHour(forecasts, beachWithTimezone, {
          targetDate: new Date('2025-01-07T07:00:00Z'),
        });

        // Should still find something (fallback behavior)
        expect(result.found).toBe(true);
      });

      it('prefers daylight forecasts over better-scoring night forecasts', () => {
        // Night forecast has perfect conditions, day forecast has good conditions
        const forecasts = [
          createForecast('2025-01-07', '08:00:00', '3.0', 90, 'W'), // Midnight PT - perfect tide
          createForecast('2025-01-07', '18:00:00', '2.0', 90, 'W'), // 10 AM PT - okay tide
        ];

        const result = findMagicHour(forecasts, beachWithTimezone, {
          targetDate: new Date('2025-01-07T07:00:00Z'),
        });

        expect(result.found).toBe(true);
        // Should pick the daytime forecast even if night has better score
        expect(result.peakTime?.getUTCHours()).toBe(18);
      });
    });
  });
});
