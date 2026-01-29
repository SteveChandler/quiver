/**
 * Send test emails to verify email templates
 * Run with: npx tsx scripts/send-test-emails.ts <email>
 */

import { Resend } from "resend";
import { render } from "@react-email/render";
import { WeekendOutlookEmail } from "../lib/mailer/templates/WeekendOutlookEmail";
import { WeeklyRecapEmail } from "../lib/mailer/templates/WeeklyRecapEmail";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Use Resend's test domain for local testing
const MAIL_FROM = "Quiver Test <onboarding@resend.dev>";

async function sendTestEmails(toEmail: string) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("❌ RESEND_API_KEY not found in environment");
    process.exit(1);
  }

  const resend = new Resend(resendApiKey);

  console.log(`\n📧 Sending test emails to: ${toEmail}\n`);

  // 1. Weekend Outlook Email
  console.log("1️⃣ Sending Weekend Outlook email...");
  try {
    const weekendHtml = await render(
      WeekendOutlookEmail({
        userName: "Steve",
        spotName: "Blacks Beach",
        forecasts: [
          {
            dayName: "Friday",
            date: "Jan 24",
            condition: "Good",
            waveHeight: "4-6ft",
            wind: "5mph NW",
            bestWindow: "6am - 10am",
          },
          {
            dayName: "Saturday",
            date: "Jan 25",
            condition: "Fair",
            waveHeight: "3-4ft",
            wind: "8mph W",
            bestWindow: "7am - 9am",
          },
          {
            dayName: "Sunday",
            date: "Jan 26",
            condition: "Poor",
            waveHeight: "2-3ft",
            wind: "12mph SW",
            bestWindow: "Skip it",
          },
        ],
        ctaUrl: "https://quiver.fyi/beaches/blacks-beach",
        unsubscribeUrl: "https://quiver.fyi/settings",
      })
    );
    const weekendResult = await resend.emails.send({
      from: MAIL_FROM,
      to: toEmail,
      subject: "🌊 Weekend Outlook: Blacks Beach (TEST)",
      html: weekendHtml,
    });
    console.log("   ✅ Weekend Outlook sent:", JSON.stringify(weekendResult));
  } catch (err) {
    console.error("   ❌ Failed:", err);
  }

  // 2. Weekly Recap Email
  console.log("2️⃣ Sending Weekly Recap email...");
  try {
    const recapHtml = await render(
      WeeklyRecapEmail({
        userName: "Steve",
        startDate: "Jan 19",
        endDate: "Jan 25",
        stats: {
          totalSessions: 4,
          totalHours: "6.5",
          topSpot: "Blacks Beach",
        },
        ctaUrl: "https://quiver.fyi/profile/analytics",
        unsubscribeUrl: "https://quiver.fyi/settings",
      })
    );
    const recapResult = await resend.emails.send({
      from: MAIL_FROM,
      to: toEmail,
      subject: "Your Week in the Water: 4 Sessions (TEST)",
      html: recapHtml,
    });
    console.log("   ✅ Weekly Recap sent:", recapResult.data?.id);
  } catch (err) {
    console.error("   ❌ Failed:", err);
  }

  console.log("\n✨ Done! Check your inbox.\n");
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/send-test-emails.ts <email>");
  process.exit(1);
}

sendTestEmails(email);
