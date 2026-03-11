/**
 * GET /session/skip
 *
 * 1-tap session skip from email links.
 * Verifies the token and renders a friendly dismissal page with a forecast link.
 * No database write — a skip is not logged, it simply acknowledges the email.
 *
 * Query params: token, beach_id
 */

import { NextRequest } from 'next/server';
import { renderEmailActionPage } from '@/lib/email/html-response';
import { verifyEmailActionToken } from '@/lib/email/verify-email-action';
import { getBaseUrl } from '@/lib/mailer/client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const beachId = searchParams.get('beach_id');

  // Verify token — require a valid log_session token to prevent link farming
  const verification = await verifyEmailActionToken(token, 'log_session');
  if (!verification.success) {
    return renderEmailActionPage({
      title: verification.errorType === 'config' ? 'Configuration Error' : 'Invalid Link',
      message: verification.error,
      isError: true,
    });
  }

  // Build a forecast link for the beach if beach_id was provided, otherwise link to the map
  const baseUrl = getBaseUrl();
  const forecastUrl = beachId
    ? `${baseUrl}/map?beach=${beachId}`
    : `${baseUrl}/map`;

  return renderEmailActionPage({
    title: 'No worries!',
    message: "Maybe next time. Check the forecast so you never miss another good day.",
    buttonText: 'See the Forecast',
    buttonUrl: forecastUrl,
  });
}
