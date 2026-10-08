import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20261008140000_find_cities_by_pattern_strip_periods.sql",
);

const PERIOD_STRIPPED = "unaccent(lower(replace(replace(b.city, '-', ' '), '.', '')))";

describe("find_cities_by_pattern period normalization migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  // "st-augustine" resolves to the pattern "st augustine"; the stored name is
  // "St. Augustine". The match, the exact flag and the ordering must all strip
  // the period, or findCityBySlug sees no exact match and returns null.
  it("strips periods in the match filter, the exact flag and the ordering", () => {
    expect(sql.split(PERIOD_STRIPPED).length - 1).toBe(3);
  });

  // "Waiʻanae" and "Waianae" are separate HI cities. Stripping apostrophes or
  // the ʻokina makes "waianae" exact-match both, which findCityBySlug treats as
  // ambiguous and 404s.
  it("does not strip apostrophes or the okina", () => {
    expect(sql).not.toMatch(/regexp_replace/i);
    expect(sql).not.toContain("'''");
    expect(sql).not.toContain("ʻ', ''");
  });

  it("keeps the signature, so CREATE OR REPLACE preserves grants", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.find_cities_by_pattern(");
    expect(sql).toContain(
      "RETURNS TABLE(city TEXT, state TEXT, beach_count BIGINT, is_exact_match BOOLEAN)",
    );
    expect(sql).not.toMatch(/DROP FUNCTION/i);
  });

  it("keeps the hardened search_path and runs in a transaction", () => {
    expect(sql).toContain("SET search_path TO 'public', 'extensions', 'pg_temp'");
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).toMatch(/^COMMIT;$/m);
  });
});
