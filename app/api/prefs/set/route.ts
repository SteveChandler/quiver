/**
 * GET /api/prefs/set  (legacy email-action-link endpoint)
 *
 * Historical behavior: the old welcome email shipped 8 preference
 * buttons that deep-linked here with `?time=`, `?level=`, or
 * `?frequency=` params, which this route wrote to `user_email_prefs`
 * (pref_time_bucket / skill_level / email_frequency).
 *
 * Current behavior: graceful no-op. The welcome email no longer links
 * here (Commit C rewrote the template to a single value-first CTA);
 * `user_email_prefs` writes are gone (plan cleanup) because nothing
 * in the app reads that table. But emails in user inboxes from before
 * the rewrite might still have these buttons, and we don't want those
 * clicks to land on a 404 or a "your click did something silent" UX.
 *
 * So we keep the route, verify the token to give a polite response
 * for bad/expired tokens, and render a "link expired" success page
 * with a link back to the app. Zero DB writes.
 *
 * Plan: abstract-exploring-phoenix cleanup.
 */

import { NextRequest } from 'next/server';
import { renderEmailActionPage } from '@/lib/email/html-response';
import { verifyEmailActionToken } from '@/lib/email/verify-email-action';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  // Still verify the token so bad/expired links get a correct error
  // page instead of a generic success. The response doesn't actually
  // depend on the verification — the endpoint is a no-op either way —
  // but giving a user with a tampered/expired token a "link expired"
  // message is kinder than pretending it worked.
  const verification = await verifyEmailActionToken(token, 'prefs');
  if (!verification.success) {
    return renderEmailActionPage({
      title: verification.errorType === 'config' ? 'Configuration Error' : 'Link Expired',
      message:
        verification.errorType === 'config'
          ? verification.error
          : "This preference link has expired. Open the app to manage your settings.",
      isError: true,
    });
  }

  return renderEmailActionPage({
    title: 'Link retired',
    message:
      "This email-preference link isn't wired up anymore — it came from an older version of our welcome email. Open the app to set your home beach and notification preferences.",
  });
}
