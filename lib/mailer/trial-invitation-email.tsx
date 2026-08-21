import * as React from "react";

import { buildAppEmailLink } from "@/lib/mailer/email-links";
import { TrialInvitationEmail } from "@/lib/mailer/templates/TrialInvitationEmail";
import type {
  CommonInput,
  GeneratedTrialEmail,
} from "@/lib/mailer/trial-lifecycle-emails";

// No beachSlug: the CTA must go through the /app handoff (App Store campaign
// attribution), never a beach page.
export function generateTrialInvitationEmail(
  input: Omit<CommonInput, "beachSlug">
): GeneratedTrialEmail {
  const spot = input.beachName ?? "your home break";
  const subject = input.beachName
    ? `Two weeks of Pro at ${input.beachName}. Free.`
    : "Two weeks of Pro. Free.";
  const ctaUrl = buildAppEmailLink({
    origin: input.baseUrl,
    emailType: "trial_invitation",
    source: "trial_invitation_email",
    utmCampaign: "trial_invitation",
    messageInstanceId: input.messageInstanceId,
  });

  const react = React.createElement(TrialInvitationEmail, {
    displayName: input.displayName,
    beachName: input.beachName,
    ctaUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  const text = [
    "Two weeks of the Pro. Free.",
    "",
    input.displayName ? `Hey ${input.displayName},` : "Hey,",
    "",
    `You've got ${spot} set as your home break. The free forecast gives you the data. That stays free either way.`,
    "",
    `Pro adds the call layer on top: the surf-call verdict for ${spot}, how the window matches sessions you've logged, board picks from your quiver, and alerts that find the window before it arrives. Two breaks ten minutes apart don't handle the same swell the same way. The call layer is where that shows up.`,
    "",
    "$4.99/mo or $39.99/yr after the trial. The first charge comes only after the full 14 days. Cancel any time before then and you aren't charged.",
    "",
    "Start your free 14-day Quiver Pro trial and find the best window for your next surf:",
    ctaUrl,
    "",
    "— Steve",
    "quiversurf.app",
  ].join("\n");

  return { subject, react, text };
}
