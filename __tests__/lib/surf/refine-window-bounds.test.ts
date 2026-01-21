/**
 * Tests for refineWindowBounds - sub-hour window refinement
 *
 * Uses UTC dates for DST safety.
 */

import {
  refineWindowBounds,
  RefineWindowBoundsParams,
  RefinedWindow,
} from '@/lib/surf/scoring';

describe('refineWindowBounds', () => {
  // Helper to create UTC dates
  const utc = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 0, 20, hour, minute, 0, 0));

  // Default params factory
  const defaultParams = (
    overrides: Partial<RefineWindowBoundsParams> = {}
  ): RefineWindowBoundsParams => ({
    hourlyStart: utc(6),
    hourlyEnd: utc(9),
    scoreAtStart: 70,
    scoreAtNextHour: 70,
    scoreAtPrevHour: 70,
    scoreAtEnd: 70,
    threshold: 50,
    getTideHeightAtTime: () => 2.5, // Always in range
    tideMin: 1.0,
    tideMax: 4.0,
    isLightOk: () => true,
    ...overrides,
  });

  describe('happy path', () => {
    it('refines window when tide becomes ok mid-hour', () => {
      // Tide below minimum until 06:30
      const getTideHeightAtTime = (t: Date): number => {
        const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
        // Below 1.0 until 06:30 (390 minutes), then above
        return minutes < 390 ? 0.5 : 2.5;
      };

      const result = refineWindowBounds(
        defaultParams({
          getTideHeightAtTime,
          tideMin: 1.0,
        })
      );

      expect(result.usedInterpolation).toBe(true);
      // Start should be ceil-snapped from ~06:30 to 06:30
      expect(result.start.getUTCHours()).toBe(6);
      expect(result.start.getUTCMinutes()).toBe(30);
    });

    it('refines end when score drops below threshold', () => {
      // Score drops at 08:30 (interpolated)
      // scoreAtPrevHour (08:00) = 70, scoreAtEnd (09:00) = 30
      // Threshold 50 crossed at 08:30 (linear interpolation)
      const result = refineWindowBounds(
        defaultParams({
          scoreAtPrevHour: 70,
          scoreAtEnd: 30,
          threshold: 50,
        })
      );

      expect(result.usedInterpolation).toBe(true);
      // End should be floor-snapped from ~08:30 to 08:30
      expect(result.end.getUTCHours()).toBe(8);
      expect(result.end.getUTCMinutes()).toBe(30);
    });
  });

  describe('permissive tide handling', () => {
    it('refines based on score+light when tide data is null', () => {
      const result = refineWindowBounds(
        defaultParams({
          getTideHeightAtTime: () => null,
          tideMin: 1.0,
          tideMax: 4.0,
        })
      );

      // Should still work, not collapse to nothing
      expect(result.usedInterpolation).toBe(true);
      expect(result.fallbackReason).toBeUndefined();
    });

    it('skips tide check when tideMin and tideMax are null', () => {
      const result = refineWindowBounds(
        defaultParams({
          tideMin: null,
          tideMax: null,
        })
      );

      expect(result.usedInterpolation).toBe(true);
      expect(result.fallbackReason).toBeUndefined();
    });
  });

  describe('fallback scenarios', () => {
    it('clamps end when light mask causes large shift', () => {
      // Light only ok from 07:50 (470 min) to 08:10 (490 min)
      const isLightOk = (t: Date): boolean => {
        const totalMin = t.getUTCHours() * 60 + t.getUTCMinutes();
        return totalMin >= 470 && totalMin <= 490;
      };

      const result = refineWindowBounds(
        defaultParams({
          isLightOk,
        })
      );

      // End scan [08:00-09:00): scans backwards from 08:55
      // 08:10 is eligible (490 min within range)
      // But shift from 09:00 to 08:10 = 50 min > MAX_SHIFT (45 min)
      // So end gets clamped to 09:00 - 45min = 08:15
      expect(result.usedInterpolation).toBe(true);
      expect(result.clampedEnd).toBe(true);
      expect(result.end.getUTCHours()).toBe(8);
      expect(result.end.getUTCMinutes()).toBe(15);
    });

    it('falls back when window is too short for interpolation', () => {
      const result = refineWindowBounds(
        defaultParams({
          hourlyStart: utc(6),
          hourlyEnd: utc(7), // Only 1 hour
        })
      );

      expect(result.usedInterpolation).toBe(false);
      expect(result.fallbackReason).toBe('window_too_short');
    });
  });

  describe('clamp behavior', () => {
    it('clamps start when delta exceeds 45 minutes', () => {
      // Tide only becomes ok at 06:55 (55 min delta > 45 max)
      const getTideHeightAtTime = (t: Date): number => {
        const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
        return minutes < 415 ? 0.5 : 2.5; // Below min until 06:55
      };

      const result = refineWindowBounds(
        defaultParams({
          getTideHeightAtTime,
          tideMin: 1.0,
        })
      );

      expect(result.clampedStart).toBe(true);
      // Should clamp to 45 min, then ceil snap to 06:45
      expect(result.start.getUTCMinutes()).toBe(45);
    });
  });

  describe('no change scenario', () => {
    it('returns refined window when all constraints pass', () => {
      // Everything eligible from hour start to hour end
      const result = refineWindowBounds(defaultParams());

      // Start should be exactly 06:00 (first eligible, no refinement needed)
      expect(result.start.getUTCHours()).toBe(6);
      expect(result.start.getUTCMinutes()).toBe(0);
      // End scan starts at hourlyEnd-1hr and works backwards from 55 min offset
      // First eligible found at 08:55, floor snapped to 08:45
      // This is expected behavior - the scan doesn't check at exactly hourlyEnd
      expect(result.end.getUTCHours()).toBe(8);
      expect(result.end.getUTCMinutes()).toBe(45);
      // usedInterpolation is true because end changed from 09:00 to 08:45
      expect(result.usedInterpolation).toBe(true);
    });
  });

  describe('one-sided tide bounds', () => {
    it('enforces tideMin only when tideMax is null', () => {
      // Tide below minimum until 06:30
      const getTideHeightAtTime = (t: Date): number => {
        const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
        return minutes < 390 ? 0.5 : 2.5;
      };

      const result = refineWindowBounds(
        defaultParams({
          getTideHeightAtTime,
          tideMin: 1.0,
          tideMax: null, // No upper bound
        })
      );

      expect(result.usedInterpolation).toBe(true);
      expect(result.start.getUTCMinutes()).toBe(30);
    });
  });

  describe('light mask trimming', () => {
    it('trims window when light mask is restrictive', () => {
      // Light only ok from 06:10 onwards
      const isLightOk = (t: Date): boolean => {
        const hour = t.getUTCHours();
        const min = t.getUTCMinutes();
        return hour > 6 || (hour === 6 && min >= 10);
      };

      const result = refineWindowBounds(
        defaultParams({
          isLightOk,
        })
      );

      expect(result.usedInterpolation).toBe(true);
      // Should ceil snap from 06:10 to 06:15
      expect(result.start.getUTCMinutes()).toBe(15);
    });
  });
});
