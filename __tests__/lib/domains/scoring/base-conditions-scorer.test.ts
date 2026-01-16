/**
 * Tests for Base Conditions Scorer
 *
 * Tests wave height and period scoring logic.
 */

import { baseConditionsScorer } from '@/lib/domains/scoring';
import type { ScorerInput } from '@/lib/domains/scoring';
import { createInput } from '../__fixtures__';

describe('Base Conditions Scorer', () => {
  describe('wave height scoring', () => {
    it('should score ideal wave height (2-5ft) highly', () => {
      const input = createInput({ waveHeight: 3.5 });
      const result = baseConditionsScorer.score(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.reasons).toContain('Good wave size (3.5ft)');
    });

    it('should score small waves (1-2ft) with moderate score', () => {
      const input = createInput({ waveHeight: 1.5 });
      const result = baseConditionsScorer.score(input);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(80);
    });

    it('should score very small waves (<1ft) with low score', () => {
      const input = createInput({ waveHeight: 0.7 });
      const result = baseConditionsScorer.score(input);

      // Wave height (0.7ft) scores ~35, period (12s) scores ~85
      // Combined: 35*0.6 + 85*0.4 = 55
      expect(result.score).toBeLessThan(70);
      expect(result.warnings).toContain('Waves may be too small');
    });

    it('should skip flat conditions (< 0.5ft)', () => {
      const input = createInput({ waveHeight: 0.3 });
      const result = baseConditionsScorer.score(input);

      expect(result.skip).toBe(true);
      expect(result.skipReason).toContain('Flat conditions');
    });

    it('should score larger waves (5-8ft) with moderate penalty', () => {
      const input = createInput({ waveHeight: 6.5 });
      const result = baseConditionsScorer.score(input);

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(90);
      expect(result.reasons).toContain('Larger swell (6.5ft)');
    });

    it('should score very large waves (8ft+) with fixed lower score', () => {
      const input = createInput({ waveHeight: 10 });
      const result = baseConditionsScorer.score(input);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThanOrEqual(75);
      expect(result.reasons).toContain('Big swell - expert conditions');
    });
  });

  describe('period scoring', () => {
    it('should score excellent period (14s+) highly', () => {
      const input = createInput({ wavePeriod: 16 });
      const result = baseConditionsScorer.score(input);

      expect(result.reasons).toContainEqual(expect.stringContaining('Strong swell energy'));
    });

    it('should score good period (10-14s) well', () => {
      const input = createInput({ wavePeriod: 12 });
      const result = baseConditionsScorer.score(input);

      expect(result.reasons).toContainEqual(expect.stringContaining('swell energy'));
    });

    it('should penalize short period (<6s) wind swell', () => {
      const input = createInput({ wavePeriod: 4 });
      const result = baseConditionsScorer.score(input);

      // Wave height (4ft) scores 100, period (4s) scores ~27
      // Combined: 100*0.6 + 27*0.4 = 71
      // The penalty comes from the lower combined score vs ideal period
      expect(result.score).toBeLessThan(85);
      expect(result.warnings).toContain('Short period wind swell');
    });
  });

  describe('combined scoring', () => {
    it('should combine wave height and period (60/40 weighting)', () => {
      // Ideal wave height, poor period
      const input1 = createInput({ waveHeight: 4, wavePeriod: 4 });
      const result1 = baseConditionsScorer.score(input1);

      // Poor wave height, ideal period
      const input2 = createInput({ waveHeight: 0.8, wavePeriod: 16 });
      const result2 = baseConditionsScorer.score(input2);

      // Wave height should have more impact (60% weight)
      expect(result1.score).toBeGreaterThan(result2.score);
    });
  });

  describe('scorer metadata', () => {
    it('should have correct name', () => {
      expect(baseConditionsScorer.name).toBe('baseConditions');
    });

    it('should have correct weight', () => {
      expect(baseConditionsScorer.weight).toBe(0.25);
    });
  });
});
