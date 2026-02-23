/**
 * Gamification Module
 *
 * Provides XP tracking, badge unlocking, and level progression for users.
 *
 * @module gamification
 */

// Re-export server actions (the primary public API)
export {
  trackXP,
  getUserXPStatus,
  getUserBadges,
  getAllBadgeDefinitions,
  creditAuthorWithXP,
  __resetGamificationCacheForTests,
} from "./gamification-actions";

// Re-export types
export type {
  XPAction,
  BadgeUnlock,
  XPTrackingResult,
  LevelInfo,
  LevelThreshold,
  UserXPStatus,
  UserBadgeStats,
  BadgeCheck,
  CreditAuthorResult,
  RelatedEntityType,
} from "./types";

// Re-export constants for consumers who need direct access
export { XP_ACTION_MAP, LEVEL_THRESHOLDS, getBadgeChecks } from "./constants";

// Re-export level utilities for advanced usage
export {
  calculateLevel,
  calculateLevelProgress,
} from "./level-service";

// Re-export XP utilities for advanced usage
export { getXPForAction, initializeUserXP } from "./xp-service";

// Re-export badge utilities for advanced usage
export {
  evaluateBadgeUnlocks,
} from "./badge-service";

// Re-export cache utilities for testing
export { resetCacheForTests, invalidateUserCaches } from "./cache";
