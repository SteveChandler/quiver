import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";

import { sendAndroidBetaInstructionsEmail } from "../lib/mailer/android-beta";

interface LeadRecipient {
  email: string;
  source: "android_beta_leads" | "profiles";
}

interface EmailClaim {
  email: string;
  claimedAt: string;
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function requestedLimit(): number {
  const limit = Number(getFlag("--limit") ?? "500");
  return Number.isFinite(limit) ? limit : 500;
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

async function ensureLeadRow(supabase: any, email: string): Promise<void> {
  const { error } = await supabase
    .from("android_beta_leads")
    .upsert(
      {
        email,
        source: "profile_android_access",
        surface: "script",
        placement: "bulk_android_beta_email",
      },
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) throw error;
}

async function claimEmail(supabase: any, email: string): Promise<EmailClaim | null> {
  const claimedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("android_beta_leads")
    .update({ instructions_sent_at: claimedAt })
    .eq("email", email)
    .is("instructions_sent_at", null)
    .select("email")
    .maybeSingle();

  if (error) throw error;
  return data ? { email, claimedAt } : null;
}

async function resetEmailClaim(
  supabase: any,
  claim: EmailClaim,
): Promise<void> {
  const { error } = await supabase
    .from("android_beta_leads")
    .update({ instructions_sent_at: null })
    .eq("email", claim.email)
    .eq("instructions_sent_at", claim.claimedAt);

  if (error) {
    console.warn("Failed to reset Android beta instructions claim", {
      email: claim.email,
      error,
    });
  }
}

export async function main(): Promise<void> {
  const shouldSend = hasFlag("--send");
  const limit = requestedLimit();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }

  const supabase = createClient(
    supabaseUrl,
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const { data: leadRows, error: leadError } = await supabase
    .from("android_beta_leads")
    .select("email")
    .is("instructions_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (leadError) throw leadError;

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("wants_android_access", true)
    .not("email", "is", null)
    .limit(limit);

  if (profileError) throw profileError;

  const recipients = new Map<string, LeadRecipient>();
  for (const row of leadRows ?? []) {
    const email = normalizeEmail(row.email);
    if (email) recipients.set(email, { email, source: "android_beta_leads" });
  }
  for (const row of profileRows ?? []) {
    const email = normalizeEmail(row.email);
    if (email && !recipients.has(email)) {
      recipients.set(email, { email, source: "profiles" });
    }
  }

  const recipientList = Array.from(recipients.values());
  console.log(JSON.stringify({
    mode: shouldSend ? "send" : "dry-run",
    recipients: recipientList.length,
    fromLeads: recipientList.filter((item) => item.source === "android_beta_leads").length,
    fromProfiles: recipientList.filter((item) => item.source === "profiles").length,
  }, null, 2));

  if (!shouldSend) {
    console.log("Dry run only. Re-run with --send to email these recipients.");
    return;
  }

  for (const recipient of recipientList) {
    if (recipient.source === "profiles") {
      await ensureLeadRow(supabase, recipient.email);
    }

    const claim = await claimEmail(supabase, recipient.email);
    if (!claim) {
      console.log("Skipped Android beta email; instructions already sent", {
        email: recipient.email,
      });
      continue;
    }

    const result = await sendAndroidBetaInstructionsEmail(recipient.email);
    if (!result.success) {
      await resetEmailClaim(supabase, claim);
      console.error("Failed to send Android beta email", {
        email: recipient.email,
        error: result.error,
      });
      process.exitCode = 1;
      continue;
    }

    console.log("Sent Android beta email", {
      email: recipient.email,
      messageId: result.messageId,
    });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
