/**
 * Tests for Tide Direction Scorer
 *
 * Tests tide direction preference matching logic.
 * Following TDD - these tests are written before the implementation.
 *
 * Key behaviors:
 * - Beach with 'either' preference: neutral score (70)
 * - Direction match: bonus (score > 70), scaled by sensitivity
 * - Direction mismatch: penalty (score < 70), scaled by sensitivity
 * - Slack tide: half penalty when beach prefers movement, bonus when beach prefers slack
 * - Never triggers skip (tide direction is a preference, not a hard constraint)
 */

import { tideDirectionScorer } from '@/lib/domains/scoring';
import type { ScorerInput } from '@/lib/domains/scoring';
import type { SpotProfile, TidePreferences } from '@/lib/domains/spot-profile';
import type { ConditionsSnapshot, TideDirection } from '@/lib/domains/conditions';
import { createInput, createSnapshot, createProfile, DEFAULT_PROFILE, DEFAULT_SNAPSHOT } from '../__fixtures__';

/**
 * Helper to create ScorerInput with tide direction overrides.
 * Makes tests more readable by focusing on the relevant parameters.
 */
function createTideInput(options: {
  tideDirection?: TideDirection;
  preferredDirection?: TidePreferences['preferredDirection'];
  directionSensitivity?: TidePreferences['directionSensitivity'];
} = {}): ScorerInput {
  const {
    tideDirection = 'rising',
    preferredDirection = 'either',
    directionSensitivity = 'medium',
  } = options;

  const snapshotOverrides: Partial<ConditionsSnapshot> = {
    tide: {
      ...DEFAULT_SNAPSHOT.tide,
      direction: tideDirection,
      status: tideDirection === 'slack' ? 'slack-high' : tideDirection,
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

describe('Tide Direction Scorer', () => {
  describe('no preference (either)', () => {
    it('should return neutral score (70) when beach has no preference', () => {
      const input = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'either',
      });
      const result = tideDirectionScorer.score(input);

      expect(result.score).toBe(70);
      expect(result.reasons).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.skip).toBe(false);
    });

    it('should return neutral score regardless of actual tide direction', () => {
      const risingInput = createTideInput({ tideDirection: 'rising', preferredDirection: 'either' });
      const fallingInput = createTideInput({ tideDirection: 'falling', preferredDirection: 'either' });
      const slackInput = createTideInput({ tideDirection: 'slack', preferredDirection: 'either' });

      expect(tideDirectionScorer.score(risingInput).score).toBe(70);
      expect(tideDirectionScorer.score(fallingInput).score).toBe(70);
      expect(tideDirectionScorer.score(slackInput).score).toBe(70);
    });
  });

  describe('direction match bonus', () => {
    it('should give bonus when tide direction matches preference', () => {
      const input = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeGreaterThan(70);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.skip).toBe(false);
    });

    it('should give bonus for falling tide matching falling preference', () => {
      const input = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'falling',
        directionSensitivity: 'medium',
      });
      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeGreaterThan(70);
    });

    it('should give higher bonus with high sensitivity', () => {
      const lowSensitivity = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });
      const mediumSensitivity = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const highSensitivity = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });

      const lowResult = tideDirectionScorer.score(lowSensitivity);
      const mediumResult = tideDirectionScorer.score(mediumSensitivity);
      const highResult = tideDirectionScorer.score(highSensitivity);

      // Higher sensitivity should give larger bonus
      expect(lowResult.score).toBeGreaterThan(70);
      expect(mediumResult.score).toBeGreaterThan(lowResult.score);
      expect(highResult.score).toBeGreaterThan(mediumResult.score);
    });

    it('should include positive reason when direction matches', () => {
      const input = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
      });
      const result = tideDirectionScorer.score(input);

      expect(result.reasons).toContainEqual(
        expect.stringMatching(/tide|rising|incoming/i)
      );
    });
  });

  describe('direction mismatch penalty', () => {
    it('should give penalty when tide direction opposes preference', () => {
      const input = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeLessThan(70);
      expect(result.skip).toBe(false);
    });

    it('should give penalty for rising tide when falling preferred', () => {
      const input = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'falling',
        directionSensitivity: 'medium',
      });
      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeLessThan(70);
    });

    it('should give larger penalty with higher sensitivity', () => {
      const lowSensitivity = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'low',
      });
      const mediumSensitivity = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const highSensitivity = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });

      const lowResult = tideDirectionScorer.score(lowSensitivity);
      const mediumResult = tideDirectionScorer.score(mediumSensitivity);
      const highResult = tideDirectionScorer.score(highSensitivity);

      // Higher sensitivity should give larger penalty (lower score)
      expect(lowResult.score).toBeLessThan(70);
      expect(mediumResult.score).toBeLessThan(lowResult.score);
      expect(highResult.score).toBeLessThan(mediumResult.score);
    });

    it('should include warning when direction mismatches with high sensitivity', () => {
      const input = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'high',
      });
      const result = tideDirectionScorer.score(input);

      // Warning should mention tide and wrong direction
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/tide.*dropping|falling|outgoing/i)
      );
    });
  });

  describe('slack tide behavior', () => {
    it('should give half penalty for slack tide when beach prefers movement (rising)', () => {
      const slackInput = createTideInput({
        tideDirection: 'slack',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });
      const mismatchInput = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        directionSensitivity: 'medium',
      });

      const slackResult = tideDirectionScorer.score(slackInput);
      const mismatchResult = tideDirectionScorer.score(mismatchInput);

      // Slack should have penalty, but less than full mismatch
      expect(slackResult.score).toBeLessThan(70);
      expect(slackResult.score).toBeGreaterThan(mismatchResult.score);
    });

    it('should give half penalty for slack tide when beach prefers falling', () => {
      const slackInput = createTideInput({
        tideDirection: 'slack',
        preferredDirection: 'falling',
        directionSensitivity: 'medium',
      });
      const mismatchInput = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'falling',
        directionSensitivity: 'medium',
      });

      const slackResult = tideDirectionScorer.score(slackInput);
      const mismatchResult = tideDirectionScorer.score(mismatchInput);

      // Slack should have penalty, but less than full mismatch
      expect(slackResult.score).toBeLessThan(70);
      expect(slackResult.score).toBeGreaterThan(mismatchResult.score);
    });

    it('should give bonus for slack tide when beach prefers slack', () => {
      const input = createTideInput({
        tideDirection: 'slack',
        preferredDirection: 'slack',
        directionSensitivity: 'medium',
      });
      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeGreaterThan(70);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should give penalty for movement when beach prefers slack', () => {
      const risingInput = createTideInput({
        tideDirection: 'rising',
        preferredDirection: 'slack',
        directionSensitivity: 'medium',
      });
      const fallingInput = createTideInput({
        tideDirection: 'falling',
        preferredDirection: 'slack',
        directionSensitivity: 'medium',
      });

      expect(tideDirectionScorer.score(risingInput).score).toBeLessThan(70);
      expect(tideDirectionScorer.score(fallingInput).score).toBeLessThan(70);
    });
  });

  describe('scorer metadata', () => {
    it('should have correct name', () => {
      expect(tideDirectionScorer.name).toBe('tideDirection');
    });

    it('should have correct weight (0.15)', () => {
      expect(tideDirectionScorer.weight).toBe(0.15);
    });
  });

  describe('skip behavior', () => {
    it('should never trigger skip (tide direction is a preference, not a constraint)', () => {
      // Test various scenarios - none should skip
      const scenarios = [
        { tideDirection: 'falling' as const, preferredDirection: 'rising' as const, directionSensitivity: 'high' as const },
        { tideDirection: 'rising' as const, preferredDirection: 'falling' as const, directionSensitivity: 'high' as const },
        { tideDirection: 'slack' as const, preferredDirection: 'rising' as const, directionSensitivity: 'high' as const },
        { tideDirection: 'slack' as const, preferredDirection: 'falling' as const, directionSensitivity: 'high' as const },
        { tideDirection: 'rising' as const, preferredDirection: 'slack' as const, directionSensitivity: 'high' as const },
      ];

      for (const scenario of scenarios) {
        const input = createTideInput(scenario);
        const result = tideDirectionScorer.score(input);

        expect(result.skip).toBe(false);
        expect(result.skipReason).toBeNull();
      }
    });
  });

  describe('score bounds', () => {
    it('should keep score within 0-100 range', () => {
      const allScenarios = [
        // Perfect matches
        { tideDirection: 'rising' as const, preferredDirection: 'rising' as const, directionSensitivity: 'high' as const },
        { tideDirection: 'falling' as const, preferredDirection: 'falling' as const, directionSensitivity: 'high' as const },
        { tideDirection: 'slack' as const, preferredDirection: 'slack' as const, directionSensitivity: 'high' as const },
        // Complete mismatches
        { tideDirection: 'falling' as const, preferredDirection: 'rising' as const, directionSensitivity: 'high' as const },
        { tideDirection: 'rising' as const, preferredDirection: 'falling' as const, directionSensitivity: 'high' as const },
        // Neutral
        { tideDirection: 'rising' as const, preferredDirection: 'either' as const, directionSensitivity: 'high' as const },
      ];

      for (const scenario of allScenarios) {
        const input = createTideInput(scenario);
        const result = tideDirectionScorer.score(input);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
  });
});
