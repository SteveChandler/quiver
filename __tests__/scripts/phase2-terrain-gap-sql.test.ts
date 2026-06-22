import { readFileSync } from "fs";
import { join } from "path";
import { expectSqlAllowedWaveSourceCtes } from "../helpers/sql-wave-source-tags";

describe("Phase 2 terrain gap SQL checks", () => {
  const preflightPath = join(
    __dirname,
    "../../scripts/db/phase2-terrain-gap-preflight.sql"
  );
  const postflightPath = join(
    __dirname,
    "../../scripts/db/phase2-terrain-gap-postflight.sql"
  );
  const montereyBayPreflightPath = join(
    __dirname,
    "../../scripts/db/phase2-terrain-monterey-bay-preflight.sql"
  );
  const montereyBayPostflightPath = join(
    __dirname,
    "../../scripts/db/phase2-terrain-monterey-bay-postflight.sql"
  );

  let preflightSQL: string;
  let postflightSQL: string;
  let montereyBayPreflightSQL: string;
  let montereyBayPostflightSQL: string;

  beforeAll(() => {
    preflightSQL = readFileSync(preflightPath, "utf8");
    postflightSQL = readFileSync(postflightPath, "utf8");
    montereyBayPreflightSQL = readFileSync(montereyBayPreflightPath, "utf8");
    montereyBayPostflightSQL = readFileSync(
      montereyBayPostflightPath,
      "utf8"
    );
  });

  const expectReadOnly = (sql: string) => {
    expect(sql).toMatch(/^BEGIN READ ONLY;/m);
    expect(sql).toMatch(/^ROLLBACK;/m);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  };

  it("keeps the preflight read-only and aligned to missing terrain filters", () => {
    expectReadOnly(preflightSQL);
    expect(preflightSQL).toContain("phase2_current_terrain_coverage");
    expect(preflightSQL).toContain("phase2_gap_regions");
    expect(preflightSQL).toContain("phase2_gap_rows");
    expect(preflightSQL).toContain("terrain_status IS NULL");
    expect(preflightSQL).toContain("swell_access_factors IS NULL");
    expect(preflightSQL).toContain("wind_exposure_factors IS NULL");
    expect(preflightSQL).toContain("array_length(wind_exposure_factors, 1)");
    expect(preflightSQL).toContain("array_length(swell_access_factors, 1)");
    expect(preflightSQL).toContain(
      "yarn terrain:analyze --missing-only --dry-run --concurrency=4 --output-json="
    );
    expect(preflightSQL).toContain(
      "This broad preflight does not approve a production write"
    );
    expect(preflightSQL).not.toContain(
      "yarn terrain:analyze --missing-only --concurrency=4"
    );
  });

  it("keeps the postflight read-only and fails when terrain gaps remain", () => {
    expectReadOnly(postflightSQL);
    expect(postflightSQL).toContain("phase2_postflight_terrain_coverage");
    expect(postflightSQL).toContain("phase2_postflight_assertions");
    expect(postflightSQL).toContain(
      "no_remaining_missing_status_or_factor_arrays"
    );
    expect(postflightSQL).toContain("all_active_have_72_bin_wind_and_swell");
    expect(postflightSQL).toContain("no_invalid_factor_lengths");
    expect(postflightSQL).toContain("phase2_terrain_gap_assertions_passed");
    expect(postflightSQL).toContain("\\gset");
    expect(postflightSQL).toContain("RAISE EXCEPTION");
    expect(postflightSQL).toContain(
      "Phase 2 terrain gap postflight assertions failed"
    );
    expect(postflightSQL).not.toContain("1 / CASE");
    expect(postflightSQL).not.toContain("1 / 0");
    expect(postflightSQL).toContain("phase2_remaining_gap_rows");
    expect(postflightSQL).toContain(
      "Run after separately approved exact-ID terrain writes"
    );
    expect(postflightSQL).toContain(
      "It is not approval evidence for a broad non-dry-run terrain command"
    );
  });

  it("keeps the Monterey Bay preflight scoped to the measured 3-beach candidate", () => {
    expectReadOnly(montereyBayPreflightSQL);
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_preflight_summary"
    );
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_target_rows"
    );
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_phase0_schema_readiness"
    );
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_phase0_schema_ready"
    );
    expect(montereyBayPreflightSQL).toContain("\\gset");
    expect(montereyBayPreflightSQL).toContain(
      "\\if :phase2_monterey_bay_phase0_schema_ready"
    );
    expect(montereyBayPreflightSQL).toContain(
      "skipped_missing_phase0_schema"
    );
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_observed_30d"
    );
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_preflight_assertions"
    );
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_preflight_blockers"
    );
    expect(montereyBayPreflightSQL).toContain("blocker_code");
    expect(montereyBayPreflightSQL).toContain("blocker_message");
    expect(montereyBayPreflightSQL).toContain("active_target_rows=");
    expect(montereyBayPreflightSQL).toContain("approval_0_72h_rows=");
    expect(montereyBayPreflightSQL).toContain(
      "targets_with_approval_0_72h_rows_at_least_25="
    );
    expect(montereyBayPreflightSQL).toContain("Del Monte Beach");
    expect(montereyBayPreflightSQL).toContain("Marina State Beach");
    expect(montereyBayPreflightSQL).toContain("Moss Landing");
    expect(montereyBayPreflightSQL).toContain(
      "a3d480de-3743-4dd7-8092-fb52772a0fb2"
    );
    expect(montereyBayPreflightSQL).toContain(
      "c0f23f4b-fcc4-4849-88f4-cb6da7206d80"
    );
    expect(montereyBayPreflightSQL).toContain(
      "885ad595-67cb-4408-b4cc-9ecf2ce3a848"
    );
    expect(montereyBayPreflightSQL).toContain("target_in_monterey_bay");
    expect(montereyBayPreflightSQL).toContain("would_update_rows");
    expect(montereyBayPreflightSQL).toContain("all_three_targets_active");
    expect(montereyBayPreflightSQL).toContain("all_targets_are_monterey_bay");
    expect(montereyBayPreflightSQL).toContain("all_targets_are_current_gaps");
    expect(montereyBayPreflightSQL).toContain(
      "no_target_has_invalid_factor_lengths"
    );
    expect(montereyBayPreflightSQL).toContain("phase0_metric_rpc_exists");
    expect(montereyBayPreflightSQL).toContain(
      "public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)"
    );
    expect(montereyBayPreflightSQL).toContain(
      "approval_0_72h_rows_at_least_75"
    );
    expect(montereyBayPreflightSQL).toContain(
      "observed_0_72h_rows_without_approval_provenance_0"
    );
    expect(montereyBayPreflightSQL).toContain(
      "all_targets_approval_0_72h_rows_at_least_25"
    );
    expect(montereyBayPreflightSQL).toContain("approval_0_72h_rows");
    expect(montereyBayPreflightSQL).toContain(
      "observed_0_72h_rows_without_approval_provenance"
    );
    expect(montereyBayPreflightSQL).toContain("forecast_horizon_bucket");
    expect(montereyBayPreflightSQL).toContain("display_wave_source");
    expect(montereyBayPreflightSQL).toContain(
      "allowed_wave_sources(source_tag) AS"
    );
    expect(montereyBayPreflightSQL).toContain(
      "FROM allowed_wave_sources AS s"
    );
    expect(montereyBayPreflightSQL).toMatch(
      /WHERE s\.source_tag = (?:c\.)?display_wave_source/
    );
    expect(montereyBayPreflightSQL).not.toMatch(
      /(?:c\.)?display_wave_source\s+(?:NOT\s+)?IN\s*\(/
    );
    expectSqlAllowedWaveSourceCtes(montereyBayPreflightSQL);
    expect(montereyBayPreflightSQL).toContain("display_raw_input_height_m");
    expect(montereyBayPreflightSQL).toContain(
      "display_raw_input_height_m >= 0"
    );
    expect(montereyBayPreflightSQL).toContain(
      "display_raw_input_height_m < 0"
    );
    expect(montereyBayPreflightSQL).toContain(
      "phase2_monterey_bay_preflight_assertions_passed"
    );
    expect(montereyBayPreflightSQL).toContain(
      "--beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848"
    );
    expect(montereyBayPreflightSQL).toContain(
      "--human-approval-token=2026-06-19-phase2-terrain-write-approved"
    );
    expect(montereyBayPreflightSQL).toContain("--approval-report-json=");
    expect(montereyBayPreflightSQL).toContain("--approval-proposed-json=");
    expect(montereyBayPreflightSQL).not.toContain(
      '--region="Monterey Bay"'
    );
    expect(montereyBayPreflightSQL).toContain("RAISE EXCEPTION");
    expect(montereyBayPreflightSQL).toContain(
      "Phase 2 Monterey Bay terrain preflight assertions failed; see phase2_monterey_bay_preflight_blockers and phase2_monterey_bay_preflight_assertions above."
    );
    expect(montereyBayPreflightSQL).not.toContain("1 / CASE");
    expect(montereyBayPreflightSQL).not.toContain("1 / 0");
  });

  it("keeps the Monterey Bay postflight scoped and fail-fast", () => {
    expectReadOnly(montereyBayPostflightSQL);
    expect(montereyBayPostflightSQL).toContain(
      "phase2_monterey_bay_postflight_summary"
    );
    expect(montereyBayPostflightSQL).toContain(
      "phase2_monterey_bay_postflight_assertions"
    );
    expect(montereyBayPostflightSQL).toContain(
      "phase2_monterey_bay_postflight_blockers"
    );
    expect(montereyBayPostflightSQL).toContain("blocker_code");
    expect(montereyBayPostflightSQL).toContain("blocker_message");
    expect(montereyBayPostflightSQL).toContain("target_complete_rows=");
    expect(montereyBayPostflightSQL).toContain("target_72_bin_rows=");
    expect(montereyBayPostflightSQL).toContain("target_dem_horizon_v1_rows=");
    expect(montereyBayPostflightSQL).toContain("active_terrain_coverage=");
    expect(montereyBayPostflightSQL).toContain(
      "phase2_monterey_bay_assertions_passed"
    );
    expect(montereyBayPostflightSQL).toContain("all_three_targets_active");
    expect(montereyBayPostflightSQL).toContain("all_targets_complete");
    expect(montereyBayPostflightSQL).toContain(
      "all_targets_have_72_bin_wind_and_swell"
    );
    expect(montereyBayPostflightSQL).toContain(
      "all_targets_use_dem_horizon_v1"
    );
    expect(montereyBayPostflightSQL).toContain(
      "active_terrain_coverage_at_least_264"
    );
    expect(montereyBayPostflightSQL).toContain(
      "--beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848"
    );
    expect(montereyBayPostflightSQL).toContain(
      "--human-approval-token=2026-06-19-phase2-terrain-write-approved"
    );
    expect(montereyBayPostflightSQL).toContain("--approval-report-json=");
    expect(montereyBayPostflightSQL).toContain("--approval-proposed-json=");
    expect(montereyBayPostflightSQL).not.toContain(
      '--region="Monterey Bay"'
    );
    expect(montereyBayPostflightSQL).toContain("\\gset");
    expect(montereyBayPostflightSQL).toContain("RAISE EXCEPTION");
    expect(montereyBayPostflightSQL).toContain(
      "Phase 2 Monterey Bay terrain postflight assertions failed; see phase2_monterey_bay_postflight_blockers, phase2_monterey_bay_postflight_assertions, and target rows above."
    );
    expect(montereyBayPostflightSQL).not.toContain("1 / CASE");
    expect(montereyBayPostflightSQL).not.toContain("1 / 0");
    expect(montereyBayPostflightSQL).not.toContain(
      "no_remaining_missing_status_or_factor_arrays"
    );
  });
});
