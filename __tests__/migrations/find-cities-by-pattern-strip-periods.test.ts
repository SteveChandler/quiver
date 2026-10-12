import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20261008140000_find_cities_by_pattern_strip_periods.sql",
);

const PERIOD_NORMALIZED =
  "trim(unaccent(lower(regexp_replace(replace(b.city, '-', ' '), '\\.\\s*', ' ', 'g'))))";

describe("find_cities_by_pattern period normalization migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const body = sql.slice(sql.indexOf("AS $$"), sql.indexOf("$$;"));

  // "st-augustine" resolves to the pattern "st augustine"; the stored name is
  // "St. Augustine". The match, the exact flag and the ordering must all
  // normalize the period, or findCityBySlug sees no exact match and returns null.
  it("normalizes periods in the match filter, the exact flag and the ordering", () => {
    expect(body.split(PERIOD_NORMALIZED).length - 1).toBe(3);
  });

  // A period becomes a word break, not nothing: "St.Augustine" must become
  // "st augustine" to meet the slug pattern, not "staugustine".
  it("turns a period into a single space rather than deleting it", () => {
    expect(body).not.toContain("'.', ''");
  });

  // "Waiʻanae" and "Waianae" are separate HI cities. Normalizing apostrophes or
  // the ʻokina makes "waianae" exact-match both, which findCityBySlug treats as
  // ambiguous and 404s. The only character normalization added is the period.
  it("does not normalize apostrophes or the okina", () => {
    const regexReplacements = body.match(/regexp_replace\([^;]*?'g'\)/g) ?? [];
    expect(regexReplacements).toHaveLength(3);
    for (const call of regexReplacements) {
      expect(call).toContain("'\\.\\s*', ' ', 'g'");
    }
    expect(body).not.toMatch(/translate\(|chr\(|[ʻ‘’`]|''''/);
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
