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

    it('should score very large waves (8ft+) as epic conditions', () => {
      const input = createInput({ waveHeight: 10 });
      const result = baseConditionsScorer.score(input);

      // Now scores 8ft+ waves highly - skill adjustment handles appropriateness
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.reasons).toContain('Epic swell (10.0ft)');
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

    it('should score longer periods higher than shorter periods (asymptotic scaling)', () => {
      // This tests the exponential asymptotic period scoring that rewards longer periods
      const input18s = createInput({ waveHeight: 4, wavePeriod: 18 });
      const input22s = createInput({ waveHeight: 4, wavePeriod: 22 });

      const result18s = baseConditionsScorer.score(input18s);
      const result22s = baseConditionsScorer.score(input22s);

      // 22s period should score higher than 18s period
      expect(result22s.score).toBeGreaterThan(result18s.score);
    });

    it('should differentiate between long periods that were previously capped', () => {
      // 14s, 18s, and 22s should all have different scores (not all 100)
      const input14s = createInput({ waveHeight: 4, wavePeriod: 14 });
      const input18s = createInput({ waveHeight: 4, wavePeriod: 18 });
      const input22s = createInput({ waveHeight: 4, wavePeriod: 22 });

      const result14s = baseConditionsScorer.score(input14s);
      const result18s = baseConditionsScorer.score(input18s);
      const result22s = baseConditionsScorer.score(input22s);

      // Scores should increase: 14s < 18s < 22s
      expect(result14s.score).toBeLessThan(result18s.score);
      expect(result18s.score).toBeLessThan(result22s.score);
      // All should be reasonably high scores
      expect(result14s.score).toBeGreaterThanOrEqual(80);
      expect(result22s.score).toBeGreaterThanOrEqual(90);
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

  describe('regression tests', () => {
    // Lock in expected behavior to detect unintended changes during refactoring
    // These tests verify the exact scores produced by the asymptotic period formula
    const periodRegressionCases = [
      { waveHeight: 4, wavePeriod: 10, expectedScore: 88 }, // 100*0.6 + 70*0.4
      { waveHeight: 4, wavePeriod: 14, expectedScore: 94 }, // 100*0.6 + 84*0.4
      { waveHeight: 4, wavePeriod: 18, expectedScore: 96 }, // 100*0.6 + 91*0.4
      { waveHeight: 4, wavePeriod: 22, expectedScore: 98 }, // 100*0.6 + 95*0.4
    ];

    periodRegressionCases.forEach(({ waveHeight, wavePeriod, expectedScore }) => {
      it(`should score ${waveHeight}ft @ ${wavePeriod}s as ${expectedScore}`, () => {
        const input = createInput({ waveHeight, wavePeriod });
        const result = baseConditionsScorer.score(input);
        expect(result.score).toBe(expectedScore);
      });
    });

    // Verify the exponential asymptotic formula produces expected period scores
    // These are the isolated period scores (not combined with wave height)
    it('should produce correct isolated period scores', () => {
      // Test period scoring in isolation by using ideal wave height
      // Combined score = height_score * 0.6 + period_score * 0.4
      // With ideal wave height (4ft), height_score = 100
      // So: combined = 100 * 0.6 + period_score * 0.4 = 60 + period_score * 0.4
      // Therefore: period_score = (combined - 60) / 0.4

      const testCases = [
        { period: 10, expectedPeriodScore: 70 },
        { period: 14, expectedPeriodScore: 85 }, // 84.4 rounds to 84, but combined score math gives 85
        { period: 18, expectedPeriodScore: 90 }, // Adjusted for combined score rounding
        { period: 22, expectedPeriodScore: 95 },
      ];

      testCases.forEach(({ period, expectedPeriodScore }) => {
        const input = createInput({ waveHeight: 4, wavePeriod: period });
        const result = baseConditionsScorer.score(input);
        // Reverse calculate the period score from combined
        const derivedPeriodScore = Math.round((result.score - 60) / 0.4);
        expect(derivedPeriodScore).toBe(expectedPeriodScore);
      });
    });
  });
});
