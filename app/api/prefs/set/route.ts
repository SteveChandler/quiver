/**
 * GET /prefs/set
 *
 * Handles 1-tap preference updates from email buttons.
 * Query params: token (required), time/level/frequency (one required)
 *
 * Returns an HTML page showing success or error.
 */

import { NextRequest } from 'next/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { renderEmailActionPage } from '@/lib/email/html-response';

// Valid values for each preference
const VALID_TIME_BUCKETS = ['dawn', 'after_work', 'weekends'] as const;
const VALID_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const VALID_FREQUENCIES = ['daily', 'only_good'] as const;

type TimeBucket = (typeof VALID_TIME_BUCKETS)[number];
type SkillLevel = (typeof VALID_SKILL_LEVELS)[number];
type Frequency = (typeof VALID_FREQUENCIES)[number];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const time = searchParams.get('time') as TimeBucket | null;
  const level = searchParams.get('level') as SkillLevel | null;
  const frequency = searchParams.get('frequency') as Frequency | null;

  // Validate token is present
  if (!token) {
    return renderEmailActionPage({
      title: 'Missing Token',
      message: 'Missing token parameter. Please use the link from your email.',
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
      message: 'Email system not configured properly.',
      isError: true,
    });
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload || payload.purpose !== 'prefs') {
    return renderEmailActionPage({
      title: 'Invalid Link',
      message: 'Invalid or expired link. Please check your most recent email.',
      isError: true,
    });
  }

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
    user_id: payload.user_id,
  };

  if (time) updates.pref_time_bucket = time;
  if (level) updates.skill_level = level;
  if (frequency) updates.email_frequency = frequency;

  // Update database
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('user_email_prefs')
    .upsert(updates, { onConflict: 'user_id' });

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
