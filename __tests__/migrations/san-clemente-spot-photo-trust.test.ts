import { readFileSync } from "fs";
import { join } from "path";

describe("San Clemente spot/photo trust migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260506160824_san_clemente_spot_photo_trust.sql"
    ),
    "utf8"
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps data changes in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("moves Church and Cottons to the corrected San Clemente coordinates", () => {
    expect(normalizedSQL).toContain("where lower(name) = 'church'");
    expect(normalizedSQL).toContain("lat = 33.38013937");
    expect(normalizedSQL).toContain("lon = -117.5798893");
    expect(normalizedSQL).toContain("where lower(name) = 'cottons'");
    expect(normalizedSQL).toContain("lat = 33.390733");
    expect(normalizedSQL).toContain("lon = -117.598633");
    expect(normalizedSQL).not.toContain("geog =");
  });

  it("inserts Riviera without writing the generated geog column", () => {
    expect(normalizedSQL).toContain("select 'riviera'");
    expect(normalizedSQL).toContain("33.40579414");
    expect(normalizedSQL).toContain("-117.60840654");
    expect(normalizedSQL).toContain("where lower(name) = 'riviera'");
    expect(normalizedSQL).not.toContain("public.st_makepoint");
  });

  it("adds the generated-diorama replacement roadmap debt item", () => {
    expect(normalizedSQL).toContain(
      "replace generated diorama loops with real surf media"
    );
    expect(normalizedSQL).toContain("category");
    expect(normalizedSQL).toContain("under_consideration");
  });

  it("rejects irrelevant photos by approval flag rather than deleting media", () => {
    expect(normalizedSQL).toContain("set approved = false");
    expect(normalizedSQL).toContain("lhok nga beach");
    expect(normalizedSQL).toContain("usa surfing competition, pismo beach california");
    expect(normalizedSQL).toContain("winding winter road - gettysburg");
    expect(normalizedSQL).toContain("physeter macrocephalus");
    expect(normalizedSQL).not.toContain("delete from public.beach_photos");
    expect(normalizedSQL).not.toContain("set deleted_at");
  });
});
