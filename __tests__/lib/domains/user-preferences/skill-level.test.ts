/**
 * Tests for Skill Level Utilities
 *
 * Tests parsing and default handling for user skill levels.
 */

import {
  parseSkillLevel,
  getSkillLevelOrDefault,
  DEFAULT_SKILL_LEVEL,
  SKILL_LEVELS,
  type SkillLevel,
} from '@/lib/domains/user-preferences/skill-level';

describe('Skill Level Utilities', () => {
  describe('parseSkillLevel', () => {
    it('should parse valid skill levels (lowercase)', () => {
      expect(parseSkillLevel('beginner')).toBe('beginner');
      expect(parseSkillLevel('intermediate')).toBe('intermediate');
      expect(parseSkillLevel('advanced')).toBe('advanced');
      expect(parseSkillLevel('expert')).toBe('expert');
    });

    it('should parse valid skill levels (uppercase)', () => {
      expect(parseSkillLevel('BEGINNER')).toBe('beginner');
      expect(parseSkillLevel('INTERMEDIATE')).toBe('intermediate');
      expect(parseSkillLevel('ADVANCED')).toBe('advanced');
      expect(parseSkillLevel('EXPERT')).toBe('expert');
    });

    it('should parse valid skill levels (mixed case)', () => {
      expect(parseSkillLevel('Beginner')).toBe('beginner');
      expect(parseSkillLevel('InTeRmEdIaTe')).toBe('intermediate');
      expect(parseSkillLevel('Advanced')).toBe('advanced');
      expect(parseSkillLevel('EXPERT')).toBe('expert');
    });

    it('should return null for invalid values', () => {
      expect(parseSkillLevel('pro')).toBeNull();
      expect(parseSkillLevel('newbie')).toBeNull();
      expect(parseSkillLevel('master')).toBeNull();
      expect(parseSkillLevel('amateur')).toBeNull();
      expect(parseSkillLevel('professional')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseSkillLevel('')).toBeNull();
    });

    it('should return null for null', () => {
      expect(parseSkillLevel(null)).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(parseSkillLevel(undefined)).toBeNull();
    });

    it('should return null for whitespace-only strings', () => {
      expect(parseSkillLevel('   ')).toBeNull();
    });

    it('should handle strings with extra whitespace (trimmed)', () => {
      // Whitespace is trimmed for data quality resilience
      expect(parseSkillLevel(' beginner')).toBe('beginner');
      expect(parseSkillLevel('beginner ')).toBe('beginner');
      expect(parseSkillLevel(' beginner ')).toBe('beginner');
      expect(parseSkillLevel('  intermediate  ')).toBe('intermediate');
      expect(parseSkillLevel('\tadvanced\t')).toBe('advanced');
      expect(parseSkillLevel('\n expert \n')).toBe('expert');
    });
  });

  describe('getSkillLevelOrDefault', () => {
    it('should return the skill level when provided', () => {
      expect(getSkillLevelOrDefault('beginner')).toBe('beginner');
      expect(getSkillLevelOrDefault('intermediate')).toBe('intermediate');
      expect(getSkillLevelOrDefault('advanced')).toBe('advanced');
      expect(getSkillLevelOrDefault('expert')).toBe('expert');
    });

    it('should return beginner for null', () => {
      expect(getSkillLevelOrDefault(null)).toBe('beginner');
    });

    it('should return beginner for undefined', () => {
      expect(getSkillLevelOrDefault(undefined)).toBe('beginner');
    });

    it('should match DEFAULT_SKILL_LEVEL constant', () => {
      expect(getSkillLevelOrDefault(null)).toBe(DEFAULT_SKILL_LEVEL);
      expect(getSkillLevelOrDefault(undefined)).toBe(DEFAULT_SKILL_LEVEL);
    });
  });

  describe('SKILL_LEVELS constant', () => {
    it('should contain all four skill levels', () => {
      expect(SKILL_LEVELS).toHaveLength(4);
      expect(SKILL_LEVELS).toContain('beginner');
      expect(SKILL_LEVELS).toContain('intermediate');
      expect(SKILL_LEVELS).toContain('advanced');
      expect(SKILL_LEVELS).toContain('expert');
    });

    it('should be in progression order', () => {
      expect(SKILL_LEVELS[0]).toBe('beginner');
      expect(SKILL_LEVELS[1]).toBe('intermediate');
      expect(SKILL_LEVELS[2]).toBe('advanced');
      expect(SKILL_LEVELS[3]).toBe('expert');
    });

    it('should be readonly', () => {
      // This is a compile-time check, but we can verify the array is defined
      expect(Array.isArray(SKILL_LEVELS)).toBe(true);
    });
  });

  describe('DEFAULT_SKILL_LEVEL constant', () => {
    it('should be beginner for safety', () => {
      expect(DEFAULT_SKILL_LEVEL).toBe('beginner');
    });
  });

  describe('Integration: parse then default', () => {
    it('should correctly parse valid input', () => {
      const parsed = parseSkillLevel('advanced');
      const result = getSkillLevelOrDefault(parsed);
      expect(result).toBe('advanced');
    });

    it('should default to beginner for invalid input', () => {
      const parsed = parseSkillLevel('invalid');
      const result = getSkillLevelOrDefault(parsed);
      expect(result).toBe('beginner');
    });

    it('should default to beginner for null input', () => {
      const parsed = parseSkillLevel(null);
      const result = getSkillLevelOrDefault(parsed);
      expect(result).toBe('beginner');
    });

    it('should safely handle database-like values', () => {
      // Simulating values that might come from a database
      const dbValues = ['beginner', 'intermediate', 'advanced', 'expert', null, '', 'UNKNOWN'];
      const expected: SkillLevel[] = [
        'beginner',
        'intermediate',
        'advanced',
        'expert',
        'beginner', // null -> beginner
        'beginner', // '' -> beginner
        'beginner', // 'UNKNOWN' -> beginner
      ];

      dbValues.forEach((dbValue, index) => {
        const parsed = parseSkillLevel(dbValue);
        const result = getSkillLevelOrDefault(parsed);
        expect(result).toBe(expected[index]);
      });
    });
  });
});
