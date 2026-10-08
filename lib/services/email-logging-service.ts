/** Log condition-alert email deliveries to email_send_log. */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Email type enum matching the email_send_log_email_type_check constraint.
 * Last widened by migration 20260821140000 (trial invitation).
 */
export type EmailType =
  | "welcome"
  | "forecast_digest"
  | "reengagement"
  | "weekly_recap"
  | "conditions_alert"
  | "session_prompt"
  | "first_session_nudge"
  | "swell_watch"
  | "trial_started"
  | "trial_ending"
  | "trial_ended"
  | "trial_invitation"
  | "founder_story";

/**
 * Email log entry with all optional fields for flexibility
 */
interface EmailLogEntry {
  userId: string;
  emailType: EmailType;
  subject?: string;
  localDate?: string; // YYYY-MM-DD format
  sentAt?: string; // ISO timestamp
  bestScore?: number;
  bestBeachId?: string;
  messageInstanceId?: string;
  meta?: Record<string, unknown>;
  resendMessageId?: string;
}

/**
 * Result of email logging operation
 */
interface EmailLogResult {
  success: boolean;
  error?: unknown;
}

/**
 * Log email deliveries to email_send_log with consistent timestamps and errors.
 */
export async function logEmailDelivery(
  supabase: SupabaseClient,
  entry: EmailLogEntry
): Promise<EmailLogResult> {
  const now = new Date();
  const timestamp = now.toISOString();

  const { error } = await supabase.from("email_send_log").insert({
    user_id: entry.userId,
    email_type: entry.emailType,
    subject: entry.subject ?? null,
    local_date: entry.localDate ?? timestamp.split("T")[0],
    sent_at: entry.sentAt ?? timestamp,
    best_score: entry.bestScore ?? null,
    best_beach_id: entry.bestBeachId ?? null,
    message_instance_id: entry.messageInstanceId ?? null,
    meta: entry.meta ?? {},
    resend_message_id: entry.resendMessageId ?? null,
  });

  if (error) {
    console.error(
      `[condition-alert-deliver] Failed to log ${entry.emailType} email for user ${entry.userId}:`,
      error
    );
    return { success: false, error };
  }

  return { success: true };
}
