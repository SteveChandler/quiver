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
   * Filter out suppressed emails from a list of user IDs.
   * Returns only user IDs whose email is NOT in the suppression list.
   * Non-blocking: returns all IDs on error (fail-open to avoid blocking sends).
   */
  async filterSuppressed(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];

    try {
      // Step 1: Get emails for these specific users (chunked to avoid URL length limits)
      const CHUNK_SIZE = 200;
      const allProfiles: { id: string; email: string | null }[] = [];

      for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
        const chunk = userIds.slice(i, i + CHUNK_SIZE);
        const { data: profiles, error: profilesError } = await this.supabase
          .from("profiles")
          .select("id, email")
          .in("id", chunk);

        if (profilesError || !profiles) {
          console.error(
            `${this.contextTag} Failed to fetch profiles for suppression check:`,
            profilesError
          );
          return userIds;
        }
        allProfiles.push(...profiles);
      }

      // Step 2: Collect unique non-null emails to check against suppression list
      const emailToUserIds = new Map<string, string[]>();
      for (const p of allProfiles) {
        if (p.email) {
          const lower = p.email.toLowerCase();
          const ids = emailToUserIds.get(lower) || [];
          ids.push(p.id);
          emailToUserIds.set(lower, ids);
        }
      }

      const emailsToCheck = Array.from(emailToUserIds.keys());
      if (emailsToCheck.length === 0) {
        return userIds;
      }

      // Step 3: Check only these specific emails against the suppression list
      const suppressedEmails = new Set<string>();
      for (let i = 0; i < emailsToCheck.length; i += CHUNK_SIZE) {
        const chunk = emailsToCheck.slice(i, i + CHUNK_SIZE);
        const { data: suppressed, error } = await this.supabase
          .from("email_suppression_list")
          .select("email")
          .in("email", chunk);

        if (error) {
          console.error(
            `${this.contextTag} Failed to check suppression list:`,
            error
          );
          // Fail open — send to all rather than block
          return userIds;
        }

        if (suppressed) {
          for (const s of suppressed) {
            suppressedEmails.add((s as { email: string }).email.toLowerCase());
          }
        }
      }

      if (suppressedEmails.size === 0) {
        return userIds;
      }

      // Step 4: Filter out suppressed user IDs
      const suppressedUserIds = new Set<string>();
      for (const email of suppressedEmails) {
        const ids = emailToUserIds.get(email);
        if (ids) {
          for (const id of ids) {
            suppressedUserIds.add(id);
          }
        }
      }

      const filtered = userIds.filter((id) => !suppressedUserIds.has(id));

      console.log(
        `${this.contextTag} Filtered out ${suppressedUserIds.size} suppressed email(s)`
      );

      return filtered;
    } catch (err) {
      console.error(
        `${this.contextTag} Unexpected error in filterSuppressed:`,
        err
      );
      return userIds;
    }
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
