/**
 * Dev-only: render every campaign email to standalone HTML for visual review.
 * Writes to the path given as argv[2]. Sends nothing, touches no database.
 */
import { writeFileSync } from "node:fs";
import { render } from "@react-email/render";

import { generateWelcomeEmail } from "../lib/mailer/welcome-email";
import {
  generateTrialStartedEmail,
  generateTrialEndingEmail,
  generateTrialEndedEmail,
} from "../lib/mailer/trial-lifecycle-emails";
import { generateTrialInvitationEmail } from "../lib/mailer/trial-invitation-email";
import { FounderStoryEmail } from "../lib/mailer/templates/FounderStoryEmail";

const outDir = process.argv[2];
const common = {
  baseUrl: "https://www.quiversurf.app",
  displayName: "Kai",
  beachName: "Blacks Beach",
  beachSlug: "blacks-beach",
  unsubscribeUrl: "https://www.quiversurf.app/unsub",
  messageInstanceId: "preview",
};

async function main(): Promise<void> {
  const emails: { key: string; subject: string; html: string; text: string }[] = [];

  emails.push({
    key: "founder-story",
    subject: "The surf call I wanted did not exist",
    html: await render(
      FounderStoryEmail({
        displayName: common.displayName,
        ctaUrl:
          "https://www.quiversurf.app/app?utm_medium=email&utm_campaign=founder_story_2026_08",
      })
    ),
    text: "",
  });

  const welcome = generateWelcomeEmail({
    baseUrl: common.baseUrl,
    homeBeachName: common.beachName,
    homeBeachSlug: common.beachSlug,
    messageInstanceId: "preview",
  });
  emails.push({
    key: "welcome",
    subject: welcome.subject,
    html: await render(welcome.react),
    text: welcome.text,
  });

  const invitation = generateTrialInvitationEmail(common);
  emails.push({
    key: "trial-invitation",
    subject: invitation.subject,
    html: await render(invitation.react),
    text: invitation.text,
  });

  const started = generateTrialStartedEmail(common);
  emails.push({
    key: "trial-started",
    subject: started.subject,
    html: await render(started.react),
    text: started.text,
  });

  const ending = generateTrialEndingEmail({
    ...common,
    trialEndsOn: "Friday, September 4",
    chargeOn: "Friday, September 4",
    price: "$4.99/mo",
    manageUrl: "https://www.quiversurf.app/settings",
  });
  emails.push({
    key: "trial-ending",
    subject: ending.subject,
    html: await render(ending.react),
    text: ending.text,
  });

  const ended = generateTrialEndedEmail(common);
  emails.push({
    key: "trial-ended",
    subject: ended.subject,
    html: await render(ended.react),
    text: ended.text,
  });

  for (const email of emails) {
    writeFileSync(`${outDir}/${email.key}.html`, email.html);
  }
  writeFileSync(`${outDir}/emails.json`, JSON.stringify(emails, null, 2));
  console.log(`Rendered ${emails.length} emails to ${outDir}`);
  for (const e of emails) console.log(`  ${e.key}: "${e.subject}"`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
