/**
 * Centralized badge styling constants for beach skill levels and crowd levels
 * Eliminates duplication across components
 */

/**
 * Tailwind CSS classes for skill level badges
 */
export const SKILL_LEVEL_STYLES = {
  Beginner: "bg-blue-50 text-ocean-blue border-transparent",
  Intermediate: "bg-orange-50 text-orange-600 border-transparent",
  Advanced: "bg-red-50 text-red-600 border-transparent",
  Expert: "bg-red-50 text-red-700 border-transparent",
} as const;

/**
 * Tailwind CSS classes for crowd level badges
 */
export const CROWD_LEVEL_STYLES = {
  Uncrowded: "bg-green-50 text-green-700 border-green-200",
  Moderate: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Crowded: "bg-red-50 text-red-700 border-red-200",
} as const;

/**
 * Valid skill level keys
 */
export type SkillLevel = keyof typeof SKILL_LEVEL_STYLES;

/**
 * Valid crowd level keys
 */
export type CrowdLevel = keyof typeof CROWD_LEVEL_STYLES;

/**
 * Get Tailwind CSS classes for a skill level badge.
 * Returns Intermediate styling as default for unknown values.
 *
 * @param level - Skill level (Beginner, Intermediate, Advanced, Expert)
 * @returns Tailwind CSS class string
 *
 * @example
 * getSkillLevelStyle("Beginner") // "bg-blue-50 text-ocean-blue border-transparent"
 * getSkillLevelStyle("Advanced") // "bg-red-50 text-red-600 border-transparent"
 * getSkillLevelStyle("Unknown") // "bg-orange-50 text-orange-600 border-transparent" (default)
 */
export function getSkillLevelStyle(level: string): string {
  return (
    SKILL_LEVEL_STYLES[level as SkillLevel] || SKILL_LEVEL_STYLES.Intermediate
  );
}

/**
 * Get Tailwind CSS classes for a crowd level badge.
 * Returns Moderate styling as default for unknown values.
 *
 * @param level - Crowd level (Uncrowded, Moderate, Crowded)
 * @returns Tailwind CSS class string
 *
 * @example
 * getCrowdLevelStyle("Uncrowded") // "bg-green-50 text-green-700 border-green-200"
 * getCrowdLevelStyle("Crowded") // "bg-red-50 text-red-700 border-red-200"
 * getCrowdLevelStyle("Unknown") // "bg-yellow-50 text-yellow-700 border-yellow-200" (default)
 */
export function getCrowdLevelStyle(level: string): string {
  return (
    CROWD_LEVEL_STYLES[level as CrowdLevel] || CROWD_LEVEL_STYLES.Moderate
  );
}
