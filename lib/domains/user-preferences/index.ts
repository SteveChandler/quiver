/**
 * User Preferences Domain
 *
 * Aggregates user preference data for personalized scoring.
 */

export type {
  WaveSizePreference,
  CrowdPreference,
  OnboardingPreferences,
  LearnedPreferences,
  BeachAffinity,
  UserPreferences,
  PreferenceMatch,
} from './types';

export { WAVE_SIZE_RANGES, USER_PREFERENCES_DEFAULTS } from './types';

// Skill level types and utilities
export type { SkillLevel } from './skill-level';
export {
  DEFAULT_SKILL_LEVEL,
  SKILL_LEVELS,
  parseSkillLevel,
  getSkillLevelOrDefault,
} from './skill-level';
