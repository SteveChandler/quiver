import { readFileSync } from "fs";
import { join } from "path";

describe("stale email candidate RPC overload cleanup migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260506130915_drop_stale_email_candidate_rpc_overloads.sql"
    ),
    "utf-8"
  );

  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the overload cleanup in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("drops only the stale two-argument candidate overloads", () => {
    expect(normalizedSQL).toContain(
      "drop function if exists public.get_conditions_alert_candidates(integer, integer);"
    );
    expect(normalizedSQL).toContain(
      "drop function if exists public.get_session_prompt_candidates(integer, integer);"
    );
    expect(normalizedSQL).not.toContain(
      "drop function if exists public.get_conditions_alert_candidates(integer);"
    );
    expect(normalizedSQL).not.toContain(
      "drop function if exists public.get_session_prompt_candidates(integer);"
    );
  });

  it("reloads the PostgREST schema cache", () => {
    expect(normalizedSQL).toContain("notify pgrst, 'reload schema';");
  });
});
