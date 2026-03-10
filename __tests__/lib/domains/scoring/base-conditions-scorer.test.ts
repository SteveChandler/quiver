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
    it('should score ideal wave height (2-5ft) with ramping score', () => {
      const input = createInput({ waveHeight: 3.5 });
      const result = baseConditionsScorer.score(input);

      // 3.5ft: height = round(55 + ((3.5-2)/3)*45) = 78, period(12s)=78
      // Combined: round(78*0.6 + 78*0.4) = 78
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.reasons).toContain('Good wave size (3.5ft)');
    });

    it('should score small waves (1-2ft) with compressed score', () => {
      const input = createInput({ waveHeight: 1.5 });
      const result = baseConditionsScorer.score(input);

      // 1.5ft: height = round(1.5/2 * 55) = 41, period(12s) = 78
      // Combined: round(41*0.6 + 78*0.4) = 56
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(70);
    });

    it('should score very small waves (<1ft) with low score', () => {
      const input = createInput({ waveHeight: 0.7 });
      const result = baseConditionsScorer.score(input);

      // Wave height (0.7ft): round(0.7/2 * 55) = 19, period (12s) = 78
      // Combined: round(19*0.6 + 78*0.4) = 43
      expect(result.score).toBeLessThan(50);
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

      // 6.5ft: height = round(100 - (1.5/3)*30) = 85, period(12s) = 78
      // Combined: round(85*0.6 + 78*0.4) = 82
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(90);
      expect(result.reasons).toContain('Larger swell (6.5ft)');
    });

    it('should score very large waves (8ft+) as epic conditions', () => {
      const input = createInput({ waveHeight: 10 });
      const result = baseConditionsScorer.score(input);

      // Epic = 85, period(12s) = 78 → combined = round(85*0.6 + 78*0.4) = 82
      expect(result.score).toBeGreaterThanOrEqual(75);
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
      expect(result22s.score).toBeGreaterThanOrEqual(85);
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

  describe('skill-level-aware idealMin', () => {
    it('should boost beginner beach scoring for small waves (idealMin=1)', () => {
      // 1.5ft at beginner beach: idealMin=1, idealMax=5, 1.5 is IN ideal range
      //   height = round(55 + ((1.5-1)/(5-1))*45) = round(55 + 5.625) = 61
      const beginnerInput = createInput({ waveHeight: 1.5 }, { skillLevel: 'beginner' });
      // 1.5ft at intermediate beach: idealMin=2, below ideal
      //   height = round(1.5/2 * 55) = 41
      const intermediateInput = createInput({ waveHeight: 1.5 }, { skillLevel: 'intermediate' });

      const beginnerResult = baseConditionsScorer.score(beginnerInput);
      const intermediateResult = baseConditionsScorer.score(intermediateInput);

      expect(beginnerResult.score).toBeGreaterThan(intermediateResult.score);
    });

    it('should penalize advanced beach for small waves (idealMin=3)', () => {
      // 1.3ft at advanced beach: idealMin=3, height = round(1.3/3 * 55) = 24
      const advancedInput = createInput({ waveHeight: 1.3 }, { skillLevel: 'advanced' });
      // 1.3ft at intermediate beach: idealMin=2, height = round(1.3/2 * 55) = 36
      const intermediateInput = createInput({ waveHeight: 1.3 }, { skillLevel: 'intermediate' });

      const advancedResult = baseConditionsScorer.score(advancedInput);
      const intermediateResult = baseConditionsScorer.score(intermediateInput);

      expect(advancedResult.score).toBeLessThan(intermediateResult.score);
    });

    it('should use idealMin=4 for expert beaches', () => {
      // 2ft at expert beach: idealMin=4, height score = round(2/4 * 55) = 28
      // Combined with 12s period (~78): round(28*0.6 + 78*0.4) = 48
      const expertInput = createInput({ waveHeight: 2 }, { skillLevel: 'expert' });
      const result = baseConditionsScorer.score(expertInput);

      expect(result.score).toBeLessThan(55);
    });

    it('should not change scoring for intermediate (idealMin=2 matches default)', () => {
      const input = createInput({ waveHeight: 4 }, { skillLevel: 'intermediate' });
      const result = baseConditionsScorer.score(input);
      // 4ft@12s with idealMin=2, idealMax=5: height = round(55 + (2/3)*45) = 85
      // period = 78 → round(85*0.6 + 78*0.4) = 82
      expect(result.score).toBe(82);
    });

    it('should use default config for null skill level', () => {
      const input = createInput({ waveHeight: 4 }, { skillLevel: null });
      const result = baseConditionsScorer.score(input);
      // Null skillLevel → DEFAULT_WAVE_CONFIG (idealMin=2) → same as intermediate
      expect(result.score).toBe(82);
    });
  });

  describe('regression tests', () => {
    // Lock in expected behavior to detect unintended changes during refactoring
    // These tests verify the exact scores produced by the compressed wave height
    // curve (55→100 in ideal range) combined with asymptotic period formula.
    // 4ft height: round(55 + ((4-2)/3)*45) = 85
    const periodRegressionCases = [
      { waveHeight: 4, wavePeriod: 10, expectedScore: 79 }, // 85*0.6 + 70*0.4
      { waveHeight: 4, wavePeriod: 14, expectedScore: 85 }, // 85*0.6 + 84*0.4
      { waveHeight: 4, wavePeriod: 18, expectedScore: 87 }, // 85*0.6 + 91*0.4
      { waveHeight: 4, wavePeriod: 22, expectedScore: 89 }, // 85*0.6 + 95*0.4
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
      // Test period scoring in isolation by using idealMax wave height (5ft)
      // for a clean height_score = 100.
      // Combined score = height_score * 0.6 + period_score * 0.4
      // With idealMax wave height (5ft), height_score = 100
      // So: combined = 100 * 0.6 + period_score * 0.4 = 60 + period_score * 0.4
      // Therefore: period_score = (combined - 60) / 0.4

      const testCases = [
        { period: 10, expectedPeriodScore: 70 },
        { period: 14, expectedPeriodScore: 85 }, // 84.4 rounds to 84, but combined score math gives 85
        { period: 18, expectedPeriodScore: 90 }, // Adjusted for combined score rounding
        { period: 22, expectedPeriodScore: 95 },
      ];

      testCases.forEach(({ period, expectedPeriodScore }) => {
        const input = createInput({ waveHeight: 5, wavePeriod: period });
        const result = baseConditionsScorer.score(input);
        // Reverse calculate the period score from combined
        const derivedPeriodScore = Math.round((result.score - 60) / 0.4);
        expect(derivedPeriodScore).toBe(expectedPeriodScore);
      });
    });
  });
});
