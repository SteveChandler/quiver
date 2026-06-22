import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertNoDuplicateProposedBeachConfigIds,
  assertNoDuplicateProposedBeachConfigSlugs,
  assertSubsetOutputBeachIdsMatchSelection,
  attachApprovalSubsetMetadata,
  buildApprovalSubsetMetadata,
  buildApprovalSubsetFromReport,
  buildProposedInputSubset,
  extractProposedBeachIds,
  parseCliArgs,
  validateApprovalSubsetSourceReport,
  writeJson,
  type ForecastAccuracyReport,
  type ProposedInput,
} from "../forecast-accuracy-approval-subset";

describe("forecast-accuracy-approval-subset", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses report, proposed, output, and sample floor options", () => {
    expect(
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json=/tmp/proposed.json",
        "--output-json",
        "/tmp/subset.json",
        "--min-gate-samples",
        "90",
        "--min-slice-samples=30",
        "--max-report-age-hours=12",
      ])
    ).toEqual({
      reportJsonPath: "/tmp/report.json",
      proposedJsonPath: "/tmp/proposed.json",
      outputJsonPath: "/tmp/subset.json",
      minGateSamples: 90,
      minSliceSamples: 30,
      maxReportAgeHours: 12,
    });
  });

  it("requires all input and output paths", () => {
    expect(() =>
      parseCliArgs([
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json",
        "/tmp/out.json",
      ])
    ).toThrow("Missing --report-json");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--output-json",
        "/tmp/out.json",
      ])
    ).toThrow("Missing --proposed-json");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json",
        "/tmp/proposed.json",
      ])
    ).toThrow("Missing --output-json");
  });

  it("rejects value flags without values", () => {
    expect(() => parseCliArgs(["--report-json", "--proposed-json"])).toThrow(
      "--report-json requires a value."
    );
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json=",
      ])
    ).toThrow("--proposed-json requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json",
        "--min-gate-samples",
        "25",
      ])
    ).toThrow("--output-json requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json",
        "/tmp/subset.json",
        "--min-slice-samples",
      ])
    ).toThrow("--min-slice-samples requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json",
        "/tmp/subset.json",
        "--min-gate-samples=",
      ])
    ).toThrow("--min-gate-samples requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json",
        "/tmp/subset.json",
        "--max-report-age-hours",
      ])
    ).toThrow("--max-report-age-hours requires a value.");
  });

  it("rejects unknown approval subset arguments", () => {
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json",
        "/tmp/subset.json",
        "--min-gate-sampels",
        "75",
      ])
    ).toThrow("Unknown argument: --min-gate-sampels.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json",
        "/tmp/subset.json",
        "/tmp/extra.json",
      ])
    ).toThrow("Unknown argument: /tmp/extra.json.");
  });

  it("selects only non-regressing beach slices that meet the sample floor", () => {
    const subset = buildApprovalSubsetFromReport(buildReport(), {
      minGateSamples: 25,
      minSliceSamples: 25,
    });

    expect(subset.selectedBeachIds).toEqual(["beach-good"]);
    expect(subset.selectedSlices).toHaveLength(1);
    expect(subset.selectedProposedCount).toBe(25);
    expect(subset.selectedCurrentCount).toBe(25);
    expect(subset.excludedSlices.map((slice) => slice.groupKey)).toEqual([
      "beach-regressed",
      "beach-thin",
      undefined,
    ]);
    expect(subset.unmeasuredGroups).toEqual(["beach-unmeasured"]);
  });

  it("excludes positive-delta beach slices even when the verdict label is stale", () => {
    const report = buildReport();
    const hiddenRegression = {
      groupKey: "beach-hidden-regression",
      group: "Hidden Regression Beach",
      proposedCount: 25,
      currentCount: 25,
      deltaMaeM: 0.05,
      verdict: "non-regressing" as const,
    };

    const subset = buildApprovalSubsetFromReport(
      {
        gate_slices: {
          ...report.gate_slices!,
          items: [hiddenRegression, ...report.gate_slices!.items!],
        },
      },
      {
        minGateSamples: 25,
        minSliceSamples: 25,
      }
    );

    expect(subset.selectedBeachIds).toEqual(["beach-good"]);
    expect(subset.excludedSlices.map((slice) => slice.groupKey)).toContain(
      "beach-hidden-regression"
    );
  });

  it("rejects duplicate beach slice keys before selecting a subset", () => {
    const report = buildReport();
    expect(() =>
      buildApprovalSubsetFromReport(
        {
          gate_slices: {
            ...report.gate_slices!,
            items: [
              report.gate_slices!.items![0],
              {
                ...report.gate_slices!.items![0],
                group: "Duplicate Good Beach",
                deltaMaeM: 0.2,
                verdict: "regressed",
              },
            ],
          },
        },
        {
          minGateSamples: 25,
          minSliceSamples: 25,
        }
      )
    ).toThrow(
      "Approval subset report has duplicate beach slice groupKey(s): beach-good."
    );
  });

  it("excludes slices with malformed sample counts from direct subset selection", () => {
    expect(() =>
      buildApprovalSubsetFromReport(
        {
          gate_slices: {
            group_by: "beach",
            items: [
              {
                groupKey: "beach-string-count",
                group: "String Count Beach",
                proposedCount: "25" as unknown as number,
                currentCount: 25,
                deltaMaeM: -0.1,
                verdict: "non-regressing",
              },
            ],
          },
        },
        {
          minGateSamples: 25,
          minSliceSamples: 25,
        }
      )
    ).toThrow("No approval-eligible beach slices found in report.");
  });

  it("excludes slices with unpaired sample counts from direct subset selection", () => {
    expect(() =>
      buildApprovalSubsetFromReport(
        {
          gate_slices: {
            group_by: "beach",
            items: [
              {
                groupKey: "beach-unpaired-count",
                group: "Unpaired Count Beach",
                proposedCount: 25,
                currentCount: 26,
                deltaMaeM: -0.1,
                verdict: "non-regressing",
              },
            ],
          },
        },
        {
          minGateSamples: 25,
          minSliceSamples: 25,
        }
      )
    ).toThrow("No approval-eligible beach slices found in report.");
  });

  it("excludes slices with stale favorable deltas from direct subset selection", () => {
    expect(() =>
      buildApprovalSubsetFromReport(
        {
          gate_slices: {
            group_by: "beach",
            items: [
              {
                groupKey: "beach-stale-delta",
                group: "Stale Delta Beach",
                proposedCount: 25,
                currentCount: 25,
                proposedMaeM: 0.6,
                currentMaeM: 0.5,
                deltaMaeM: -0.1,
                verdict: "non-regressing",
              },
            ],
          },
        },
        {
          minGateSamples: 25,
          minSliceSamples: 25,
        }
      )
    ).toThrow("No approval-eligible beach slices found in report.");
  });

  it("requires a beach-level harness report", () => {
    expect(() =>
      buildApprovalSubsetFromReport(
        {
          gate_slices: {
            group_by: "region",
            items: [],
          },
        },
        { minGateSamples: 25, minSliceSamples: 25 }
      )
    ).toThrow("Approval subset requires a beach-level harness report; got region.");
  });

  it("fails when no beach slices are approval eligible", () => {
    expect(() =>
      buildApprovalSubsetFromReport(
        {
          gate_slices: {
            group_by: "beach",
            items: [
              {
                groupKey: "beach-regressed",
                group: "Regressed Beach",
                proposedCount: 25,
                currentCount: 25,
                deltaMaeM: 0.1,
                verdict: "regressed",
              },
            ],
          },
        },
        { minGateSamples: 25, minSliceSamples: 25 }
      )
    ).toThrow("No approval-eligible beach slices found in report.");
  });

  it("requires selected slices to meet the aggregate approval sample floor", () => {
    expect(() =>
      buildApprovalSubsetFromReport(buildReport(), {
        minGateSamples: 75,
        minSliceSamples: 25,
      })
    ).toThrow(
      "Approval subset selected proposed gate sample count 25 is below 75; selected current gate sample count 25 is below 75."
    );
  });

  it("filters beach config proposed JSON while preserving metadata", () => {
    const proposedInput: ProposedInput = {
      generated_at: "2026-06-19T00:00:00.000Z",
      source_migration: "supabase/migrations/source.sql",
      source_migration_sha256: "source-sha",
      source_validated_json:
        "../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json",
      source_validated_json_sha256: "validated-source-sha",
      filters: { missingOnly: true, force: false },
      summary: {
        total_beaches: 3,
        successful: 3,
        failed: 0,
        skipped: 0,
        total_time_ms: 300,
        avg_time_per_beach_ms: 100,
      },
      beaches: [
        { id: "beach-good", swell_access_factors: [1] },
        { id: "beach-regressed", swell_access_factors: [1] },
        { id: "beach-thin", swell_access_factors: [1] },
      ],
      failures: [{ id: "failed-beach", error: "failed" }],
    };

    expect(buildProposedInputSubset(proposedInput, ["beach-good"])).toEqual({
      generated_at: "2026-06-19T00:00:00.000Z",
      source_migration: "supabase/migrations/source.sql",
      source_migration_sha256: "source-sha",
      source_validated_json:
        "../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json",
      source_validated_json_sha256: "validated-source-sha",
      filters: {
        missingOnly: true,
        force: false,
        beachId: "beach-good",
      },
      summary: {
        total_beaches: 1,
        successful: 1,
        failed: 0,
        skipped: 0,
        total_time_ms: 100,
        avg_time_per_beach_ms: 100,
      },
      beaches: [{ id: "beach-good", swell_access_factors: [1] }],
      failures: [],
    });
  });

  it("filters prediction arrays and top-level beach configs", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    const proposedInput: ProposedInput = {
      predictions: [
        { beach_id: uuid, proposed_display_height_m: 1 },
        { beach_id: "beach-regressed", proposed_display_height_m: 2 },
      ],
      [uuid]: { shoaling_factors: { version: 1 } },
      "22222222-2222-4222-8222-222222222222": {
        shoaling_factors: { version: 1 },
      },
      "good-slug": {
        id: uuid,
        slug: "good-slug",
        shoaling_factors: { version: 2 },
      },
      "bad-slug": {
        id: "beach-regressed",
        slug: "bad-slug",
        shoaling_factors: { version: 2 },
      },
      "unknown-slug": {
        slug: "unknown-slug",
        shoaling_factors: { version: 3 },
      },
    };

    const subset = buildProposedInputSubset(proposedInput, [uuid]);

    expect(subset).toEqual({
      predictions: [{ beach_id: uuid, proposed_display_height_m: 1 }],
      [uuid]: { shoaling_factors: { version: 1 } },
      "good-slug": {
        id: uuid,
        slug: "good-slug",
        shoaling_factors: { version: 2 },
      },
    });
    expect(extractProposedBeachIds(subset)).toEqual([uuid]);
  });

  it("builds approval subset provenance metadata", () => {
    const subset = buildApprovalSubsetFromReport(buildReport(), {
      minGateSamples: 25,
      minSliceSamples: 25,
    });

    expect(
      buildApprovalSubsetMetadata({
        subset,
        reportJsonPath: "/tmp/report.json",
        reportJsonSha256: "report-sha",
        proposedJsonPath: "/tmp/proposed.json",
        proposedJsonSha256: "proposed-sha",
        minGateSamples: 25,
        minSliceSamples: 25,
        maxReportAgeHours: 24,
        generatedAt: new Date("2026-06-19T00:00:00Z"),
      })
    ).toEqual({
      generated_at: "2026-06-19T00:00:00.000Z",
      source_report_json_path: "/tmp/report.json",
      source_report_json_sha256: "report-sha",
      source_proposed_json_path: "/tmp/proposed.json",
      source_proposed_json_sha256: "proposed-sha",
      selection_rule:
        "beach-level 0-72h row-paired slices with finite proposed/current MAE, numeric delta_mae_m <= 0, and proposed/current sample counts at or above min_slice_samples",
      criteria: {
        min_gate_samples: 25,
        min_slice_samples: 25,
        max_report_age_hours: 24,
      },
      selected_beach_ids: ["beach-good"],
      selected_slice_count: 1,
      selected_proposed_count: 25,
      selected_current_count: 25,
      excluded_measured_slice_count: 3,
      excluded_unmeasured_group_count: 1,
      selected_slices: [
        {
          beach_id: "beach-good",
          group: "Good Beach",
          proposed_count: 25,
          current_count: 25,
          proposed_mae_m: 0.2,
          current_mae_m: 0.3,
          delta_mae_m: -0.1,
        },
      ],
    });
  });

  it("attaches approval subset metadata without changing proposed beach ids", () => {
    const metadata = buildApprovalSubsetMetadata({
      subset: buildApprovalSubsetFromReport(buildReport(), {
        minGateSamples: 25,
        minSliceSamples: 25,
      }),
      reportJsonPath: "/tmp/report.json",
      reportJsonSha256: "report-sha",
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: "proposed-sha",
      minGateSamples: 25,
      minSliceSamples: 25,
      maxReportAgeHours: 24,
      generatedAt: new Date("2026-06-19T00:00:00Z"),
    });
    const proposedInput: ProposedInput = [
      { beach_id: "beach-good", proposed_display_height_m: 1 },
    ];

    const withMetadata = attachApprovalSubsetMetadata(proposedInput, metadata);

    expect(withMetadata).toMatchObject({
      predictions: [{ beach_id: "beach-good", proposed_display_height_m: 1 }],
      approval_subset: {
        selected_beach_ids: ["beach-good"],
      },
    });
    expect(extractProposedBeachIds(withMetadata)).toEqual(["beach-good"]);
  });

  it("preserves proposed approval policy metadata without adding beach ids", () => {
    const proposedInput: ProposedInput = {
      approval_policy: {
        status: "phase0_required",
        production_write_allowed: false,
        requires_phase0_approval: true,
        required_gate: "0-72h",
        required_metric: "face_height_mae",
        required_validator: "forecast-accuracy-report-validate --approval",
        min_gate_samples: 75,
        min_slice_samples: 25,
        max_report_age_hours: 24,
      },
      beaches: [
        { id: "beach-good", shoaling_factors: { version: 1 } },
        { id: "beach-regressed", shoaling_factors: { version: 1 } },
      ],
    };

    const subset = buildProposedInputSubset(proposedInput, ["beach-good"]);

    expect(subset).toMatchObject({
      approval_policy: proposedInput.approval_policy,
      beaches: [{ id: "beach-good" }],
    });
    expect(extractProposedBeachIds(subset)).toEqual(["beach-good"]);
  });

  it("fails when subset output misses selected ids or keeps unselected ids", () => {
    expect(() =>
      assertSubsetOutputBeachIdsMatchSelection(["beach-good"], [
        "beach-good",
        "beach-missing",
      ])
    ).toThrow(
      "Selected beach ids missing from proposed output: beach-missing"
    );

    expect(() =>
      assertSubsetOutputBeachIdsMatchSelection(
        ["beach-good", "beach-regressed"],
        ["beach-good"]
      )
    ).toThrow(
      "Unselected beach ids survived in proposed output: beach-regressed"
    );
  });

  it("fails when subset output duplicates selected ids", () => {
    expect(() =>
      assertSubsetOutputBeachIdsMatchSelection(
        ["beach-good", "beach-good"],
        ["beach-good"]
      )
    ).toThrow("Duplicate proposed output beach id(s): beach-good.");
  });

  it("fails when proposed output duplicates beach config ids", () => {
    expect(() =>
      assertNoDuplicateProposedBeachConfigIds({
        beaches: [
          { id: "beach-good", swell_access_factors: [1] },
          { id: "beach-good", wind_exposure_factors: [1] },
        ],
      })
    ).toThrow("Duplicate proposed output beach id(s): beach-good.");
  });

  it("fails when proposed output duplicates beach config slugs", () => {
    expect(() =>
      assertNoDuplicateProposedBeachConfigSlugs({
        beaches: [
          {
            id: "beach-good",
            slug: "duplicate-slug",
            swell_access_factors: [1],
          },
          {
            id: "beach-other",
            slug: "duplicate-slug",
            wind_exposure_factors: [1],
          },
        ],
      })
    ).toThrow("Duplicate proposed output beach slug(s): duplicate-slug.");

    expect(() =>
      assertNoDuplicateProposedBeachConfigSlugs({
        "11111111-1111-4111-8111-111111111111": {
          slug: "duplicate-slug",
          swell_access_factors: [1],
        },
        "22222222-2222-4222-8222-222222222222": {
          slug: "duplicate-slug",
          wind_exposure_factors: [1],
        },
      })
    ).toThrow("Duplicate proposed output beach slug(s): duplicate-slug.");
  });

  it("validates hard source report gates while allowing excluded bad slices", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-good",
      "beach-regressed",
      "beach-thin",
      "beach-unmeasured",
    ]);
    const report = buildValidatedReport(proposedJsonPath);

    expect(() =>
      validateApprovalSubsetSourceReport(report, {
        proposedJsonPath,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).not.toThrow();
  });

  it("allows a stricter source harness gate floor than the narrowed subset floor", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-good",
      "beach-regressed",
      "beach-thin",
      "beach-unmeasured",
    ]);
    const baseReport = buildValidatedReport(proposedJsonPath);
    const report = {
      ...baseReport,
      approval_gates: {
        ...baseReport.approval_gates,
        min_gate_samples: 175,
      },
      proposed_gate_verdict: {
        ...baseReport.proposed_gate_verdict!,
        sampleFloor: {
          minSampleCount: 175,
          insufficientGroups: [],
          shouldFail: false,
        },
        delta: {
          ...baseReport.proposed_gate_verdict!.delta,
          sample_count: 175,
          comparison_sample_count: 175,
        },
      },
      row_counts: {
        ...baseReport.row_counts!,
        matched_0_72h_rows: 175,
        matched_0_72h_rows_with_horizon_bucket_provenance: 175,
        matched_0_72h_rows_with_replay_provenance: 175,
      },
      gate_slices: {
        ...baseReport.gate_slices!,
        items: [
          {
            ...baseReport.gate_slices!.items![0],
            proposedCount: 75,
            currentCount: 75,
          },
          {
            ...baseReport.gate_slices!.items![1],
            proposedCount: 50,
            currentCount: 50,
          },
          {
            ...baseReport.gate_slices!.items![2],
            proposedCount: 24,
            currentCount: 24,
          },
          {
            ...baseReport.gate_slices!.items![3],
            proposedCount: 26,
            currentCount: 26,
          },
        ],
      },
    };

    expect(() =>
      validateApprovalSubsetSourceReport(report, {
        proposedJsonPath,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).not.toThrow();
  });

  it("rejects source reports without hard harness flags", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-good",
      "beach-regressed",
      "beach-thin",
      "beach-unmeasured",
    ]);
    const report = {
      ...buildValidatedReport(proposedJsonPath),
      approval_gates: {
        fail_on_regression: false,
        fail_on_slice_regression: false,
        fail_on_unmeasured_slices: false,
      },
    };

    expect(() =>
      validateApprovalSubsetSourceReport(report, {
        proposedJsonPath,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toThrow(
      "Approval subset source report failed validation: Approval report must be generated with --fail-on-regression."
    );
  });

  it("rejects source reports without hard evidence contracts", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-good",
      "beach-regressed",
      "beach-thin",
      "beach-unmeasured",
    ]);

    expect(() =>
      validateApprovalSubsetSourceReport(
        {
          ...buildValidatedReport(proposedJsonPath),
          truth_source: undefined,
          truth_contract: undefined,
          measurement_contract: undefined,
        },
        {
          proposedJsonPath,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toThrow(
      "Approval subset source report failed validation: Missing or invalid truth_source in report.; Approval report must declare measurement_contract.proposed_delta_method row-paired."
    );

    expect(() =>
      validateApprovalSubsetSourceReport(
        {
          ...buildValidatedReport(proposedJsonPath),
          truth_source: "session",
          truth_contract: {
            observed_field: "legacy_observed",
            truth_quantity: "wave_height_hs_m",
            metric: "rmse_m",
            session_truth_requires_canonical_display_source: false,
            canonical_display_source: "legacy",
          },
          measurement_contract: {
            proposed_delta_method: "aggregate",
            comparison_baseline: "raw_display",
            candidate_baseline: "candidate",
            gate_horizon: "73h+",
          },
        },
        {
          proposedJsonPath,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toThrow(
      "Approval report must declare truth_contract.observed_field observed_m."
    );
  });

  it("rejects source reports whose proposed artifact hash is stale", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-good",
      "beach-regressed",
      "beach-thin",
      "beach-unmeasured",
    ]);
    const report = {
      ...buildValidatedReport(proposedJsonPath),
      proposed_json_sha256: "stale-hash",
    };

    expect(() =>
      validateApprovalSubsetSourceReport(report, {
        proposedJsonPath,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toThrow(
      "Report proposed_json_sha256 stale-hash does not match current proposed JSON SHA-256"
    );
  });

  it("rejects source proposed artifacts without approval policy", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      beaches: [
        { id: "beach-good", swell_access_factors: [] },
        { id: "beach-regressed", swell_access_factors: [] },
        { id: "beach-thin", swell_access_factors: [] },
        { id: "beach-unmeasured", swell_access_factors: [] },
      ],
    });
    const report = buildValidatedReport(proposedJsonPath);

    expect(() =>
      validateApprovalSubsetSourceReport(report, {
        proposedJsonPath,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toThrow("Approval proposed JSON must include approval_policy.");
  });

  it("rejects source reports whose proposed source migration hash is stale", () => {
    const migrationDir = mkdtempSync(join(tmpdir(), "approval-subset-migration-"));
    tempDirs.push(migrationDir);
    const migrationPath = join(migrationDir, "source.sql");
    writeFileSync(migrationPath, "select 1;\n");
    const proposedJsonPath = writeTempProposedJson(
      tempDirs,
      [
        "beach-good",
        "beach-regressed",
        "beach-thin",
        "beach-unmeasured",
      ],
      {
        sourceMigration: migrationPath,
        sourceMigrationSha256: "stale-source-sha",
      }
    );
    const report = buildValidatedReport(proposedJsonPath);

    expect(() =>
      validateApprovalSubsetSourceReport(report, {
        proposedJsonPath,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toThrow("Proposed JSON source_migration_sha256 stale-source-sha");
  });

  it("writes newline-terminated JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "approval-subset-"));
    const outputPath = join(dir, "subset.json");

    try {
      const resolvedPath = writeJson(outputPath, {
        beaches: [{ id: "beach-good" }],
      });

      expect(resolvedPath).toBe(outputPath);
      expect(readFileSync(outputPath, "utf8")).toMatch(/\n$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function buildReport(): ForecastAccuracyReport {
  return {
    gate_slices: {
      group_by: "beach",
      items: [
        {
          groupKey: "beach-good",
          group: "Good Beach",
          proposedCount: 25,
          currentCount: 25,
          proposedMaeM: 0.2,
          currentMaeM: 0.3,
          deltaMaeM: -0.1,
          verdict: "non-regressing",
        },
        {
          groupKey: "beach-regressed",
          group: "Regressed Beach",
          proposedCount: 25,
          currentCount: 25,
          proposedMaeM: 0.5,
          currentMaeM: 0.3,
          deltaMaeM: 0.2,
          verdict: "regressed",
        },
        {
          groupKey: "beach-thin",
          group: "Thin Beach",
          proposedCount: 24,
          currentCount: 24,
          proposedMaeM: 0.2,
          currentMaeM: 0.3,
          deltaMaeM: -0.1,
          verdict: "non-regressing",
        },
        {
          group: "Missing Key Beach",
          proposedCount: 1,
          currentCount: 1,
          proposedMaeM: 0.2,
          currentMaeM: 0.3,
          deltaMaeM: -0.1,
          verdict: "non-regressing",
        },
      ],
      coverage: {
        unmeasuredGroups: ["beach-unmeasured"],
      },
    },
  };
}

function buildValidatedReport(proposedJsonPath: string): ForecastAccuracyReport {
  return {
    generated_at: "2026-06-19T00:00:00.000Z",
    range: {
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-18T00:00:00.000Z",
    },
    truth_source: "buoy",
    truth_contract: {
      observed_field: "observed_m",
      truth_quantity: "breaking_face_height_m",
      metric: "mae_m",
      session_truth_requires_canonical_display_source: true,
      canonical_display_source: "face-Hs-transformer-v1",
    },
    measurement_contract: {
      proposed_delta_method: "row-paired",
      comparison_baseline: "current_display",
      candidate_baseline: "proposed_display",
      gate_horizon: "0-72h",
    },
    proposed_json_path: proposedJsonPath,
    proposed_json_sha256: sha256File(proposedJsonPath),
    scope: {
      beach_count: 4,
      beach_ids: [
        "beach-good",
        "beach-regressed",
        "beach-thin",
        "beach-unmeasured",
      ],
    },
    row_counts: {
      matched_prediction_rows: 104,
      matched_0_72h_rows: 75,
      matched_0_72h_rows_with_horizon_bucket_provenance: 75,
      matched_0_72h_rows_without_horizon_bucket_provenance: 0,
      matched_0_72h_rows_with_replay_provenance: 75,
      matched_0_72h_rows_without_replay_provenance: 0,
      proposed_rows_compared: 104,
      rows_without_proposed_value: 0,
    },
    approval_gates: {
      fail_on_regression: true,
      fail_on_slice_regression: true,
      fail_on_unmeasured_slices: true,
      min_gate_samples: 75,
      min_slice_samples: 25,
    },
    proposed_gate_verdict: {
      verdict: "regressed",
      shouldFail: true,
      delta: {
        horizon_group: "0-72h",
        baseline: "proposed_display",
        baseline_label: "Proposed display",
        sample_count: 75,
        comparison_sample_count: 75,
        mae_m: 0.45,
        comparison_mae_m: 0.43,
        delta_mae_m: 0.02,
      },
    },
    gate_slices: buildReport().gate_slices,
  };
}

function writeTempProposedJson(
  tempDirs: string[],
  beachIds: string[],
  source?: {
    sourceMigration: string;
    sourceMigrationSha256: string;
  }
): string {
  const dir = mkdtempSync(join(tmpdir(), "approval-subset-"));
  tempDirs.push(dir);
  const path = join(dir, "proposed.json");
  writeFileSync(
    path,
    JSON.stringify({
      approval_policy: approvalPolicy(),
      ...(source
        ? {
            source_migration: source.sourceMigration,
            source_migration_sha256: source.sourceMigrationSha256,
          }
        : {}),
      beaches: beachIds.map((id) => ({ id, swell_access_factors: [] })),
    })
  );
  return path;
}

function writeRawProposedJson(tempDirs: string[], value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "approval-subset-"));
  tempDirs.push(dir);
  const path = join(dir, "proposed.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function approvalPolicy(): Record<string, unknown> {
  return {
    status: "phase0_required",
    production_write_allowed: false,
    requires_phase0_approval: true,
    required_gate: "0-72h",
    required_metric: "face_height_mae",
    required_validator: "forecast-accuracy-report-validate --approval",
    min_gate_samples: 75,
    min_slice_samples: 25,
    max_report_age_hours: 24,
  };
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
