/**
 * GET /window/save
 *
 * 1-tap window saving from email links.
 * Query params: token, beach_id, start, end
 */

import { NextRequest } from 'next/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { renderEmailActionPage } from '@/lib/email/html-response';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const beachId = searchParams.get('beach_id');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  // Validate required params
  if (!token || !beachId || !start || !end) {
    return renderEmailActionPage({
      title: 'Missing Info',
      message: 'Missing required parameters. Please use the link from your email.',
      isError: true,
    });
  }

  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return renderEmailActionPage({
      title: 'Configuration Error',
      message: 'Email system not configured.',
      isError: true,
    });
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload || payload.purpose !== 'save_window') {
    return renderEmailActionPage({
      title: 'Invalid Link',
      message: 'Invalid or expired link.',
      isError: true,
    });
  }

  // Parse dates
  const startTs = new Date(start);
  const endTs = new Date(end);

  if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
    return renderEmailActionPage({
      title: 'Invalid Dates',
      message: 'Invalid date format in link.',
      isError: true,
    });
  }

  // Save to database
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('saved_windows').insert({
    user_id: payload.user_id,
    beach_id: beachId,
    start_ts: startTs.toISOString(),
    end_ts: endTs.toISOString(),
    source: 'email',
  });

  if (error) {
    // Duplicate is OK - just show success
    if (error.code === '23505') {
      return renderEmailActionPage({
        title: 'Saved',
        message: 'This window is already saved.',
      });
    }
    console.error('Failed to save window:', error);
    return renderEmailActionPage({
      title: 'Save Failed',
      message: 'Failed to save window. Please try again.',
      isError: true,
    });
  }

  return renderEmailActionPage({
    title: 'Saved',
    message: "We'll remind you before this window starts.",
  });
}
