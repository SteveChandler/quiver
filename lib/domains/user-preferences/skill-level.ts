/**
 * Skill Level Type Module
 *
 * Canonical type and utilities for user skill/experience level.
 * Used for wave appropriateness scoring to ensure safety-first recommendations.
 *
 * Wave threshold data lives here so that any module that needs per-skill-level
 * wave ranges (hard gates, scoring curves, discovery preferences) draws from a
 * single source rather than duplicating numbers.
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

// ============================================================================
// Wave Threshold Data
// ============================================================================

/**
 * Ideal and acceptable wave height ranges (in feet) for each skill level.
 *
 * These ranges serve two purposes:
 *
 * 1. **Scoring curve** (`ideal.min`): The lower bound of the "ideal" wave height
 *    range used by the base-conditions scorer. Waves below `ideal.min` score on
 *    a linear ramp rather than receiving full marks.
 *
 * 2. **Safety ceiling** (`acceptable.max`): Hard cap used by the discovery adapter
 *    to penalise waves that exceed a surfer's safe upper limit.
 *
 * Hard gate minimum for surf-call verdicts uses `acceptable.min` for
 * beginner/intermediate/advanced. Expert's minimum is intentionally set higher
 * (2.5 ft) than `acceptable.min` (2.0 ft) in `surf-call-logic.ts` because
 * expert-rated venues need real size to be worth paddling out — this is a
 * beach-as-venue consideration, not a user-safety one.
 */
export interface SkillWaveRanges {
  ideal: { min: number; max: number };
  acceptable: { min: number; max: number };
}

export const SKILL_WAVE_RANGES: Record<SkillLevel, SkillWaveRanges> = {
  beginner: {
    ideal: { min: 1, max: 3 },
    acceptable: { min: 0.5, max: 4 },
  },
  intermediate: {
    ideal: { min: 2, max: 5 },
    acceptable: { min: 1, max: 6 },
  },
  advanced: {
    ideal: { min: 3, max: 8 },
    acceptable: { min: 2, max: 12 },
  },
  expert: {
    ideal: { min: 4, max: 12 },
    acceptable: { min: 2, max: 20 },
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

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
