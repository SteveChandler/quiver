/**
 * Tests for Wind Quality Scorer
 *
 * Tests wind direction and speed scoring logic.
 */

import { windQualityScorer } from '@/lib/domains/scoring';
import type { ScorerInput } from '@/lib/domains/scoring';
import { createInput } from '../__fixtures__';

describe('Wind Quality Scorer', () => {
  describe('glassy conditions', () => {
    it('should give perfect score for glassy conditions (< 3 mph)', () => {
      const input = createInput({ wind: { speedMph: 2, directionDeg: 270 } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBe(100);
      expect(result.reasons).toContain('Glassy conditions');
      expect(result.skip).toBe(false);
    });
  });

  describe('offshore wind', () => {
    it('should score offshore wind highly', () => {
      // East wind (90°) is offshore for west-facing beach (offshore = 90°)
      const input = createInput({ wind: { speedMph: 8, directionDeg: 90 } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.reasons).toContain('Offshore wind');
    });

    it('should slightly degrade high offshore wind', () => {
      const input = createInput({ wind: { speedMph: 15, directionDeg: 90 } });
      const result = windQualityScorer.score(input);

      // Still good but not perfect
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('cross-shore wind', () => {
    it('should score cross-shore wind moderately', () => {
      // North wind (0°) is cross-shore (90° + 45° to 90° + 105°)
      const input = createInput({ wind: { speedMph: 8, directionDeg: 0 } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThanOrEqual(70);
    });

    it('should warn about strong cross-shore wind', () => {
      const input = createInput({ wind: { speedMph: 12, directionDeg: 0 } });
      const result = windQualityScorer.score(input);

      expect(result.warnings).toContain('Cross-shore wind picking up');
    });
  });

  describe('onshore wind', () => {
    it('should score onshore wind poorly', () => {
      // West wind (270°) is onshore for west-facing beach
      const input = createInput({ wind: { speedMph: 8, directionDeg: 270 } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBeLessThanOrEqual(40);
      expect(result.warnings).toContain('Onshore wind');
    });

    it('should skip strong onshore wind', () => {
      const input = createInput({ wind: { speedMph: 12, directionDeg: 270 } });
      const result = windQualityScorer.score(input);

      // 12 mph onshore exceeds maxOnshoreMph (10)
      expect(result.skip).toBe(true);
      expect(result.skipReason).toContain('Strong onshore wind');
    });
  });

  describe('skip conditions', () => {
    it('should skip when wind exceeds max any speed', () => {
      const input = createInput({ wind: { speedMph: 25, directionDeg: 90 } });
      const result = windQualityScorer.score(input);

      // 25 mph exceeds maxAnyMph (18)
      expect(result.skip).toBe(true);
      expect(result.skipReason).toContain('Too windy');
    });
  });

  describe('unknown wind direction', () => {
    it('should return moderate score when wind direction unknown', () => {
      const input = createInput({ wind: { speedMph: 8, directionDeg: null } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBe(50);
      expect(result.warnings).toContain('Wind direction unknown');
    });
  });

  describe('scorer metadata', () => {
    it('should have correct name', () => {
      expect(windQualityScorer.name).toBe('windQuality');
    });

    it('should have correct weight', () => {
      expect(windQualityScorer.weight).toBe(0.15);
    });
  });

  describe('break type awareness', () => {
    it('should score reef breaks higher than beach breaks for cross-shore wind', () => {
      // North wind (0°) is cross-shore
      const beachInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'beach' }
      );
      const reefInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'reef' }
      );

      const beachResult = windQualityScorer.score(beachInput);
      const reefResult = windQualityScorer.score(reefInput);

      // Reef should handle cross-shore wind better
      expect(reefResult.score).toBeGreaterThan(beachResult.score);
    });

    it('should score point breaks higher than beach breaks for cross-shore wind', () => {
      // North wind (0°) is cross-shore
      const beachInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'beach' }
      );
      const pointInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'point' }
      );

      const beachResult = windQualityScorer.score(beachInput);
      const pointResult = windQualityScorer.score(pointInput);

      // Point breaks (often sheltered) should handle cross-shore wind better
      expect(pointResult.score).toBeGreaterThan(beachResult.score);
    });

    it('should score reef breaks higher than beach breaks for onshore wind', () => {
      // West wind (270°) is onshore for west-facing beach
      const beachInput = createInput(
        { wind: { speedMph: 6, directionDeg: 270 } },
        { breakType: 'beach' }
      );
      const reefInput = createInput(
        { wind: { speedMph: 6, directionDeg: 270 } },
        { breakType: 'reef' }
      );

      const beachResult = windQualityScorer.score(beachInput);
      const reefResult = windQualityScorer.score(reefInput);

      // Reef should handle onshore wind slightly better
      expect(reefResult.score).toBeGreaterThan(beachResult.score);
    });
  });

  describe('softened cross-shore penalty', () => {
    it('should apply softer cross-shore penalty for light wind', () => {
      // 5 mph cross-shore wind (North, 0°) should not be heavily penalized
      const input = createInput({ wind: { speedMph: 5, directionDeg: 0 } });
      const result = windQualityScorer.score(input);

      // With the softened divisor (25 instead of 20), 5 mph should score well
      // speedFactor = max(0.5, 1 - (5 - 3) / 25) = max(0.5, 0.92) = 0.92
      // score = 70 * 0.92 = ~64 for beach (divisor 22), higher for others
      expect(result.score).toBeGreaterThanOrEqual(55);
    });
  });

  describe('edge cases', () => {
    it('should handle null breakType gracefully', () => {
      const input = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: null }
      );
      expect(() => windQualityScorer.score(input)).not.toThrow();
      expect(windQualityScorer.score(input).score).toBeGreaterThan(0);
    });

    it('should handle undefined breakType gracefully', () => {
      const input = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: undefined }
      );
      expect(() => windQualityScorer.score(input)).not.toThrow();
    });

    it('should handle unexpected breakType values with default behavior', () => {
      const input = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'UNKNOWN_TYPE' }
      );
      const result = windQualityScorer.score(input);
      // Should fall back to default behavior
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle compound break type strings', () => {
      // "reef break" should be recognized as reef
      const reefBreakInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'reef break' }
      );
      const reefInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'reef' }
      );

      expect(windQualityScorer.score(reefBreakInput).score)
        .toBe(windQualityScorer.score(reefInput).score);
    });
  });

  describe('regression tests', () => {
    // Lock in expected behavior to detect unintended changes during refactoring
    const regressionCases = [
      // Glassy conditions
      { wind: { speedMph: 2, directionDeg: 90 }, breakType: 'beach', expected: 100 },
      // Offshore wind
      { wind: { speedMph: 8, directionDeg: 90 }, breakType: 'beach', expected: 82 },
      { wind: { speedMph: 8, directionDeg: 90 }, breakType: 'reef', expected: 85 },
      { wind: { speedMph: 8, directionDeg: 90 }, breakType: 'point', expected: 86 },
      // Cross-shore wind (North, 0° is cross-shore for west-facing beach)
      { wind: { speedMph: 8, directionDeg: 0 }, breakType: 'beach', expected: 54 },
      { wind: { speedMph: 8, directionDeg: 0 }, breakType: 'reef', expected: 57 },
      { wind: { speedMph: 8, directionDeg: 0 }, breakType: 'point', expected: 62 },
    ];

    regressionCases.forEach(({ wind, breakType, expected }) => {
      it(`should score ${breakType} with ${wind.speedMph}mph wind at ${wind.directionDeg}° as ${expected}`, () => {
        const input = createInput({ wind }, { breakType });
        const result = windQualityScorer.score(input);
        expect(result.score).toBe(expected);
      });
    });
  });
});
