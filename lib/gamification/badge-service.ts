/**
 * Badge evaluation and awarding service
 *
 * Handles badge evaluation, stat gathering, and badge awarding.
 * NOTE: This module does NOT have "use server" - it contains pure logic
 * that is called by the server actions in gamification-actions.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import type { BadgeUnlock, UserBadgeStats } from "./types";
import type { CachedUserBadge, CachedBadgeDefinition } from "./cache";
import { getBadgeChecks } from "./constants";
import {
  getCached,
  setCached,
  getUserBadgesCache,
  getBadgeDefinitionsCache,
  getInflightCache,
  CACHE_TTL,
} from "./cache";

/**
 * Generic type alias for a Supabase query builder used in safeCount.
 * Uses broad generics because safeCount accepts dynamic table names.
 * The generic parameters match the shape returned by an untyped
 * SupabaseClient's `.from(table).select(...)` call.
 */
type SupabaseCountQuery = PostgrestFilterBuilder<any, any, any, any, any>;

/**
 * Row shape returned when selecting session fields for reflection/swell analysis
 */
interface SessionRow {
  notes: string | null;
  wave_quality: number | null;
  rating: number | null;
  status: string | null;
  arrival_time: string | null;
  wave_height: string | null;
}

/**
 * Helper function for safe counting
 *
 * @param supabase - Supabase client
 * @param table - Table name
 * @param apply - Function to apply filters to query
 * @returns Count or 0 on error
 */
async function safeCount(
  supabase: SupabaseClient,
  table: string,
  apply: (q: SupabaseCountQuery) => SupabaseCountQuery
): Promise<number> {
  try {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    q = apply(q);
    const { count, error } = await q;
    if (error || typeof count !== "number") return 0;
    return count;
  } catch {
    return 0;
  }
}

/**
 * Get user stats needed for badge evaluation
 *
 * @param userId - The user ID
 * @param supabase - Supabase client
 * @returns User stats for badge evaluation
 */
export async function getUserStatsForBadges(
  userId: string,
  supabase: SupabaseClient
): Promise<UserBadgeStats> {
  // Sessions: totals and derived counts
  const session_count = await safeCount(supabase, "sessions", (q) =>
    q.eq("user_id", userId)
  );
  const complete_entries = await safeCount(supabase, "sessions", (q) =>
    q.eq("user_id", userId).eq("status", "completed")
  );
  const board_tags = await safeCount(supabase, "sessions", (q) =>
    q.eq("user_id", userId).not("board_id", "is", null)
  );
  const temp_records = await safeCount(supabase, "sessions", (q) =>
    q.eq("user_id", userId).not("water_temp", "is", null)
  );
  const wave_ratings = await safeCount(supabase, "sessions", (q) =>
    q.eq("user_id", userId).or("wave_quality.not.is.null,rating.not.is.null")
  );

  // Reflection count: consider notes/rating/wave_quality as reflection markers
  let reflection_count = 0;
  // Swell sessions: naive heuristic using recorded wave_height >= ~8ft or notes mention swell
  let swell_sessions = 0;
  try {
    const { data } = await supabase
      .from("sessions")
      .select("notes,wave_quality,rating,status,arrival_time,wave_height")
      .eq("user_id", userId)
      .limit(1000);
    const sessions = data || [];
    reflection_count = sessions.filter(
      (s: SessionRow) =>
        (s?.notes && String(s.notes).trim().length > 0) ||
        typeof s?.rating === "number" ||
        typeof s?.wave_quality === "number"
    ).length;
    // Simple parse: extract first number from wave_height, treat as feet
    const parseFeet = (v: string | number | null | undefined): number => {
      if (!v) return 0;
      const m = String(v).match(/(\d+(?:\.\d+)?)/);
      if (!m) return 0;
      return Number(m[1]);
    };
    swell_sessions = sessions.reduce((acc: number, s: SessionRow) => {
      const h = parseFeet(s?.wave_height);
      const noteFlag =
        typeof s?.notes === "string" && /swell|storm|big|huge/i.test(s.notes);
      return acc + (h >= 8 || noteFlag ? 1 : 0);
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
      .from("sessions")
      .select("arrival_time,status")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("arrival_time", { ascending: false })
      .limit(1000);

    const completed = (data || []).filter(
      (s): s is { arrival_time: string; status: string | null } =>
        s?.arrival_time != null
    );
    // Count early sessions: before 6am local time
    early_sessions = completed.reduce(
      (acc: number, s: { arrival_time: string }) => {
        const d = new Date(s.arrival_time);
        const hour = d.getHours();
        return acc + (hour < 6 ? 1 : 0);
      },
      0
    );

    // Compute max consecutive day streak (based on arrival date)
    const dates = Array.from(
      new Set(
        completed.map((s) =>
          new Date(s.arrival_time).toISOString().slice(0, 10)
        )
      )
    ).sort();
    let current = 0;
    let best = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        current = 1;
        best = 1;
        continue;
      }
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) current += 1;
      else current = 1;
      if (current > best) best = current;
    }
    consecutive_days = best || 0;
  } catch {
    early_sessions = 0;
    consecutive_days = 0;
  }

  // Boards
  const board_count = await safeCount(supabase, "boards", (q) =>
    q.eq("user_id", userId)
  );
  const detailed_boards = await safeCount(supabase, "boards", (q) =>
    q
      .eq("user_id", userId)
      .or("dimensions.not.is.null,description.not.is.null,image_url.not.is.null")
  );
  const board_session_uses = board_tags; // proxy: sessions with board_id present

  // Twin fin sessions: find twin boards then count sessions using them
  let twin_fin_sessions = 0;
  try {
    const { data: twinBoards } = await supabase
      .from("boards")
      .select("id,board_type")
      .eq("user_id", userId)
      .ilike("board_type", "%twin%");
    const twinIds = (twinBoards || []).map((b: { id: string }) => b.id);
    if (twinIds.length > 0) {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("board_id", twinIds);
      twin_fin_sessions = count || 0;
    }
  } catch {
    twin_fin_sessions = 0;
  }

  // Intel posts & likes (confirmations)
  const intel_posts = await safeCount(supabase, "intel_posts", (q) =>
    q.eq("user_id", userId)
  );
  let intel_likes = 0;
  try {
    const { data: posts } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("user_id", userId)
      .limit(1000);
    intel_likes = (posts || []).reduce(
      (sum: number, p: { confirmations_count: number | null }) =>
        sum + (p?.confirmations_count || 0),
      0
    );
  } catch {
    intel_likes = 0;
  }

  // Beach reviews
  const beach_reviews = await safeCount(supabase, "beach_reviews", (q) =>
    q.eq("user_id", userId)
  );

  // Invitations sent / group sessions
  const invites_sent = await safeCount(
    supabase,
    "session_invitations",
    (q) => q.eq("inviter_id", userId)
  );
  const group_sessions = await safeCount(
    supabase,
    "session_invitations",
    (q) => q.eq("inviter_id", userId).eq("status", "accepted")
  );

  // Users tagged: distinct participants across your sessions
  let users_tagged = 0;
  try {
    const { data: mySessions } = await supabase
      .from("sessions")
      .select("id")
      .eq("user_id", userId)
      .limit(1000);
    const sessionIds = (mySessions || []).map((s: { id: string }) => s.id);
    if (sessionIds.length > 0) {
      const { data: participants } = await supabase
        .from("session_participants")
        .select("user_id,session_id")
        .in("session_id", sessionIds)
        .limit(5000);
      const unique = new Set<string>();
      const typedParticipants = (participants || []) as Array<{
        user_id: string;
        session_id: string;
      }>;
      for (const p of typedParticipants) {
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

/**
 * Evaluate and unlock badges for a user
 *
 * @param userId - The user ID
 * @param supabase - Supabase client
 * @returns Array of newly unlocked badges
 */
export async function evaluateBadgeUnlocks(
  userId: string,
  supabase: SupabaseClient
): Promise<BadgeUnlock[]> {
  // Get existing user badges
  const { data: existingBadges, error: badgeError } = await supabase
    .from("user_badges")
    .select("badge_slug")
    .eq("user_id", userId);

  if (badgeError) {
    throw new Error(`Failed to fetch user badges: ${badgeError.message}`);
  }

  const existingBadgeSlugs = new Set(
    existingBadges?.map((b) => b.badge_slug) || []
  );
  const newlyUnlockedBadges: BadgeUnlock[] = [];

  // Get user stats for badge evaluation
  const stats = await getUserStatsForBadges(userId, supabase);

  // Get badge checks with current stats
  const badgeChecks = getBadgeChecks(stats);

  // Check which badges should be unlocked
  const badgesToUnlock = badgeChecks
    .filter((check) => check.condition && !existingBadgeSlugs.has(check.slug))
    .map((check) => check.slug);

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
    const badgeInserts =
      badgeDefinitions?.map((badge) => ({
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
          await supabase.from("xp_events").insert({
            user_id: userId,
            action: "badge_unlock",
            xp_amount: badge.xp_reward,
            related_entity_type: "badge",
            related_entity_id: badge.badge_slug,
          });
        }
      }

      newlyUnlockedBadges.push(...(badgeDefinitions || []));
    }
  }

  return newlyUnlockedBadges;
}

/**
 * Fetch user badges with caching
 *
 * @param userId - The user ID
 * @param supabase - Supabase client
 * @returns Array of user badges with definitions
 */
export async function fetchUserBadges(
  userId: string,
  supabase: SupabaseClient
): Promise<CachedUserBadge[]> {
  const badgeCache = getUserBadgesCache();
  const inflightCache = getInflightCache();

  // Check cache first
  const cached = getCached(badgeCache, userId);
  if (cached) {
    return cached;
  }

  // Check for inflight request
  const inflightKey = `userBadges:${userId}`;
  const inflight = inflightCache.get(inflightKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("user_badges")
      .select(
        `
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
      `
      )
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user badges: ${error.message}`);
    }

    setCached(badgeCache, userId, data, CACHE_TTL.USER_BADGES);
    return data;
  })();

  inflightCache.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflightCache.delete(inflightKey);
  }
}

/**
 * Fetch all badge definitions with caching
 *
 * @param supabase - Supabase client
 * @returns Array of all badge definitions
 */
export async function fetchAllBadgeDefinitions(
  supabase: SupabaseClient
): Promise<CachedBadgeDefinition[]> {
  const defCache = getBadgeDefinitionsCache();
  const inflightCache = getInflightCache();
  const cacheKey = "all";

  // Check cache first
  const cached = getCached(defCache, cacheKey);
  if (cached) {
    return cached;
  }

  // Check for inflight request
  const inflightKey = "badgeDefinitions:all";
  const inflight = inflightCache.get(inflightKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("badge_definitions")
      .select("*")
      .order("category", { ascending: true })
      .order("badge_slug", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch badge definitions: ${error.message}`);
    }

    setCached(defCache, cacheKey, data, CACHE_TTL.BADGE_DEFINITIONS);
    return data;
  })();

  inflightCache.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflightCache.delete(inflightKey);
  }
}
