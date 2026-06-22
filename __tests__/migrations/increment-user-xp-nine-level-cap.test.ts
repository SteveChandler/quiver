import { readFileSync } from "fs";
import { join } from "path";

describe("increment_user_xp nine-level cap migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260622180000_cap_increment_user_xp_to_nine_levels.sql",
    ),
    "utf8",
  );

  it("preserves the nine-tier product model in the XP RPC", () => {
    expect(migrationSQL).toContain("CHECK (level >= 1 AND level <= 9)");
    expect(migrationSQL).toContain("UPDATE public.user_xp");
    expect(migrationSQL).toContain("WHERE level > 9");
    expect(migrationSQL).toMatch(/WHEN v_total >= 4000 THEN 9/i);
    expect(migrationSQL).not.toMatch(/WHEN v_total >= 5500 THEN 10/i);
  });

  it("keeps the function hardened and idempotent", () => {
    expect(migrationSQL).toMatch(/SECURITY DEFINER/i);
    expect(migrationSQL).toMatch(/SET search_path = public/i);
    expect(migrationSQL).toContain("idempotency_key");
    expect(migrationSQL).toContain("EXCEPTION WHEN unique_violation");
    expect(migrationSQL).toContain("GRANT EXECUTE ON FUNCTION public.increment_user_xp");
  });
});
