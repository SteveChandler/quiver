'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';

export interface LogSessionResult {
  success: boolean;
  error?: string;
}

export async function logSession(
  token: string,
  beachId: string,
  windowStart: string,
  rating: 'skip' | 'good' | 'fired',
  notes?: string,
  predictedScore?: number
): Promise<LogSessionResult> {
  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return { success: false, error: 'Email system not configured' };
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload || payload.purpose !== 'log_session') {
    return { success: false, error: 'Invalid or expired link' };
  }

  // Save to database
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('session_logs').insert({
    user_id: payload.user_id,
    beach_id: beachId,
    window_start: windowStart,
    rating,
    notes: notes || null,
    predicted_score: predictedScore || null,
    source: 'email',
  });

  if (error) {
    console.error('Failed to log session:', error);
    return { success: false, error: 'Failed to save. Please try again.' };
  }

  return { success: true };
}
