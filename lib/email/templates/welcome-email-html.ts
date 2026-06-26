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
 * - When home beach is set: app-first "Check your {beach} forecast →"
 * - When home beach is unset: "Pick your home beach →" uses the app-first
 *   `/app` handoff path with onboarding intent preserved in query params.
 */

import {
  buildAppEmailLink,
  buildBeachEmailLink,
} from "@/lib/mailer/email-links";

export interface WelcomeEmailParams {
  baseUrl: string;
  /** Home beach display name; when present, the CTA deep-links to the
   *  beach detail page. When absent, the CTA nudges the user to the
   *  onboarding dialog. */
  homeBeachName?: string | null;
  /** Home beach slug for the app-first `/app/spot/{slug}` CTA. */
  homeBeachSlug?: string | null;
  messageInstanceId: string;
}

const COLORS = {
  primary: "#F78E42", // Charming Orange — hits the brand accent, contrasts with the Twilight Navy header
  text: "#1a1a1a",
  textSecondary: "#555555",
  textTertiary: "#888888",
  heading: "#252D6B", // Twilight Navy
  border: "#eeeeee",
} as const;

// Brand fonts per quiver/CLAUDE.md: Space Grotesk (headings) + DM Sans (body).
// Imported via Google Fonts for Gmail/Apple Mail; Outlook and stripped clients
// fall back through the stack to system sans. `Arial` is listed before the
// generic `sans-serif` keyword so Outlook/Word's renderer — which can fall
// to Times New Roman when it fails to resolve earlier entries — always lands
// on a sans face, never a serif or Comic Sans.
const FONT_FAMILY =
  "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
const HEADING_FONT_FAMILY =
  "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

// Dark ink on the orange button. The brand Twilight Navy clears WCAG AA
// against #F78E42 and reads as deliberate brand contrast, not the default
// white-on-orange every SaaS ships.
const BUTTON_TEXT_COLOR = COLORS.heading; // #252D6B Twilight Navy

const PRIMARY_BUTTON_LINK_STYLE = `
  display: inline-block;
  padding: 15px 30px;
  color: ${BUTTON_TEXT_COLOR};
  text-decoration: none;
  font-family: ${HEADING_FONT_FAMILY};
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.01em;
  line-height: 1;
`.trim();

/**
 * Bulletproof, email-client-safe primary button. Uses a <table> + `bgcolor`
 * so Outlook (Word renderer — ignores `background`/`border-radius` on inline
 * <a>) still paints the orange fill; the rounded corners and padding degrade
 * gracefully there. The href + label come from the variant logic so there's a
 * single strong activation CTA per case.
 */
function renderPrimaryButton(href: string, label: string): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 8px 0 28px;">
    <tr>
      <td align="center" bgcolor="${COLORS.primary}" style="border-radius: 10px; background-color: ${COLORS.primary};">
        <a href="${href}" style="${PRIMARY_BUTTON_LINK_STYLE}">${label}</a>
      </td>
    </tr>
  </table>`.trim();
}

/**
 * Generates the welcome email HTML.
 *
 * Pure string generator. URL construction stays in shared email-link helpers so
 * app-first attribution remains consistent across templates.
 */
export function generateWelcomeEmailHtml(params: WelcomeEmailParams): string {
  const { baseUrl: rawBaseUrl, homeBeachName, homeBeachSlug, messageInstanceId } = params;
  const baseUrl = rawBaseUrl.trim();

  const hasHomeBeach = Boolean(homeBeachName && homeBeachSlug);

  // Variant-specific copy. Both paths lead with a single clear CTA;
  // neither asks for preferences. Variant markers flow into UTM tags so
  // the /app-stats email dashboard can attribute future clicks.
  const ctaHref = homeBeachName && homeBeachSlug
    ? buildBeachEmailLink({
        origin: baseUrl,
        beachSlug: homeBeachSlug,
        emailType: "welcome",
        messageInstanceId,
        source: "welcome_email",
        utmCampaign: "home_beach_set",
      })
    : buildAppEmailLink({
        origin: baseUrl,
        emailType: "welcome",
        messageInstanceId,
        source: "welcome_email",
        utmCampaign: "no_home_beach",
        params: {
          onboarding: "required",
        },
      });

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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=DM+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
</head>
<body style="font-family: ${FONT_FAMILY}; max-width: 560px; margin: 0 auto; padding: 24px; color: ${COLORS.text}; background: #ffffff;">
  <!-- Handwritten pre-header in Caveat (listed in .impeccable.md as a
       brand accent font). Loaded via the Google Fonts <link> above so
       clients that support webfonts render Caveat; clients that don't
       fall through to Space Grotesk — never Comic Sans. -->
  <p style="font-family: 'Caveat', ${HEADING_FONT_FAMILY}; font-weight: 700; font-size: 22px; line-height: 1; color: ${COLORS.primary}; margin: 0 0 20px; transform: rotate(-0.5deg); display: inline-block;">
    From the crew at quiversurf.app —
  </p>
  <p style="font-family: ${HEADING_FONT_FAMILY}; font-size: 24px; line-height: 1.25; color: ${COLORS.heading}; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 12px;">
    ${headline}
  </p>

  <p style="font-size: 16px; line-height: 1.55; color: ${COLORS.text}; margin: 0 0 24px;">
    ${body}
  </p>

  ${renderPrimaryButton(ctaHref, ctaLabel)}

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
  const { baseUrl: rawBaseUrl, homeBeachName, homeBeachSlug, messageInstanceId } = params;
  const baseUrl = rawBaseUrl.trim();
  const hasHomeBeach = Boolean(homeBeachName && homeBeachSlug);

  const ctaHref = homeBeachName && homeBeachSlug
    ? buildBeachEmailLink({
        origin: baseUrl,
        beachSlug: homeBeachSlug,
        emailType: "welcome",
        messageInstanceId,
        source: "welcome_email",
        utmCampaign: "home_beach_set",
      })
    : buildAppEmailLink({
        origin: baseUrl,
        emailType: "welcome",
        messageInstanceId,
        source: "welcome_email",
        utmCampaign: "no_home_beach",
        params: {
          onboarding: "required",
        },
      });

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
From the crew at quiversurf.app —

${headline}

${body}

${cta}

Every session you log levels you up and makes the forecast smarter.

— Steven
${baseUrl}
  `.trim();
}

export const WELCOME_EMAIL_SUBJECT = "Your forecast is live";
