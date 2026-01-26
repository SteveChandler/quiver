/**
 * Gamification Actions - Backwards Compatibility Re-exports
 *
 * This file re-exports all public APIs from the modularized gamification module.
 * New code should import directly from "@/lib/gamification" instead.
 *
 * @deprecated Import from "@/lib/gamification" instead
 */

// Re-export all server actions
export {
  trackXP,
  getUserXPStatus,
  getUserBadges,
  getAllBadgeDefinitions,
  creditAuthorWithXP,
  __resetGamificationCacheForTests,
} from "./gamification";

// Re-export types
export type {
  XPAction,
  BadgeUnlock,
  XPTrackingResult,
} from "./gamification";
