/**
 * Tests for waveHeightCeiling
 *
 * Boundary-focused unit tests for the domain scoring engine's small-wave
 * ceiling. Mirrors the intent of `getWaveHeightCeiling` in
 * `lib/scoring/surf-conditions-scorer.ts:562` with skill-agnostic thresholds.
 */

import { waveHeightCeiling } from '@/lib/domains/scoring/wave-height-ceiling';

describe('waveHeightCeiling', () => {
  describe('ankle slop (< 1.0 ft) -> 30', () => {
    it('returns 30 for 0.5 ft', () => {
      expect(waveHeightCeiling(0.5)).toBe(30);
    });

    it('returns 30 for 0.99 ft', () => {
      expect(waveHeightCeiling(0.99)).toBe(30);
    });
  });

  describe('knee-high (1.0 - 1.49 ft) -> 40', () => {
    it('returns 40 at the lower boundary (1.0 ft, strict <)', () => {
      expect(waveHeightCeiling(1.0)).toBe(40);
    });

    it('returns 40 for 1.49 ft', () => {
      expect(waveHeightCeiling(1.49)).toBe(40);
    });
  });

  describe('thigh-high (1.5 - 1.99 ft) -> 55', () => {
    it('returns 55 at the lower boundary (1.5 ft)', () => {
      expect(waveHeightCeiling(1.5)).toBe(55);
    });

    it('returns 55 for 1.9 ft', () => {
      expect(waveHeightCeiling(1.9)).toBe(55);
    });
  });

  describe('waist+ (2.0 - 2.99 ft) -> 75', () => {
    it('returns 75 at the lower boundary (2.0 ft)', () => {
      expect(waveHeightCeiling(2.0)).toBe(75);
    });

    it('returns 75 for 2.99 ft', () => {
      expect(waveHeightCeiling(2.99)).toBe(75);
    });
  });

  describe('chest+ (>= 3.0 ft) -> 100 (uncapped)', () => {
    it('returns 100 at the lower boundary (3.0 ft)', () => {
      expect(waveHeightCeiling(3.0)).toBe(100);
    });

    it('returns 100 for 10 ft', () => {
      expect(waveHeightCeiling(10)).toBe(100);
    });

    it('returns 100 for very large waves (25 ft)', () => {
      expect(waveHeightCeiling(25)).toBe(100);
    });
  });

  describe('invalid / null inputs preserve legacy behavior (no cap)', () => {
    it('returns 100 for null', () => {
      expect(waveHeightCeiling(null)).toBe(100);
    });

    it('returns 100 for undefined', () => {
      expect(waveHeightCeiling(undefined)).toBe(100);
    });

    it('returns 100 for NaN', () => {
      expect(waveHeightCeiling(Number.NaN)).toBe(100);
    });

    it('returns 100 for Infinity', () => {
      expect(waveHeightCeiling(Number.POSITIVE_INFINITY)).toBe(100);
    });

    it('returns 100 for negative values', () => {
      expect(waveHeightCeiling(-1)).toBe(100);
    });
  });

  describe('monotonicity', () => {
    it('ceiling is non-decreasing as height increases', () => {
      const heights = [0.5, 0.99, 1.0, 1.49, 1.5, 1.99, 2.0, 2.99, 3.0, 10];
      const ceilings = heights.map((h) => waveHeightCeiling(h));
      for (let i = 1; i < ceilings.length; i++) {
        expect(ceilings[i]).toBeGreaterThanOrEqual(ceilings[i - 1]);
      }
    });
  });
});
