/**
 * GET /session/confirm
 *
 * 1-tap session confirmation from email links.
 * Verifies the token, deduplicates within 24h, and logs the session.
 *
 * Query params: token, beach_id, date (YYYY-MM-DD)
 */

import { NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { renderEmailActionPage } from '@/lib/email/html-response';
import { verifyEmailActionToken } from '@/lib/email/verify-email-action';
import { isValidUuid } from '@/lib/middleware/api-wrappers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const beachId = searchParams.get('beach_id');
  const date = searchParams.get('date');

  // Validate required params
  if (!beachId || !date) {
    return renderEmailActionPage({
      title: 'Missing Info',
      message: 'Missing required parameters. Please use the link from your email.',
      isError: true,
    });
  }

  // Validate beach_id is a proper UUID before using it in DB queries
  if (!isValidUuid(beachId)) {
    return renderEmailActionPage({
      title: 'Invalid Link',
      message: 'Invalid beach identifier.',
      isError: true,
    });
  }

  // Verify token
  const verification = await verifyEmailActionToken(token, 'log_session');
  if (!verification.success) {
    return renderEmailActionPage({
      title: verification.errorType === 'config' ? 'Configuration Error' : 'Invalid Link',
      message: verification.error,
      isError: true,
    });
  }
  const userId = verification.userId;

  // Parse and validate the date
  const sessionDate = new Date(date);
  if (isNaN(sessionDate.getTime())) {
    return renderEmailActionPage({
      title: 'Invalid Date',
      message: 'Invalid date format in link.',
      isError: true,
    });
  }

  // Reject future dates or dates more than 7 days in the past
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  if (sessionDate > now) {
    return renderEmailActionPage({
      title: 'Invalid Date',
      message: 'Session date cannot be in the future.',
      isError: true,
    });
  }
  if (sessionDate < sevenDaysAgo) {
    return renderEmailActionPage({
      title: 'Link Expired',
      message: 'This session link has expired. Links are valid for 7 days.',
      isError: true,
    });
  }

  // Use service role client — email links are clicked without an auth session
  const supabase = createSupabaseServiceRoleClient();

  // Deduplicate: check for an existing log for the same user + beach within the same calendar day
  const dayStart = new Date(sessionDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const { data: existing, error: checkError } = await supabase
    .from('session_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('beach_id', beachId)
    .gte('window_start', dayStart.toISOString())
    .lt('window_start', dayEnd.toISOString())
    .limit(1);

  if (checkError) {
    console.error('Failed to check for duplicate session log:', checkError);
    return renderEmailActionPage({
      title: 'Something Went Wrong',
      message: 'Failed to verify your session. Please try again.',
      isError: true,
    });
  }

  if (existing && existing.length > 0) {
    return renderEmailActionPage({
      title: 'Already Logged',
      message: "You've already logged a session for this day. Nice work getting out there!",
      buttonText: 'View Your Sessions',
      buttonUrl: '/sessions',
    });
  }

  // Insert the minimal session log
  const { error: insertError } = await supabase.from('session_logs').insert({
    user_id: userId,
    beach_id: beachId,
    window_start: sessionDate.toISOString(),
    rating: 'good',
    source: 'email',
  });

  if (insertError) {
    // Unique constraint violation — treat as duplicate (race condition)
    if (insertError.code === '23505') {
      return renderEmailActionPage({
        title: 'Already Logged',
        message: "You've already logged a session for this day. Nice work getting out there!",
        buttonText: 'View Your Sessions',
        buttonUrl: '/sessions',
      });
    }
    console.error('Failed to create session log:', insertError);
    return renderEmailActionPage({
      title: 'Log Failed',
      message: 'Failed to save your session. Please try again.',
      isError: true,
    });
  }

  return renderEmailActionPage({
    title: 'Session Logged!',
    message: 'Your session has been recorded. Keep shredding!',
    buttonText: 'View Your Sessions',
    buttonUrl: '/sessions',
  });
}
