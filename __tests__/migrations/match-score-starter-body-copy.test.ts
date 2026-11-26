import { readFileSync } from "fs";
import { join } from "path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string): string => readFileSync(join(migrationsDir, name), "utf8");
const migration = read("20261126120000_match_score_starter_body_copy.sql");
const previousScorer = read("20261124180000_match_score_max_logged_wave.sql");

const flat = (sql: string): string => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const fn = (sql: string): string => {
  const match = sql.match(/CREATE OR REPLACE FUNCTION public\.compute_user_match_scores\([\s\S]*?\$scores\$;/);
  expect(match).not.toBeNull();
  return flat(match![0]);
};
const OLD_BODY =
  "'body','A starter read from your skill' || CASE WHEN has_wind OR has_tide THEN ' and this spot''s setup' ELSE '' END || '. It gets more personal as you rate sessions.',";
const NEW_BODY = "'body','This gets more personal as you rate sessions.',";

// Older native builds show the server starter body as is (quiver-native#797).
describe("match score starter body copy migration", () => {
  it("is one transaction that only replaces the scorer", () => {
    expect(migration).toMatch(/^(--.*\n)*BEGIN;/);
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect([...migration.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)/g)].map((m) => m[1])).toEqual([
      "public.compute_user_match_scores",
    ]);
    expect(flat(migration)).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|GRANT|REVOKE)\b/i);
  });

  it("is the previous function with only the starter body changed", () => {
    const sql = fn(migration);
    expect(sql.split(NEW_BODY)).toHaveLength(2);
    expect(sql.replace(NEW_BODY, OLD_BODY)).toBe(fn(previousScorer));
  });

  it("drops the starter-read and spot-setup copy and keeps the fit labels", () => {
    const sql = fn(migration);
    expect(sql).not.toMatch(/starter read|spot''s setup/i);
    expect(sql).toContain("'Based on your skill + this spot'");
    expect(sql).toContain("'Based on your skill level'");
  });

  it("names the rollback", () => {
    expect(migration).toContain(
      "Rollback: re-run compute_user_match_scores from 20261124180000_match_score_max_logged_wave.sql.",
    );
  });
});
