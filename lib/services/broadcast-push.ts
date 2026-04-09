/**
 * Broadcast Push Service
 *
 * Wraps sendPushNotification() with a "send to everyone" fan-out used by
 * marketing for launch-day announcements. Fetches distinct user_ids from
 * user_devices, batches in chunks of BROADCAST_BATCH_SIZE, and dispatches
 * sequentially to avoid FCM and Supabase rate limits.
 *
 * High blast radius. Callers MUST enforce admin auth at the route level.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendPushNotification } from "@/lib/services/push-notifications";

export const BROADCAST_BATCH_SIZE = 500;

export interface BroadcastPushInput {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Optional cap on the number of users targeted, for safety drills. */
  maxUsers?: number;
}

export interface BroadcastPushResult {
  totalUsers: number;
  sentBatches: number;
  failedBatches: number;
  errors: string[];
}

/**
 * Send a push notification to every active user — every distinct user_id
 * with at least one row in user_devices. Batched sequentially.
 */
export async function broadcastToActiveUsers(
  supabase: SupabaseClient<Database>,
  input: BroadcastPushInput
): Promise<BroadcastPushResult> {
  const { title, body, data, maxUsers } = input;

  const { data: rows, error } = await supabase
    .from("user_devices")
    .select("user_id");

  if (error) {
    throw new Error(`Failed to fetch user_devices for broadcast: ${error.message}`);
  }

  const uniqueUserIds = Array.from(
    new Set((rows ?? []).map((row) => row.user_id).filter((id): id is string => Boolean(id)))
  );

  const targetUserIds =
    typeof maxUsers === "number" && maxUsers >= 0
      ? uniqueUserIds.slice(0, maxUsers)
      : uniqueUserIds;

  const result: BroadcastPushResult = {
    totalUsers: targetUserIds.length,
    sentBatches: 0,
    failedBatches: 0,
    errors: [],
  };

  if (targetUserIds.length === 0) {
    return result;
  }

  for (let offset = 0; offset < targetUserIds.length; offset += BROADCAST_BATCH_SIZE) {
    const batch = targetUserIds.slice(offset, offset + BROADCAST_BATCH_SIZE);
    try {
      await sendPushNotification({ userIds: batch, title, body, data });
      result.sentBatches += 1;
    } catch (err) {
      result.failedBatches += 1;
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}
