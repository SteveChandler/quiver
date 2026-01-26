/**
 * Gamification Actions - Backwards Compatibility Re-exports
 *
 * This file re-exports all public APIs from the modularized gamification module.
 * New code should import directly from "@/lib/gamification" instead.
 *
 * @deprecated Import from "@/lib/gamification" instead
 */

import {
  trackXP as _trackXP,
  getUserXPStatus as _getUserXPStatus,
  getUserBadges as _getUserBadges,
  getAllBadgeDefinitions as _getAllBadgeDefinitions,
  creditAuthorWithXP as _creditAuthorWithXP,
  __resetGamificationCacheForTests as _resetCache,
} from "./gamification";

/** @deprecated Import from "@/lib/gamification" instead */
export const trackXP = _trackXP;
/** @deprecated Import from "@/lib/gamification" instead */
export const getUserXPStatus = _getUserXPStatus;
/** @deprecated Import from "@/lib/gamification" instead */
export const getUserBadges = _getUserBadges;
/** @deprecated Import from "@/lib/gamification" instead */
export const getAllBadgeDefinitions = _getAllBadgeDefinitions;
/** @deprecated Import from "@/lib/gamification" instead */
export const creditAuthorWithXP = _creditAuthorWithXP;
/** @deprecated Import from "@/lib/gamification" instead */
export const __resetGamificationCacheForTests = _resetCache;

// Re-export types (types can't have @deprecated in JSDoc, but the file-level deprecation applies)
export type {
  XPAction,
  BadgeUnlock,
  XPTrackingResult,
} from "./gamification";
