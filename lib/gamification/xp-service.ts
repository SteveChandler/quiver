/**
 * XP tracking core logic service
 *
 * Handles XP initialization, tracking, and crediting.
 * NOTE: This module does NOT have "use server" - it contains pure logic
 * that is called by the server actions in gamification-actions.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { XPAction, LevelInfo, UserXPStatus } from "./types";
import { XP_ACTION_MAP, LEVEL_THRESHOLDS } from "./constants";
import { calculateLevel, calculateLevelProgress } from "./level-service";
import {
  getCached,
  setCached,
  getXPStatusCache,
  getInflightCache,
  CACHE_TTL,
} from "./cache";

/**
 * Get XP value for an action
 *
 * @param action - The XP action
 * @returns The XP amount for the action
 * @throws Error if action is unknown
 */
export function getXPForAction(action: XPAction): number {
  const xp = XP_ACTION_MAP[action];
  if (xp === undefined) {
    throw new Error(`Unknown XP action: ${action}`);
  }
  return xp;
}

/**
 * Initialize user XP record if it doesn't exist
 *
 * @param userId - The user ID
 * @param supabase - Supabase client
 */
export async function initializeUserXP(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: existingXP } = await supabase
    .from("user_xp")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!existingXP) {
    const { error } = await supabase.from("user_xp").insert({
      user_id: userId,
      xp_total: 0,
      level: 1,
    });

    if (error) {
      throw new Error(`Failed to initialize user XP: ${error.message}`);
    }
  }
}

/**
 * Get current XP and level for a user
 *
 * @param userId - The user ID
 * @param supabase - Supabase client
 * @returns Current XP total and level
 */
export async function getCurrentXP(
  userId: string,
  supabase: SupabaseClient
): Promise<{ xp_total: number; level: number }> {
  const { data, error } = await supabase
    .from("user_xp")
    .select("xp_total, level")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user XP: ${error.message}`);
  }

  return { xp_total: data.xp_total, level: data.level };
}

/**
 * Update user XP and level
 *
 * @param userId - The user ID
 * @param newTotalXP - New total XP value
 * @param newLevel - New level value
 * @param supabase - Supabase client
 */
export async function updateUserXP(
  userId: string,
  newTotalXP: number,
  newLevel: number,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from("user_xp")
    .update({
      xp_total: newTotalXP,
      level: newLevel,
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update user XP: ${error.message}`);
  }
}

/**
 * Log an XP event
 *
 * @param userId - The user ID
 * @param action - The XP action
 * @param xpAmount - Amount of XP gained
 * @param relatedEntityId - Optional related entity ID
 * @param relatedEntityType - Optional related entity type
 * @param supabase - Supabase client
 */
export async function logXPEvent(
  userId: string,
  action: string,
  xpAmount: number,
  relatedEntityId: string | undefined,
  relatedEntityType: string | undefined,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.from("xp_events").insert({
    user_id: userId,
    action,
    xp_amount: xpAmount,
    related_entity_id: relatedEntityId,
    related_entity_type: relatedEntityType,
  });

  if (error) {
    throw new Error(`Failed to log XP event: ${error.message}`);
  }
}

/**
 * Get user's full XP status with caching
 *
 * @param userId - The user ID
 * @param supabase - Supabase client
 * @returns Full XP status including progression info
 */
export async function fetchUserXPStatus(
  userId: string,
  supabase: SupabaseClient
): Promise<UserXPStatus> {
  const xpCache = getXPStatusCache();
  const inflightCache = getInflightCache();

  // Check cache first
  const cached = getCached(xpCache, userId);
  if (cached) {
    return cached as UserXPStatus;
  }

  // Check for inflight request
  const inflightKey = `xpStatus:${userId}`;
  const inflight = inflightCache.get(inflightKey);
  if (inflight) return inflight as Promise<UserXPStatus>;

  const promise = (async (): Promise<UserXPStatus> => {
    await initializeUserXP(userId, supabase);

    const { data, error } = await supabase
      .from("user_xp")
      .select("xp_total, level, created_at, updated_at")
      .eq("user_id", userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch XP status: ${error.message}`);
    }

    const { title } = calculateLevel(data.xp_total);
    const { progressPercent, xpToNext, nextLevelTitle } = calculateLevelProgress(
      data.xp_total,
      data.level
    );

    const result: UserXPStatus = {
      xp_total: data.xp_total,
      level: data.level,
      created_at: data.created_at,
      updated_at: data.updated_at,
      level_title: title,
      progress_to_next: progressPercent,
      xp_to_next_level: xpToNext,
      next_level_title: nextLevelTitle,
    };

    setCached(xpCache, userId, result, CACHE_TTL.XP_STATUS);
    return result;
  })();

  inflightCache.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflightCache.delete(inflightKey);
  }
}
