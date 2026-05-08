/**
 * Tests for Skill Level Wave Scoring
 *
 * Tests the helper functions for skill-based wave scoring:
 * - checkSkillCeiling
 * - checkSkillFloor
 * - calculateBeachSkillMatchBonus (condition-aware)
 *
 * Also tests safety defaults and priority order.
 */

import {
  checkSkillCeiling,
  checkSkillFloor,
  calculateBeachSkillMatchBonus,
  WAVE_SIZE_SCORING_CONFIG,
  SKILL_WAVE_RANGES,
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

  describe('checkSkillFloor', () => {
    it('does not penalize beginner-friendly practice waves for beginners', () => {
      const result = checkSkillFloor(1.5, 'beginner');
      expect(result.penalty).toBe(0);
      expect(result.warning).toBeNull();
    });

    it('soft-penalizes small waves for advanced surfers', () => {
      const result = checkSkillFloor(1.5, 'advanced');
      expect(result.penalty).toBe(13);
      expect(result.warning).toBe('Waves are below your usual range');
    });

    it('applies a lighter penalty below ideal but still acceptable', () => {
      const result = checkSkillFloor(2.5, 'advanced');
      expect(result.penalty).toBe(3);
      expect(result.warning).toBe('Waves are smaller than your ideal range');
    });

    it('does not penalize waves at the ideal lower bound', () => {
      const result = checkSkillFloor(3, 'advanced');
      expect(result.penalty).toBe(0);
      expect(result.warning).toBeNull();
    });

    it('caps extreme small-wave penalties', () => {
      const result = checkSkillFloor(0, 'expert');
      expect(result.penalty).toBe(WAVE_SIZE_SCORING_CONFIG.skillFloorPenaltyCap);
      expect(result.warning).toBe('Waves are below your usual range');
    });
  });

  describe('calculateBeachSkillMatchBonus', () => {
    describe('beach at or below user level with ideal conditions', () => {
      it('should give bonus when beginner at beginner beach with ideal waves', () => {
        const result = calculateBeachSkillMatchBonus(2, 'beginner', 'beginner');
        expect(result.adjustment).toBe(3);
        expect(result.reason).toBe('Conditions match your experience level today');
        expect(result.warning).toBeNull();
      });

      it('should give bonus when intermediate at beginner beach with ideal waves', () => {
        const result = calculateBeachSkillMatchBonus(3, 'beginner', 'intermediate');
        expect(result.adjustment).toBe(3);
        expect(result.reason).toBe('Conditions match your experience level today');
      });

      it('should give bonus at ideal range boundaries', () => {
        expect(calculateBeachSkillMatchBonus(1, 'beginner', 'beginner').adjustment).toBe(3);
        expect(calculateBeachSkillMatchBonus(3, 'beginner', 'beginner').adjustment).toBe(3);
      });

      it('should give neutral when waves outside ideal range but beach matches', () => {
        const result = calculateBeachSkillMatchBonus(0.5, 'beginner', 'beginner');
        expect(result.adjustment).toBe(0);
        expect(result.reason).toBeNull();
      });
    });

    describe('beach harder than user but conditions manageable', () => {
      it('should give small bonus for 1-level gap with manageable waves', () => {
        // Intermediate beach, beginner user, 2ft waves (within beginner ideal max 3ft)
        const result = calculateBeachSkillMatchBonus(2, 'intermediate', 'beginner');
        expect(result.adjustment).toBe(1);
        expect(result.reason).toContain('manageable');
        expect(result.warning).toBeNull();
      });

      it('should give neutral for 2+ level gap even with manageable waves', () => {
        // Advanced beach, beginner user, 2ft waves
        const result = calculateBeachSkillMatchBonus(2, 'advanced', 'beginner');
        expect(result.adjustment).toBe(0);
        expect(result.reason).toContain('manageable');
        expect(result.warning).toBeNull();
      });
    });

    describe('beach harder than user and conditions not manageable', () => {
      it('should penalize 1-level gap with no warning', () => {
        // Intermediate beach, beginner user, 5ft waves (above beginner ideal max 3ft)
        const result = calculateBeachSkillMatchBonus(5, 'intermediate', 'beginner');
        expect(result.adjustment).toBe(-2);
        expect(result.reason).toBeNull();
        expect(result.warning).toBeNull(); // Only 1-level gap, no warning
      });

      it('should penalize and warn for 2+ level gap', () => {
        // Advanced beach, beginner user, 5ft waves
        const result = calculateBeachSkillMatchBonus(5, 'advanced', 'beginner');
        expect(result.adjustment).toBe(-4);
        expect(result.warning).toContain('challenging');
      });

      it('should cap penalty at -6', () => {
        // Expert beach, beginner user, 10ft waves
        const result = calculateBeachSkillMatchBonus(10, 'expert', 'beginner');
        expect(result.adjustment).toBe(-6);
        expect(result.warning).toContain('challenging');
      });
    });

    describe('Condition-Aware Scoring Matrix (plan scenarios)', () => {
      it('Pipeline at 3ft for beginner — manageable', () => {
        // Advanced beach, beginner user, 3ft (within beginner ideal max)
        const result = calculateBeachSkillMatchBonus(3, 'advanced', 'beginner');
        expect(result.adjustment).toBe(0); // 2-level gap → 0 adjustment
        expect(result.reason).toContain('manageable');
        expect(result.warning).toBeNull();
      });

      it('Pipeline at 15ft for beginner — heavy penalty', () => {
        // Advanced beach, beginner user, 15ft waves
        const result = calculateBeachSkillMatchBonus(15, 'advanced', 'beginner');
        expect(result.adjustment).toBe(-4);
        expect(result.warning).toContain('challenging');
      });

      it('Mellow beach at 2ft for beginner — bonus', () => {
        // Beginner beach, beginner user, 2ft waves (ideal range)
        const result = calculateBeachSkillMatchBonus(2, 'beginner', 'beginner');
        expect(result.adjustment).toBe(3);
        expect(result.reason).toContain('match your experience');
      });

      it('Advanced beach at 4ft for intermediate — manageable with small bonus', () => {
        // Advanced beach, intermediate user, 4ft (within intermediate ideal max 5ft)
        const result = calculateBeachSkillMatchBonus(4, 'advanced', 'intermediate');
        expect(result.adjustment).toBe(1); // 1-level gap → +1
        expect(result.reason).toContain('manageable');
      });

      it('Expert beach at 8ft for intermediate — penalty', () => {
        // Expert beach, intermediate user, 8ft (above intermediate ideal max 5ft)
        const result = calculateBeachSkillMatchBonus(8, 'expert', 'intermediate');
        expect(result.adjustment).toBe(-4); // 2-level gap → -4
        expect(result.warning).toContain('challenging');
      });
    });

    describe('null/undefined beach skill level defaults to intermediate', () => {
      it('should treat null beach skill as intermediate', () => {
        // null beach → intermediate, beginner user, 2ft waves → manageable
        const result = calculateBeachSkillMatchBonus(2, null, 'beginner');
        expect(result.adjustment).toBe(1); // 1-level gap, manageable
        expect(result.reason).toContain('manageable');
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
      const skillLevel = getSkillLevelOrDefault(null);
      expect(checkSkillCeiling(2, skillLevel).penalty).toBe(0);
      expect(checkSkillFloor(2, skillLevel).penalty).toBe(0);
    });
  });

  describe('Priority Order', () => {
    it('should give beach skill match bonus when within skill ceiling', () => {
      // Intermediate user at intermediate beach, 3ft waves:
      // - Skill ceiling: passes (3ft <= 6ft)
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

    it('should have correct small-wave floor penalty settings', () => {
      expect(WAVE_SIZE_SCORING_CONFIG.skillFloorPenaltyPerFoot).toBe(6);
      expect(WAVE_SIZE_SCORING_CONFIG.skillFloorBelowAcceptableExtraPenaltyPerFoot).toBe(8);
      expect(WAVE_SIZE_SCORING_CONFIG.skillFloorPenaltyCap).toBe(18);
    });

    it('should have correct skill ideal bonus', () => {
      expect(WAVE_SIZE_SCORING_CONFIG.skillIdealBonus).toBe(3);
    });
  });

  describe('Wave Range Constants', () => {
    it('should have skill ranges for all levels', () => {
      expect(SKILL_WAVE_RANGES.beginner).toBeDefined();
      expect(SKILL_WAVE_RANGES.intermediate).toBeDefined();
      expect(SKILL_WAVE_RANGES.advanced).toBeDefined();
      expect(SKILL_WAVE_RANGES.expert).toBeDefined();
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
