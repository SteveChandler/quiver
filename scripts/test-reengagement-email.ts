/**
 * Test script to send a re-engagement email with real data.
 *
 * Usage: npx tsx scripts/test-reengagement-email.ts
 *
 * Requires RESEND_API_KEY environment variable.
 */

import "dotenv/config";
import { Resend } from "resend";
import { ReengagementEmail } from "../lib/mailer/templates/ReengagementEmail";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY environment variable is required");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// Real data from Scripps today (2026-02-02)
const testData = {
  displayName: "Steve",
  beachName: "Scripps",
  beachSlug: "scripps",
  conditionsScore: 10, // 0-10 scale, will display as 100
  surfDescription: "Overhead",
  windDescription: "light onshore",
  bestWindow: {
    start: "6:00 AM",
    end: "9:00 AM",
  },
  recentIntel: [
    {
      tag: "conditions",
      description: "Scripps waking up to 2-5ft faces with 15-second period. Light SE winds holding through mid-morning.",
    },
  ],
  ctaUrl: "https://quiversurf.app/beaches/scripps",
  unsubscribeUrl: "https://quiversurf.app/settings",
};

async function main() {
  const testEmail = "stcha0004@gmail.com";
  const subject = `Perfect conditions at ${testData.beachName} today!`;

  console.log(`Sending test re-engagement email to ${testEmail}...`);
  console.log(`Subject: ${subject}`);
  console.log(`Data:`, JSON.stringify(testData, null, 2));

  try {
    const result = await resend.emails.send({
      from: process.env.MAIL_FROM || "Quiver <invites@send.quiversurf.app>",
      replyTo: process.env.MAIL_REPLY_TO || "Quiver <invites@send.quiversurf.app>",
      to: testEmail,
      subject,
      react: ReengagementEmail(testData),
    });

    console.log("✅ Email sent successfully!");
    console.log("Result:", result);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    process.exit(1);
  }
}

main();
