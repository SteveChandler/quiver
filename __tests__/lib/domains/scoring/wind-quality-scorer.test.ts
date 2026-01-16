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
});
