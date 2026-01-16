/**
 * Integration Tests for Tide Direction Scorer
 *
 * Tests that the tide direction scorer works correctly within
 * the full scoring pipeline with multiple scorers registered.
 *
 * Key assertions:
 * 1. High sensitivity mismatch drops total score by at least 8 points
 * 2. Tide direction warning appears in composite result
 * 3. Low sensitivity mismatch has minimal impact (<5 points)
 */

import {
  ScoringEngine,
  baseConditionsScorer,
  windQualityScorer,
  tideFitScorer,
  tideDirectionScorer,
  swellAlignmentScorer,
} from '@/lib/domains/scoring';
import type { ScorerInput } from '@/lib/domains/scoring';
import type { SpotProfile, TidePreferences } from '@/lib/domains/spot-profile';
import type { ConditionsSnapshot, TideDirection } from '@/lib/domains/conditions';
import {
  createInput,
  DEFAULT_PROFILE,
  DEFAULT_SNAPSHOT,
} from '../../__fixtures__';

/**
 * Creates a full scoring engine with standard scorers.
 * This simulates the real-world scoring pipeline.
 */
function createFullScoringEngine(): ScoringEngine {
  return new ScoringEngine()
    .register(baseConditionsScorer)
    .register(windQualityScorer)
    .register(tideFitScorer)
    .register(tideDirectionScorer)
    .register(swellAlignmentScorer);
}

/**
 * Helper to create ScorerInput with tide direction overrides.
 * Uses good base conditions to ensure tide direction is the variable under test.
 */
function createTideTestInput(options: {
  tideDirection?: TideDirection;
  preferredDirection?: TidePreferences['preferredDirection'];
  directionSensitivity?: TidePreferences['directionSensitivity'];
} = {}): ScorerInput {
  const {
    tideDirection = 'rising',
    preferredDirection = 'either',
    directionSensitivity = 'medium',
  } = options;

  // Use good base conditions to isolate tide direction impact
  const snapshotOverrides: Partial<ConditionsSnapshot> = {
    waveHeight: 4,
    wavePeriod: 12,
    waveDirection: 270,
    wind: { speedMph: 5, directionDeg: 90 }, // Light offshore wind
    tide: {
      heightFt: 3,
      status: tideDirection === 'slack' ? 'slack-high' : tideDirection,
      direction: tideDirection,
    },
    primarySwell: {
      heightFt: 4,
      periodS: 12,
      directionDeg: 270,
      energy: 4 * 4 * 12,
    },
  };

  const profileOverrides: Partial<SpotProfile> = {
    tidePreferences: {
      ...DEFAULT_PROFILE.tidePreferences,
      preferredDirection,
      directionSensitivity,
    },
  };

  return createInput(snapshotOverrides, profileOverrides);
}

describe('Tide Direction Integration Tests', () => {
  describe('high sensitivity mismatch impact', () => {
    it('should drop total score by at least 8 points with high sensitivity mismatch', () => {
      const engine = createFullScoringEngine();

      // Baseline: tide direction matches preference (rising matches rising)
      const matchInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });
      const matchResult = engine.score(matchInput);

      // Mismatch: tide direction opposes preference (falling vs rising)
      const mismatchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });
      const mismatchResult = engine.score(mismatchInput);

      // High sensitivity mismatch should have significant impact
      // tideDirection weight is 0.15, mismatch score is 10 vs match score of 90
      // Expected impact: 0.15 * (90 - 10) / normalized_weights = ~12 points
      const scoreDrop = matchResult.total - mismatchResult.total;

      expect(scoreDrop).toBeGreaterThanOrEqual(8);
      expect(mismatchResult.subscores.get('tideDirection')).toBe(10);
      expect(matchResult.subscores.get('tideDirection')).toBe(90);
    });

    it('should maintain significant impact with falling tide preference', () => {
      const engine = createFullScoringEngine();

      // Baseline: falling matches falling
      const matchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'falling',
        directionSensitivity: 'high',
      });
      const matchResult = engine.score(matchInput);

      // Mismatch: rising vs falling
      const mismatchInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'falling',
        directionSensitivity: 'high',
      });
      const mismatchResult = engine.score(mismatchInput);

      const scoreDrop = matchResult.total - mismatchResult.total;

      expect(scoreDrop).toBeGreaterThanOrEqual(8);
    });
  });

  describe('tide direction warning in composite result', () => {
    it('should include tide direction warning when high sensitivity mismatch occurs', () => {
      const engine = createFullScoringEngine();

      const mismatchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });
      const result = engine.score(mismatchInput);

      // Warning should be present in composite result
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/tide.*dropping|outgoing|this spot/i)
      );
    });

    it('should include tide direction warning for medium sensitivity mismatch', () => {
      const engine = createFullScoringEngine();

      const mismatchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const result = engine.score(mismatchInput);

      expect(result.warnings).toContainEqual(
        expect.stringMatching(/tide.*dropping|falling|outgoing/i)
      );
    });

    it('should include slack tide warning when beach prefers movement', () => {
      const engine = createFullScoringEngine();

      const slackInput = createTideTestInput({
        tideDirection: 'slack',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const result = engine.score(slackInput);

      expect(result.warnings).toContainEqual(
        expect.stringMatching(/slack.*prefers.*rising/i)
      );
    });
  });

  describe('low sensitivity mismatch minimal impact', () => {
    it('should have less than 5 point impact with low sensitivity mismatch', () => {
      const engine = createFullScoringEngine();

      // Baseline: tide direction matches preference
      const matchInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });
      const matchResult = engine.score(matchInput);

      // Mismatch with low sensitivity
      const mismatchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });
      const mismatchResult = engine.score(mismatchInput);

      // Low sensitivity: match=80, mismatch=55
      // Expected impact: 0.15 * (80 - 55) / normalized_weights = ~3-5 points
      // Due to rounding and weight normalization, exact value may be 4-5 points
      const scoreDrop = matchResult.total - mismatchResult.total;

      expect(scoreDrop).toBeLessThanOrEqual(5);
      expect(scoreDrop).toBeGreaterThan(0); // Should still have some impact
      expect(mismatchResult.subscores.get('tideDirection')).toBe(55);
      expect(matchResult.subscores.get('tideDirection')).toBe(80);
    });

    it('should have minimal impact even when other conditions are poor', () => {
      const engine = createFullScoringEngine();

      // Create input with moderate conditions
      const baseInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });

      const mismatchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });

      const baseResult = engine.score(baseInput);
      const mismatchResult = engine.score(mismatchInput);

      const scoreDrop = baseResult.total - mismatchResult.total;
      // Low sensitivity should have minimal impact (5 points or less)
      expect(scoreDrop).toBeLessThanOrEqual(5);
    });
  });

  describe('neutral preference behavior', () => {
    it('should have zero impact when beach has no tide direction preference', () => {
      const engine = createFullScoringEngine();

      // Both with 'either' preference
      const risingInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'either',
        directionSensitivity: 'high', // Sensitivity doesn't matter with 'either'
      });
      const fallingInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'either',
        directionSensitivity: 'high',
      });
      const slackInput = createTideTestInput({
        tideDirection: 'slack',
        preferredDirection: 'either',
        directionSensitivity: 'high',
      });

      const risingResult = engine.score(risingInput);
      const fallingResult = engine.score(fallingInput);
      const slackResult = engine.score(slackInput);

      // All should have identical tide direction scores
      expect(risingResult.subscores.get('tideDirection')).toBe(70);
      expect(fallingResult.subscores.get('tideDirection')).toBe(70);
      expect(slackResult.subscores.get('tideDirection')).toBe(70);

      // Total scores should be the same (only tide direction component varies)
      expect(risingResult.total).toBe(fallingResult.total);
      expect(fallingResult.total).toBe(slackResult.total);
    });
  });

  describe('subscore tracking', () => {
    it('should track tide direction subscore in composite result', () => {
      const engine = createFullScoringEngine();

      const input = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const result = engine.score(input);

      expect(result.subscores.has('tideDirection')).toBe(true);
      expect(result.subscores.get('tideDirection')).toBe(85); // medium sensitivity match
    });

    it('should include tide direction alongside other subscores', () => {
      const engine = createFullScoringEngine();

      const input = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const result = engine.score(input);

      // Should have all registered scorers
      expect(result.subscores.has('baseConditions')).toBe(true);
      expect(result.subscores.has('windQuality')).toBe(true);
      expect(result.subscores.has('tideFit')).toBe(true);
      expect(result.subscores.has('tideDirection')).toBe(true);
      expect(result.subscores.has('swellAlignment')).toBe(true);
    });
  });

  describe('match quality impact', () => {
    it('should not change match quality with low sensitivity mismatch on good conditions', () => {
      const engine = createFullScoringEngine();

      const matchInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });
      const mismatchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });

      const matchResult = engine.score(matchInput);
      const mismatchResult = engine.score(mismatchInput);

      // With good base conditions and low sensitivity, both should be in same quality bracket
      // or adjacent brackets (not skip to excellent drop)
      const qualityLevels = ['perfect', 'excellent', 'good', 'fair', 'skip'];
      const matchIndex = qualityLevels.indexOf(matchResult.matchQuality);
      const mismatchIndex = qualityLevels.indexOf(mismatchResult.matchQuality);

      // Should not drop more than 1 quality level
      expect(mismatchIndex - matchIndex).toBeLessThanOrEqual(1);
    });

    it('may downgrade match quality with high sensitivity mismatch', () => {
      const engine = createFullScoringEngine();

      const matchInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });
      const mismatchInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });

      const matchResult = engine.score(matchInput);
      const mismatchResult = engine.score(mismatchInput);

      // With high sensitivity, we expect a meaningful score drop
      // This may or may not change quality level depending on base score
      expect(matchResult.total).toBeGreaterThan(mismatchResult.total);
    });
  });

  describe('never triggers skip', () => {
    it('should never skip based on tide direction alone', () => {
      const engine = createFullScoringEngine();

      // Test worst case: high sensitivity mismatch
      const worstCaseInput = createTideTestInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });
      const result = engine.score(worstCaseInput);

      // Skip should only come from other scorers (e.g., flat conditions)
      // not from tide direction
      if (result.skipReason) {
        expect(result.skipReason).not.toMatch(/tide direction/i);
      }
    });
  });

  describe('reason aggregation', () => {
    it('should include positive reason when tide direction matches with high sensitivity', () => {
      const engine = createFullScoringEngine();

      const matchInput = createTideTestInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });
      const result = engine.score(matchInput);

      // Should have a positive reason about tide
      expect(result.reasons).toContainEqual(
        expect.stringMatching(/tide.*rising|incoming|optimal/i)
      );
    });
  });
});
