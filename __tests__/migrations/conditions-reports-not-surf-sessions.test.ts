import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261105120000_conditions_reports_not_surf_sessions.sql"),
  "utf8",
);
const normalized = sql.replace(/\s+/g, " ").toLowerCase();
const exclusion = "source is distinct from 'conditions_report'";

function section(start: string, end: string): string {
  const from = normalized.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  return normalized.slice(from, normalized.indexOf(end, from));
}

describe("conditions reports are not surf sessions migration", () => {
  it("runs in one transaction", () => {
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("drops reports from the public feed view, keeping security_invoker and the visibility rule", () => {
    const view = section("create or replace view public.public_session_feed_eligibility", "from classified;");
    expect(view).toContain("with (security_invoker = true)");
    expect(view).toContain("s.is_public = true");
    expect(view).toContain(`and s.${exclusion}`);
    expect(normalized).not.toContain("drop view");
    expect(normalized).toContain("grant select on public.public_session_feed_eligibility to anon, authenticated");
  });

  it("drops reports from profile stats and keeps the function SECURITY INVOKER", () => {
    const fn = section("create or replace function public.get_profile_stats", "$$;");
    expect(fn).toContain("security invoker");
    expect(fn).not.toContain("security definer");
    expect(fn).toContain(`and deleted_at is null and ${exclusion}`);
  });

  it("drops reports from the weekly session streak and keeps the self-read guard", () => {
    const fn = section("create or replace function public.get_user_streaks", "$$;");
    const weeks = fn.slice(fn.indexOf("with weeks as"), fn.indexOf("islands as"));
    expect(weeks).toContain(`and deleted_at is null and ${exclusion}`);
    expect(fn).toContain("caller may only read own streaks");
    expect(normalized).toContain("revoke all on function public.get_user_streaks(uuid) from public, anon");
  });

  it("does not change is_public on any session", () => {
    expect(normalized).not.toMatch(/update public\.sessions/);
  });
});
