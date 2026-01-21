/**
 * Welcome Email HTML Generator
 *
 * CANONICAL SOURCE for welcome email template HTML.
 *
 * This is a pure function with NO external dependencies so it can be:
 * 1. Imported directly in Node.js (lib/email/templates/welcome-email.ts)
 * 2. Copied to Deno Edge Functions (supabase/functions/on-auth-user-created/index.ts)
 *
 * IMPORTANT: If you modify this template, you MUST also update:
 * - supabase/functions/on-auth-user-created/index.ts (copy the generateWelcomeEmailHtml function)
 *
 * The template includes:
 * - Surf time preference buttons (dawn, after work, weekends)
 * - Skill level buttons (beginner, intermediate, advanced)
 * - Email frequency buttons (daily, only when good)
 * - Home beach link
 */

export interface WelcomeEmailParams {
  baseUrl: string;
  token: string;
}

// Inline style constants (no imports to keep this pure)
const COLORS = {
  primary: '#3b82f6',
  text: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  heading: '#1e40af',
  border: '#eeeeee',
} as const;

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const BUTTON_STYLE = `
  display: inline-block;
  padding: 12px 20px;
  margin: 4px;
  background: ${COLORS.primary};
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
`.trim();

const TIME_BUTTONS = [
  { label: 'Dawn patrol', value: 'dawn' },
  { label: 'After work', value: 'after_work' },
  { label: 'Weekends', value: 'weekends' },
] as const;

const LEVEL_BUTTONS = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
] as const;

const FREQUENCY_BUTTONS = [
  { label: 'Daily (even if flat)', value: 'daily' },
  { label: "Only when it's good", value: 'only_good' },
] as const;

/**
 * Generates the welcome email HTML.
 *
 * This is a pure function with no external dependencies.
 * It can be safely copied to Deno Edge Functions.
 */
export function generateWelcomeEmailHtml(params: WelcomeEmailParams): string {
  const { baseUrl, token } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: ${FONT_FAMILY}; max-width: 600px; margin: 0 auto; padding: 20px; color: ${COLORS.text};">
  <h1 style="color: ${COLORS.heading}; font-size: 24px; margin-bottom: 8px;">🌊 Welcome to Quiver</h1>

  <p style="font-size: 18px; color: ${COLORS.textSecondary}; margin-bottom: 24px;">
    Quiver emails you one thing: the best yes/no surf call.
  </p>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">When do you usually surf?</h2>
    ${TIME_BUTTONS.map(b => `<a href="${baseUrl}/prefs/set?time=${b.value}&token=${token}" style="${BUTTON_STYLE}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">What's your level?</h2>
    ${LEVEL_BUTTONS.map(b => `<a href="${baseUrl}/prefs/set?level=${b.value}&token=${token}" style="${BUTTON_STYLE}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">How often should we email?</h2>
    ${FREQUENCY_BUTTONS.map(b => `<a href="${baseUrl}/prefs/set?frequency=${b.value}&token=${token}" style="${BUTTON_STYLE}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">Home break?</h2>
    <a href="${baseUrl}/prefs/home-beach?token=${token}" style="${BUTTON_STYLE}">Set home beach →</a>
  </div>

  <p style="color: ${COLORS.textTertiary}; font-size: 14px; margin-top: 32px;">
    Or just reply with your home break name.
  </p>

  <hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 32px 0;">

  <p style="color: ${COLORS.textTertiary}; font-size: 12px;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();
}

/**
 * Generates the welcome email plain text version.
 */
export function generateWelcomeEmailText(params: WelcomeEmailParams): string {
  const { baseUrl, token } = params;

  return `
Welcome to Quiver

Quiver emails you one thing: the best yes/no surf call.

Set your preferences:
- Time: ${baseUrl}/prefs/set?time=dawn&token=${token}
- Level: ${baseUrl}/prefs/set?level=intermediate&token=${token}
- Frequency: ${baseUrl}/prefs/set?frequency=daily&token=${token}
- Home beach: ${baseUrl}/prefs/home-beach?token=${token}

Or just reply with your home break name.
  `.trim();
}

export const WELCOME_EMAIL_SUBJECT = 'Welcome to Quiver — set your surf defaults (10 seconds)';
