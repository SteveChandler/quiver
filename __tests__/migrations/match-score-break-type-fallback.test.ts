import { readFileSync } from "fs";
import { join } from "path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string): string => readFileSync(join(migrationsDir, name), "utf8");
const migration = read("20261124120000_match_score_break_type_fallback.sql");
const previousScorer = read("20261010140000_match_score_hashable_joins.sql");

const flat = (sql: string): string => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const header = (sql: string): string => {
  const match = sql.match(/CREATE OR REPLACE FUNCTION public\.compute_user_match_scores\([\s\S]*?AS \$scores\$/);
  expect(match).not.toBeNull();
  return flat(match![0]);
};

// 2026-11-24: a break type with no 4+ session returned avoidance_learned with a NULL score, which
// verdicts read as neutral, so those beaches were never stepped down. Result behaviour is pinned in
// supabase/tests/match_score_break_type_fallback.sql (scripts/test-match-score-break-type-fallback-postgres.sh).
describe("match score break-type fallback migration", () => {
  it("is one transaction that only replaces the scorer", () => {
    expect(migration).toMatch(/^(--.*\n)*BEGIN;/);
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect([...migration.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)/g)].map((m) => m[1])).toEqual([
      "public.compute_user_match_scores",
    ]);
    expect(flat(migration)).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|GRANT|REVOKE)\b/i);
  });

  it("keeps the signature, security, search_path and enable_nestloop", () => {
    expect(header(migration)).toBe(header(previousScorer));
  });

  it("falls back only for 5+ session users with a 4+ session somewhere", () => {
    const sql = flat(migration);
    expect(sql).toContain("p.p_count = 0 AND a.p_count > 0 AND g.session_count >= 5 AS all_breaks");
    expect(sql).toContain("JOIN peaks p ON p.break_type IS NOT DISTINCT FROM ps.profile_break_type");
    expect(sql).toContain(
      "AND (t.profile_break_type IS NULL OR h.break_type = t.profile_break_type OR h.break_type IS NULL)",
    );
    expect(sql).toContain(`CASE WHEN all_breaks THEN '{"profile_scope":"all_breaks"}'::jsonb ELSE '{}'::jsonb END`);
  });

  it("keeps the three hashable join keys", () => {
    expect(flat(migration).match(/ AND jsonb_build_array\([^()]*\) = jsonb_build_array\([^()]*\)/g)).toHaveLength(3);
  });
});
