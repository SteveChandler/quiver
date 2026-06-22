import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const LEARNED_PATH_MARKER = "-- Parse forecast inputs.";

function readMigration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

function normalized(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

function learnedPath(sql: string): string {
  const markerIndex = sql.indexOf(LEARNED_PATH_MARKER);

  expect(markerIndex).toBeGreaterThan(-1);
  return sql.slice(markerIndex);
}

describe("cold-start prior match score migration", () => {
  it("replaces only compute_user_match_score_core and keeps the learned path unchanged", () => {
    const previous = readMigration("20260612123000_match_score_skill_aware_band.sql");
    const current = readMigration("20260622064000_coldstart_prior_match_score.sql");
    const compactSql = normalized(current);

    expect(hasTransactionOrBackfilledMetadata(current)).toBe(true);
    expect(compactSql).toContain(
      "create or replace function public.compute_user_match_score_core",
    );
    expect(compactSql).not.toContain(
      "create or replace function public.compute_user_match_score(",
    );
    expect(learnedPath(current)).toBe(learnedPath(previous));
  });

  it("returns a numeric starter score with honest skill and spot copy", () => {
    const compactSql = normalized(
      readMigration("20260622064000_coldstart_prior_match_score.sql"),
    );

    expect(compactSql).toContain("if v_session_count < 5 then");
    expect(compactSql).toContain("'state', 'starter'");
    expect(compactSql).toContain("'score', round(v_prior_score::numeric, 1)");
    expect(compactSql).toContain("based on your skill + this spot");
    expect(compactSql).toContain("based on your skill level");
    expect(compactSql).toContain("a starter read from your skill");
    expect(compactSql).not.toContain("fits your stated preferences");
  });

  it("anchors the starter prior on skill, optional spot dimensions, and early positives", () => {
    const compactSql = normalized(
      readMigration("20260622064000_coldstart_prior_match_score.sql"),
    );

    expect(compactSql).toContain("v_prior_dimensions jsonb := jsonb_build_array('skill_wave')");
    expect(compactSql).toContain("v_profile_skill in ('beginner', 'intermediate', 'advanced', 'expert')");
    expect(compactSql).toContain("v_skill_source := 'profile'");
    expect(compactSql).toContain("v_skill_source := 'board_prior'");
    expect(compactSql).toContain("v_skill_source := 'default'");
    expect(compactSql).toContain("v_prior_wind_dir := v_spot_wind_offshore_deg");
    expect(compactSql).toContain("v_prior_tide := (v_spot_tide_min_ft + v_spot_tide_max_ft) / 2.0");
    expect(compactSql).toContain("v_blend_weight := v_session_count::numeric / (v_session_count::numeric + 5.0)");
    expect(compactSql).toContain("v_prior_weight_total := v_prior_weight_total + 0.35");
    expect(compactSql).toContain("v_prior_weight_total := v_prior_weight_total + 0.10");
    expect(compactSql).toContain("'prior_dimensions', v_prior_dimensions");
    expect(compactSql).toContain("'skill_used', v_resolved_skill");
    expect(compactSql).toContain("'skill_source', v_skill_source");
  });
});
