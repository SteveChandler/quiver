/**
 * Send any email template to one address with representative sample data.
 *
 * Preview only. It takes a single explicit recipient and can never read a
 * recipient list, so there is no way to blast with it — that is the safety
 * model, which is why it has no --send flag.
 *
 * It writes nothing to email_send_log and respects no suppression list, so a
 * preview never dedupes you out of a real campaign send.
 *
 *   npx tsx scripts/send-template-preview.ts weekly-recap you@example.com
 *   npx tsx scripts/send-template-preview.ts --list
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";

import { WeeklyRecapEmail } from "../lib/mailer/templates/WeeklyRecapEmail";
import { SessionPromptEmail } from "../lib/mailer/templates/SessionPromptEmail";
import { FirstSessionNudgeEmail } from "../lib/mailer/templates/FirstSessionNudgeEmail";
import { PersonalizedNudgeEmail } from "../lib/mailer/templates/PersonalizedNudgeEmail";
import { CheckInEmail } from "../lib/mailer/templates/CheckInEmail";
import { FounderStoryEmail } from "../lib/mailer/templates/FounderStoryEmail";
import { generateWelcomeEmail } from "../lib/mailer/welcome-email";
import {
  generateTrialStartedEmail,
  generateTrialEndingEmail,
  generateTrialEndedEmail,
} from "../lib/mailer/trial-lifecycle-emails";
import { generateTrialInvitationEmail } from "../lib/mailer/trial-invitation-email";

const BASE = "https://www.quiversurf.app";
const UNSUB = `${BASE}/settings`;

const COMMON = {
  baseUrl: BASE,
  displayName: "Steven",
  beachName: "Blacks Beach",
  beachSlug: "blacks-beach",
  unsubscribeUrl: UNSUB,
  messageInstanceId: "preview",
};

interface Preview {
  subject: string;
  react: React.ReactElement;
}

const TEMPLATES: Record<string, () => Preview> = {
  "weekly-recap": () => ({
    subject: "Your week in the water: 3 sessions",
    react: React.createElement(WeeklyRecapEmail, {
      userName: "Steven",
      startDate: "Aug 16",
      endDate: "Aug 22",
      stats: { totalSessions: 3, totalHours: "4.5", topSpot: "Blacks Beach" },
      ctaUrl: `${BASE}/profile/analytics`,
      unsubscribeUrl: UNSUB,
      bestDays: [
        { beach_name: "Blacks Beach", score: 8.4, label: "GOOD", weekday: "Thursday", time: "6am" },
        { beach_name: "Windansea", score: 7.1, label: "FAIR", weekday: "Saturday", time: "7am" },
        { beach_name: "Tourmaline", score: 6.3, label: "RIDEABLE", weekday: "Sunday", time: "6am" },
      ],
      topSpotImageUrl: null,
    }),
  }),
  "session-prompt": () => ({
    subject: "How was your session at Blacks Beach?",
    react: React.createElement(SessionPromptEmail, {
      displayName: "Steven",
      beachName: "Blacks Beach",
      conditionsScore: 78,
      surfDescription: "Chest-high peeling rights",
      appSessionUrl: `${BASE}/sessions/new`,
      confirmUrl: `${BASE}/sessions/new`,
      skipUrl: `${BASE}/sessions/new`,
      unsubscribeUrl: UNSUB,
    }),
  }),
  "first-session-nudge": () => ({
    subject: "Your first forecast is waiting",
    react: React.createElement(FirstSessionNudgeEmail, {
      displayName: "Steven",
      logSessionUrl: `${BASE}/sessions/new`,
      unsubscribeUrl: UNSUB,
    }),
  }),
  "personalized-nudge": () => ({
    subject: "Blacks Beach — conditions are looking good",
    react: React.createElement(PersonalizedNudgeEmail, {
      displayName: "Steven",
      beachName: "Blacks Beach",
      conditionsScore: 78,
      surfDescription: "Chest-high peeling rights",
      windDescription: "Light offshore",
      bestWindow: { start: "7:00 AM", end: "10:00 AM" },
      ctaUrl: `${BASE}/app/spot/blacks-beach`,
      logSessionUrl: `${BASE}/sessions/new`,
      unsubscribeUrl: UNSUB,
    }),
  }),
  "check-in": () => ({
    subject: "How's your Quiver experience so far?",
    react: React.createElement(CheckInEmail, { displayName: "Steven" }),
  }),
  "founder-story": () => ({
    subject: "Too many wasted drives.",
    react: React.createElement(FounderStoryEmail, {
      displayName: "Steven",
      ctaUrl: `${BASE}/app?utm_medium=email&utm_campaign=preview`,
    }),
  }),
  welcome: () => {
    const e = generateWelcomeEmail({
      baseUrl: BASE,
      homeBeachName: "Blacks Beach",
      homeBeachSlug: "blacks-beach",
      messageInstanceId: "preview",
    });
    return { subject: e.subject, react: e.react };
  },
  "trial-invitation": () => {
    const e = generateTrialInvitationEmail(COMMON);
    return { subject: e.subject, react: e.react };
  },
  "trial-started": () => {
    const e = generateTrialStartedEmail(COMMON);
    return { subject: e.subject, react: e.react };
  },
  "trial-ending": () => {
    const e = generateTrialEndingEmail({
      ...COMMON,
      trialEndsOn: "Friday, September 4",
      chargeOn: "Friday, September 4",
      price: "$4.99/mo",
      manageUrl: `${BASE}/settings`,
    });
    return { subject: e.subject, react: e.react };
  },
  "trial-ended": () => {
    const e = generateTrialEndedEmail(COMMON);
    return { subject: e.subject, react: e.react };
  },
};

async function main(): Promise<void> {
  const [name, to] = process.argv.slice(2);
  if (name === "--list" || !name) {
    console.log("templates:\n  " + Object.keys(TEMPLATES).sort().join("\n  "));
    console.log("\nusage: npx tsx scripts/send-template-preview.ts <template> <email>");
    process.exit(name === "--list" ? 0 : 1);
  }
  const make = TEMPLATES[name];
  if (!make) {
    console.error(`unknown template "${name}". Run --list to see them.`);
    process.exit(1);
  }
  if (!to || !to.includes("@")) {
    console.error("second argument must be a single email address");
    process.exit(1);
  }

  const { subject, react } = make();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.MAIL_FROM?.trim() || "Quiver <invites@send.quiversurf.app>";

  const { data, error } = await resend.emails.send({
    from,
    replyTo: process.env.MAIL_REPLY_TO?.trim() || from,
    to,
    subject: `[preview] ${subject}`,
    react,
    html: await render(react),
  });

  if (error) {
    console.error("send failed:", error);
    process.exit(1);
  }
  console.log(`sent "${name}" to ${to}`);
  console.log(`  subject: [preview] ${subject}`);
  console.log(`  resend id: ${data?.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
