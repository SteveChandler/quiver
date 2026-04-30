/**
 * Manual type augmentation for the new notification tables introduced in
 *   - 20260429231445_create_notification_events.sql
 *   - 20260429231446_create_notification_delivery_attempts.sql
 *
 * This is a temporary shim until `yarn db:types` regenerates against a local
 * Supabase that has these migrations applied. After that, this file's
 * declarations will be redundant and can be removed.
 *
 * The shape mirrors the SQL CHECK constraints exactly. Keep in sync if either
 * migration changes — or, better, regenerate and delete this file.
 */

import type { Json } from "@/types/database.generated";
import type {
  NotificationEventStatus,
  NotificationDeliveryStatus,
  NotificationChannel,
} from "./types";

export interface NotificationEventRow {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Json;
  dedupe_key: string | null;
  status: NotificationEventStatus;
  skip_reason: string | null;
  created_at: string;
  processed_at: string | null;
  /**
   * Worker claim timestamp. Set by claim_notification_events RPC at the start
   * of each tick; cleared (or refreshed) when the worker finalizes the event
   * or releases the lease. A value older than 5 minutes is treated as a
   * stale lease and may be reclaimed.
   */
  claimed_at: string | null;
  /** Phase 5a additions — see migration 20260430130000_notifications_phase5_schema.sql. */
  attempt_count: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  claim_token: string | null;
  cancel_reason: string | null;
  last_error: string | null;
}

export type NotificationEventInsert = Omit<
  NotificationEventRow,
  | "id"
  | "created_at"
  | "processed_at"
  | "status"
  | "skip_reason"
  | "claimed_at"
  | "attempt_count"
  | "next_attempt_at"
  | "last_attempt_at"
  | "claim_token"
  | "cancel_reason"
  | "last_error"
> & {
  status?: NotificationEventStatus;
  skip_reason?: string | null;
  claimed_at?: string | null;
  attempt_count?: number;
  next_attempt_at?: string | null;
  last_attempt_at?: string | null;
  claim_token?: string | null;
  cancel_reason?: string | null;
  last_error?: string | null;
};

export type NotificationEventUpdate = Partial<NotificationEventRow>;

export interface NotificationDeliveryAttemptRow {
  id: string;
  notification_event_id: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  provider_response: Json | null;
  error_message: string | null;
  created_at: string;
  /** Phase 5a addition — which retry attempt this row records (1-indexed). */
  attempt_number: number;
}

export type NotificationDeliveryAttemptInsert = Omit<
  NotificationDeliveryAttemptRow,
  "id" | "created_at" | "attempt_number"
> & {
  attempt_number?: number;
};
