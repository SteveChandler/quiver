import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPAIR_VERSION = "20260709122000";
const BACKFILL_VERSION = "20260709123000";
const REPAIR_FILE = join(
  process.cwd(),
  `supabase/migrations/${REPAIR_VERSION}_exclude_board_rec_seed_from_analytics.sql`,
);
const BACKFILL_FILE = join(
  process.cwd(),
  `supabase/migrations/${BACKFILL_VERSION}_public_session_feed_eligibility.sql`,
);
const repairSQL = existsSync(REPAIR_FILE) ? readFileSync(REPAIR_FILE, "utf8") : "";
const normalizedRepairSQL = repairSQL.replace(/\s+/g, " ").toLowerCase();
const normalizedBackfillSQL = readFileSync(BACKFILL_FILE, "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("Board Rec seed analytics repair migration", () => {
  it("runs before the session_created analytics backfill", () => {
    expect(existsSync(REPAIR_FILE)).toBe(true);
    expect(Number(REPAIR_VERSION)).toBeLessThan(Number(BACKFILL_VERSION));
  });

  it("marks only the orphaned Board Rec seed signature as mock data", () => {
    expect(normalizedRepairSQL).toContain("begin;");
    expect(normalizedRepairSQL).toContain("update public.profiles as p");
    expect(normalizedRepairSQL).toContain("is_mock = true");
    expect(normalizedRepairSQL).toContain("analytics_is_real_user = false");
    expect(normalizedRepairSQL).toContain("analytics_exclusion_reason = 'mock_profile'");
    expect(normalizedRepairSQL).toContain("p.full_name = 'board rec test user'");
    expect(normalizedRepairSQL).toContain("not exists ( select 1 from auth.users");
    expect(normalizedRepairSQL).toContain("b.name = 'performance thruster'");
    expect(normalizedRepairSQL).toContain("b.name = 'retro fish'");
    expect(normalizedRepairSQL).toContain("b.name = 'classic noserider'");
    expect(normalizedRepairSQL).toContain("commit;");
  });

  it("keeps the real-user backfill guard and user_events foreign key intact", () => {
    expect(normalizedBackfillSQL).toContain("coalesce(p.is_mock, false) = false");
    expect(normalizedRepairSQL).not.toMatch(/delete from|truncate|drop constraint/);
    expect(normalizedRepairSQL).not.toContain("alter table public.user_events");
  });
});

const RUN_INTEGRATION = process.env.RUN_SUPABASE_INTEGRATION === "1";
const DATABASE_URL = process.env.BOARD_REC_SEED_DATABASE_URL;
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

function localDatabaseUrl(): string {
  if (!DATABASE_URL) throw new Error("BOARD_REC_SEED_DATABASE_URL is required");
  const hostname = new URL(DATABASE_URL).hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
    throw new Error("Board Rec seed integration tests may only use a loopback database");
  }
  return DATABASE_URL;
}

describeIntegration("Board Rec seed analytics repair (local Supabase)", () => {
  it("excludes the auth-orphan seed profile and its sessions from user_events", () => {
    const output = execFileSync(
      "psql",
      [
        localDatabaseUrl(),
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-c",
        `
          SELECT json_build_object(
            'profile_count', count(DISTINCT p.id),
            'unmarked_profiles', count(DISTINCT p.id) FILTER (
              WHERE p.is_mock IS DISTINCT FROM true
                OR p.analytics_is_real_user IS DISTINCT FROM false
                OR p.analytics_exclusion_reason IS DISTINCT FROM 'mock_profile'
            ),
            'auth_users', count(DISTINCT u.id),
            'sessions', count(DISTINCT s.id),
            'session_created_events', count(DISTINCT e.id) FILTER (
              WHERE e.event_type = 'session_created'
            )
          )
          FROM public.profiles p
          LEFT JOIN auth.users u ON u.id = p.id
          LEFT JOIN public.sessions s ON s.user_id = p.id
          LEFT JOIN public.user_events e ON e.user_id = p.id
          WHERE p.full_name = 'Board Rec Test User';
        `,
      ],
      { encoding: "utf8" },
    ).trim();

    const result = JSON.parse(output) as {
      profile_count: number;
      unmarked_profiles: number;
      auth_users: number;
      sessions: number;
      session_created_events: number;
    };

    expect(result.profile_count).toBe(1);
    expect(result.unmarked_profiles).toBe(0);
    expect(result.auth_users).toBe(0);
    expect(result.sessions).toBeGreaterThan(0);
    expect(result.session_created_events).toBe(0);
  });
});
