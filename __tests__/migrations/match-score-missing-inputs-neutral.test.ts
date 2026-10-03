import { readFileSync } from "fs";
import { join } from "path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string): string => readFileSync(join(migrationsDir, name), "utf8");
const migration = read("20261002200000_match_score_missing_inputs_neutral.sql");
const previousScorer = read("20260929120000_match_score_om_similarity_period.sql");

const flat = (sql: string): string => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const block = (sql: string, start: RegExp, end: RegExp): string => {
  const from = sql.search(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const rest = sql.slice(from);
  const to = rest.slice(1).search(end);
  return flat(to < 0 ? rest : rest.slice(0, to + 1));
};
const header = (sql: string, fn: string): string => {
  const match = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(.*?AS \\$\\w+\\$`, "s"));
  expect(match).not.toBeNull();
  return flat(match![0]);
};
const nullableNumber = (expr: string): string => `(regexp_match(${expr}, '(-?\\d+\\.?\\d*)'))[1]::numeric`;

// 2026-10-02: parse_numeric_from_text coalesces to 0, so a missing wind scored as 0 mph (glassy),
// a missing direction as due north and a missing tide as 0 ft; learned scores moved by a median
// -0.8 (wind) and -0.5 (tide). The behaviour is pinned in supabase/tests/match_score_missing_inputs.sql.
describe("match score missing-inputs-neutral migration", () => {
  it("is one transaction that only replaces the scorer", () => {
    expect(migration).toMatch(/^(--.*\n)*BEGIN;/);
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect([...migration.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)/g)].map((m) => m[1])).toEqual([
      "public.compute_user_match_scores",
    ]);
    // Checked without comments: the header explains that a missing factor drops out.
    expect(flat(migration)).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|GRANT|REVOKE)\b/i);
  });

  it("keeps the signature, security, volatility and search_path identical", () => {
    expect(header(migration, "compute_user_match_scores")).toBe(header(previousScorer, "compute_user_match_scores"));
  });

  it("parses wind, direction and tide to NULL when absent, on both the history and the slot side", () => {
    const sql = flat(migration);
    for (const [expr, alias] of [
      ["sfs.forecast_snapshot->>'wind_speed'", "wind"],
      ["sfs.forecast_snapshot->>'wind_direction_deg'", "wind_dir"],
      ["sfs.forecast_snapshot->>'tide_height'", "tide"],
      ["conditions->>2", "f_wind"],
      ["conditions->>3", "f_wind_dir"],
      ["conditions->>4", "f_tide"],
    ]) {
      expect(sql).toContain(`${nullableNumber(expr)} AS ${alias},`);
      expect(sql).not.toContain(`public.parse_numeric_from_text(${expr}) AS ${alias},`);
    }
    // Wave height and period keep the shared parser.
    expect(sql).toContain("public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') AS wave,");
    expect(sql).toContain("public.parse_numeric_from_text(conditions->>1) AS f_period,");
  });

  it("averages each preference and aversion factor only over sessions that have it", () => {
    const peaks = block(migration, /peaks AS MATERIALIZED/, /\), inputs AS MATERIALIZED/);
    for (const [col, cmp] of [["wind", ">= 4"], ["wind_dir", ">= 4"], ["tide", ">= 4"], ["wind", "<= 2"], ["wind_dir", "<= 2"], ["tide", "<= 2"]]) {
      expect(peaks.split(`FILTER (WHERE h.rating ${cmp} AND h.${col} IS NOT NULL)`).length - 1).toBe(2);
    }
  });

  it("counts a missing factor as half a miss of its own weight, with no renormalization", () => {
    const sql = flat(migration);
    for (const side of ["p", "a"]) {
      expect(sql).toContain(`CASE WHEN ${side}_wind IS NOT NULL AND f_wind IS NOT NULL THEN 0.20 * LEAST(ABS(${side}_wind - f_wind) / GREATEST(${side}_wind, 5), 1) ELSE 0.20 * 0.5 END`);
      expect(sql).toContain(`CASE WHEN ${side}_tide IS NOT NULL AND f_tide IS NOT NULL THEN 0.10 * LEAST(ABS(${side}_tide - f_tide) / 3, 1) ELSE 0.10 * 0.5 END`);
      expect(sql).toContain(`360 - ABS(${side}_wind_dir - f_wind_dir)) / 180, 1) ELSE 0.10 * 0.5 END`);
    }
    expect(sql).toContain("CASE WHEN t.f_wind IS NOT NULL THEN 0.20 * LEAST(ABS(h.wind - t.f_wind) / GREATEST(h.wind, 5), 1) ELSE 0.20 * 0.5 END");
    // Dropping a factor and renormalizing tilted wind-less beaches up; it must not come back.
    expect(sql).not.toContain("/ (0.60");
  });

  it("matches slots with a NULL factor in both tuple joins", () => {
    const sql = flat(migration);
    expect(sql).toContain("(t.f_wave,t.f_period,t.f_wind,t.f_wind_dir,t.f_tide) IS NOT DISTINCT FROM (d.f_wave,d.f_period,d.f_wind,d.f_wind_dir,d.f_tide)");
    expect(sql).toContain("(c.f_wave,c.f_period,c.f_wind,c.f_wind_dir,c.f_tide) IS NOT DISTINCT FROM (s.f_wave,s.f_period,s.f_wind,s.f_wind_dir,s.f_tide)");
    expect(sql).not.toMatch(/f_tide\) = \(/);
  });

  it("leaves similarity, priors, board, scoring and results byte-for-byte as before", () => {
    for (const [start, end] of [
      [/similar_good AS MATERIALIZED/, /\), fit_targets AS MATERIALIZED/],
      [/priors AS MATERIALIZED/, /\), bands AS MATERIALIZED/],
      [/bands AS MATERIALIZED/, /\), distances AS MATERIALIZED/],
      [/scored AS MATERIALIZED/, /\), results AS MATERIALIZED/],
      [/results AS MATERIALIZED/, /SELECT s\.slot_idx, s\.beach_id, s\.forecast_at, r\.result/],
    ] as const) {
      expect(block(migration, start, end)).toBe(block(previousScorer, start, end));
    }
  });
});
