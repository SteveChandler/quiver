/**
 * Heads-Up Alert Email Template
 *
 * Sent 2-3 hours before a good window starts.
 */

import { signEmailToken } from '@/lib/utils/email-token';

export interface HeadsUpEmailProps {
  userId: string;
  userEmail: string;
  baseUrl: string;
  beachId: string;
  beachName: string;
  score: number;
  startTime: string;
  endTime: string;
  hoursUntil: number;
  conditionNote: string; // "Light winds holding, tide about to turn."
}

export async function generateHeadsUpEmail(
  props: HeadsUpEmailProps,
  secret: string
): Promise<{ subject: string; html: string; text: string }> {
  const { userId, baseUrl, beachId, beachName, score, startTime, endTime, hoursUntil, conditionNote } = props;

  // Generate token for log session link
  const token = await signEmailToken({ user_id: userId, purpose: 'log_session' }, secret);

  const subject = `⏰ Surf in ~${hoursUntil} hours: ${score.toFixed(1)}/10 at ${beachName} (${startTime}–${endTime})`;

  const logSessionUrl = `${baseUrl}/session/log?token=${token}&beach_id=${beachId}&window_start=${encodeURIComponent(startTime)}&beach_name=${encodeURIComponent(beachName)}&score=${score}`;

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">

  <div style="text-align: center; margin-bottom: 16px;">
    <div style="font-size: 48px;">⏰</div>
  </div>

  <h1 style="text-align: center; font-size: 24px; color: #1e40af; margin-bottom: 8px;">
    ${beachName}
  </h1>

  <div style="text-align: center; font-size: 32px; font-weight: bold; color: #16a34a; margin-bottom: 8px;">
    ${score.toFixed(1)}/10
  </div>

  <div style="text-align: center; font-size: 16px; color: #666; margin-bottom: 24px;">
    ${startTime}–${endTime}
  </div>

  <p style="text-align: center; color: #666; margin-bottom: 24px;">
    ${conditionNote}
  </p>

  <div style="text-align: center;">
    <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
    <a href="${logSessionUrl}" style="${buttonStyle}">Log this session</a>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();

  const text = `
Surf in ~${hoursUntil} hours!

${beachName} — ${score.toFixed(1)}/10 (${startTime}–${endTime})

${conditionNote}

Open Quiver: ${baseUrl}
Log session: ${logSessionUrl}
  `.trim();

  return { subject, html, text };
}
