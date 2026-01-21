/**
 * Daily "Best Window" Email Template
 *
 * Sent each morning with the day's surf call.
 */

import { signEmailToken } from '@/lib/utils/email-token';
import {
  EMAIL_COLORS,
  EMAIL_FONT_FAMILY,
  EMAIL_BUTTON_STYLE,
  EMAIL_CHIP_STYLE,
} from '../email-constants';

export interface BeachWindow {
  beachId: string;
  beachName: string;
  score: number;
  startTime: string; // "6:30"
  endTime: string;   // "8:00"
  isHomeBeach?: boolean;
}

export interface DailyEmailProps {
  userId: string;
  userEmail: string;
  baseUrl: string;
  isWorthIt: boolean;
  decision: 'YES' | 'NO';
  decisionReason: string;  // "worth it if you can go by 6:30"
  chips: string[];         // ["Offshore", "Tide rising", "Medium period"]
  bestWindow: BeachWindow;
  backups: BeachWindow[];
  nextGoodDate?: string;   // "Thu Jan 22" - only for NO days
}

export async function generateDailyEmail(
  props: DailyEmailProps,
  secret: string
): Promise<{ subject: string; html: string; text: string }> {
  const { userId, baseUrl, isWorthIt, decision, decisionReason, chips, bestWindow, backups, nextGoodDate } = props;

  // Generate token for save window link
  const token = await signEmailToken({ user_id: userId, purpose: 'save_window' }, secret);

  // Build subject
  const subject = isWorthIt
    ? `⚡ Today: ${bestWindow.score.toFixed(1)}/10 at ${bestWindow.beachName} (${bestWindow.startTime}–${bestWindow.endTime})`
    : `🌊 Not worth it today — next window ${nextGoodDate}`;

  // Build save window URL
  const saveWindowUrl = `${baseUrl}/window/save?token=${token}&beach_id=${bestWindow.beachId}&start=${encodeURIComponent(bestWindow.startTime)}&end=${encodeURIComponent(bestWindow.endTime)}`;

  const chipStyle = EMAIL_CHIP_STYLE;
  const buttonStyle = EMAIL_BUTTON_STYLE;
  const decisionColor = isWorthIt ? EMAIL_COLORS.success : EMAIL_COLORS.error;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: ${EMAIL_FONT_FAMILY}; max-width: 600px; margin: 0 auto; padding: 20px; color: ${EMAIL_COLORS.text};">

  <div style="text-align: center; margin-bottom: 24px;">
    <div style="font-size: 48px; font-weight: bold; color: ${decisionColor};">
      ${decision}
    </div>
    <div style="font-size: 18px; color: ${EMAIL_COLORS.textSecondary};">
      ${decisionReason}
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    ${chips.map(chip => `<span style="${chipStyle}">${chip}</span>`).join('')}
  </div>

  ${isWorthIt ? `
    <div style="background: ${EMAIL_COLORS.cardBgAlt}; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
      <div style="font-weight: 600; font-size: 16px;">
        ${bestWindow.beachName} — ${bestWindow.score.toFixed(1)}/10 (${bestWindow.startTime}–${bestWindow.endTime})
        ${bestWindow.isHomeBeach ? `<span style="color: ${EMAIL_COLORS.primary};"> ← your home break</span>` : ''}
      </div>
    </div>

    ${backups.length > 0 ? `
      <div style="color: ${EMAIL_COLORS.textSecondary}; font-size: 14px; margin-bottom: 24px;">
        <strong>Backups:</strong><br>
        ${backups.map(b => `${b.beachName} — ${b.score.toFixed(1)}/10 (${b.startTime}–${b.endTime})`).join('<br>')}
      </div>
    ` : ''}

    <div style="text-align: center;">
      <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
      <a href="${saveWindowUrl}" style="${buttonStyle}">Save this window</a>
    </div>
  ` : `
    <div style="text-align: center; margin-bottom: 24px; color: ${EMAIL_COLORS.textSecondary};">
      Next good window: <strong>${nextGoodDate}</strong>
    </div>

    <div style="text-align: center;">
      <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
    </div>
  `}

  <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.border}; margin: 32px 0;">

  <p style="color: ${EMAIL_COLORS.textTertiary}; font-size: 12px; text-align: center;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();

  const text = `
${decision} — ${decisionReason}

${chips.join(' · ')}

${isWorthIt ? `
Best: ${bestWindow.beachName} — ${bestWindow.score.toFixed(1)}/10 (${bestWindow.startTime}–${bestWindow.endTime})
${backups.map(b => `${b.beachName} — ${b.score.toFixed(1)}/10 (${b.startTime}–${b.endTime})`).join('\n')}

Open Quiver: ${baseUrl}
Save window: ${saveWindowUrl}
` : `
Next good window: ${nextGoodDate}

Open Quiver: ${baseUrl}
`}
  `.trim();

  return { subject, html, text };
}
