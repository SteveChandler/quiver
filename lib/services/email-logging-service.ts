/**
 * Email Logging Service
 *
 * Centralized service for logging email deliveries to the email_send_log table.
 * Provides consistent error handling, type safety, and field population across
 * all email cron routes.
 *
 * Used by:
 * - reengagement-email
 * - weekly-recap-email
 * - welcome-email
 * - forecast-digest-email
 * - conditions-alert-email
 * - session-prompt-email
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Email type enum matching database constraint from migration 20260203120000
 */
export type EmailType =
  | "welcome"
  | "forecast_digest"
  | "reengagement"
  | "weekly_recap"
  | "conditions_alert"
  | "session_prompt";

/**
 * Email log entry with all optional fields for flexibility
 */
export interface EmailLogEntry {
  userId: string;
  emailType: EmailType;
  subject?: string;
  localDate?: string; // YYYY-MM-DD format
  sentAt?: string; // ISO timestamp
  bestScore?: number;
  bestBeachId?: string;
  meta?: Record<string, unknown>;
  resendMessageId?: string;
}

/**
 * Result of email logging operation
 */
export interface EmailLogResult {
  success: boolean;
  error?: unknown;
}

/**
 * Service for logging email deliveries to email_send_log table.
 * Provides consistent timestamp handling and error logging.
 */
export class EmailLoggingService {
  constructor(
    private supabase: SupabaseClient,
    private contextTag: string // e.g., "[reengagement-email]"
  ) {}

  /**
   * Log an email delivery with consistent timestamp and field handling.
   * Non-blocking: errors are logged but don't throw.
   */
  async logDelivery(entry: EmailLogEntry): Promise<EmailLogResult> {
    const now = new Date();
    const timestamp = now.toISOString();

    const { error } = await this.supabase.from("email_send_log").insert({
      user_id: entry.userId,
      email_type: entry.emailType,
      subject: entry.subject ?? null,
      local_date: entry.localDate ?? timestamp.split("T")[0],
      sent_at: entry.sentAt ?? timestamp,
      best_score: entry.bestScore ?? null,
      best_beach_id: entry.bestBeachId ?? null,
      meta: entry.meta ?? {},
      resend_message_id: entry.resendMessageId ?? null,
    });

    if (error) {
      console.error(
        `${this.contextTag} Failed to log ${entry.emailType} email for user ${entry.userId}:`,
        error
      );
      return { success: false, error };
    }

    return { success: true };
  }

  /**
   * Log multiple email deliveries in a batch.
   * Useful for future optimization when processing many emails.
   */
  async logBatch(entries: EmailLogEntry[]): Promise<EmailLogResult> {
    if (entries.length === 0) {
      return { success: true };
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const localDate = timestamp.split("T")[0];

    const records = entries.map((entry) => ({
      user_id: entry.userId,
      email_type: entry.emailType,
      subject: entry.subject ?? null,
      local_date: entry.localDate ?? localDate,
      sent_at: entry.sentAt ?? timestamp,
      best_score: entry.bestScore ?? null,
      best_beach_id: entry.bestBeachId ?? null,
      meta: entry.meta ?? {},
      resend_message_id: entry.resendMessageId ?? null,
    }));

    const { error } = await this.supabase.from("email_send_log").insert(records);

    if (error) {
      console.error(
        `${this.contextTag} Failed to log batch of ${entries.length} emails:`,
        error
      );
      return { success: false, error };
    }

    return { success: true };
  }
}

/**
 * Factory function for creating email logging service
 */
export function createEmailLogger(
  supabase: SupabaseClient,
  contextTag: string
): EmailLoggingService {
  return new EmailLoggingService(supabase, contextTag);
}
