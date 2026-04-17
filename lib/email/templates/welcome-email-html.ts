/**
 * Welcome Email HTML Generator
 *
 * CANONICAL SOURCE for welcome email template HTML.
 * Used by the /api/cron/welcome-email cron job.
 *
 * Plan abstract-exploring-phoenix (Commit C): the previous version shipped
 * 8 preference buttons ("Dawn patrol / After work / Weekends", 3 skill
 * levels, 2 frequency options, "Set home break") linking to
 * /api/prefs/set, which writes to `user_email_prefs`. Audit on
 * 2026-04-17 confirmed NOTHING in the codebase reads `user_email_prefs`
 * — it's written by this email and by onboarding-actions.ts:260-268 but
 * no `.select()` query, cron, or lib consumes it. The 7d email click
 * rate was 0% (7 opens / 0 clicks). Users were clicking buttons that
 * wrote to a dead table.
 *
 * The new template leads with forecast value:
 * - When home beach is set: deep-link "Check your {beach} forecast →"
 * - When home beach is unset: "Pick your home beach →" deep-links to
 *   `/?onboarding=required` (Commit B entry path).
 */

export interface WelcomeEmailParams {
  baseUrl: string;
  /** Home beach display name; when present, the CTA deep-links to the
   *  beach detail page. When absent, the CTA nudges the user to the
   *  onboarding dialog. */
  homeBeachName?: string | null;
  /** Home beach slug (for URL construction). Required together with
   *  homeBeachName — when one is missing we fall back to the
   *  no-home-beach copy. */
  homeBeachSlug?: string | null;
}

const COLORS = {
  primary: "#F78E42", // Charming Orange — hits the brand accent, contrasts with the Twilight Navy header
  text: "#1a1a1a",
  textSecondary: "#555555",
  textTertiary: "#888888",
  heading: "#252D6B", // Twilight Navy
  border: "#eeeeee",
} as const;

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const PRIMARY_BUTTON_STYLE = `
  display: inline-block;
  padding: 14px 28px;
  background: ${COLORS.primary};
  color: #ffffff;
  text-decoration: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.01em;
`.trim();

/**
 * Generates the welcome email HTML.
 *
 * Pure function with no external dependencies — safe to port to Deno
 * Edge Functions.
 */
export function generateWelcomeEmailHtml(params: WelcomeEmailParams): string {
  const { baseUrl: rawBaseUrl, homeBeachName, homeBeachSlug } = params;
  const baseUrl = rawBaseUrl.trim();

  const hasHomeBeach = Boolean(homeBeachName && homeBeachSlug);

  // Variant-specific copy. Both paths lead with a single clear CTA;
  // neither asks for preferences. Variant markers flow into UTM tags so
  // the /app-stats email dashboard can attribute future clicks.
  const ctaHref = hasHomeBeach
    ? `${baseUrl}/beach/${encodeURIComponent(homeBeachSlug!)}?utm_source=email&utm_medium=welcome&utm_campaign=home_beach_set`
    : `${baseUrl}/?onboarding=required&utm_source=email&utm_medium=welcome&utm_campaign=no_home_beach`;

  const ctaLabel = hasHomeBeach
    ? `Check your ${homeBeachName} forecast →`
    : "Pick your home beach →";

  const headline = hasHomeBeach
    ? `Your ${homeBeachName} forecast is dialed`
    : "Your forecast is live";

  const body = hasHomeBeach
    ? `You know that 5 a.m. moment — alarm goes off, still not sure if it's worth it. Quiver just tells you. Yes or no. Best window. That's it.<br/><br/>Every session you log sharpens the call.`
    : `One thing left — pick your home beach so we can dial the forecast to it.<br/><br/>You know that 5 a.m. moment — alarm goes off, still not sure if it's worth it. Once your home break is set, Quiver just tells you. Yes or no. Best window. That's it.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: ${FONT_FAMILY}; max-width: 560px; margin: 0 auto; padding: 24px; color: ${COLORS.text}; background: #ffffff;">
  <p style="font-size: 22px; line-height: 1.3; color: ${COLORS.heading}; font-weight: 700; margin: 0 0 12px;">
    ${headline}
  </p>

  <p style="font-size: 16px; line-height: 1.55; color: ${COLORS.text}; margin: 0 0 24px;">
    ${body}
  </p>

  <p style="margin: 8px 0 28px;">
    <a href="${ctaHref}" style="${PRIMARY_BUTTON_STYLE}">${ctaLabel}</a>
  </p>

  <p style="font-size: 14px; line-height: 1.5; color: ${COLORS.textSecondary}; margin: 0 0 8px;">
    Every session you log levels you up and makes the forecast smarter.
  </p>

  <p style="margin-top: 36px; padding-top: 20px; border-top: 1px solid ${COLORS.border}; color: ${COLORS.textTertiary}; font-size: 13px; line-height: 1.5;">
    — Steven<br/>
    <a href="${baseUrl}" style="color: ${COLORS.textTertiary}; text-decoration: underline;">quiversurf.app</a>
  </p>
</body>
</html>
  `.trim();
}

/**
 * Generates the welcome email plain text version.
 */
export function generateWelcomeEmailText(params: WelcomeEmailParams): string {
  const { baseUrl: rawBaseUrl, homeBeachName, homeBeachSlug } = params;
  const baseUrl = rawBaseUrl.trim();
  const hasHomeBeach = Boolean(homeBeachName && homeBeachSlug);

  const ctaHref = hasHomeBeach
    ? `${baseUrl}/beach/${encodeURIComponent(homeBeachSlug!)}?utm_source=email&utm_medium=welcome&utm_campaign=home_beach_set`
    : `${baseUrl}/?onboarding=required&utm_source=email&utm_medium=welcome&utm_campaign=no_home_beach`;

  const headline = hasHomeBeach
    ? `Your ${homeBeachName} forecast is dialed`
    : "Your forecast is live";

  const body = hasHomeBeach
    ? `You know that 5 a.m. moment — alarm goes off, still not sure if it's worth it. Quiver just tells you. Yes or no. Best window. That's it.\n\nEvery session you log sharpens the call.`
    : `One thing left — pick your home beach so we can dial the forecast to it.\n\nYou know that 5 a.m. moment — alarm goes off, still not sure if it's worth it. Once your home break is set, Quiver just tells you. Yes or no. Best window. That's it.`;

  const cta = hasHomeBeach
    ? `Check your ${homeBeachName} forecast: ${ctaHref}`
    : `Pick your home beach: ${ctaHref}`;

  return `
${headline}

${body}

${cta}

Every session you log levels you up and makes the forecast smarter.

— Steven
${baseUrl}
  `.trim();
}

export const WELCOME_EMAIL_SUBJECT = "Your forecast is live";
