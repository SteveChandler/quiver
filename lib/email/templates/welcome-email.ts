/**
 * Welcome Email Template
 *
 * Sent immediately after signup. Captures user preferences via email buttons.
 */

import { signEmailToken } from '@/lib/utils/email-token';
import {
  EMAIL_COLORS,
  EMAIL_FONT_FAMILY,
  EMAIL_BUTTON_STYLE_COMPACT,
} from '../email-constants';

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

  const timeButtons = [
    { label: 'Dawn patrol', value: 'dawn' },
    { label: 'After work', value: 'after_work' },
    { label: 'Weekends', value: 'weekends' },
  ];

  const levelButtons = [
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' },
  ];

  const frequencyButtons = [
    { label: 'Daily (even if flat)', value: 'daily' },
    { label: 'Only when it\'s good', value: 'only_good' },
  ];

  const buttonStyle = EMAIL_BUTTON_STYLE_COMPACT;

  const subject = 'Welcome to Quiver — set your surf defaults (10 seconds)';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: ${EMAIL_FONT_FAMILY}; max-width: 600px; margin: 0 auto; padding: 20px; color: ${EMAIL_COLORS.text};">
  <h1 style="color: ${EMAIL_COLORS.heading}; font-size: 24px; margin-bottom: 8px;">🌊 Welcome to Quiver</h1>

  <p style="font-size: 18px; color: ${EMAIL_COLORS.textSecondary}; margin-bottom: 24px;">
    Quiver emails you one thing: the best yes/no surf call.
  </p>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${EMAIL_COLORS.text}; margin-bottom: 12px;">When do you usually surf?</h2>
    ${timeButtons.map(b => `
      <a href="${baseUrl}/prefs/set?time=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>
    `).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${EMAIL_COLORS.text}; margin-bottom: 12px;">What's your level?</h2>
    ${levelButtons.map(b => `
      <a href="${baseUrl}/prefs/set?level=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>
    `).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${EMAIL_COLORS.text}; margin-bottom: 12px;">How often should we email?</h2>
    ${frequencyButtons.map(b => `
      <a href="${baseUrl}/prefs/set?frequency=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>
    `).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${EMAIL_COLORS.text}; margin-bottom: 12px;">Home break?</h2>
    <a href="${baseUrl}/prefs/home-beach?token=${token}" style="${buttonStyle}">Set home beach →</a>
  </div>

  <p style="color: ${EMAIL_COLORS.textTertiary}; font-size: 14px; margin-top: 32px;">
    Or just reply with your home break name.
  </p>

  <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.border}; margin: 32px 0;">

  <p style="color: ${EMAIL_COLORS.textTertiary}; font-size: 12px;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();

  const text = `
Welcome to Quiver

Quiver emails you one thing: the best yes/no surf call.

Set your preferences:
- Time: ${baseUrl}/prefs/set?time=dawn&token=${token}
- Level: ${baseUrl}/prefs/set?level=intermediate&token=${token}
- Frequency: ${baseUrl}/prefs/set?frequency=daily&token=${token}
- Home beach: ${baseUrl}/prefs/home-beach?token=${token}

Or just reply with your home break name.
  `.trim();

  return { subject, html, text };
}
