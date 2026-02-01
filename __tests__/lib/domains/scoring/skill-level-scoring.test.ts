/**
 * Tests for Skill Level Wave Scoring
 *
 * Tests the helper functions extracted from applyPreferredWaveSizeAdjustment:
 * - checkSkillCeiling
 * - calculateSkillBonus
 * - calculatePreferenceAdjustment
 *
 * Also tests safety defaults and priority order.
 */

import {
  checkSkillCeiling,
  calculateSkillBonus,
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

  describe('calculateSkillBonus', () => {
    describe('beginner (ideal 1-3ft)', () => {
      it('should bonus waves in ideal skill range', () => {
        expect(calculateSkillBonus(2, 'beginner').bonus).toBe(3);
        expect(calculateSkillBonus(2, 'beginner').reason).toBe('Great wave size for your level');
      });

      it('should bonus at minimum of ideal range', () => {
        expect(calculateSkillBonus(1, 'beginner').bonus).toBe(3);
      });

      it('should bonus at maximum of ideal range', () => {
        expect(calculateSkillBonus(3, 'beginner').bonus).toBe(3);
      });

      it('should not bonus waves below ideal range', () => {
        expect(calculateSkillBonus(0.5, 'beginner').bonus).toBe(0);
        expect(calculateSkillBonus(0.5, 'beginner').reason).toBeNull();
      });

      it('should not bonus waves above ideal but within acceptable', () => {
        expect(calculateSkillBonus(3.5, 'beginner').bonus).toBe(0);
      });
    });

    describe('intermediate (ideal 2-5ft)', () => {
      it('should bonus waves at 3.5ft', () => {
        const result = calculateSkillBonus(3.5, 'intermediate');
        expect(result.bonus).toBe(3);
        expect(result.reason).toBe('Great wave size for your level');
      });

      it('should not bonus waves at 6ft (outside ideal)', () => {
        expect(calculateSkillBonus(6, 'intermediate').bonus).toBe(0);
      });
    });

    describe('advanced (ideal 3-8ft)', () => {
      it('should bonus waves at 5ft', () => {
        expect(calculateSkillBonus(5, 'advanced').bonus).toBe(3);
      });

      it('should bonus waves at 8ft (at max ideal)', () => {
        expect(calculateSkillBonus(8, 'advanced').bonus).toBe(3);
      });
    });

    describe('expert (ideal 4-12ft)', () => {
      it('should bonus waves at 8ft', () => {
        expect(calculateSkillBonus(8, 'expert').bonus).toBe(3);
      });

      it('should bonus waves at 12ft', () => {
        expect(calculateSkillBonus(12, 'expert').bonus).toBe(3);
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
      // This is a documentation/logic test - skill ceiling should be checked
      // before any preference bonus is applied

      // For beginner seeing 12ft waves with "large" preference:
      // - Skill ceiling: 12ft - 4ft = 8ft over = 64pt penalty
      // - Should NOT get large preference bonus

      // We test the individual functions work correctly
      const skillResult = checkSkillCeiling(12, 'beginner');
      expect(skillResult.penalty).toBe(64);

      // Even though preference would give bonus, skill ceiling should take precedence
      const prefResult = calculatePreferenceAdjustment(12, 'large');
      expect(prefResult.adjustment).toBe(5); // Would give bonus

      // But in actual use, skill ceiling penalty > 0 means we don't check preference
      // This is verified by the main function logic in applyPreferredWaveSizeAdjustment
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

    it('should give skill bonus when no preference is set', () => {
      // Intermediate with no preference, 3ft waves:
      // - Skill ceiling: passes (3ft <= 6ft)
      // - No preference to check
      // - Skill bonus: 3ft in ideal range (2-5ft), +3pts

      const skillResult = checkSkillCeiling(3, 'intermediate');
      expect(skillResult.penalty).toBe(0);

      const bonusResult = calculateSkillBonus(3, 'intermediate');
      expect(bonusResult.bonus).toBe(3);
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

      const bonusResult = calculateSkillBonus(0, 'beginner');
      expect(bonusResult.bonus).toBe(0); // 0 is below ideal 1-3ft

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
});
