import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260808170000_secure_get_nearby_beaches_visibility.sql",
);

describe("get_nearby_beaches public visibility migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("excludes private and soft-deleted rows inside the security definer", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("COALESCE(b.is_private, false) = false");
    expect(sql).toContain("b.deleted_at IS NULL");
  });

  it("caps direct RPC calls to the public map contract", () => {
    expect(sql).toContain(
      "LEAST(GREATEST(max_distance_meters, 0), 80467)",
    );
    expect(sql).toContain("LEAST(GREATEST(limit_count, 1), 50)");
  });

  it("does not grant execution to the implicit public role", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) FROM PUBLIC",
    );
  });
});
