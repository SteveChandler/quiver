import * as React from "react";

import { buildAppEmailLink, buildBeachEmailLink } from "@/lib/mailer/email-links";
import { TrialEndedEmail } from "@/lib/mailer/templates/TrialEndedEmail";
import { TrialEndingEmail } from "@/lib/mailer/templates/TrialEndingEmail";
import { TrialStartedEmail } from "@/lib/mailer/templates/TrialStartedEmail";

/**
 * Trial-lifecycle email content. Kept separate from the cron route so the copy,
 * subjects, and link shapes are unit-testable without a Supabase or Resend stub.
 *
 * Stage copy is canon-bound: `Brand-Vault/marketing/email-campaign-trial-loop.md`
 * (stages 4, 6, 7). Read that before changing a subject or a CTA.
 */

export type TrialEmailStage = "trial_started" | "trial_ending" | "trial_ended";

export interface GeneratedTrialEmail {
  subject: string;
  react: React.ReactElement;
  text: string;
}

export interface CommonInput {
  baseUrl: string;
  displayName: string | null;
  beachName: string | null;
  beachSlug: string | null;
  unsubscribeUrl: string;
  messageInstanceId: string;
}

/**
 * Formats a trial boundary for a human, in the user's own timezone when we
 * know it. A charge-date email that names the wrong day is worse than no
 * email, so an unknown/invalid timezone falls back to UTC rather than to the
 * server's local zone.
 */
export function formatTrialDate(
  iso: string,
  timezone: string | null
): string {
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };

  if (timezone) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        ...options,
        timeZone: timezone,
      }).format(date);
    } catch {
      // Fall through to UTC — an invalid tz string must not throw mid-send.
    }
  }

  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

function beachOrAppLink(
  input: CommonInput,
  stage: TrialEmailStage,
  params?: Record<string, string | undefined>
): string {
  const shared = {
    origin: input.baseUrl,
    emailType: stage,
    messageInstanceId: input.messageInstanceId,
    source: `${stage}_email`,
    utmCampaign: stage,
  };

  if (input.beachSlug) {
    return buildBeachEmailLink({ ...shared, beachSlug: input.beachSlug });
  }
  return buildAppEmailLink({ ...shared, params });
}

export function generateTrialStartedEmail(
  input: CommonInput
): GeneratedTrialEmail {
  const spot = input.beachName ?? "your home break";
  const subject = `Your first Pro call at ${spot}`;
  const ctaUrl = beachOrAppLink(input, "trial_started");

  const react = React.createElement(TrialStartedEmail, {
    displayName: input.displayName,
    beachName: input.beachName,
    ctaUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  const text = [
    "You're on Pro.",
    "",
    input.displayName ? `Hey ${input.displayName},` : "Hey,",
    "here's the one thing worth doing today.",
    "",
    `Open ${spot} and read the call: the verdict, why it landed there, and the red flags underneath it. That's the part you're trialling, and it's the part I most want you to argue with.`,
    "",
    "Other apps charge for the forecast. Ours is free. Pro is the part that reads it beach by beach, because two breaks ten minutes apart don't handle the same swell the same way. That's what to judge over the next two weeks.",
    "",
    `See your Pro call for ${spot}: ${ctaUrl}`,
    "",
    "TWO THINGS WORTH SETTING UP",
    "",
    "Alerts on any beach. Free gives you your home break. Pro lets you watch every spot you might actually drive to, so the window finds you instead of the other way around.",
    "",
    "Custom spots. Drop a pin on the break that isn't in the catalog. Those are free, but they are what make the calls yours.",
    "",
    "If the call looks wrong to you, reply and tell me. That's more useful to me than a five-star review.",
    "",
    "— Steve",
    "quiversurf.app",
  ].join("\n");

  return { subject, react, text };
}

export interface TrialEndingInput extends CommonInput {
  trialEndsOn: string;
  chargeOn: string;
  price: string;
  manageUrl: string;
}

export function generateTrialEndingEmail(
  input: TrialEndingInput
): GeneratedTrialEmail {
  const subject = `Your trial ends ${input.trialEndsOn}`;

  const react = React.createElement(TrialEndingEmail, {
    displayName: input.displayName,
    trialEndsOn: input.trialEndsOn,
    chargeOn: input.chargeOn,
    price: input.price,
    manageUrl: input.manageUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  const text = [
    `Your trial ends ${input.trialEndsOn}.`,
    "",
    input.displayName ? `Hey ${input.displayName},` : "Hey,",
    "straight up, so nothing surprises you:",
    "",
    `Your Quiver Pro trial ends ${input.trialEndsOn}, and ${input.price} is charged on ${input.chargeOn} unless you cancel before then. Cancelling takes about fifteen seconds in your App Store subscription settings.`,
    "",
    "If it's been useful, there's nothing to do.",
    "",
    "If you cancel, you keep the full forecast for every beach. What goes back to the free tier is the call layer: two ranked spots instead of all of them, and two days of the week instead of seven.",

    "",
    `Manage your subscription: ${input.manageUrl}`,
    "",
    "— Steve",
    "quiversurf.app",
  ].join("\n");

  return { subject, react, text };
}

export function generateTrialEndedEmail(
  input: CommonInput
): GeneratedTrialEmail {
  const spot = input.beachName ?? "your home break";
  const subject = "What would make it worth it?";

  const react = React.createElement(TrialEndedEmail, {
    displayName: input.displayName,
    beachName: input.beachName,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  const text = [
    "What would make it worth it?",
    "",
    input.displayName ? `Hey ${input.displayName},` : "Hey,",
    "your trial ended and you didn't stay on Pro. That's a useful signal, and I'd like the detail behind it.",
    "",
    "What would Quiver need to get right for you to keep it?",
    "",
    "Just hit reply. One sentence is plenty.",
    "",
    `The forecast for ${spot} stays exactly as it was, and your session log is untouched. Both were always free.`,
    "",
    "— Steve",
    "quiversurf.app",
  ].join("\n");

  return { subject, react, text };
}
