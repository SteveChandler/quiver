/**
 * Welcome Email Template
 *
 * Sent by the /api/cron/welcome-email cron (delayed conditional send).
 * Captures user preferences via email buttons.
 */

import { signEmailToken } from '@/lib/utils/email-token';
import {
  generateWelcomeEmailHtml,
  generateWelcomeEmailText,
  WELCOME_EMAIL_SUBJECT,
} from './welcome-email-html';

export interface WelcomeEmailProps {
  userId: string;
  userEmail: string;
  baseUrl: string;
}

export async function generateWelcomeEmail(
  props: WelcomeEmailProps,
  secret: string
): Promise<{ subject: string; html: string; text: string }> {
  const { userId, baseUrl } = props;

  // Generate token for preference links (7 day expiry)
  const token = await signEmailToken({ user_id: userId, purpose: 'prefs' }, secret);

  const html = generateWelcomeEmailHtml({ baseUrl, token });
  const text = generateWelcomeEmailText({ baseUrl, token });

  return {
    subject: WELCOME_EMAIL_SUBJECT,
    html,
    text,
  };
}
