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
});
