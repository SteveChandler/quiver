import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261004210000_create_swell_outlook_user_state.sql"),
  "utf8",
);

describe("swell outlook user state migration", () => {
  it("runs in one transaction and creates one row per user", () => {
    expect(sql.trim().split("\n").filter((line) => !line.startsWith("--"))[0]).toBe("BEGIN;");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.swell_outlook_user_state/);
    expect(sql).toMatch(/user_id uuid PRIMARY KEY REFERENCES public\.profiles\(id\) ON DELETE CASCADE/);
  });

  it("stores the back-off fields and both lists", () => {
    for (const column of ["last_sent_at", "paused_since", "last_answered_at", "last_exception_at", "last_first_sighting_at"]) {
      expect(sql).toMatch(new RegExp(`${column} timestamptz NULL`));
    }
    expect(sql).toMatch(/consecutive_unanswered integer NOT NULL DEFAULT 0 CHECK \(consecutive_unanswered >= 0\)/);
    expect(sql).toMatch(/outlook_list jsonb NULL/);
    expect(sql).toMatch(/outlook_prev_list jsonb NULL/);
  });

  it("is service role only", () => {
    expect(sql).toMatch(/ALTER TABLE public\.swell_outlook_user_state ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON public\.swell_outlook_user_state FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE ON public\.swell_outlook_user_state TO service_role;/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|TRUNCATE/);
  });

  it("changes the comparison token on every update, including updates in one transaction", () => {
    expect(sql).toMatch(/BEFORE UPDATE ON public\.swell_outlook_user_state/);
    expect(sql).toMatch(/clock_timestamp\(\)/);
    expect(sql).toMatch(/OLD\.updated_at \+ interval '1 microsecond'/);
  });
});
