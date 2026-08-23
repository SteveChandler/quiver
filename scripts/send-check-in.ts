/**
 * First-90-days check-in send.
 *
 * One question to everyone who signed up in the last 90 days: is Quiver useful,
 * and if not, what stopped you. The action is a REPLY, not a click, so this
 * email carries no CTA and no trial ask. Mixing the campaign CTA in here would
 * break the one-job-per-asset rule in
 * `Brand-Vault/marketing/quiver-founder-execution-system.md`.
 *
 * Deliberately different from send-founder-story.ts in three ways:
 * - No entitlement exclusion. Nothing is being sold, so paid and lifetime
 *   surfers are exactly the people whose answers matter most.
 * - Plain text only. A designed newsletter gets archived; a plain note gets
 *   replies, and replies are the entire point.
 * - Dedup lives in the receipts file, not email_send_log. Adding a
 *   `first_90_checkin` email type would need another constraint migration, and
 *   this is a one-off blast with no links to track.
 *
 * DRY-RUN BY DEFAULT. Nothing sends without --send.
 *
 *   npx tsx scripts/send-check-in.ts <recipients-file>           # preview
 *   npx tsx scripts/send-check-in.ts <recipients-file> --send    # real send
 *   npx tsx scripts/send-check-in.ts --test you@example.com --send
 *
 * Recipients file: `email,firstName,homeBeach` per line. KEEP IT OUTSIDE THE
 * REPO — the growth plan forbids committing personal data. A receipts JSON is
 * written beside it on every run and is both the outreach-tracker source and
 * the dedup record.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { render } from "@react-email/render";
import { CheckInEmail } from "../lib/mailer/templates/CheckInEmail";

const CAMPAIGN = "first_90_days_checkin_2026_08";
const DEFAULT_SUBJECT = "How's your Quiver experience so far?";
const SEND_GAP_MS = 700; // under Resend's 2 rps, with headroom

interface Recipient {
  email: string;
  name: string | null;
}

interface Receipt {
  email: string;
  status: "sent" | "dry_run" | "skipped_suppressed" | "skipped_already_sent" | "send_failed";
  resend_message_id: string | null;
  at: string;
}

/**
 * Plain-text twin of CheckInEmail. Kept in lockstep by hand — if the template
 * copy changes, change this too.
 *
 * A warm check-in, not a self-critique. The numbered options carry most of the
 * reply rate: someone who would never write a paragraph will still send a digit.
 *
 * "a little while" rather than a stated tenure, because the list spans one to
 * ninety days and only 70 of 125 ever set a home beach. The copy cannot assume
 * either without misfiring on half the list.
 */
function buildText(name: string | null): string {
  return [
    name ? `Hey ${name},` : "Hey,",
    "",
    "You've been using Quiver for a little while now, so I wanted to check in.",
    "",
    "How's your experience so far?",
    "",
    "  1. Good. I check it before I surf.",
    "  2. Okay. Still figuring it out.",
    "  3. Honestly, I haven't really used it.",
    "",
    "Just hit reply with the number. If you've got a sentence about what would make it better, even better. I read every one.",
    "",
    "Thanks for being here this early. It makes a real difference.",
    "",
    "- Steve",
    "quiversurf.app",
    "",
    "If you'd rather not hear from me, reply \"no thanks\" and I'll leave you out.",
  ].join("\n");
}

function parseRecipients(path: string): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [email, first] = line.split(",");
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@") || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ email: normalized, name: (first ?? "").trim() || null });
  }
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const send = args.includes("--send");
  const testIdx = args.indexOf("--test");
  const subjectIdx = args.indexOf("--subject");
  const subject = subjectIdx >= 0 ? args[subjectIdx + 1] : DEFAULT_SUBJECT;
  const isTest = testIdx >= 0;

  let recipients: Recipient[];
  let receiptsPath: string;
  if (isTest) {
    recipients = [{ email: args[testIdx + 1].toLowerCase(), name: null }];
    receiptsPath = "/tmp/checkin-test-receipts.json";
  } else {
    const file = args.find(
      (a, i) =>
        !a.startsWith("--") &&
        (subjectIdx < 0 || i !== subjectIdx + 1) &&
        (testIdx < 0 || i !== testIdx + 1)
    );
    if (!file) {
      console.error('Usage: npx tsx scripts/send-check-in.ts <recipients-file> [--send] [--subject "..."] | --test <email> [--send]');
      process.exit(1);
    }
    recipients = parseRecipients(file);
    receiptsPath = `${file}.receipts.json`;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const mailFrom = process.env.MAIL_FROM?.trim() || "Quiver <invites@send.quiversurf.app>";
  const mailReplyTo = process.env.MAIL_REPLY_TO?.trim() || mailFrom;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  );

  const prior: Receipt[] = existsSync(receiptsPath)
    ? JSON.parse(readFileSync(receiptsPath, "utf8"))
    : [];
  const alreadySent = new Set(prior.filter((r) => r.status === "sent").map((r) => r.email));

  // Re-check suppression at send time even though the list builder filtered:
  // a bounce or complaint may have landed since the list was generated.
  const { data: suppressed } = await supabase
    .from("email_suppression_list")
    .select("email")
    .in("email", recipients.map((r) => r.email));
  const supSet = new Set((suppressed ?? []).map((r) => r.email.toLowerCase()));

  const receipts: Receipt[] = [...prior];
  let sent = 0;
  const eta = Math.round((recipients.length * SEND_GAP_MS) / 1000);
  console.log(`${send ? "SEND" : "DRY RUN"} — ${recipients.length} recipients`);
  console.log(`subject: "${subject}"`);
  if (send) console.log(`pacing ${SEND_GAP_MS}ms apart, ~${eta}s total\n`);
  else console.log("");

  for (const r of recipients) {
    const at = new Date().toISOString();
    if (!isTest && supSet.has(r.email)) {
      console.log(`SKIP suppressed    ${r.email}`);
      receipts.push({ email: r.email, status: "skipped_suppressed", resend_message_id: null, at });
      continue;
    }
    if (!isTest && alreadySent.has(r.email)) {
      console.log(`SKIP already sent  ${r.email}`);
      receipts.push({ email: r.email, status: "skipped_already_sent", resend_message_id: null, at });
      continue;
    }

    if (!send) {
      console.log(`DRY  would send    ${r.email}${r.name ? ` (${r.name})` : ""}`);
      receipts.push({ email: r.email, status: "dry_run", resend_message_id: null, at });
      continue;
    }

    const { data, error } = await resend.emails.send({
      from: mailFrom,
      replyTo: mailReplyTo,
      to: r.email,
      subject,
      text: buildText(r.name),
      html: await render(CheckInEmail({ displayName: r.name })),
      headers: { "X-Quiver-Campaign": CAMPAIGN },
    });

    if (error) {
      console.error(`FAIL ${r.email}:`, error);
      receipts.push({ email: r.email, status: "send_failed", resend_message_id: null, at });
      continue;
    }
    sent++;
    console.log(`SENT ${r.email}`);
    receipts.push({ email: r.email, status: "sent", resend_message_id: data?.id ?? null, at });
    await new Promise((res) => setTimeout(res, SEND_GAP_MS));
  }

  writeFileSync(receiptsPath, JSON.stringify(receipts, null, 2));
  console.log(`\n${send ? `Sent ${sent}.` : "Dry run complete, nothing sent."} Receipts: ${receiptsPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
