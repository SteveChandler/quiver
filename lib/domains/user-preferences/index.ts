/**
 * User Preferences Domain
 *
 * Aggregates user preference data for personalized scoring.
 */

export type {
  WaveSizePreference,
  OnboardingPreferences,
  LearnedPreferences,
  BeachAffinity,
  UserPreferences,
  PreferenceMatch,
} from './types';

export { WAVE_SIZE_RANGES, USER_PREFERENCES_DEFAULTS } from './types';

// Skill level types, utilities, and wave threshold data
export type { SkillLevel, SkillWaveRanges } from './skill-level';
export {
  DEFAULT_SKILL_LEVEL,
  SKILL_LEVELS,
  parseBeachSkillRequirement,
  parseSkillLevel,
  getSkillLevelOrDefault,
  SKILL_WAVE_RANGES,
} from './skill-level';

// Board class types and utilities
export type { BoardClass } from './board-class';
export {
  BOARD_CLASSES,
  BOARD_TYPE_TO_BOARD_CLASS,
  DEFAULT_BOARD_CLASS,
  normalizeBoardClass,
  parseBoardClass,
  getBoardClassOrDefault,
  mapBoardTypeToBoardClass,
} from './board-class';
