/**
 * Lists users who signed up in the past 7 days, split into normal inboxes
 * (`sendable`) and Apple Hide-My-Email relays (`appleRelay`), which cannot be
 * emailed from a personal Gmail.
 *
 * Usage: npx tsx scripts/list-new-users-week.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local)"
  );
}

const APPLE_RELAY_DOMAIN = "@privaterelay.appleid.com";
const TEST_EMAIL_PATTERNS = [/@example\.invalid$/i, /@quiversurf\.test$/i, /^codex-/i, /^e2e-/i];
const DAYS = 7;

type NewUser = {
  email: string;
  greeting: string | null;
  displayName: string | null;
  createdAt: string;
};

/** Junk-name heuristics: initials, handles, single letters, digits, emails. */
function toGreeting(displayName: string | null): string | null {
  if (!displayName) return null;
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  if (first.length < 2) return null;
  if (first.includes("@")) return null;
  if (!/^[\p{L}][\p{L}'’-]+$/u.test(first)) return null;
  if (first === first.toUpperCase() && first.length <= 3) return null;

  return first.charAt(0).toUpperCase() + first.slice(1);
}

async function main(): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("profiles")
    .select("email, display_name, full_name, created_at")
    .eq("is_mock", false)
    .gte("created_at", cutoff.toISOString())
    .order("created_at");
  if (error) throw new Error(`profiles fetch failed: ${error.message}`);

  const all: NewUser[] = (data ?? [])
    .filter((row): row is typeof row & { email: string } => Boolean(row.email))
    .filter((row) => !TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(row.email)))
    .map((row) => {
      const displayName = row.display_name ?? row.full_name ?? null;
      return {
        email: row.email,
        greeting: toGreeting(displayName),
        displayName,
        createdAt: row.created_at,
      };
    });

  const isRelay = (u: NewUser) => u.email.toLowerCase().endsWith(APPLE_RELAY_DOMAIN);

  console.log(
    JSON.stringify(
      {
        since: cutoff.toISOString(),
        total: all.length,
        sendable: all.filter((u) => !isRelay(u)),
        appleRelay: all.filter(isRelay),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
