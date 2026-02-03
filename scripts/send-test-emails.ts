/**
 * Send test emails to verify email templates
 * Run with: npx tsx scripts/send-test-emails.ts <email>
 */

import { Resend } from "resend";
import { render } from "@react-email/render";
import { WeeklyRecapEmail } from "../lib/mailer/templates/WeeklyRecapEmail";
import { ForecastDigestEmail } from "../lib/mailer/templates/ForecastDigestEmail";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Use Resend's test domain for local testing
const MAIL_FROM = "Quiver Test <onboarding@resend.dev>";

async function sendTestEmails(toEmail: string) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not found in environment");
    process.exit(1);
  }

  const resend = new Resend(resendApiKey);

  console.log(`\nSending test emails to: ${toEmail}\n`);

  // 1. Forecast Digest Email
  console.log("1. Sending Forecast Digest email...");
  try {
    const digestHtml = await render(
      ForecastDigestEmail({
        displayName: "Steve",
        beachName: "Blacks Beach",
        beachSlug: "blacks-beach",
        forecastDate: "Monday, February 3",
        matchQuality: "excellent",
        waveHeight: "4-6ft",
        wavePeriod: "14s",
        windSpeed: "5mph",
        windDirection: "NW",
        tideStatus: "2.3ft, rising",
        whyText: "Clean offshore winds and solid SW swell make for excellent conditions.",
        crowdWarning: null,
        bestWindow: {
          startTime: "6:00 AM",
          endTime: "10:00 AM",
        },
        ctaUrl: "https://quiversurf.app/beaches/blacks-beach",
        unsubscribeUrl: "https://quiversurf.app/settings",
      })
    );
    const digestResult = await resend.emails.send({
      from: MAIL_FROM,
      to: toEmail,
      subject: "Blacks Beach: Excellent Conditions Today (TEST)",
      html: digestHtml,
    });
    console.log("   Forecast Digest sent:", JSON.stringify(digestResult));
  } catch (err) {
    console.error("   Failed:", err);
  }

  // 2. Weekly Recap Email
  console.log("2. Sending Weekly Recap email...");
  try {
    const recapHtml = await render(
      WeeklyRecapEmail({
        userName: "Steve",
        startDate: "Jan 27",
        endDate: "Feb 2",
        stats: {
          totalSessions: 4,
          totalHours: "6.5",
          topSpot: "Blacks Beach",
        },
        ctaUrl: "https://quiversurf.app/profile/analytics",
        unsubscribeUrl: "https://quiversurf.app/settings",
      })
    );
    const recapResult = await resend.emails.send({
      from: MAIL_FROM,
      to: toEmail,
      subject: "Your Week in the Water: 4 Sessions (TEST)",
      html: recapHtml,
    });
    console.log("   Weekly Recap sent:", recapResult.data?.id);
  } catch (err) {
    console.error("   Failed:", err);
  }

  console.log("\nDone! Check your inbox.\n");
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/send-test-emails.ts <email>");
  process.exit(1);
}

sendTestEmails(email);
