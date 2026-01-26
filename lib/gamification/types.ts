/**
 * Type definitions for the gamification system
 *
 * Covers XP tracking, badge unlocks, and level progression.
 */

import type { XP_ACTION_MAP, LEVEL_THRESHOLDS } from "./constants";

/**
 * XP action identifier - each action maps to a specific XP reward
 */
export type XPAction = keyof typeof XP_ACTION_MAP;

/**
 * Badge unlock information returned when a user earns a new badge
 */
export interface BadgeUnlock {
  badge_slug: string;
  name: string;
  icon: string;
  xp_reward: number;
}

/**
 * Result of tracking an XP action
 */
export interface XPTrackingResult {
  xp_gained: number;
  total_xp: number;
  previous_level: number;
  new_level: number;
  level_up: boolean;
  level_title: string;
  new_badges: BadgeUnlock[];
}

/**
 * Level information with title
 */
export interface LevelInfo {
  level: number;
  title: string;
}

/**
 * Level threshold definition
 */
export interface LevelThreshold {
  level: number;
  title: string;
  xp_required: number;
}

/**
 * User XP status with progression information
 */
export interface UserXPStatus {
  xp_total: number;
  level: number;
  created_at: string;
  updated_at: string;
  level_title: string;
  progress_to_next: number;
  xp_to_next_level: number;
  next_level_title: string;
}

/**
 * User stats gathered for badge evaluation
 */
export interface UserBadgeStats {
  session_count: number;
  board_count: number;
  intel_posts: number;
  group_sessions: number;
  beach_reviews: number;
  intel_likes: number;
  invites_sent: number;
  users_tagged: number;
  early_sessions: number;
  reflection_count: number;
  swell_sessions: number;
  consecutive_days: number;
  board_tags: number;
  temp_records: number;
  wave_ratings: number;
  complete_entries: number;
  detailed_boards: number;
  board_session_uses: number;
  twin_fin_sessions: number;
}

/**
 * Badge check definition for evaluation
 */
export interface BadgeCheck {
  slug: string;
  condition: boolean;
}

/**
 * Result of crediting XP to an author
 */
export interface CreditAuthorResult {
  success: boolean;
  message?: string;
  xp_gained?: number;
  total_xp?: number;
  level_up?: boolean;
  new_level?: number;
  level_title?: string;
}

/**
 * Related entity types for XP events
 */
export type RelatedEntityType =
  | "session"
  | "board"
  | "intel_post"
  | "review"
  | "invite"
  | "photo"
  | "badge";
