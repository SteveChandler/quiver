/**
 * Welcome Email Template
 *
 * Sent by the /api/cron/welcome-email cron (delayed conditional send).
 * Plan abstract-exploring-phoenix (Commit C) rewrote the body from the
 * 8-preference-button prompt to a value-first forecast CTA. The
 * `user_email_prefs` preferences captured by the old buttons are no
 * longer read by any downstream code — see welcome-email-html.ts for
 * the full rationale.
 */

import {
  generateWelcomeEmailHtml,
  generateWelcomeEmailText,
  WELCOME_EMAIL_SUBJECT,
} from './welcome-email-html';

export interface WelcomeEmailProps {
  userId: string;
  userEmail: string;
  baseUrl: string;
  /** Home beach name, when the profile has one. Drives the CTA path. */
  homeBeachName?: string | null;
  /** Home beach slug for the app-first `/app/spot/{slug}` CTA. */
  homeBeachSlug?: string | null;
  messageInstanceId: string;
}

export async function generateWelcomeEmail(
  props: WelcomeEmailProps,
  // `secret` kept in the signature for callsite stability; the new
  // template doesn't need signed preference tokens, but removing the
  // param would force every caller to change in the same commit.
  _secret: string
): Promise<{ subject: string; html: string; text: string }> {
  const { baseUrl, homeBeachName, homeBeachSlug, messageInstanceId } = props;

  const html = generateWelcomeEmailHtml({
    baseUrl,
    homeBeachName,
    homeBeachSlug,
    messageInstanceId,
  });
  const text = generateWelcomeEmailText({
    baseUrl,
    homeBeachName,
    homeBeachSlug,
    messageInstanceId,
  });

  return {
    subject: WELCOME_EMAIL_SUBJECT,
    html,
    text,
  };
}
