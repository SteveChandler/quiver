/**
 * GET /prefs/set
 *
 * Handles 1-tap preference updates from email buttons.
 * Query params: token (required), time/level/frequency (one required)
 *
 * Returns an HTML page showing success or error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { escapeHtml } from '@/lib/utils/html';

// Valid values for each preference
const VALID_TIME_BUCKETS = ['dawn', 'after_work', 'weekends'] as const;
const VALID_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const VALID_FREQUENCIES = ['daily', 'only_good'] as const;

type TimeBucket = (typeof VALID_TIME_BUCKETS)[number];
type SkillLevel = (typeof VALID_SKILL_LEVELS)[number];
type Frequency = (typeof VALID_FREQUENCIES)[number];

function renderPage(title: string, message: string, isError: boolean = false) {
  const bgColor = isError ? '#fef2f2' : '#f0fdf4';
  const textColor = isError ? '#dc2626' : '#16a34a';
  const icon = isError ? '!' : 'check';

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Quiver</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: ${bgColor};
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: ${textColor};
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
    }
    p {
      color: #666;
      margin: 0 0 1.5rem;
    }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
    }
    .btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon === 'check' ? '&#10003;' : '&#33;'}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="/" class="btn">Open Quiver</a>
  </div>
</body>
</html>`,
    {
      status: isError ? 400 : 200,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const time = searchParams.get('time') as TimeBucket | null;
  const level = searchParams.get('level') as SkillLevel | null;
  const frequency = searchParams.get('frequency') as Frequency | null;

  // Validate token is present
  if (!token) {
    return renderPage(
      'Missing Token',
      'Missing token parameter. Please use the link from your email.',
      true
    );
  }

  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return renderPage(
      'Configuration Error',
      'Email system not configured properly.',
      true
    );
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload || payload.purpose !== 'prefs') {
    return renderPage(
      'Invalid Link',
      'Invalid or expired link. Please check your most recent email.',
      true
    );
  }

  // Validate at least one preference is being set
  if (!time && !level && !frequency) {
    return renderPage('No Preference', 'No preference specified to update.', true);
  }

  // Validate preference values
  if (time && !VALID_TIME_BUCKETS.includes(time)) {
    return renderPage('Invalid Value', `Invalid time value: ${time}`, true);
  }
  if (level && !VALID_SKILL_LEVELS.includes(level)) {
    return renderPage('Invalid Value', `Invalid level value: ${level}`, true);
  }
  if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
    return renderPage('Invalid Value', `Invalid frequency value: ${frequency}`, true);
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
    return renderPage(
      'Update Failed',
      'Failed to save your preference. Please try again.',
      true
    );
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

  return renderPage('Saved', successMessage);
}
