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









} from "./types";

// Re-export constants for consumers who need direct access

// Re-export level utilities for advanced usage

// Re-export XP utilities for advanced usage

// Re-export badge utilities for advanced usage

// Re-export cache utilities for testing
