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

  // Ceilings sit at the widest any live caller legitimately asks for, not at
  // the defaults: native's use-nearest-beach requests 160934 m, and discovery's
  // candidate pool wants 60 rows. Clamping tighter returns zero beaches for
  // users far from a break, in binaries already shipped.
  it("caps direct RPC calls to the public map contract", () => {
    expect(sql).toContain(
      "LEAST(GREATEST(max_distance_meters, 0), 160934)",
    );
    expect(sql).toContain("LEAST(GREATEST(limit_count, 1), 100)");
  });

  it("leaves the narrower defaults in place for callers that omit arguments", () => {
    expect(sql).toContain("max_distance_meters INTEGER DEFAULT 80467");
    expect(sql).toContain("limit_count INTEGER DEFAULT 50");
  });

  it("does not grant execution to the implicit public role", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) FROM PUBLIC",
    );
  });
});
