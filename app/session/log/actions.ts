'use server';

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { verifyEmailActionToken } from '@/lib/email/verify-email-action';

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
  const verification = await verifyEmailActionToken(token, 'log_session');
  if (!verification.success) {
    return { success: false, error: verification.error };
  }
  const userId = verification.userId;

  // Save to database
  // Email links are clicked without a Supabase auth session; the signed token
  // above is the authorization check for this write.
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from('session_logs').insert({
    user_id: userId,
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
