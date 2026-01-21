/**
 * Daily "Best Window" Email Template
 *
 * Sent each morning with the day's surf call.
 */

import { signEmailToken } from '@/lib/utils/email-token';

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

  const chipStyle = `
    display: inline-block;
    padding: 6px 12px;
    margin: 2px;
    background: #e0f2fe;
    color: #0369a1;
    border-radius: 16px;
    font-size: 13px;
  `;

  const buttonStyle = `
    display: inline-block;
    padding: 12px 24px;
    margin: 8px 4px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
  `;

  const decisionColor = isWorthIt ? '#16a34a' : '#dc2626';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">

  <div style="text-align: center; margin-bottom: 24px;">
    <div style="font-size: 48px; font-weight: bold; color: ${decisionColor};">
      ${decision}
    </div>
    <div style="font-size: 18px; color: #666;">
      ${decisionReason}
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    ${chips.map(chip => `<span style="${chipStyle}">${chip}</span>`).join('')}
  </div>

  ${isWorthIt ? `
    <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
      <div style="font-weight: 600; font-size: 16px;">
        ${bestWindow.beachName} — ${bestWindow.score.toFixed(1)}/10 (${bestWindow.startTime}–${bestWindow.endTime})
        ${bestWindow.isHomeBeach ? '<span style="color: #3b82f6;"> ← your home break</span>' : ''}
      </div>
    </div>

    ${backups.length > 0 ? `
      <div style="color: #666; font-size: 14px; margin-bottom: 24px;">
        <strong>Backups:</strong><br>
        ${backups.map(b => `${b.beachName} — ${b.score.toFixed(1)}/10 (${b.startTime}–${b.endTime})`).join('<br>')}
      </div>
    ` : ''}

    <div style="text-align: center;">
      <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
      <a href="${saveWindowUrl}" style="${buttonStyle}">Save this window</a>
    </div>
  ` : `
    <div style="text-align: center; margin-bottom: 24px; color: #666;">
      Next good window: <strong>${nextGoodDate}</strong>
    </div>

    <div style="text-align: center;">
      <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
    </div>
  `}

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
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
