/**
 * Producer-side API for the centralized notification pipeline.
 *
 * Producers (route handlers, crons, server actions) call enqueueNotification
 * to create a durable `notification_events` row with status='pending'. The
 * delivery worker (`/api/cron/notifications-deliver`) picks it up on the next
 * tick and handles preferences, dedupe, self-suppress, push + in-app.
 *
 * Producers do NOT block on delivery — call this fire-and-forget where it
 * makes sense. The function never throws on a duplicate dedupe key; it
 * returns `{ enqueued: false, reason: 'duplicate' }` so producers can log
 * but treat the dup as success.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 1e).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isKnownNotificationType } from "./registry";
import type { EnqueueArgs, EnqueueResult } from "./types";
import type {
  NotificationEventInsert,
  NotificationEventRow,
} from "./db-augment";

const POSTGRES_UNIQUE_VIOLATION = "23505";

type ServiceClient = SupabaseClient<Database>;

// Narrow client that only types the `notification_events` table — used to
// bypass the generated Database type until `yarn db:types` re-runs.
type NotificationEventsClient = {
  from(t: "notification_events"): {
    insert(row: NotificationEventInsert): {
      select(s: "id"): {
        single(): Promise<{
          data: Pick<NotificationEventRow, "id"> | null;
          error: { code: string; message: string } | null;
        }>;
      };
    };
  };
};

/**
 * Enqueue a notification event for asynchronous delivery.
 *
 * @param args - Event metadata. `type` must match a registry key.
 * @param client - Optional service-role client. Defaults to the singleton
 *   from `createSupabaseServiceRoleClient()`. Pass an explicit client when
 *   the caller already has one (e.g. inside a cron) to avoid lazy init.
 */
export async function enqueueNotification(
  args: EnqueueArgs,
  client?: ServiceClient
): Promise<EnqueueResult> {
  if (!isKnownNotificationType(args.type)) {
    return {
      enqueued: false,
      reason: "unknown_type",
      message: `Notification type "${args.type}" is not registered`,
    };
  }

  if (!args.recipientUserId) {
    return {
      enqueued: false,
      reason: "internal_error",
      message: "recipientUserId is required",
    };
  }

  const supabase = client ?? createSupabaseServiceRoleClient();
  const notifClient = supabase as unknown as NotificationEventsClient;

  const { data, error } = await notifClient
    .from("notification_events")
    .insert({
      recipient_user_id: args.recipientUserId,
      actor_user_id: args.actorUserId ?? null,
      type: args.type,
      entity_type: args.entityType ?? null,
      entity_id: args.entityId ?? null,
      payload: (args.payload ?? {}) as never,
      dedupe_key: args.dedupeKey ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return { enqueued: false, reason: "duplicate" };
    }
    console.error("[notifications/enqueue] insert failed:", {
      type: args.type,
      recipientUserId: args.recipientUserId,
      code: error.code,
      message: error.message,
    });
    return {
      enqueued: false,
      reason: "internal_error",
      message: error.message,
    };
  }

  if (!data) {
    return {
      enqueued: false,
      reason: "internal_error",
      message: "insert returned no row",
    };
  }
  return { enqueued: true, eventId: data.id };
}
