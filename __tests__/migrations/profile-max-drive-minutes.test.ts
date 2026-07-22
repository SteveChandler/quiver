import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RECONCILIATION_VERSION = "20260715050000";
const CONSUMER_VERSION = "20260715051000";
const RECONCILIATION_FILE = join(
  process.cwd(),
  `supabase/migrations/${RECONCILIATION_VERSION}_restore_profile_max_drive_minutes.sql`,
);
const reconciliationSQL = existsSync(RECONCILIATION_FILE)
  ? readFileSync(RECONCILIATION_FILE, "utf8")
  : "";
const normalizedSQL = reconciliationSQL.replace(/\s+/g, " ").toLowerCase();

describe("profiles.max_drive_minutes schema reconciliation", () => {
  it("runs before the first migration that reads the column", () => {
    expect(existsSync(RECONCILIATION_FILE)).toBe(true);
    expect(Number(RECONCILIATION_VERSION)).toBeLessThan(Number(CONSUMER_VERSION));
  });

  it("replays the nullable integer column and its production comment idempotently", () => {
    expect(normalizedSQL).toContain("begin;");
    expect(normalizedSQL).toContain(
      "alter table public.profiles add column if not exists max_drive_minutes integer",
    );
    expect(normalizedSQL).toContain(
      "comment on column public.profiles.max_drive_minutes is 'optional maximum drive time preference in minutes for discovery candidate radius. null means no cap/current behavior.'",
    );
    expect(normalizedSQL).toContain("commit;");
  });

  it("does not remove profile data or relax the column shape", () => {
    expect(normalizedSQL).not.toMatch(/delete from|truncate|drop table|drop column/);
    expect(normalizedSQL).not.toContain("not null");
    expect(normalizedSQL).not.toContain("default");
  });
});
