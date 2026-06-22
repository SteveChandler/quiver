/**
 * Constants for the gamification system
 *
 * Contains XP action mappings, level thresholds, and badge check definitions.
 */

import type { UserBadgeStats, BadgeCheck } from "./types";

/**
 * XP action mapping - defines XP values for each user action
 */
export const XP_ACTION_MAP = {
  log_session: 50,
  make_call: 10,
  add_board: 30,
  tag_board_to_session: 20,
  post_beach_intel: 50,
  review_intel: 25,
  tag_friends_in_session: 20,
  invite_friend: 100,
  post_surf_photos: 15,
  get_like_upvote: 10,
  write_reflection: 25,
  add_surf_tags: 20,
  record_temperature: 10,
  submit_crowd_parking: 10,
  onboarding_completed: 100,
  referral_signup: 50,
  successful_referral: 100,
  share_session: 25, // Sharing a session to social media
} as const;

/**
 * Level progression thresholds (9 tiers as per spec)
 */
export const LEVEL_THRESHOLDS = [
  { level: 1, title: "Kook", xp_required: 0 },
  { level: 2, title: "Grom", xp_required: 100 },
  { level: 3, title: "Paddler", xp_required: 300 },
  { level: 4, title: "Wavestorm Warrior", xp_required: 600 },
  { level: 5, title: "Rip Rider", xp_required: 1000 },
  { level: 6, title: "Barrel Hunter", xp_required: 1500 },
  { level: 7, title: "Point Breaker", xp_required: 2200 },
  { level: 8, title: "Lineup Legend", xp_required: 3000 },
  { level: 9, title: "Quiver King/Queen", xp_required: 4000 },
] as const;

/**
 * Generate badge check definitions from user stats
 *
 * @param stats - User stats for badge evaluation
 * @returns Array of badge checks with conditions
 */
export function getBadgeChecks(stats: UserBadgeStats): BadgeCheck[] {
  return [
    // Global badges
    { slug: "first_ride", condition: stats.session_count >= 1 },
    { slug: "quiver_builder", condition: stats.board_count >= 3 },
    { slug: "wave_whisperer", condition: stats.intel_posts >= 10 },
    { slug: "session_captain", condition: stats.group_sessions >= 5 },
    { slug: "crowd_control", condition: stats.beach_reviews >= 10 },
    { slug: "locals_tip", condition: stats.intel_likes >= 5 },
    { slug: "the_recruiter", condition: stats.invites_sent >= 3 },
    { slug: "tag_team", condition: stats.users_tagged >= 10 },
    { slug: "sunrise_chaser", condition: stats.early_sessions >= 1 },
    { slug: "dawn_patrol_legend", condition: stats.early_sessions >= 5 },
    { slug: "storm_chaser", condition: stats.swell_sessions >= 1 },

    // Journal badges
    { slug: "first_entry", condition: stats.reflection_count >= 1 },
    { slug: "consistency_king_queen", condition: stats.consecutive_days >= 7 },
    { slug: "board_logger", condition: stats.board_tags >= 10 },
    { slug: "water_watcher", condition: stats.temp_records >= 20 },
    { slug: "wave_rater", condition: stats.wave_ratings >= 15 },
    { slug: "seasoned_tracker", condition: stats.complete_entries >= 50 },

    // Quiver badges
    { slug: "quiver_starter", condition: stats.board_count >= 1 },
    { slug: "board_collector", condition: stats.board_count >= 5 },
    { slug: "tech_spec_pro", condition: stats.detailed_boards >= 3 },
    { slug: "ride_logger", condition: stats.board_session_uses >= 10 },
    { slug: "twin_fin_fan", condition: stats.twin_fin_sessions >= 5 },
    { slug: "quiver_king_queen", condition: stats.board_count >= 10 },

    // Progression badges
    { slug: "skill_tracker", condition: stats.skill_rated_sessions >= 10 },
    { slug: "streak_warrior", condition: stats.consecutive_days >= 14 },
    { slug: "sweet_spot_finder", condition: stats.sweet_spot_confidence > 0.5 },
    { slug: "progression_sharer", condition: stats.progression_shares >= 1 },
  ];
}
