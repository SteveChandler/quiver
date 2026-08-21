import * as React from "react";

import {
  buildAppEmailLink,
  buildBeachEmailLink,
} from "@/lib/mailer/email-links";
import { WelcomeEmail } from "@/lib/mailer/templates/WelcomeEmail";

export const WELCOME_EMAIL_SUBJECT = "Your forecast is live";

export interface GenerateWelcomeEmailInput {
  baseUrl: string;
  homeBeachName?: string | null;
  homeBeachSlug?: string | null;
  messageInstanceId: string;
}

export interface GeneratedWelcomeEmail {
  subject: typeof WELCOME_EMAIL_SUBJECT;
  react: React.ReactElement;
  text: string;
}

interface WelcomeContent {
  headline: string;
  bodyParagraphs: readonly string[];
  ctaHref: string;
  ctaLabel: string;
}

function deriveWelcomeContent({
  baseUrl,
  homeBeachName,
  homeBeachSlug,
  messageInstanceId,
}: GenerateWelcomeEmailInput): WelcomeContent {
  if (homeBeachName && homeBeachSlug) {
    return {
      headline: `Your ${homeBeachName} forecast is dialed`,
      bodyParagraphs: [
        "You know that 5 a.m. moment — alarm goes off, still not sure if it's worth the drive. Quiver lays out the window: size, wind, tide, and the red flags, so you can make your own call in about ten seconds.",
        "Log what you actually get, and every new call has your own days to compare against.",
      ],
      ctaHref: buildBeachEmailLink({
        origin: baseUrl,
        beachSlug: homeBeachSlug,
        emailType: "welcome",
        messageInstanceId,
        source: "welcome_email",
        utmCampaign: "home_beach_set",
      }),
      ctaLabel: `Check your ${homeBeachName} forecast →`,
    };
  }

  return {
    headline: "Your forecast is live",
    bodyParagraphs: [
      "One thing left — pick your home beach so we can dial the forecast to it.",
      "You know that 5 a.m. moment — alarm goes off, still not sure if it's worth the drive. Once your home break is set, Quiver lays out the window: size, wind, tide, and the red flags, so you can make your own call in about ten seconds.",
    ],
    ctaHref: buildAppEmailLink({
      origin: baseUrl,
      emailType: "welcome",
      messageInstanceId,
      source: "welcome_email",
      utmCampaign: "no_home_beach",
      params: {
        onboarding: "required",
      },
    }),
    ctaLabel: "Pick your home beach →",
  };
}

function generateWelcomeEmailText(content: WelcomeContent): string {
  const body = content.bodyParagraphs.join("\n\n");
  const ctaLabel = content.ctaLabel.replace(/\s*→$/, "");

  return [
    "From the crew at quiversurf.app —",
    "",
    content.headline,
    "",
    body,
    "",
    `${ctaLabel}: ${content.ctaHref}`,
    "",
    "Every session you log becomes a day you can compare the next call against.",
    "",
    "— Steven",
    "quiversurf.app",
  ].join("\n");
}

export function generateWelcomeEmail(
  input: GenerateWelcomeEmailInput
): GeneratedWelcomeEmail {
  const content = deriveWelcomeContent({
    ...input,
    baseUrl: input.baseUrl.trim(),
  });

  return {
    subject: WELCOME_EMAIL_SUBJECT,
    react: React.createElement(WelcomeEmail, content),
    text: generateWelcomeEmailText(content),
  };
}
