/**
 * GET /prefs/set
 *
 * Handles 1-tap preference updates from email buttons.
 * Query params: token (required), time/level/frequency (one required)
 *
 * Returns an HTML page showing success or error.
 */

import { NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { renderEmailActionPage } from '@/lib/email/html-response';
import { verifyEmailActionToken } from '@/lib/email/verify-email-action';
import { SKILL_LEVELS, type SkillLevel } from '@/lib/domains/user-preferences';

// Valid values for each preference
const VALID_TIME_BUCKETS = ['dawn', 'after_work', 'weekends'] as const;
const VALID_SKILL_LEVELS = SKILL_LEVELS;
const VALID_FREQUENCIES = ['daily', 'only_good'] as const;

type TimeBucket = (typeof VALID_TIME_BUCKETS)[number];
type Frequency = (typeof VALID_FREQUENCIES)[number];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const time = searchParams.get('time') as TimeBucket | null;
  const level = searchParams.get('level') as SkillLevel | null;
  const frequency = searchParams.get('frequency') as Frequency | null;

  // Verify token
  const verification = await verifyEmailActionToken(token, 'prefs');
  if (!verification.success) {
    return renderEmailActionPage({
      title: verification.errorType === 'config' ? 'Configuration Error' : 'Invalid Link',
      message: verification.error,
      isError: true,
    });
  }
  const userId = verification.userId;

  // Validate at least one preference is being set
  if (!time && !level && !frequency) {
    return renderEmailActionPage({
      title: 'No Preference',
      message: 'No preference specified to update.',
      isError: true,
    });
  }

  // Validate preference values
  if (time && !VALID_TIME_BUCKETS.includes(time)) {
    return renderEmailActionPage({
      title: 'Invalid Value',
      message: `Invalid time value: ${time}`,
      isError: true,
    });
  }
  if (level && !VALID_SKILL_LEVELS.includes(level)) {
    return renderEmailActionPage({
      title: 'Invalid Value',
      message: `Invalid level value: ${level}`,
      isError: true,
    });
  }
  if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
    return renderEmailActionPage({
      title: 'Invalid Value',
      message: `Invalid frequency value: ${frequency}`,
      isError: true,
    });
  }

  // Build update object
  const updates: Record<string, string> = {
    user_id: userId,
  };

  if (time) updates.pref_time_bucket = time;
  if (level) updates.skill_level = level;
  if (frequency) updates.email_frequency = frequency;

  // Update database - use service role client since email links are clicked without auth session
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from('user_email_prefs')
    .upsert(updates as any, { onConflict: 'user_id' });

  if (error) {
    console.error('Failed to update email prefs:', error);
    return renderEmailActionPage({
      title: 'Update Failed',
      message: 'Failed to save your preference. Please try again.',
      isError: true,
    });
  }

  // Success message based on what was updated
  let successMessage = 'Your preference has been saved.';
  if (time) {
    const timeLabels: Record<TimeBucket, string> = {
      dawn: 'Dawn patrol',
      after_work: 'After work',
      weekends: 'Weekends',
    };
    successMessage = `Surf time set to "${timeLabels[time]}"`;
  } else if (level) {
    successMessage = `Skill level set to "${level}"`;
  } else if (frequency) {
    const freqLabels: Record<Frequency, string> = {
      daily: 'Daily (even if flat)',
      only_good: "Only when it's good",
    };
    successMessage = `Email frequency set to "${freqLabels[frequency]}"`;
  }

  return renderEmailActionPage({
    title: 'Saved',
    message: successMessage,
  });
}
