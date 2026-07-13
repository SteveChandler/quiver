import { readFileSync } from "fs";
import { join } from "path";

describe("Pawleys and South Litchfield custom spot distance migration", () => {
  const migrationSQL: string = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260708130000_set_pawleys_litchfield_custom_spot_distances.sql",
    ),
    "utf8",
  );
  const normalizedSQL: string = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the distance repair in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("targets only the three previously remapped custom spots", () => {
    expect(normalizedSQL).toContain("'ea66c1be-ea12-4606-8430-d17271f053d3'::uuid");
    expect(normalizedSQL).toContain("'7e65605a-d260-45d7-ba9b-59476ee1bfd8'::uuid");
    expect(normalizedSQL).toContain("'99c8b745-a3d8-4248-be97-7691a31fafa3'::uuid");
    expect(normalizedSQL).toContain("'pawleys-island-pier-pawleys-island-sc'");
    expect(normalizedSQL).toContain("'south-litchfield-litchfield-beach-sc'");
  });

  it("computes the distance from custom spot coordinates to the assigned beach", () => {
    expect(normalizedSQL).toContain("nearest_beach_distance_mi");
    expect(normalizedSQL).toContain("public.st_distance");
    expect(normalizedSQL).toContain(
      "public.st_point(cs.lon::double precision, cs.lat::double precision)",
    );
    expect(normalizedSQL).toContain("/ 1609.344");
    expect(normalizedSQL).toContain("cs.nearest_beach_id = b.id");
    expect(normalizedSQL).toContain("cs.nearest_beach_distance_mi is distinct from");
  });

  it("does not broaden scope to users, profiles, or destructive operations", () => {
    expect(normalizedSQL).not.toContain("profiles");
    expect(normalizedSQL).not.toContain("where user_id");
    expect(normalizedSQL).not.toMatch(/\bdelete\s+from\b/);
    expect(normalizedSQL).not.toMatch(/\btruncate\b/);
    expect(normalizedSQL).not.toMatch(/\bdrop\s+table\b/);
  });
});
