/**
 * Skill Level Type Module
 *
 * Canonical type and utilities for user skill/experience level.
 * Used for wave appropriateness scoring to ensure safety-first recommendations.
 */

/**
 * User experience/skill level for wave appropriateness scoring.
 */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Default skill level for users without a set preference.
 * Conservative approach - defaults to beginner for safety.
 */
export const DEFAULT_SKILL_LEVEL: SkillLevel = 'beginner';

/**
 * All valid skill levels for iteration/validation.
 */
export const SKILL_LEVELS: readonly SkillLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;

/**
 * Parse skill level from database string value.
 * Returns null for invalid/unknown values.
 *
 * @param value - Raw string from database (e.g., profile.experience_level)
 * @returns Parsed SkillLevel or null if invalid
 *
 * @example
 * parseSkillLevel('beginner')    // 'beginner'
 * parseSkillLevel('ADVANCED')    // 'advanced'
 * parseSkillLevel('pro')         // null
 * parseSkillLevel(null)          // null
 */
export function parseSkillLevel(value: string | null | undefined): SkillLevel | null {
  if (!value) return null;

  const lower = value.trim().toLowerCase();
  if (
    lower === 'beginner' ||
    lower === 'intermediate' ||
    lower === 'advanced' ||
    lower === 'expert'
  ) {
    return lower as SkillLevel;
  }

  return null;
}

/**
 * Get skill level with safety default.
 * Returns beginner for null/undefined to ensure safety.
 *
 * This should be used at scoring boundaries to guarantee a valid skill level
 * is always available for safety calculations.
 *
 * @param skillLevel - Parsed skill level (may be null)
 * @returns Valid SkillLevel, defaulting to 'beginner' for safety
 *
 * @example
 * getSkillLevelOrDefault('advanced')   // 'advanced'
 * getSkillLevelOrDefault(null)         // 'beginner'
 * getSkillLevelOrDefault(undefined)    // 'beginner'
 */
export function getSkillLevelOrDefault(
  skillLevel: SkillLevel | null | undefined
): SkillLevel {
  return skillLevel ?? DEFAULT_SKILL_LEVEL;
}
