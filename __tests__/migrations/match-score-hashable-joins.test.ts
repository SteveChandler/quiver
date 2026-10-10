import { readFileSync } from "fs";
import { join } from "path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string): string => readFileSync(join(migrationsDir, name), "utf8");
const migration = read("20261010140000_match_score_hashable_joins.sql");
const previousScorer = read("20261002200000_match_score_missing_inputs_neutral.sql");

const flat = (sql: string): string => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const body = (sql: string): string => {
  const match = sql.match(/AS \$scores\$([\s\S]*?)\$scores\$;/);
  expect(match).not.toBeNull();
  return flat(match![1]);
};
const header = (sql: string): string => {
  const match = sql.match(/CREATE OR REPLACE FUNCTION public\.compute_user_match_scores\(.*?AS \$scores\$/s);
  expect(match).not.toBeNull();
  return flat(match![0]);
};
const KEY_CONJUNCT = / AND jsonb_build_array\([^()]*\) = jsonb_build_array\([^()]*\)/g;

// 2026-10-10: the IS NOT DISTINCT FROM tuple joins from 20261002200000 cannot hash, so the scorer
// ran N x N nested loops (1,640 slots took 2.3 s) and pushed /api/forecasts/bulk past the statement
// timeout. Result equality is pinned in supabase/tests/match_score_hashable_joins.sql.
describe("match score hashable-joins migration", () => {
  it("is one transaction that only replaces the scorer", () => {
    expect(migration).toMatch(/^(--.*\n)*BEGIN;/);
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect([...migration.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)/g)].map((m) => m[1])).toEqual([
      "public.compute_user_match_scores",
    ]);
    expect(flat(migration)).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|GRANT|REVOKE)\b/i);
  });

  it("keeps the previous header and only adds enable_nestloop = off", () => {
    expect(header(migration).replace(" SET enable_nestloop = off", "")).toBe(header(previousScorer));
    expect(header(migration)).toContain("SET enable_nestloop = off AS $scores$");
  });

  it("is the previous body plus three additive hash keys, so no result can change", () => {
    const added = body(migration).match(KEY_CONJUNCT) ?? [];
    expect(added).toHaveLength(3);
    expect(body(migration).replace(KEY_CONJUNCT, "")).toBe(body(previousScorer));
  });

  it("keys each IS NOT DISTINCT FROM tuple join on exactly its own columns", () => {
    const sql = body(migration);
    expect(sql).toContain(
      "AND jsonb_build_array(t.break_type,t.f_wave,t.f_period,t.f_wind,t.f_wind_dir,t.f_tide) = jsonb_build_array(d.break_type,d.f_wave,d.f_period,d.f_wind,d.f_wind_dir,d.f_tide)",
    );
    expect(sql).toContain(
      "AND jsonb_build_array(st.break_families,st.similarity_wave,st.f_period,st.similarity_period,st.period_aware, st.f_wind,st.f_wind_dir,st.relative_tide) = jsonb_build_array(d.break_families,d.similarity_wave,d.f_period,d.similarity_period,d.period_aware, d.f_wind,d.f_wind_dir,d.f_tide-d.spot_tide)",
    );
    expect(sql).toContain(
      "AND jsonb_build_array(c.beach_id,c.similarity_wave,c.similarity_period,c.period_aware,c.f_wave,c.f_period,c.f_wind,c.f_wind_dir,c.f_tide) = jsonb_build_array(s.beach_id,s.similarity_wave,s.similarity_period,s.period_aware,s.f_wave,s.f_period,s.f_wind,s.f_wind_dir,s.f_tide)",
    );
    // The final join still drops slots whose period is NULL, exactly as before.
    expect(sql).toContain("AND c.similarity_period = s.similarity_period AND c.period_aware = s.period_aware");
  });
});
