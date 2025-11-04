"use server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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
  onboarding_completed: 100,
  referral_signup: 50,
  successful_referral: 100,
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
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
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
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
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
    { slug: 'storm_chaser', condition: stats.swell_sessions >= 1 },
    
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
  // Safe counter helper (returns 0 on any error)
  const safeCount = async (
    table: string,
    apply: (q: any) => any
  ): Promise<number> => {
    try {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      q = apply(q);
      const { count, error } = await q;
      if (error || typeof count !== 'number') return 0;
      return count;
    } catch {
      return 0;
    }
  };

  // Sessions: totals and derived counts
  const session_count = await safeCount('sessions', (q: any) => q.eq('user_id', userId));
  const complete_entries = await safeCount('sessions', (q: any) => q.eq('user_id', userId).eq('status', 'completed'));
  const board_tags = await safeCount('sessions', (q: any) => q.eq('user_id', userId).not('board_id', 'is', null));
  const temp_records = await safeCount('sessions', (q: any) => q.eq('user_id', userId).not('water_temp', 'is', null));
  const wave_ratings = await safeCount('sessions', (q: any) =>
    q.eq('user_id', userId).or('wave_quality.not.is.null,rating.not.is.null'));

  // Reflection count: consider notes/rating/wave_quality as reflection markers
  let reflection_count = 0;
  // Swell sessions: naive heuristic using recorded wave_height >= ~8ft or notes mention swell
  let swell_sessions = 0;
  try {
    const { data } = await supabase
      .from('sessions')
      .select('notes,wave_quality,rating,status,arrival_time,wave_height')
      .eq('user_id', userId)
      .limit(1000);
    const sessions = (data || []);
    reflection_count = sessions.filter(
      (s: any) => (s?.notes && String(s.notes).trim().length > 0) || typeof s?.rating === 'number' || typeof s?.wave_quality === 'number'
    ).length;
    // Simple parse: extract first number from wave_height, treat as feet
    const parseFeet = (v: any): number => {
      if (!v) return 0;
      const m = String(v).match(/(\d+(?:\.\d+)?)/);
      if (!m) return 0;
      return Number(m[1]);
    };
    swell_sessions = sessions.reduce((acc: number, s: any) => {
      const h = parseFeet(s?.wave_height);
      const noteFlag = typeof s?.notes === 'string' && /swell|storm|big|huge/i.test(s.notes);
      return acc + ((h >= 8 || noteFlag) ? 1 : 0);
    }, 0);
  } catch {
    reflection_count = 0;
    swell_sessions = 0;
  }

  // Early sessions and consecutive days (client-side aggregation with cap)
  let early_sessions = 0;
  let consecutive_days = 0;
  try {
    const { data } = await supabase
      .from('sessions')
      .select('arrival_time,status')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('arrival_time', { ascending: false })
      .limit(1000);

    const completed = (data || []).filter((s: any) => s?.arrival_time);
    // Count early sessions: before 6am local time
    early_sessions = completed.reduce((acc: number, s: any) => {
      const d = new Date(s.arrival_time);
      const hour = d.getHours();
      return acc + (hour < 6 ? 1 : 0);
    }, 0);

    // Compute max consecutive day streak (based on arrival date)
    const dates = Array.from(
      new Set(
        completed.map((s: any) => new Date(s.arrival_time).toISOString().slice(0, 10))
      )
    ).sort();
    let current = 0;
    let best = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        current = 1; best = 1; continue;
      }
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) current += 1; else current = 1;
      if (current > best) best = current;
    }
    consecutive_days = best || 0;
  } catch {
    early_sessions = 0;
    consecutive_days = 0;
  }

  // Boards
  const board_count = await safeCount('boards', (q: any) => q.eq('user_id', userId));
  const detailed_boards = await safeCount('boards', (q: any) =>
    q.eq('user_id', userId).or('dimensions.not.is.null,description.not.is.null,image_url.not.is.null'));
  const board_session_uses = board_tags; // proxy: sessions with board_id present

  // Twin fin sessions: find twin boards then count sessions using them
  let twin_fin_sessions = 0;
  try {
    const { data: twinBoards } = await supabase
      .from('boards')
      .select('id,board_type')
      .eq('user_id', userId)
      .ilike('board_type', '%twin%');
    const twinIds = (twinBoards || []).map((b: any) => b.id);
    if (twinIds.length > 0) {
      const { count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('board_id', twinIds);
      twin_fin_sessions = count || 0;
    }
  } catch {
    twin_fin_sessions = 0;
  }

  // Intel posts & likes (confirmations)
  const intel_posts = await safeCount('intel_posts', (q: any) => q.eq('user_id', userId));
  let intel_likes = 0;
  try {
    const { data: posts } = await supabase
      .from('intel_posts')
      .select('confirmations_count')
      .eq('user_id', userId)
      .limit(1000);
    intel_likes = (posts || []).reduce((sum: number, p: any) => sum + (p?.confirmations_count || 0), 0);
  } catch {
    intel_likes = 0;
  }

  // Beach reviews
  const beach_reviews = await safeCount('beach_reviews', (q: any) => q.eq('user_id', userId));

  // Invitations sent / group sessions
  const invites_sent = await safeCount('session_invitations', (q: any) => q.eq('inviter_id', userId));
  const group_sessions = await safeCount('session_invitations', (q: any) => q.eq('inviter_id', userId).eq('status', 'accepted'));

  // Users tagged: distinct participants across your sessions
  let users_tagged = 0;
  try {
    const { data: mySessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .limit(1000);
    const sessionIds = (mySessions || []).map((s: any) => s.id);
    if (sessionIds.length > 0) {
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id,session_id')
        .in('session_id', sessionIds)
        .limit(5000);
      const unique = new Set<string>();
      for (const p of participants || []) {
        if (p?.user_id && p.user_id !== userId) unique.add(p.user_id);
      }
      users_tagged = unique.size;
    }
  } catch {
    users_tagged = 0;
  }

  return {
    session_count,
    board_count,
    intel_posts,
    group_sessions,
    beach_reviews,
    intel_likes,
    invites_sent,
    users_tagged,
    early_sessions,
    reflection_count,
    swell_sessions,
    consecutive_days,
    board_tags,
    temp_records,
    wave_ratings,
    complete_entries,
    detailed_boards,
    board_session_uses,
    twin_fin_sessions,
  };
}

// Get user's badge collection
export async function getUserBadges() {
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
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
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
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

// Credit XP to content author when their content is liked/upvoted
// This requires service-role access to write XP for another user
export async function creditAuthorWithXP(
  authorId: string,
  contentType: 'session' | 'intel_post' | 'review',
  contentId: string
) {
  // Use service-role client to bypass RLS for crediting another user
  const supabase = createSupabaseServiceRoleClient();
  
  try {
    // Check if we've already credited XP for this like (prevent duplicate XP)
    const { data: existingEvent } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", authorId)
      .eq("action", "get_like_upvote")
      .eq("related_entity_id", contentId)
      .single();
    
    if (existingEvent) {
      // Already credited, skip
      return { success: true, message: "XP already credited" };
    }
    
    // Initialize XP record if needed
    await initializeUserXP(authorId, supabase);
    
    // Get current XP
    const { data: currentXP, error: xpError } = await supabase
      .from("user_xp")
      .select("xp_total, level")
      .eq("user_id", authorId)
      .single();
    
    if (xpError || !currentXP) {
      throw new Error(`Failed to fetch user XP: ${xpError?.message}`);
    }
    
    const xpAmount = XP_ACTION_MAP.get_like_upvote;
    const newTotal = currentXP.xp_total + xpAmount;
    const newLevelInfo = calculateLevel(newTotal);
    
    // Update user XP
    const { error: updateError } = await supabase
      .from("user_xp")
      .update({
        xp_total: newTotal,
        level: newLevelInfo.level,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", authorId);
    
    if (updateError) {
      throw new Error(`Failed to update user XP: ${updateError.message}`);
    }
    
    // Record XP event
    const { error: eventError } = await supabase
      .from("xp_events")
      .insert({
        user_id: authorId,
        action: "get_like_upvote",
        xp_amount: xpAmount,
        related_entity_id: contentId,
        related_entity_type: contentType,
      });
    
    if (eventError) {
      throw new Error(`Failed to record XP event: ${eventError.message}`);
    }
    
    return {
      success: true,
      xp_gained: xpAmount,
      total_xp: newTotal,
      level_up: newLevelInfo.level > currentXP.level,
      new_level: newLevelInfo.level,
      level_title: newLevelInfo.title,
    };
  } catch (error) {
    console.error("Error crediting author with XP:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to credit XP" 
    };
  }
}
