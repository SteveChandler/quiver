import { readFileSync } from "fs";
import { join } from "path";

describe("Track A session truth relinkability SQL", () => {
  const sqlPath = join(
    __dirname,
    "../../scripts/db/track-a-session-truth-relinkability.sql"
  );
  const sql = readFileSync(sqlPath, "utf8");

  it("is read-only and does not expose raw identifiers in outputs", () => {
    expect(sql).toMatch(/^BEGIN READ ONLY;/m);
    expect(sql).toMatch(/^ROLLBACK;/m);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bALTER\b/i);
    expect(sql).not.toMatch(/\bCREATE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/'session_id'/i);
    expect(sql).not.toMatch(/'user_id'/i);
    expect(sql).not.toMatch(/'beach_id'/i);
    expect(sql).not.toMatch(/'ml_prediction_id'/i);
  });

  it("uses the canonical Phase 0 session-truth matching contract", () => {
    expect(sql).toContain("public.session_wave_observation_candidates");
    expect(sql).toContain("JOIN public.profiles pr");
    expect(sql).toContain("pr.id = c.user_id");
    expect(sql).toContain("pr.deleted_at IS NULL");
    expect(sql).toContain("COALESCE(pr.is_mock, false) = false");
    expect(sql).toContain("COALESCE(pr.analytics_is_real_user, true) = true");
    expect(sql).toContain("COALESCE(pr.is_system_account, false) = false");
    expect(sql).toContain("public.ml_predictions_log");
    expect(sql).toContain("c.ml_prediction_id IS NULL");
    expect(sql).toContain("p.display_source = 'face-Hs-transformer-v1'");
    expect(sql).toContain(
      "p.predicted_at BETWEEN c.observed_at - interval '6 hours'"
    );
    expect(sql).toContain("c.observed_at + interval '6 hours'");
    expect(sql).toContain(
      "WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'"
    );
    expect(sql).toContain("p.forecast_horizon_hours ASC NULLS LAST");
    expect(sql).toContain("p.created_at DESC");
  });

  it("emits aggregate relinkability result sets", () => {
    expect(sql).toContain(
      "track_a_session_truth_relinkability_summary"
    );
    expect(sql).toContain(
      "track_a_session_truth_relinkability_by_source"
    );
    expect(sql).toContain(
      "track_a_session_truth_relinkability_by_potential_horizon"
    );
    expect(sql).toContain(
      "track_a_session_truth_relinkability_by_delta_bucket"
    );
    expect(sql).toContain("relinkable_canonical_within_6h");
    expect(sql).toContain("relinkable_canonical_0_72h");
    expect(sql).toContain("no_canonical_match_within_6h");
  });
});
