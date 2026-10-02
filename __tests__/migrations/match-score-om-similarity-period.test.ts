import { readFileSync } from "fs";
import { join } from "path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string): string => readFileSync(join(migrationsDir, name), "utf8");
const migration = read("20260929120000_match_score_om_similarity_period.sql");
const previousScorer = read("20260927230000_board_model_merge_match_score.sql");
const previousBatch = read("20260923040000_share_match_score_inputs.sql");

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

describe("match score Open-Meteo similarity period migration", () => {
  it("is one transaction that only replaces the scorer and its slot wrapper", () => {
    expect(migration).toMatch(/^(--.*\n)*BEGIN;/);
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect([...migration.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)/g)].map((m) => m[1])).toEqual([
      "public.compute_user_match_scores",
      "public.compute_user_match_score_batch",
    ]);
    expect(migration).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE)\b/i);
    expect(migration).not.toMatch(/\b(GRANT|REVOKE)\b/i);
  });

  it("keeps signatures, security, volatility and search_path identical", () => {
    expect(header(migration, "compute_user_match_scores")).toBe(header(previousScorer, "compute_user_match_scores"));
    expect(header(migration, "compute_user_match_score_batch")).toBe(header(previousBatch, "compute_user_match_score_batch"));
  });

  it("reads Open-Meteo history snapshots by wave_period_om, case-insensitively and only when positive", () => {
    const sql = flat(migration);
    expect(sql).toContain("CASE WHEN upper(sfs.forecast_snapshot->>'data_source') = 'OPEN_METEO'");
    expect(sql).toContain("AND public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period_om') > 0");
    expect(sql).toContain("THEN public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period_om')");
    expect(sql).toContain("WHEN sfs.forecast_snapshot->>'wave_period' IS NOT NULL");
    // The legacy column stays for slots without data_source.
    expect(sql).toContain("AS similarity_period,");
    expect(sql).toContain("AS similarity_period_by_source");
  });

  it("reads Open-Meteo slots by wave_period_om and leaves slots without data_source on the legacy period", () => {
    const sql = flat(migration);
    expect(sql).toContain("value->'data_source',value->'wave_period_om') AS conditions");
    expect(sql).toContain("NULLIF(trim(conditions->>5), '') IS NOT NULL AS period_aware");
    expect(sql).toContain("CASE WHEN upper(trim(conditions->>5)) = 'OPEN_METEO' AND public.parse_numeric_from_text(conditions->>6) > 0");
    expect(sql).toContain("ELSE public.parse_numeric_from_text(conditions->>1) END AS similarity_period");
    expect(sql).toContain("CASE WHEN t.period_aware THEN h.similarity_period_by_source ELSE h.similarity_period END-t.similarity_period");
    expect(sql).toContain("CASE WHEN t.period_aware THEN h.steepness_by_source ELSE h.steepness END");
    // Scenario identity and both joins carry the new columns so a slot never picks up another slot's count.
    expect(sql).toContain("GROUP BY beach_id, f_wave, f_period, f_wind, f_wind_dir, f_tide, similarity_wave, similarity_period, period_aware");
    expect(sql).toContain("st.f_period,st.similarity_period,st.period_aware");
    expect(sql).toContain("c.similarity_period = s.similarity_period AND c.period_aware = s.period_aware");
  });

  it("changes similarity only: the profile, aversion, fit and board terms are byte-for-byte the previous ones", () => {
    for (const [start, end] of [
      [/peaks AS MATERIALIZED/, /\), inputs AS MATERIALIZED/],
      [/fit_pairs AS MATERIALIZED/, /\), fit AS MATERIALIZED/],
      [/priors AS MATERIALIZED/, /\), adjustments AS MATERIALIZED/],
      [/scored AS MATERIALIZED/, /\), results AS MATERIALIZED/],
    ] as const) {
      expect(block(migration, start, end)).toBe(block(previousScorer, start, end));
    }
    expect(flat(migration)).toContain("public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS period,");
  });

  it("no longer puts the session-count sentence in reason_bullets but keeps the counts as data", () => {
    const sql = flat(migration);
    expect(sql).not.toMatch(/good sessions were in conditions like this/);
    expect(sql).not.toContain("%s of your %s");
    expect(sql).toContain("'reason_bullets','[]'::jsonb || CASE WHEN fit_count > 0");
    expect(sql).toContain("'good_session_count',good_total,'similar_good_session_count',similar_good");
    // The other bullets are untouched.
    for (const text of ["Your session fit feedback lifts this window.", "Similar sessions were flagged as a skill or board mismatch.", "Your session fit feedback is neutral for this window."]) {
      expect(migration).toContain(text);
    }
  });

  it("forwards data_source and wave_period_om from batch slots without blanking absent keys", () => {
    const batch = flat(migration.slice(migration.indexOf("compute_user_match_score_batch")));
    expect(batch).toContain("|| jsonb_strip_nulls(jsonb_build_object('data_source',value->>'data_source', 'wave_period_om',value->>'wave_period_om')) ORDER BY ordinality");
    expect(batch).toContain("'wind_direction',value->>'wind_direction','tide_height',value->>'tide_height')");
    expect(batch).toContain("public.user_match_access_result(p_user_id)");
  });

  it("mirrors the TypeScript rule name so the twins stay findable", () => {
    expect(readFileSync(join(process.cwd(), "lib", "scoring", "personal-board.ts"), "utf8")).toContain("export function similarityPeriod");
    expect(migration).toContain("similarityPeriod in lib/scoring/personal-board.ts");
  });
});
