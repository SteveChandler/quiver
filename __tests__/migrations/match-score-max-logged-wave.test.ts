import { readFileSync } from "fs";
import { join } from "path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string): string => readFileSync(join(migrationsDir, name), "utf8");
const migration = read("20261124180000_match_score_max_logged_wave.sql");
const previousScorer = read("20261010140000_match_score_hashable_joins.sql");

const flat = (sql: string): string => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const fn = (sql: string): string => {
  const match = sql.match(/CREATE OR REPLACE FUNCTION public\.compute_user_match_scores\([\s\S]*?\$scores\$;/);
  expect(match).not.toBeNull();
  return flat(match![0]);
};
const INPUT = " (SELECT round(max(wave), 1) FROM history WHERE eligible AND wave > 0) AS max_logged_wave_ft,";
const KEY = ", 'max_logged_wave_ft',max_logged_wave_ft";

// A MEH match must not step a window down when the forecast is bigger than any logged session
// (engine personalMatchVerdict). Row equality is pinned in supabase/tests/match_score_max_logged_wave.sql.
describe("match score max-logged-wave migration", () => {
  it("is one transaction that only replaces the scorer", () => {
    expect(migration).toMatch(/^(--.*\n)*BEGIN;/);
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect([...migration.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)/g)].map((m) => m[1])).toEqual([
      "public.compute_user_match_scores",
    ]);
    expect(flat(migration)).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|GRANT|REVOKE)\b/i);
  });

  it("is the previous function plus one input and one learned key", () => {
    const sql = fn(migration);
    expect(sql.split(INPUT)).toHaveLength(2);
    expect(sql.split(KEY)).toHaveLength(2);
    expect(sql.replace(INPUT, "").replace(KEY, "")).toBe(fn(previousScorer));
  });

  it("adds the key only to the learned result", () => {
    const sql = fn(migration);
    expect(sql.indexOf(KEY)).toBeGreaterThan(sql.indexOf("'state','learned'"));
    expect(sql.indexOf(KEY)).toBeLessThan(sql.indexOf("END AS result"));
  });

  it("names the rollback", () => {
    expect(migration).toContain("Rollback: re-run compute_user_match_scores from 20261010140000_match_score_hashable_joins.sql.");
  });
});
