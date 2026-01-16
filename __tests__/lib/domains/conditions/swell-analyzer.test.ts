/**
 * Tests for Swell Analyzer
 *
 * Tests swell interference detection and alignment scoring.
 */

import {
  analyzeSwell,
  createSwellComponent,
  areSwellsAligned,
  areSwellsCrossing,
} from '@/lib/domains/conditions';
import type { SwellWindow } from '@/lib/domains/spot-profile';

// Helper to create a swell window
function createSwellWindow(
  minDeg: number,
  maxDeg: number
): SwellWindow {
  const span = ((maxDeg - minDeg + 360) % 360) || 360;
  const centerDeg = (minDeg + span / 2) % 360;
  return {
    minDeg,
    maxDeg,
    centerDeg,
    halfWidthDeg: span / 2,
  };
}

describe('Swell Analyzer', () => {
  describe('createSwellComponent', () => {
    it('should create swell component with computed energy', () => {
      const swell = createSwellComponent(4, 12, 270);

      expect(swell.heightFt).toBe(4);
      expect(swell.periodS).toBe(12);
      expect(swell.directionDeg).toBe(270);
      expect(swell.energy).toBe(4 * 4 * 12); // 192
    });

    it('should compute energy as height² × period', () => {
      const small = createSwellComponent(2, 10, 270);
      const large = createSwellComponent(4, 10, 270);

      // Doubling height quadruples energy
      expect(large.energy).toBe(small.energy * 4);
    });
  });

  describe('areSwellsAligned', () => {
    it('should return true for swells from same direction', () => {
      const swell1 = createSwellComponent(4, 12, 270);
      const swell2 = createSwellComponent(2, 8, 270);

      expect(areSwellsAligned(swell1, swell2)).toBe(true);
    });

    it('should return true for swells within 30° of each other', () => {
      const swell1 = createSwellComponent(4, 12, 270);
      const swell2 = createSwellComponent(2, 8, 290);

      expect(areSwellsAligned(swell1, swell2)).toBe(true);
    });

    it('should return false for swells 30°+ apart', () => {
      const swell1 = createSwellComponent(4, 12, 270);
      const swell2 = createSwellComponent(2, 8, 310);

      expect(areSwellsAligned(swell1, swell2)).toBe(false);
    });
  });

  describe('areSwellsCrossing', () => {
    it('should return true for swells 60°+ apart', () => {
      const swell1 = createSwellComponent(4, 12, 270);
      const swell2 = createSwellComponent(2, 8, 180);

      expect(areSwellsCrossing(swell1, swell2)).toBe(true);
    });

    it('should return false for swells within 60°', () => {
      const swell1 = createSwellComponent(4, 12, 270);
      const swell2 = createSwellComponent(2, 8, 300);

      expect(areSwellsCrossing(swell1, swell2)).toBe(false);
    });
  });

  describe('analyzeSwell', () => {
    const westWindow = createSwellWindow(250, 290); // Center: 270°

    describe('with no swell data', () => {
      it('should return zero scores', () => {
        const result = analyzeSwell(null, null, westWindow);

        expect(result.primaryAlignment).toBe(0);
        expect(result.secondaryAlignment).toBe(0);
        expect(result.interferencePenalty).toBe(0);
        expect(result.combinedScore).toBe(0);
        expect(result.explanation).toBe('No swell data available');
      });
    });

    describe('with primary swell only', () => {
      it('should return high score for perfectly aligned swell', () => {
        const primary = createSwellComponent(4, 12, 270); // Perfect alignment

        const result = analyzeSwell(primary, null, westWindow);

        expect(result.primaryAlignment).toBe(100);
        expect(result.interferencePenalty).toBe(0);
        expect(result.combinedScore).toBe(100);
      });

      it('should return good score for swell within window', () => {
        const primary = createSwellComponent(4, 12, 260); // Within window

        const result = analyzeSwell(primary, null, westWindow);

        expect(result.primaryAlignment).toBeGreaterThanOrEqual(70);
        expect(result.interferencePenalty).toBe(0);
      });

      it('should return lower score for swell outside window', () => {
        const primary = createSwellComponent(4, 12, 180); // South swell

        const result = analyzeSwell(primary, null, westWindow);

        expect(result.primaryAlignment).toBeLessThan(70);
        expect(result.combinedScore).toBeLessThan(70);
      });
    });

    describe('with insignificant secondary swell', () => {
      it('should ignore secondary swell with <10% energy', () => {
        const primary = createSwellComponent(5, 14, 270); // Energy: 350
        const secondary = createSwellComponent(1, 10, 180); // Energy: 10 (< 10% of 350)

        const result = analyzeSwell(primary, secondary, westWindow);

        // Should be treated as primary-only
        expect(result.secondaryAlignment).toBe(0);
        expect(result.interferencePenalty).toBe(0);
      });
    });

    describe('with significant secondary swell', () => {
      it('should apply no penalty for aligned swells', () => {
        const primary = createSwellComponent(4, 12, 270);
        const secondary = createSwellComponent(3, 10, 280); // Similar direction

        const result = analyzeSwell(primary, secondary, westWindow);

        expect(result.interferencePenalty).toBe(0);
        expect(result.combinedScore).toBeGreaterThanOrEqual(70);
      });

      it('should apply penalty for crossing swells (60°+ apart)', () => {
        const primary = createSwellComponent(4, 12, 270); // W
        const secondary = createSwellComponent(3, 10, 180); // S - 90° apart

        const result = analyzeSwell(primary, secondary, westWindow);

        expect(result.interferencePenalty).toBeGreaterThan(10);
        expect(result.explanation).toContain('cross-swell');
      });

      it('should apply maximum penalty for perpendicular swells with equal energy', () => {
        const primary = createSwellComponent(4, 12, 270); // W
        const secondary = createSwellComponent(4, 12, 0); // N - 90° apart, same energy

        const result = analyzeSwell(primary, secondary, westWindow);

        // High penalty for perpendicular + equal energy
        expect(result.interferencePenalty).toBeGreaterThanOrEqual(15);
      });

      it('should reduce penalty when secondary has less energy', () => {
        const primary = createSwellComponent(5, 14, 270); // High energy
        const secondary = createSwellComponent(2, 8, 180); // Low energy, 90° apart

        const result = analyzeSwell(primary, secondary, westWindow);

        // Lower penalty due to energy imbalance
        expect(result.interferencePenalty).toBeLessThan(15);
      });

      it('should compute combined score as weighted alignment minus penalty', () => {
        const primary = createSwellComponent(4, 12, 270);
        const secondary = createSwellComponent(2, 10, 200); // Different direction

        const result = analyzeSwell(primary, secondary, westWindow);

        // Combined should be less than primary alignment due to penalty/weighting
        expect(result.combinedScore).toBeLessThanOrEqual(result.primaryAlignment);
      });
    });

    describe('explanation formatting', () => {
      it('should include primary swell details', () => {
        const primary = createSwellComponent(4.5, 12, 270);

        const result = analyzeSwell(primary, null, westWindow);

        expect(result.explanation).toContain('4.5ft');
        expect(result.explanation).toContain('12s');
        expect(result.explanation).toContain('W');
      });

      it('should mention secondary swell when significant', () => {
        const primary = createSwellComponent(4, 12, 270);
        const secondary = createSwellComponent(3, 10, 290);

        const result = analyzeSwell(primary, secondary, westWindow);

        expect(result.explanation).toContain('secondary');
      });

      it('should mention cross-swell when interference is high', () => {
        const primary = createSwellComponent(4, 12, 270);
        const secondary = createSwellComponent(3, 10, 180);

        const result = analyzeSwell(primary, secondary, westWindow);

        expect(result.explanation).toContain('cross-swell');
      });
    });
  });

  describe('Edge Cases', () => {
    const northWindow = createSwellWindow(350, 10); // Crosses 0°

    it('should handle swell window crossing 0°', () => {
      const primary = createSwellComponent(4, 12, 0); // Due North

      const result = analyzeSwell(primary, null, northWindow);

      expect(result.primaryAlignment).toBe(100);
    });

    it('should handle 360° vs 0° equivalence', () => {
      const swell360 = createSwellComponent(4, 12, 360);
      const swell0 = createSwellComponent(4, 12, 0);

      expect(areSwellsAligned(swell360, swell0)).toBe(true);
    });

    it('should handle exactly 30° difference (boundary)', () => {
      const swell1 = createSwellComponent(4, 12, 270);
      const swell2 = createSwellComponent(3, 10, 300); // Exactly 30° apart

      // At exactly 30°, should NOT be aligned (threshold is < 30)
      expect(areSwellsAligned(swell1, swell2)).toBe(false);
    });
  });
});
