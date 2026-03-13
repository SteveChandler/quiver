/**
 * Tests for Skill Level Wave Scoring
 *
 * Tests the helper functions extracted from applyPreferredWaveSizeAdjustment:
 * - checkSkillCeiling
 * - calculateBeachSkillMatchBonus (condition-aware, replaces calculateSkillBonus)
 * - calculatePreferenceAdjustment
 *
 * Also tests safety defaults and priority order.
 */

import {
  checkSkillCeiling,
  calculateBeachSkillMatchBonus,
  calculatePreferenceAdjustment,
  WAVE_SIZE_SCORING_CONFIG,
  SKILL_WAVE_RANGES,
  PREF_WAVE_RANGES,
} from '@/lib/domains/scoring/discovery-adapter';
import { getSkillLevelOrDefault, type SkillLevel } from '@/lib/domains/user-preferences';

describe('Skill Level Wave Scoring', () => {
  describe('checkSkillCeiling', () => {
    describe('beginner (max 4ft)', () => {
      it('should return no penalty when waves within skill limit', () => {
        const result = checkSkillCeiling(3, 'beginner');
        expect(result.penalty).toBe(0);
        expect(result.warning).toBeNull();
      });

      it('should return no penalty at exactly the limit', () => {
        const result = checkSkillCeiling(4, 'beginner');
        expect(result.penalty).toBe(0);
        expect(result.warning).toBeNull();
      });

      it('should return penalty when 1ft over limit', () => {
        const result = checkSkillCeiling(5, 'beginner'); // 1ft over 4ft limit
        expect(result.penalty).toBe(8); // 1 * 8
        expect(result.warning).toBe('Waves may exceed your skill level');
      });

      it('should return graduated penalty when 4ft over limit', () => {
        const result = checkSkillCeiling(8, 'beginner'); // 4ft over 4ft limit
        expect(result.penalty).toBe(32); // 4 * 8
        expect(result.warning).toBe('Waves significantly exceed your skill level');
      });

      it('should return dangerous warning for 8+ ft over limit', () => {
        const result = checkSkillCeiling(12, 'beginner'); // 8ft over 4ft limit
        expect(result.penalty).toBe(64); // 8 * 8
        expect(result.warning).toBe('Dangerous: Waves far exceed your skill level');
      });

      it('should return very high penalty for extreme conditions', () => {
        const result = checkSkillCeiling(20, 'beginner'); // 16ft over
        expect(result.penalty).toBe(128); // 16 * 8
        expect(result.warning).toBe('Dangerous: Waves far exceed your skill level');
      });
    });

    describe('intermediate (max 6ft)', () => {
      it('should return no penalty at 6ft', () => {
        const result = checkSkillCeiling(6, 'intermediate');
        expect(result.penalty).toBe(0);
        expect(result.warning).toBeNull();
      });

      it('should return penalty at 8ft', () => {
        const result = checkSkillCeiling(8, 'intermediate'); // 2ft over
        expect(result.penalty).toBe(16);
        expect(result.warning).toBe('Waves may exceed your skill level');
      });
    });

    describe('advanced (max 12ft)', () => {
      it('should return no penalty at 10ft', () => {
        const result = checkSkillCeiling(10, 'advanced');
        expect(result.penalty).toBe(0);
        expect(result.warning).toBeNull();
      });

      it('should return penalty at 15ft', () => {
        const result = checkSkillCeiling(15, 'advanced'); // 3ft over 12ft
        expect(result.penalty).toBe(24);
        expect(result.warning).toBe('Waves may exceed your skill level');
      });
    });

    describe('expert (max 20ft)', () => {
      it('should return no penalty at 18ft', () => {
        const result = checkSkillCeiling(18, 'expert');
        expect(result.penalty).toBe(0);
        expect(result.warning).toBeNull();
      });

      it('should return penalty at 25ft', () => {
        const result = checkSkillCeiling(25, 'expert'); // 5ft over 20ft
        expect(result.penalty).toBe(40);
        expect(result.warning).toBe('Waves significantly exceed your skill level');
      });
    });

    describe('warning thresholds', () => {
      it('should use config for warning thresholds', () => {
        expect(WAVE_SIZE_SCORING_CONFIG.warnings.dangerousThreshold).toBe(8);
        expect(WAVE_SIZE_SCORING_CONFIG.warnings.significantThreshold).toBe(4);
      });
    });
  });

  describe('calculateBeachSkillMatchBonus', () => {
    describe('beach at or below user level with ideal waves', () => {
      it('should bonus beginner beach + beginner user + ideal waves', () => {
        const result = calculateBeachSkillMatchBonus(2, 'beginner', 'beginner');
        expect(result.adjustment).toBe(3);
        expect(result.reason).toBe('Conditions match your experience level today');
        expect(result.warning).toBeNull();
      });

      it('should bonus intermediate beach + advanced user + ideal waves', () => {
        const result = calculateBeachSkillMatchBonus(5, 'intermediate', 'advanced');
        expect(result.adjustment).toBe(3);
        expect(result.reason).toBe('Conditions match your experience level today');
      });

      it('should bonus at boundaries of ideal range', () => {
        // Beginner ideal: 1-3ft
        expect(calculateBeachSkillMatchBonus(1, 'beginner', 'beginner').adjustment).toBe(3);
        expect(calculateBeachSkillMatchBonus(3, 'beginner', 'beginner').adjustment).toBe(3);
      });

      it('should not bonus waves below ideal range', () => {
        expect(calculateBeachSkillMatchBonus(0.5, 'beginner', 'beginner').adjustment).toBe(0);
      });

      it('should not bonus waves above ideal but within acceptable', () => {
        // Beginner ideal max = 3, acceptable max = 4
        expect(calculateBeachSkillMatchBonus(3.5, 'beginner', 'beginner').adjustment).toBe(0);
      });
    });

    describe('beach harder than user with manageable conditions', () => {
      it('should give small bonus for 1-level gap with manageable waves', () => {
        // Advanced beach, intermediate user, 3ft waves (within intermediate ideal max of 5)
        const result = calculateBeachSkillMatchBonus(3, 'advanced', 'intermediate');
        expect(result.adjustment).toBe(1);
        expect(result.reason).toContain('Advanced spot');
        expect(result.reason).toContain('manageable');
        expect(result.warning).toBeNull();
      });

      it('should give neutral for 2-level gap with manageable waves', () => {
        // Expert beach, intermediate user, 3ft waves
        const result = calculateBeachSkillMatchBonus(3, 'expert', 'intermediate');
        expect(result.adjustment).toBe(0);
        expect(result.reason).toContain('Expert spot');
        expect(result.reason).toContain('manageable');
      });

      it('Pipeline at 3ft for beginner — small penalty, not massive', () => {
        // Expert beach at 3ft, beginner user (ideal max = 3)
        const result = calculateBeachSkillMatchBonus(3, 'expert', 'beginner');
        expect(result.adjustment).toBe(0); // Manageable — waves at ideal max
        expect(result.reason).toContain('manageable');
      });
    });

    describe('beach harder than user with challenging conditions', () => {
      it('should penalize 1-level gap with non-manageable waves', () => {
        // Advanced beach, intermediate user, 6ft waves (above intermediate ideal max of 5)
        const result = calculateBeachSkillMatchBonus(6, 'advanced', 'intermediate');
        expect(result.adjustment).toBe(-2); // 1 gap * 2
        expect(result.reason).toBeNull();
      });

      it('should penalize 2-level gap with non-manageable waves and add warning', () => {
        // Expert beach, intermediate user, 8ft waves
        const result = calculateBeachSkillMatchBonus(8, 'expert', 'intermediate');
        expect(result.adjustment).toBe(-4); // 2 gap * 2
        expect(result.warning).toContain('conditions may be challenging');
      });

      it('should penalize 3-level gap with cap at -6', () => {
        // Expert beach, beginner user, 5ft waves (above beginner ideal max of 3)
        const result = calculateBeachSkillMatchBonus(5, 'expert', 'beginner');
        expect(result.adjustment).toBe(-6); // min(3 * 2, 6)
        expect(result.warning).toContain('conditions may be challenging');
      });

      it('Pipeline at 15ft for beginner — penalty from skill match', () => {
        // checkSkillCeiling handles the main penalty, but skill match also adds
        const result = calculateBeachSkillMatchBonus(15, 'expert', 'beginner');
        expect(result.adjustment).toBe(-6); // capped at 6
        expect(result.warning).toBeTruthy();
      });
    });

    describe('null beach skill level', () => {
      it('should default to intermediate when beach skill level is null', () => {
        // null beach → 'intermediate', beginner user, ideal waves
        const result = calculateBeachSkillMatchBonus(2, null, 'beginner');
        // skillGap = 1 (intermediate > beginner), waves manageable (2 <= 3)
        expect(result.adjustment).toBe(1);
        expect(result.reason).toContain('Intermediate spot');
      });

      it('should give bonus when user is intermediate and beach is null', () => {
        // null → intermediate, intermediate user, ideal waves
        const result = calculateBeachSkillMatchBonus(3, null, 'intermediate');
        expect(result.adjustment).toBe(3); // skillGap = 0, ideal range
      });
    });

    describe('compound skill levels (pre-migration)', () => {
      it('should handle unrecognized values by defaulting to intermediate', () => {
        const result = calculateBeachSkillMatchBonus(3, 'beginner-intermediate', 'intermediate');
        // parseSkillLevel returns null for 'beginner-intermediate' → defaults to 'intermediate'
        expect(result.adjustment).toBe(3); // skillGap = 0, ideal range
      });
    });
  });

  describe('calculatePreferenceAdjustment', () => {
    describe('small preference (ideal 1-3ft, acceptable 0.5-4ft)', () => {
      it('should bonus matching preference in ideal range', () => {
        const result = calculatePreferenceAdjustment(2, 'small');
        expect(result.adjustment).toBe(5);
        expect(result.reason).toBe('Waves match your preferred size');
        expect(result.warning).toBeNull();
      });

      it('should give no adjustment for acceptable range', () => {
        const result = calculatePreferenceAdjustment(3.5, 'small');
        expect(result.adjustment).toBe(0);
        expect(result.reason).toBeNull();
        expect(result.warning).toBeNull();
      });

      it('should penalize waves smaller than acceptable', () => {
        const result = calculatePreferenceAdjustment(0.2, 'small'); // 0.3ft under 0.5 min
        expect(result.adjustment).toBeLessThan(0);
        expect(result.warning).toBe('Waves may be smaller than preferred');
      });

      it('should penalize waves larger than acceptable', () => {
        const result = calculatePreferenceAdjustment(6, 'small'); // 2ft over 4ft max
        expect(result.adjustment).toBe(-10); // 2 * 5
        expect(result.warning).toBe('Waves may be larger than preferred');
      });
    });

    describe('medium preference (ideal 3-6ft, acceptable 2-8ft)', () => {
      it('should bonus matching preference at 4ft', () => {
        const result = calculatePreferenceAdjustment(4, 'medium');
        expect(result.adjustment).toBe(5);
        expect(result.reason).toBe('Waves match your preferred size');
      });

      it('should give no adjustment at 7ft (acceptable but not ideal)', () => {
        const result = calculatePreferenceAdjustment(7, 'medium');
        expect(result.adjustment).toBe(0);
      });

      it('should penalize waves below acceptable', () => {
        const result = calculatePreferenceAdjustment(0.9, 'medium'); // 1.1ft under 2ft min
        expect(result.adjustment).toBe(-6); // round(1.1 * 5) = 6
        expect(result.warning).toBe('Waves may be smaller than preferred');
      });

      it('should cap penalty at max', () => {
        const result = calculatePreferenceAdjustment(15, 'medium'); // 7ft over 8ft max
        expect(result.adjustment).toBe(-15); // capped at 15
      });
    });

    describe('large preference (ideal 5-12ft, acceptable 4-15ft)', () => {
      it('should bonus matching preference at 8ft', () => {
        const result = calculatePreferenceAdjustment(8, 'large');
        expect(result.adjustment).toBe(5);
      });

      it('should penalize waves smaller than acceptable', () => {
        const result = calculatePreferenceAdjustment(2, 'large'); // 2ft under 4ft min
        expect(result.adjustment).toBe(-10);
        expect(result.warning).toBe('Waves may be smaller than preferred');
      });
    });

    describe('penalty cap', () => {
      it('should respect max penalty from config', () => {
        expect(WAVE_SIZE_SCORING_CONFIG.preferenceOutsideMaxPenalty).toBe(15);

        // 10ft outside acceptable = should be capped at 15
        const result = calculatePreferenceAdjustment(15, 'small'); // 11ft over 4ft max
        expect(result.adjustment).toBe(-15);
      });
    });
  });

  describe('Safety Defaults', () => {
    it('should default to beginner when skill level is null', () => {
      expect(getSkillLevelOrDefault(null)).toBe('beginner');
    });

    it('should default to beginner when skill level is undefined', () => {
      expect(getSkillLevelOrDefault(undefined)).toBe('beginner');
    });

    it('should apply beginner limits when skill not set', () => {
      // 8ft waves with no skill set should get beginner penalty
      // 8ft - 4ft (beginner max) = 4ft over, 32pt penalty
      const result = checkSkillCeiling(8, getSkillLevelOrDefault(null));
      expect(result.penalty).toBe(32);
      expect(result.warning).toBe('Waves significantly exceed your skill level');
    });

    it('should not penalize small waves for beginner default', () => {
      const result = checkSkillCeiling(2, getSkillLevelOrDefault(null));
      expect(result.penalty).toBe(0);
    });
  });

  describe('Priority Order', () => {
    it('should verify skill ceiling check happens before preference', () => {
      // For beginner seeing 12ft waves with "large" preference:
      // - Skill ceiling: 12ft - 4ft = 8ft over = 64pt penalty
      // - Should NOT get large preference bonus

      const skillResult = checkSkillCeiling(12, 'beginner');
      expect(skillResult.penalty).toBe(64);

      // Even though preference would give bonus, skill ceiling should take precedence
      const prefResult = calculatePreferenceAdjustment(12, 'large');
      expect(prefResult.adjustment).toBe(5); // Would give bonus

      // But in actual use, skill ceiling penalty > 0 means we don't check preference
    });

    it('should verify preference only applies when skill ceiling passes', () => {
      // Expert seeing 8ft waves with "medium" preference:
      // - Skill ceiling: 8ft <= 20ft (expert max), no penalty
      // - Preference: 8ft in acceptable range (2-8ft for medium), no adjustment

      const skillResult = checkSkillCeiling(8, 'expert');
      expect(skillResult.penalty).toBe(0);

      const prefResult = calculatePreferenceAdjustment(8, 'medium');
      expect(prefResult.adjustment).toBe(0);
    });

    it('should give beach skill match bonus when no preference is set', () => {
      // Intermediate user at intermediate beach, 3ft waves:
      // - Skill ceiling: passes (3ft <= 6ft)
      // - No preference to check
      // - Beach skill match: beach matches user level, waves in ideal range → +3

      const skillResult = checkSkillCeiling(3, 'intermediate');
      expect(skillResult.penalty).toBe(0);

      const bonusResult = calculateBeachSkillMatchBonus(3, 'intermediate', 'intermediate');
      expect(bonusResult.adjustment).toBe(3);
    });
  });

  describe('Configuration Constants', () => {
    it('should have correct penalty per foot', () => {
      expect(WAVE_SIZE_SCORING_CONFIG.skillCeilingPenaltyPerFoot).toBe(8);
    });

    it('should have correct skill ideal bonus', () => {
      expect(WAVE_SIZE_SCORING_CONFIG.skillIdealBonus).toBe(3);
    });

    it('should have correct preference match bonus', () => {
      expect(WAVE_SIZE_SCORING_CONFIG.preferenceMatchBonus).toBe(5);
    });

    it('should have correct preference penalty per foot', () => {
      expect(WAVE_SIZE_SCORING_CONFIG.preferenceOutsidePenaltyPerFoot).toBe(5);
    });

    it('should have correct max preference penalty', () => {
      expect(WAVE_SIZE_SCORING_CONFIG.preferenceOutsideMaxPenalty).toBe(15);
    });
  });

  describe('Wave Range Constants', () => {
    it('should have skill ranges for all levels', () => {
      expect(SKILL_WAVE_RANGES.beginner).toBeDefined();
      expect(SKILL_WAVE_RANGES.intermediate).toBeDefined();
      expect(SKILL_WAVE_RANGES.advanced).toBeDefined();
      expect(SKILL_WAVE_RANGES.expert).toBeDefined();
    });

    it('should have preference ranges for all sizes', () => {
      expect(PREF_WAVE_RANGES.small).toBeDefined();
      expect(PREF_WAVE_RANGES.medium).toBeDefined();
      expect(PREF_WAVE_RANGES.large).toBeDefined();
    });

    it('should have progressively larger ranges for higher skill levels', () => {
      expect(SKILL_WAVE_RANGES.beginner.acceptable.max).toBeLessThan(
        SKILL_WAVE_RANGES.intermediate.acceptable.max
      );
      expect(SKILL_WAVE_RANGES.intermediate.acceptable.max).toBeLessThan(
        SKILL_WAVE_RANGES.advanced.acceptable.max
      );
      expect(SKILL_WAVE_RANGES.advanced.acceptable.max).toBeLessThan(
        SKILL_WAVE_RANGES.expert.acceptable.max
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0ft waves', () => {
      const skillResult = checkSkillCeiling(0, 'beginner');
      expect(skillResult.penalty).toBe(0);

      // 0ft waves, beginner beach, beginner user — not in ideal range (1-3ft)
      const bonusResult = calculateBeachSkillMatchBonus(0, 'beginner', 'beginner');
      expect(bonusResult.adjustment).toBe(0);

      const prefResult = calculatePreferenceAdjustment(0, 'small');
      // 0ft is 0.5ft below acceptable min of 0.5ft
      expect(prefResult.adjustment).toBe(-3); // round(0.5 * 5) = 3
    });

    it('should handle fractional wave heights', () => {
      const result = checkSkillCeiling(4.5, 'beginner'); // 0.5ft over
      expect(result.penalty).toBe(4); // round(0.5 * 8) = 4
    });

    it('should handle large wave heights', () => {
      const result = checkSkillCeiling(50, 'expert'); // 30ft over
      expect(result.penalty).toBe(240); // 30 * 8
      expect(result.warning).toBe('Dangerous: Waves far exceed your skill level');
    });
  });

  describe('Condition-Aware Scoring Matrix', () => {
    // Verifies the key scenarios from the plan
    const testMatrix: Array<{
      scenario: string;
      waveHeight: number;
      beachSkill: string;
      userSkill: SkillLevel;
      expectedAdjMin: number;
      expectedAdjMax: number;
    }> = [
      {
        scenario: 'Pipeline at 3ft for beginner (expert beach, mild conditions)',
        waveHeight: 3, beachSkill: 'expert', userSkill: 'beginner',
        expectedAdjMin: -1, expectedAdjMax: 1,
      },
      {
        scenario: 'Pipeline at 15ft for beginner (expert beach, heavy conditions)',
        waveHeight: 15, beachSkill: 'expert', userSkill: 'beginner',
        expectedAdjMin: -6, expectedAdjMax: -4,
      },
      {
        scenario: 'Mellow beach at 2ft for beginner (beginner beach, ideal)',
        waveHeight: 2, beachSkill: 'beginner', userSkill: 'beginner',
        expectedAdjMin: 3, expectedAdjMax: 3,
      },
      {
        scenario: 'Advanced beach at 4ft for intermediate (1-level gap, manageable)',
        waveHeight: 4, beachSkill: 'advanced', userSkill: 'intermediate',
        expectedAdjMin: 1, expectedAdjMax: 1,
      },
      {
        scenario: 'Expert beach at 8ft for intermediate (2-level gap, heavy)',
        waveHeight: 8, beachSkill: 'expert', userSkill: 'intermediate',
        expectedAdjMin: -4, expectedAdjMax: -4,
      },
    ];

    testMatrix.forEach(({ scenario, waveHeight, beachSkill, userSkill, expectedAdjMin, expectedAdjMax }) => {
      it(scenario, () => {
        const result = calculateBeachSkillMatchBonus(waveHeight, beachSkill, userSkill);
        expect(result.adjustment).toBeGreaterThanOrEqual(expectedAdjMin);
        expect(result.adjustment).toBeLessThanOrEqual(expectedAdjMax);
      });
    });
  });
});
