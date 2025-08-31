"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// XP action mapping - defines XP values for each user action
const XP_ACTION_MAP = {
  plan_session: 50,
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
} as const;

// Level progression thresholds (9 tiers as per spec)
const LEVEL_THRESHOLDS = [
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

export type XPAction = keyof typeof XP_ACTION_MAP;
export type BadgeUnlock = {
  badge_slug: string;
  name: string;
  icon: string;
  xp_reward: number;
};

export interface XPTrackingResult {
  xp_gained: number;
  total_xp: number;
  previous_level: number;
  new_level: number;
  level_up: boolean;
  level_title: string;
  new_badges: BadgeUnlock[];
}

// Initialize user XP record if it doesn't exist
async function initializeUserXP(userId: string, supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: existingXP } = await supabase
    .from("user_xp")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!existingXP) {
    const { error } = await supabase
      .from("user_xp")
      .insert({
        user_id: userId,
        xp_total: 0,
        level: 1,
      });
    
    if (error) {
      throw new Error(`Failed to initialize user XP: ${error.message}`);
    }
  }
}

// Calculate level from total XP
function calculateLevel(totalXP: number): { level: number; title: string } {
  // Find the highest level the user qualifies for
  let currentLevel = LEVEL_THRESHOLDS[0] as (typeof LEVEL_THRESHOLDS)[number];
  
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalXP >= threshold.xp_required) {
      currentLevel = threshold;
    } else {
      break;
    }
  }
  
  return { level: currentLevel.level, title: currentLevel.title };
}

// Track XP and update user level
export async function trackXP(
  action: XPAction,
  relatedEntityId?: string,
  relatedEntityType?: 'session' | 'board' | 'intel_post' | 'review' | 'invite' | 'photo'
) {
  return withAuthenticatedAction(async (user, supabase) => {
  
  // Get XP value for action
  const xpGained = XP_ACTION_MAP[action];
  if (!xpGained) {
    throw new Error(`Unknown XP action: ${action}`);
  }

  // Initialize user XP if needed
  await initializeUserXP(user.id, supabase);

  // Get current XP and level
  const { data: currentXP, error: fetchError } = await supabase
    .from("user_xp")
    .select("xp_total, level")
    .eq("user_id", user.id)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch user XP: ${fetchError.message}`);
  }

  const previousLevel = currentXP.level;
  const newTotalXP = currentXP.xp_total + xpGained;
  const { level: newLevel, title: levelTitle } = calculateLevel(newTotalXP);
  const levelUp = newLevel > previousLevel;

  // Update user XP and level
  const { error: updateError } = await supabase
    .from("user_xp")
    .update({
      xp_total: newTotalXP,
      level: newLevel,
    })
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Failed to update user XP: ${updateError.message}`);
  }

  // Log XP event
  const { error: logError } = await supabase
    .from("xp_events")
    .insert({
      user_id: user.id,
      action,
      xp_amount: xpGained,
      related_entity_id: relatedEntityId,
      related_entity_type: relatedEntityType,
    });

  if (logError) {
    throw new Error(`Failed to log XP event: ${logError.message}`);
  }

  // Check for new badge unlocks
  const newBadges = await evaluateBadgeUnlocks(user.id, supabase);

    return {
      xp_gained: xpGained,
      total_xp: newTotalXP,
      previous_level: previousLevel,
      new_level: newLevel,
      level_up: levelUp,
      level_title: levelTitle,
      new_badges: newBadges,
    };
  });
}

// Get user's current XP status
export async function getUserXPStatus() {
  return withAuthenticatedAction(async (user, supabase) => {
  await initializeUserXP(user.id, supabase);
  
  const { data, error } = await supabase
    .from("user_xp")
    .select("xp_total, level, created_at, updated_at")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch XP status: ${error.message}`);
  }

  const { title } = calculateLevel(data.xp_total);
  
  // Calculate progress to next level
  const currentLevelIndex = LEVEL_THRESHOLDS.findIndex(t => t.level === data.level);
  const nextLevelThreshold = LEVEL_THRESHOLDS[currentLevelIndex + 1];
  const currentLevelThreshold = LEVEL_THRESHOLDS[currentLevelIndex];
  
  let progressToNext = 100; // Default to 100% if max level
  let xpToNext = 0;
  
  if (nextLevelThreshold) {
    const xpInCurrentLevel = data.xp_total - currentLevelThreshold.xp_required;
    const xpNeededForLevel = nextLevelThreshold.xp_required - currentLevelThreshold.xp_required;
    progressToNext = Math.round((xpInCurrentLevel / xpNeededForLevel) * 100);
    xpToNext = nextLevelThreshold.xp_required - data.xp_total;
  }

    return {
      ...data,
      level_title: title,
      progress_to_next: progressToNext,
      xp_to_next_level: xpToNext,
      next_level_title: nextLevelThreshold?.title || "Max Level",
    };
  });
}

// Badge evaluation logic - determines which badges user should unlock
async function evaluateBadgeUnlocks(
  userId: string, 
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<BadgeUnlock[]> {
  
  // Get existing user badges
  const { data: existingBadges, error: badgeError } = await supabase
    .from("user_badges")
    .select("badge_slug")
    .eq("user_id", userId);

  if (badgeError) {
    throw new Error(`Failed to fetch user badges: ${badgeError.message}`);
  }

  const existingBadgeSlugs = new Set(existingBadges?.map(b => b.badge_slug) || []);
  const newlyUnlockedBadges: BadgeUnlock[] = [];

  // Get user stats for badge evaluation
  const stats = await getUserStatsForBadges(userId, supabase);
  
  // Evaluate each badge type
  const badgeChecks = [
    // Global badges
    { slug: 'first_ride', condition: stats.session_count >= 1 },
    { slug: 'quiver_builder', condition: stats.board_count >= 3 },
    { slug: 'wave_whisperer', condition: stats.intel_posts >= 10 },
    { slug: 'session_captain', condition: stats.group_sessions >= 5 },
    { slug: 'crowd_control', condition: stats.beach_reviews >= 10 },
    { slug: 'locals_tip', condition: stats.intel_likes >= 5 },
    { slug: 'the_recruiter', condition: stats.invites_sent >= 3 },
    { slug: 'tag_team', condition: stats.users_tagged >= 10 },
    { slug: 'sunrise_chaser', condition: stats.early_sessions >= 1 },
    { slug: 'dawn_patrol_legend', condition: stats.early_sessions >= 5 },
    
    // Journal badges  
    { slug: 'first_entry', condition: stats.reflection_count >= 1 },
    { slug: 'consistency_king_queen', condition: stats.consecutive_days >= 7 },
    { slug: 'board_logger', condition: stats.board_tags >= 10 },
    { slug: 'water_watcher', condition: stats.temp_records >= 20 },
    { slug: 'wave_rater', condition: stats.wave_ratings >= 15 },
    { slug: 'seasoned_tracker', condition: stats.complete_entries >= 50 },
    
    // Quiver badges
    { slug: 'quiver_starter', condition: stats.board_count >= 1 },
    { slug: 'board_collector', condition: stats.board_count >= 5 },
    { slug: 'tech_spec_pro', condition: stats.detailed_boards >= 3 },
    { slug: 'ride_logger', condition: stats.board_session_uses >= 10 },
    { slug: 'twin_fin_fan', condition: stats.twin_fin_sessions >= 5 },
    { slug: 'quiver_king_queen', condition: stats.board_count >= 10 },
  ];

  // Check which badges should be unlocked
  const badgesToUnlock = badgeChecks
    .filter(check => check.condition && !existingBadgeSlugs.has(check.slug))
    .map(check => check.slug);

  if (badgesToUnlock.length > 0) {
    // Get badge definitions for the badges to unlock
    const { data: badgeDefinitions, error: defError } = await supabase
      .from("badge_definitions")
      .select("badge_slug, name, icon, xp_reward")
      .in("badge_slug", badgesToUnlock);

    if (defError) {
      throw new Error(`Failed to fetch badge definitions: ${defError.message}`);
    }

    // Insert new badge records
    const badgeInserts = badgeDefinitions?.map(badge => ({
      user_id: userId,
      badge_slug: badge.badge_slug,
      context: {},
    })) || [];

    if (badgeInserts.length > 0) {
      const { error: insertError } = await supabase
        .from("user_badges")
        .insert(badgeInserts);

      if (insertError) {
        throw new Error(`Failed to insert badges: ${insertError.message}`);
      }

      // Add XP rewards for badges (optional - badges can grant bonus XP)
      for (const badge of badgeDefinitions || []) {
        if (badge.xp_reward > 0) {
          await supabase
            .from("xp_events")
            .insert({
              user_id: userId,
              action: 'badge_unlock',
              xp_amount: badge.xp_reward,
              related_entity_type: 'badge',
              related_entity_id: badge.badge_slug,
            });
        }
      }

      newlyUnlockedBadges.push(...(badgeDefinitions || []));
    }
  }

  return newlyUnlockedBadges;
}

// Helper function to get user stats needed for badge evaluation
async function getUserStatsForBadges(
  userId: string, 
  supabase: ReturnType<typeof createSupabaseServerClient>
) {
  // This would need to be implemented based on your existing database structure
  // For now, returning mock data structure - replace with actual queries
  
  const stats = {
    session_count: 0,
    board_count: 0,
    intel_posts: 0,
    group_sessions: 0,
    beach_reviews: 0,
    intel_likes: 0,
    invites_sent: 0,
    users_tagged: 0,
    early_sessions: 0,
    reflection_count: 0,
    consecutive_days: 0,
    board_tags: 0,
    temp_records: 0,
    wave_ratings: 0,
    complete_entries: 0,
    detailed_boards: 0,
    board_session_uses: 0,
    twin_fin_sessions: 0,
  };

  // TODO: Implement actual database queries based on your schema
  // Example queries you'd need:
  // - Count sessions: SELECT COUNT(*) FROM sessions WHERE user_id = ?
  // - Count boards: SELECT COUNT(*) FROM boards WHERE user_id = ?
  // - Count intel posts: SELECT COUNT(*) FROM intel_posts WHERE user_id = ?
  // etc.

  return stats;
}

// Get user's badge collection
export async function getUserBadges() {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data, error } = await supabase
      .from("user_badges")
      .select(`
        badge_slug,
        unlocked_at,
        context,
        badge_definitions (
          name,
          description,
          icon,
          category,
          xp_reward
        )
      `)
      .eq("user_id", user.id)
      .order("unlocked_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user badges: ${error.message}`);
    }

    return data;
  });
}

// Get all badge definitions (for showing locked badges)
export async function getAllBadgeDefinitions() {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data, error } = await supabase
      .from("badge_definitions")
      .select("*")
      .order("category", { ascending: true })
      .order("badge_slug", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch badge definitions: ${error.message}`);
    }

    return data;
  });
}