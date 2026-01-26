/**
 * Test script to send both email variants to a specific address.
 * Usage: npx tsx scripts/test-digest-emails.ts
 */

import "dotenv/config";
import { renderToStaticMarkup } from "react-dom/server";
import { resend, MAIL_FROM, MAIL_REPLY_TO } from "../lib/mailer/client";
import { ForecastDigestEmail } from "../lib/mailer/templates/ForecastDigestEmail";
import { ForecastQuickEmail } from "../lib/mailer/templates/ForecastQuickEmail";

const TEST_EMAIL = "stcha0004@gmail.com";

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quiver.fyi";

  console.log("Sending test emails to:", TEST_EMAIL);

  // 1. Send "Good Day" email
  const goodDayProps = {
    displayName: "Steve",
    beachName: "Malibu Surfrider",
    beachSlug: "malibu-surfrider",
    forecastDate: "Saturday, January 25",
    matchQuality: "excellent" as const,
    waveHeight: "3-5ft",
    wavePeriod: "14s",
    windSpeed: "5mph",
    windDirection: "NE (offshore)",
    tideStatus: "2.1ft, rising",
    whyText: [
      "Wave height matches your sweet spot (3-5ft)",
      "Clean offshore winds expected all morning",
      "Long period swell for quality waves",
    ],
    crowdWarning: null,
    bestWindow: {
      startTime: "6:30 AM",
      endTime: "10:15 AM",
    },
    ctaUrl: `${baseUrl}/beaches/malibu-surfrider`,
    unsubscribeUrl: `${baseUrl}/settings`,
  };

  try {
    const goodDayHtml = renderToStaticMarkup(ForecastDigestEmail(goodDayProps));
    const { data: goodData, error: goodError } = await resend.emails.send({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: TEST_EMAIL,
      subject: "✨ Malibu Surfrider: Excellent Conditions Today",
      html: goodDayHtml,
    });

    if (goodError) {
      console.error("❌ Good day email failed:", goodError);
    } else {
      console.log("✅ Good day email sent:", goodData?.id);
    }
  } catch (err) {
    console.error("❌ Good day email error:", err);
  }

  // 2. Send "Bad Day" email
  const badDayProps = {
    displayName: "Steve",
    beachName: "Malibu Surfrider",
    beachSlug: "malibu-surfrider",
    forecastDate: "Saturday, January 25",
    waveHeight: "1-2ft",
    windSpeed: "15mph",
    windDirection: "SW (onshore)",
    lookAheadText: "A solid swell is showing for Thursday. We'll let you know.",
    ctaUrl: `${baseUrl}/beaches/malibu-surfrider`,
    unsubscribeUrl: `${baseUrl}/settings`,
  };

  try {
    const badDayHtml = renderToStaticMarkup(ForecastQuickEmail(badDayProps));
    const { data: badData, error: badError } = await resend.emails.send({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: TEST_EMAIL,
      subject: "Malibu Surfrider: Not worth it today",
      html: badDayHtml,
    });

    if (badError) {
      console.error("❌ Bad day email failed:", badError);
    } else {
      console.log("✅ Bad day email sent:", badData?.id);
    }
  } catch (err) {
    console.error("❌ Bad day email error:", err);
  }

  console.log("\nDone! Check your inbox at", TEST_EMAIL);
}

main().catch(console.error);
