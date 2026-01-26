"use server";

/**
 * Gamification server actions
 *
 * Thin wrappers around the gamification services that add "use server" directive.
 * All business logic is delegated to the service modules.
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ServerActionResponse } from "@/lib/server-action-utils";
import type {
  XPAction,
  XPTrackingResult,
  CreditAuthorResult,
  UserXPStatus,
} from "./types";
import { XP_ACTION_MAP } from "./constants";
import { calculateLevel } from "./level-service";
import {
  getXPForAction,
  initializeUserXP,
  getCurrentXP,
  updateUserXP,
  logXPEvent,
  fetchUserXPStatus,
} from "./xp-service";
import {
  evaluateBadgeUnlocks,
  fetchUserBadges,
  fetchAllBadgeDefinitions,
} from "./badge-service";
import { invalidateUserCaches, resetCacheForTests } from "./cache";

/**
 * Test-only helper to avoid cross-test cache bleed.
 * This module caches results in-memory for performance, which is great in prod but
 * can make unit tests flaky if state carries across test cases.
 */
export async function __resetGamificationCacheForTests(): Promise<void> {
  resetCacheForTests();
}

/**
 * Track XP and update user level
 *
 * @param action - The XP action to track
 * @param relatedEntityId - Optional related entity ID
 * @param relatedEntityType - Optional related entity type
 * @returns XP tracking result with level and badge info
 */
export async function trackXP(
  action: XPAction,
  relatedEntityId?: string,
  relatedEntityType?:
    | "session"
    | "board"
    | "intel_post"
    | "review"
    | "invite"
    | "photo"
): Promise<ServerActionResponse<XPTrackingResult>> {
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
  return withAuthenticatedAction(async (user, supabase) => {
    // Get XP value for action
    const xpGained = getXPForAction(action);

    // Initialize user XP if needed
    await initializeUserXP(user.id, supabase);

    // Get current XP and level
    const { xp_total: currentXpTotal, level: previousLevel } =
      await getCurrentXP(user.id, supabase);

    const newTotalXP = currentXpTotal + xpGained;
    const { level: newLevel, title: levelTitle } = calculateLevel(newTotalXP);
    const levelUp = newLevel > previousLevel;

    // Update user XP and level
    await updateUserXP(user.id, newTotalXP, newLevel, supabase);

    // Log XP event
    await logXPEvent(
      user.id,
      action,
      xpGained,
      relatedEntityId,
      relatedEntityType,
      supabase
    );

    // Check for new badge unlocks
    const newBadges = await evaluateBadgeUnlocks(user.id, supabase);

    // Invalidate cached reads for this user (XP and badges can change here)
    invalidateUserCaches(user.id);

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

/**
 * Get user's current XP status
 *
 * @returns User's XP status with progression info
 */
export async function getUserXPStatus(): Promise<ServerActionResponse<UserXPStatus>> {
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
  return withAuthenticatedAction(async (user, supabase) => {
    return fetchUserXPStatus(user.id, supabase);
  });
}

/**
 * Get user's badge collection
 *
 * @returns Array of user badges with definitions
 */
export async function getUserBadges(): Promise<ServerActionResponse<any[]>> {
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
  return withAuthenticatedAction(async (user, supabase) => {
    return fetchUserBadges(user.id, supabase);
  });
}

/**
 * Get all badge definitions (for showing locked badges)
 *
 * @returns Array of all badge definitions
 */
export async function getAllBadgeDefinitions(): Promise<ServerActionResponse<any[]>> {
  const { withAuthenticatedAction } = await import("@/lib/server-action-utils");
  return withAuthenticatedAction(async (_user, supabase) => {
    return fetchAllBadgeDefinitions(supabase);
  });
}

/**
 * Credit XP to content author when their content is liked/upvoted
 * This requires service-role access to write XP for another user
 *
 * @param authorId - The author's user ID
 * @param contentType - Type of content that was liked
 * @param contentId - ID of the content that was liked
 * @returns Result of the XP credit operation
 */
export async function creditAuthorWithXP(
  authorId: string,
  contentType: "session" | "intel_post" | "review",
  contentId: string
): Promise<CreditAuthorResult> {
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
    const { xp_total: currentXpTotal, level: currentLevel } = await getCurrentXP(
      authorId,
      supabase
    );

    const xpAmount = XP_ACTION_MAP.get_like_upvote;
    const newTotal = currentXpTotal + xpAmount;
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
    const { error: eventError } = await supabase.from("xp_events").insert({
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
      level_up: newLevelInfo.level > currentLevel,
      new_level: newLevelInfo.level,
      level_title: newLevelInfo.title,
    };
  } catch (error) {
    console.error("Error crediting author with XP:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to credit XP",
    };
  }
}
