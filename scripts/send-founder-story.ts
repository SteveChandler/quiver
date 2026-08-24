/**
 * Day-1 founder-story campaign send.
 *
 * Sends the founder-story email from the campaign playbook
 * (Brand-Vault/marketing/founding-crew-ltd-launch-playbook.md) to a warm
 * recipient list, with the attributed /app handoff link as the one CTA.
 *
 * DRY-RUN BY DEFAULT. Nothing sends without --send.
 *
 *   npx tsx scripts/send-founder-story.ts <recipients-file>            # preview
 *   npx tsx scripts/send-founder-story.ts <recipients-file> --send    # real send
 *   npx tsx scripts/send-founder-story.ts --test you@example.com --send
 *
 * Recipients file: one recipient per line, `email` or `email,First Name`.
 * KEEP IT OUTSIDE THE REPO — the campaign plan forbids committing personal
 * data. A receipts JSON is written next to it after every run (dry or real);
 * that file is the outreach tracker row source and the dedupe record for
 * recipients who are not Quiver users.
 *
 * Per recipient:
 * - suppression-list check (skip if suppressed)
 * - dedupe: users via email_send_log (email_type founder_story, once ever),
 *   non-users via the receipts file
 * - unique handoff_id + message_instance_id in the CTA link
 * - users get an email_send_log row so Resend webhook tracking matches;
 *   non-users are tracked in the receipts file only (email_send_log.user_id
 *   is NOT NULL, so non-users cannot be logged there)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { render } from "@react-email/render";
import { FounderStoryEmail } from "../lib/mailer/templates/FounderStoryEmail";

const CAMPAIGN = "founder_story_2026_08";
const EMAIL_TYPE = "founder_story";
const UTM_CONTENT = "day_1_founder_email";
const DEFAULT_SUBJECT = "Too many wasted drives.";
const SEND_GAP_MS = 650; // stay under Resend's 2 rps

interface Recipient {
  email: string;
  name: string | null;
}

interface Receipt {
  email: string;
  status: "sent" | "dry_run" | "skipped_suppressed" | "skipped_already_sent" | "skipped_entitled" | "send_failed";
  user_id: string | null;
  handoff_id: string | null;
  message_instance_id: string | null;
  resend_message_id: string | null;
  at: string;
}

/**
 * Deliberately short. `/app` generates its own handoff_id when none is given,
 * and resolveIosAppStoreCampaign maps utm_medium=email to the App Store
 * campaign token on its own — so the other seven params were dead weight that
 * made a personal letter read like bulk mail. Per-recipient click attribution
 * comes from the Resend webhook via resend_message_id, not from the URL.
 */
function buildCtaLink(baseUrl: string): string {
  const search = new URLSearchParams({
    utm_medium: "email",
    utm_campaign: CAMPAIGN,
  });
  return `${baseUrl}/app?${search.toString()}`;
}

/**
 * Plain-text twin of FounderStoryEmail. Kept in lockstep with the template by
 * hand — if the template copy changes, change this too. The canonical CTA
 * sentence appears here in full per the campaign playbook.
 */
function buildText(name: string | null, ctaLink: string): string {
  return [
    name ? `Hey ${name},` : "Hey,",
    "",
    "Too many wasted drives.",
    "",
    "The forecast said fair. The rating was green. I drove out anyway. Flat.",
    "",
    "I'd checked the cams, the maps, the buoys, the wind and the tide, and still couldn't answer the only question that mattered: is it working, and when do I go?",
    "",
    "Cams don't cover every break. And two spots ten minutes apart don't handle the same swell the same way.",
    "",
    "The data was all there. The feedback wasn't.",
    "",
    "I built Quiver because I wanted to make it simple.",
    "",
    "Quiver can already adjust a beach's forecast from what surfers report. That wiring is built and running. What it needs is reports, and right now there aren't enough. Chicken and egg: a break only gets sharper once enough people say what it actually did there.",
    "",
    "So when we get a beach wrong, tell us. Two places: rate the forecast when you log a session, or file a conditions report from the beach page. Every report is the next session at that break getting a better read.",
    "",
    "For the next two weeks I'm asking a small group of surfers to use Pro for one real surf decision.",
    "",
    "Start your free 14-day Quiver Pro trial and find the best window for your next surf:",
    ctaLink,
    "",
    "It's early, and it will still be wrong sometimes. That's exactly why I want real surfers on it. Reply and tell me where it helps or breaks. I read every one.",
    "",
    "— Steve",
    "quiversurf.app",
    "",
    "Reply \"no thanks\" and I'll leave you out of these.",
  ].join("\n");
}

function parseRecipients(path: string): Recipient[] {
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [email, ...nameParts] = line.split(",");
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@") || seen.has(normalized)) continue;
    seen.add(normalized);
    recipients.push({
      email: normalized,
      name: nameParts.join(",").trim() || null,
    });
  }
  return recipients;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const send = args.includes("--send");
  const testIdx = args.indexOf("--test");
  const subjectIdx = args.indexOf("--subject");
  const subject = subjectIdx >= 0 ? args[subjectIdx + 1] : DEFAULT_SUBJECT;

  let recipients: Recipient[];
  let receiptsPath: string;
  const isTest = testIdx >= 0;
  if (isTest) {
    recipients = [{ email: args[testIdx + 1].toLowerCase(), name: null }];
    receiptsPath = "/tmp/founder-story-test-receipts.json";
  } else {
    // Positional = anything that isn't a flag or a flag's value.
    const file = args.find(
      (a, i) =>
        !a.startsWith("--") &&
        (subjectIdx < 0 || i !== subjectIdx + 1) &&
        (testIdx < 0 || i !== testIdx + 1)
    );
    if (!file) {
      console.error("Usage: npx tsx scripts/send-founder-story.ts <recipients-file> [--send] [--subject \"...\"] | --test <email> [--send]");
      process.exit(1);
    }
    recipients = parseRecipients(file);
    receiptsPath = `${file}.receipts.json`;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const mailFrom = process.env.MAIL_FROM?.trim() || "Quiver <invites@send.quiversurf.app>";
  const mailReplyTo = process.env.MAIL_REPLY_TO?.trim() || mailFrom;
  const baseUrl = "https://www.quiversurf.app";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  );

  const priorReceipts: Receipt[] = existsSync(receiptsPath)
    ? JSON.parse(readFileSync(receiptsPath, "utf8"))
    : [];
  const previouslySent = new Set(
    priorReceipts.filter((r) => r.status === "sent").map((r) => r.email)
  );

  const emails = recipients.map((r) => r.email);
  const { data: suppressed } = await supabase
    .from("email_suppression_list")
    .select("email")
    .in("email", emails);
  const suppressedSet = new Set((suppressed ?? []).map((r) => r.email.toLowerCase()));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("email", emails);
  const userIdByEmail = new Map(
    (profiles ?? [])
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), p.id as string])
  );

  const userIds = Array.from(userIdByEmail.values());
  const alreadyLogged = new Set<string>();
  // Lifetime, promo, active paid, and prior-trial users must not get a
  // "start your free trial" ask. Any user_entitlements row disqualifies —
  // same rule as the trial-invitation cron.
  const entitled = new Set<string>();
  if (userIds.length > 0) {
    const { data: logs } = await supabase
      .from("email_send_log")
      .select("user_id")
      .eq("email_type", EMAIL_TYPE)
      .in("user_id", userIds);
    for (const row of logs ?? []) alreadyLogged.add(row.user_id as string);

    const { data: entitlements } = await supabase
      .from("user_entitlements")
      .select("user_id")
      .in("user_id", userIds);
    for (const row of entitlements ?? []) entitled.add(row.user_id as string);
  }

  const receipts: Receipt[] = [...priorReceipts];
  let sent = 0;
  console.log(`${send ? "SEND" : "DRY RUN"} — ${recipients.length} recipients, subject: "${subject}"\n`);

  for (const recipient of recipients) {
    const userId = userIdByEmail.get(recipient.email) ?? null;
    const stamp = new Date().toISOString();

    if (suppressedSet.has(recipient.email)) {
      console.log(`SKIP suppressed      ${recipient.email}`);
      receipts.push({ email: recipient.email, status: "skipped_suppressed", user_id: userId, handoff_id: null, message_instance_id: null, resend_message_id: null, at: stamp });
      continue;
    }
    // --test is a preview of the rendered email, not a campaign send — it
    // bypasses the entitlement and dedupe filters (suppression still applies).
    if (!isTest && userId && entitled.has(userId)) {
      console.log(`SKIP entitled        ${recipient.email} (lifetime/paid/prior-trial — no trial ask)`);
      receipts.push({ email: recipient.email, status: "skipped_entitled", user_id: userId, handoff_id: null, message_instance_id: null, resend_message_id: null, at: stamp });
      continue;
    }
    if (!isTest && (previouslySent.has(recipient.email) || (userId && alreadyLogged.has(userId)))) {
      console.log(`SKIP already sent    ${recipient.email}`);
      receipts.push({ email: recipient.email, status: "skipped_already_sent", user_id: userId, handoff_id: null, message_instance_id: null, resend_message_id: null, at: stamp });
      continue;
    }

    const handoffId = randomUUID();
    const messageInstanceId = randomUUID();
    const ctaLink = buildCtaLink(baseUrl);
    const text = buildText(recipient.name, ctaLink);
    const html = await render(
      FounderStoryEmail({ displayName: recipient.name, ctaUrl: ctaLink })
    );

    if (!send) {
      console.log(`DRY   would send     ${recipient.email}${userId ? " (user)" : ""}\n      ${ctaLink}`);
      receipts.push({ email: recipient.email, status: "dry_run", user_id: userId, handoff_id: handoffId, message_instance_id: messageInstanceId, resend_message_id: null, at: stamp });
      continue;
    }

    const { data, error } = await resend.emails.send({
      from: mailFrom,
      replyTo: mailReplyTo,
      to: recipient.email,
      subject,
      text,
      html,
    });

    if (error) {
      console.error(`FAIL  ${recipient.email}:`, error);
      receipts.push({ email: recipient.email, status: "send_failed", user_id: userId, handoff_id: handoffId, message_instance_id: messageInstanceId, resend_message_id: null, at: stamp });
      continue;
    }

    if (userId && !isTest) {
      const { error: logError } = await supabase.from("email_send_log").insert({
        user_id: userId,
        email_type: EMAIL_TYPE,
        subject,
        local_date: stamp.slice(0, 10),
        resend_message_id: data?.id ?? null,
        meta: { campaign: CAMPAIGN, handoff_id: handoffId, message_instance_id: messageInstanceId, utm_content: UTM_CONTENT },
      });
      if (logError) console.error(`WARN  log failed for ${recipient.email}:`, logError.message);
    }

    sent++;
    console.log(
      `SENT  ${recipient.email}` +
        (isTest
          ? " (test — not logged, still eligible for the real send)"
          : userId
            ? " (user, logged)"
            : " (non-user, receipt only)")
    );
    receipts.push({ email: recipient.email, status: "sent", user_id: userId, handoff_id: handoffId, message_instance_id: messageInstanceId, resend_message_id: data?.id ?? null, at: stamp });

    await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
  }

  writeFileSync(receiptsPath, JSON.stringify(receipts, null, 2));
  console.log(`\n${send ? `Sent ${sent}.` : "Dry run complete — nothing sent."} Receipts: ${receiptsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
