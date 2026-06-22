import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseCliArgs,
  validateForecastAccuracyReport,
  type ForecastAccuracyReport,
} from "../forecast-accuracy-report-validate";

describe("forecast-accuracy-report-validate", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses approval mode and sample floors", () => {
    expect(
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--approval",
        "--min-gate-samples",
        "75",
        "--min-slice-samples=25",
        "--expect-scope-beach-count",
        "3",
        "--expect-proposed-json",
        "/tmp/proposed.json",
        "--max-report-age-hours",
        "24",
      ])
    ).toEqual({
      reportJsonPath: "/tmp/report.json",
      approval: true,
      phase0Baseline: false,
      requireProposedGate: true,
      requireNonRegressingGate: true,
      requireSlices: true,
      requireBeachSlices: true,
      requireNoRegressedSlices: true,
      requireNoUnmeasuredSlices: true,
      minGateSamples: 75,
      minSliceSamples: 25,
      maxRowsWithoutProposedValue: 0,
      expectScopeBeachCount: 3,
      expectProposedJsonPath: "/tmp/proposed.json",
      requireProposedJson: true,
      requireScopeMatchesProposedJson: true,
      maxReportAgeHours: 24,
    });
  });

  it("parses Phase 0 baseline mode with default freshness and sample floors", () => {
    expect(
      parseCliArgs(["--report-json", "/tmp/baseline.json", "--phase0-baseline"])
    ).toMatchObject({
      reportJsonPath: "/tmp/baseline.json",
      approval: false,
      phase0Baseline: true,
      minGateSamples: 75,
      maxReportAgeHours: 24,
    });
  });

  it("requires a report path", () => {
    expect(() => parseCliArgs(["--approval"])).toThrow(
      "Missing --report-json"
    );
  });

  it("rejects value flags without values", () => {
    expect(() => parseCliArgs(["--report-json", "--approval"])).toThrow(
      "--report-json requires a value."
    );
    expect(() => parseCliArgs(["--report-json="])).toThrow(
      "--report-json requires a value."
    );
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--min-gate-samples",
      ])
    ).toThrow("--min-gate-samples requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--min-slice-samples=",
      ])
    ).toThrow("--min-slice-samples requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--max-rows-without-proposed-value",
        "--approval",
      ])
    ).toThrow("--max-rows-without-proposed-value requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--expect-scope-beach-count=",
      ])
    ).toThrow("--expect-scope-beach-count requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--expect-proposed-json",
      ])
    ).toThrow("--expect-proposed-json requires a value.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--max-report-age-hours=",
      ])
    ).toThrow("--max-report-age-hours requires a value.");
  });

  it("rejects unknown approval validation arguments", () => {
    expect(() =>
      parseCliArgs(["--report-json", "/tmp/report.json", "--aproval"])
    ).toThrow("Unknown argument: --aproval.");
    expect(() =>
      parseCliArgs([
        "--report-json",
        "/tmp/report.json",
        "--require-non-regresing-gate",
      ])
    ).toThrow("Unknown argument: --require-non-regresing-gate.");
    expect(() =>
      parseCliArgs(["--report-json", "/tmp/report.json", "/tmp/extra.json"])
    ).toThrow("Unknown argument: /tmp/extra.json.");
  });

  it("requires proposed JSON scope matching in approval mode", () => {
    expect(
      parseCliArgs(["--report-json", "/tmp/report.json", "--approval"])
    ).toMatchObject({
      approval: true,
      minGateSamples: 75,
      minSliceSamples: 25,
      maxReportAgeHours: 24,
      requireProposedJson: true,
      requireScopeMatchesProposedJson: true,
    });
  });

  it("fails approval validation without explicit sample and freshness constraints", () => {
    expect(
      validateForecastAccuracyReport(buildReport(), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: null,
        minSliceSamples: null,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: null,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: false,
        maxReportAgeHours: null,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval validation requires --min-gate-samples.",
        "Approval validation requires --min-slice-samples.",
        "Approval validation requires --max-report-age-hours.",
      ]),
    });
  });

  it("fails approval validation when sample and freshness constraints are zero", () => {
    expect(
      validateForecastAccuracyReport(buildReport(), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 0,
        minSliceSamples: 0,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: null,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: false,
        maxReportAgeHours: 0,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval --min-gate-samples must be at least 1.",
        "Approval --min-slice-samples must be at least 1.",
        "Approval --max-report-age-hours must be at least 1.",
      ]),
    });
  });

  it("fails approval validation when sample and freshness constraints are NaN", () => {
    expect(
      validateForecastAccuracyReport(buildReport(), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: Number.NaN,
        minSliceSamples: Number.NaN,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: null,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: false,
        maxReportAgeHours: Number.NaN,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval --min-gate-samples must be at least 1.",
        "Approval --min-slice-samples must be at least 1.",
        "Approval --max-report-age-hours must be at least 1.",
      ]),
    });
  });

  it("validates a non-regressing approval report", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("fails approval when report schema version is missing or unsupported", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);
    const approvalOptions = {
      approval: true,
      requireProposedGate: true,
      requireNonRegressingGate: true,
      requireSlices: true,
      requireBeachSlices: true,
      requireNoRegressedSlices: true,
      requireNoUnmeasuredSlices: true,
      minGateSamples: 75,
      minSliceSamples: 25,
      maxRowsWithoutProposedValue: 0,
      expectScopeBeachCount: 3,
      expectProposedJsonPath: proposedJsonPath,
      requireProposedJson: true,
      requireScopeMatchesProposedJson: true,
      maxReportAgeHours: 24,
      now: new Date("2026-06-19T12:00:00Z"),
    };
    const missingSchemaVersion = buildReport(proposedJsonPath);
    delete missingSchemaVersion.report_schema_version;

    expect(
      validateForecastAccuracyReport(missingSchemaVersion, approvalOptions)
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report must declare report_schema_version 1.",
      ]),
    });

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          report_schema_version: 2,
        },
        approvalOptions
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report must declare report_schema_version 1.",
      ]),
    });
  });

  it("validates a fresh Phase 0 baseline harness report", () => {
    expect(
      validateForecastAccuracyReport(
        buildPhase0BaselineReport(),
        phase0BaselineOptions()
      )
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("fails Phase 0 baseline validation on proposed or incomplete metric reports", () => {
    const baselineReport = buildPhase0BaselineReport();
    const incompleteReport = {
      ...baselineReport,
      proposed_json_path: "/tmp/proposed.json",
      metrics: baselineReport.metrics?.filter(
        (metric) =>
          !(
            metric.horizon_bucket === "25-72h" &&
            metric.baseline === "raw_om"
          )
      ),
      gate_metrics: baselineReport.gate_metrics?.map((metric) =>
        metric.baseline === "current_display"
          ? { ...metric, sample_count: 74 }
          : metric
      ),
    };

    expect(
      validateForecastAccuracyReport(incompleteReport, phase0BaselineOptions())
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Phase 0 baseline report must not include proposed_json_path.",
        "Phase 0 baseline metric missing for 25-72h / raw_om.",
        "Phase 0 baseline current_display 0-72h sample_count 74 is below 75.",
        "Phase 0 baseline current_display gate sample_count 74 must equal matched_0_72h_rows 75.",
      ]),
    });
  });

  it("accepts approval when proposed JSON approval policy matches the approval constraints", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      approval_policy: approvalPolicy(),
      beaches: [
        { id: "beach-1", shoaling_factors: { version: 1 } },
        { id: "beach-2", shoaling_factors: { version: 1 } },
        { id: "beach-3", shoaling_factors: { version: 1 } },
      ],
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("fails approval when proposed JSON approval policy requires stricter gates", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      approval_policy: approvalPolicy({
        min_gate_samples: 100,
        min_slice_samples: 50,
        max_report_age_hours: 12,
      }),
      beaches: [
        { id: "beach-1", shoaling_factors: { version: 1 } },
        { id: "beach-2", shoaling_factors: { version: 1 } },
        { id: "beach-3", shoaling_factors: { version: 1 } },
      ],
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval --min-gate-samples 75 is weaker than proposed JSON approval_policy.min_gate_samples 100.",
        "Approval --min-slice-samples 25 is weaker than proposed JSON approval_policy.min_slice_samples 50.",
        "Approval --max-report-age-hours 24 is weaker than proposed JSON approval_policy.max_report_age_hours 12.",
      ]),
    });
  });

  it("fails approval when proposed JSON omits the approval policy", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      beaches: [
        { id: "beach-1", shoaling_factors: { version: 1 } },
        { id: "beach-2", shoaling_factors: { version: 1 } },
        { id: "beach-3", shoaling_factors: { version: 1 } },
      ],
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval proposed JSON must include approval_policy.",
      ]),
    });
  });

  it("fails approval when proposed JSON approval policy is not a Phase 0 gate policy", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      approval_policy: approvalPolicy({
        status: "approved",
        production_write_allowed: true,
        requires_phase0_approval: false,
        required_gate: "73h+",
        required_metric: "generic_mae",
        required_validator: "custom-validator",
        min_gate_samples: 0,
        min_slice_samples: Number.NaN,
        max_report_age_hours: 0,
      }),
      beaches: [
        { id: "beach-1", shoaling_factors: { version: 1 } },
        { id: "beach-2", shoaling_factors: { version: 1 } },
        { id: "beach-3", shoaling_factors: { version: 1 } },
      ],
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed JSON approval_policy.status must be phase0_required or harness_only; got approved.",
        "Proposed JSON approval_policy.production_write_allowed must be false for approval artifacts.",
        "Proposed JSON approval_policy.requires_phase0_approval must be true.",
        "Proposed JSON approval_policy.required_gate must be 0-72h; got 73h+.",
        "Proposed JSON approval_policy.required_metric must be face_height_mae; got generic_mae.",
        "Proposed JSON approval_policy.required_validator must be forecast-accuracy-report-validate --approval; got custom-validator.",
        "Proposed JSON approval_policy.min_gate_samples must be a positive integer.",
        "Proposed JSON approval_policy.min_slice_samples must be a positive integer.",
        "Proposed JSON approval_policy.max_report_age_hours must be a positive integer.",
      ]),
    });
  });

  it("validates a session-truth approval report only when the truth contract is present", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);
    const baseOptions = {
      approval: true,
      requireProposedGate: true,
      requireNonRegressingGate: true,
      requireSlices: true,
      requireBeachSlices: true,
      requireNoRegressedSlices: true,
      requireNoUnmeasuredSlices: true,
      minGateSamples: 75,
      minSliceSamples: 25,
      maxRowsWithoutProposedValue: 0,
      expectScopeBeachCount: 3,
      expectProposedJsonPath: proposedJsonPath,
      requireProposedJson: true,
      requireScopeMatchesProposedJson: true,
      maxReportAgeHours: 24,
      now: new Date("2026-06-19T12:00:00Z"),
    };

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          truth_source: "session",
          truth_contract: undefined,
        },
        baseOptions
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report must declare truth_contract.observed_field observed_m.",
        "Approval report must declare truth_contract.truth_quantity breaking_face_height_m.",
        "Approval report must declare truth_contract.metric mae_m.",
        "Approval report with session truth must require canonical display-source session links.",
        "Approval report with session truth must declare canonical_display_source face-Hs-transformer-v1.",
      ]),
    });

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          truth_source: "session",
          truth_contract: {
            observed_field: "observed_m",
            truth_quantity: "breaking_face_height_m",
            metric: "mae_m",
            session_truth_requires_canonical_display_source: true,
            canonical_display_source: "face-Hs-transformer-v1",
          },
        },
        baseOptions
      )
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("fails approval when buoy reports omit the face-height truth contract", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          truth_contract: {
            session_truth_requires_canonical_display_source: true,
            canonical_display_source: "face-Hs-transformer-v1",
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: proposedJsonPath,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: true,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report must declare truth_contract.observed_field observed_m.",
        "Approval report must declare truth_contract.truth_quantity breaking_face_height_m.",
        "Approval report must declare truth_contract.metric mae_m.",
      ]),
    });
  });

  it("validates approval reports only when the measurement contract is row-paired", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);
    const baseOptions = {
      approval: true,
      requireProposedGate: true,
      requireNonRegressingGate: true,
      requireSlices: true,
      requireBeachSlices: true,
      requireNoRegressedSlices: true,
      requireNoUnmeasuredSlices: true,
      minGateSamples: 75,
      minSliceSamples: 25,
      maxRowsWithoutProposedValue: 0,
      expectScopeBeachCount: 3,
      expectProposedJsonPath: proposedJsonPath,
      requireProposedJson: true,
      requireScopeMatchesProposedJson: true,
      maxReportAgeHours: 24,
      now: new Date("2026-06-19T12:00:00Z"),
    };

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          measurement_contract: undefined,
        },
        baseOptions
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report must declare measurement_contract.proposed_delta_method row-paired.",
        "Approval report must declare measurement_contract.comparison_baseline current_display.",
        "Approval report must declare measurement_contract.candidate_baseline proposed_display.",
        "Approval report must declare measurement_contract.gate_horizon 0-72h.",
      ]),
    });

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          measurement_contract: {
            proposed_delta_method: "aggregate",
            comparison_baseline: "raw_display",
            candidate_baseline: "candidate",
            gate_horizon: "73h+",
          },
        },
        baseOptions
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report must declare measurement_contract.proposed_delta_method row-paired.",
        "Approval report must declare measurement_contract.comparison_baseline current_display.",
        "Approval report must declare measurement_contract.candidate_baseline proposed_display.",
        "Approval report must declare measurement_contract.gate_horizon 0-72h.",
      ]),
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), baseOptions)
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("fails when the proposed gate is missing", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_gate_verdict: null,
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: "/tmp/proposed.json",
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Missing proposed 0-72h gate verdict.",
      ]),
    });
  });

  it("fails approval when the harness was not run with hard gate flags", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          approval_gates: {
            fail_on_regression: false,
            fail_on_slice_regression: false,
            fail_on_unmeasured_slices: false,
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report must be generated with --fail-on-regression.",
        "Approval report must be generated with --fail-on-slice-regression.",
        "Approval report must be generated with --fail-on-unmeasured-slices.",
      ]),
    });
  });

  it("fails approval when recorded sample floors do not match required floors", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          approval_gates: {
            fail_on_regression: true,
            fail_on_slice_regression: true,
            fail_on_unmeasured_slices: true,
            min_gate_samples: 1,
            min_slice_samples: 1,
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval report min_gate_samples 1 does not match required --min-gate-samples 75.",
        "Approval report min_slice_samples 1 does not match required --min-slice-samples 25.",
      ]),
    });
  });

  it("fails approval when report range is missing or invalid", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          range: {
            start: "2026-06-20T00:00:00.000Z",
            end: "2026-06-19T01:00:00.000Z",
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Report range.start must be before range.end.",
        "Report range.end 2026-06-19T01:00:00.000Z is after generated_at 2026-06-19T00:00:00.000Z.",
      ]),
    });

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          range: undefined,
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Missing or invalid report range.start.",
        "Missing or invalid report range.end.",
      ]),
    });

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          generated_at: "2026-06-21T00:00:00.000Z",
          range: {
            start: "2026-06-18T00:00:00.000Z",
            end: "2026-06-20T00:00:00.000Z",
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Report range.end 2026-06-20T00:00:00.000Z is after validation time 2026-06-19T12:00:00.000Z.",
      ]),
    });
  });

  it("fails approval when the measured report window is stale", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          generated_at: "2026-06-19T00:00:00.000Z",
          range: {
            start: "2026-05-01T00:00:00.000Z",
            end: "2026-06-16T00:00:00.000Z",
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: proposedJsonPath,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: true,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Report range.end is 72.000h before generated_at, exceeding 24h.",
      ]),
    });
  });

  it("fails approval when compared 0-72h rows lack replay provenance", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          row_counts: {
            ...buildReport().row_counts!,
            matched_0_72h_rows: 75,
            matched_0_72h_rows_with_replay_provenance: 70,
            matched_0_72h_rows_without_replay_provenance: 5,
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Matched 0-72h rows without replay provenance 5 exceeds 0.",
        "0-72h rows with replay provenance 70 is below proposed gate sample count 75.",
      ]),
    });
  });

  it("fails approval when compared 0-72h rows lack horizon-bucket provenance", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          row_counts: {
            ...buildReport().row_counts!,
            matched_0_72h_rows: 75,
            matched_0_72h_rows_with_horizon_bucket_provenance: 70,
            matched_0_72h_rows_without_horizon_bucket_provenance: 5,
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Matched 0-72h rows without horizon-bucket provenance 5 exceeds 0.",
        "0-72h rows with horizon-bucket provenance 70 is below proposed gate sample count 75.",
      ]),
    });
  });

  it("fails approval when horizon-bucket provenance counts are missing", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          row_counts: {
            matched_prediction_rows: 104,
            matched_0_72h_rows: 75,
            matched_0_72h_rows_with_replay_provenance: 75,
            matched_0_72h_rows_without_replay_provenance: 0,
            proposed_rows_compared: 104,
            rows_without_proposed_value: 0,
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Missing matched_0_72h_rows_with_horizon_bucket_provenance in report.",
        "Missing matched_0_72h_rows_without_horizon_bucket_provenance in report.",
      ]),
    });
  });

  it("fails when the proposed gate regresses", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_gate_verdict: {
            ...buildReport().proposed_gate_verdict!,
            verdict: "regressed",
            shouldFail: true,
            delta: {
              ...buildReport().proposed_gate_verdict!.delta,
              delta_mae_m: 0.05,
            },
          },
        },
        {
          approval: false,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: false,
          requireBeachSlices: false,
          requireNoRegressedSlices: false,
          requireNoUnmeasuredSlices: false,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: null,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed 0-72h gate verdict is regressed, delta 0.050m.",
      ]),
    });
  });

  it("fails when the proposed gate verdict conflicts with the numeric delta", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_gate_verdict: {
            ...buildReport().proposed_gate_verdict!,
            verdict: "non-regressing",
            shouldFail: false,
            delta: {
              ...buildReport().proposed_gate_verdict!.delta,
              delta_mae_m: 0.05,
            },
          },
        },
        {
          approval: false,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: false,
          requireBeachSlices: false,
          requireNoRegressedSlices: false,
          requireNoUnmeasuredSlices: false,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: null,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed 0-72h gate verdict non-regressing is inconsistent with delta 0.050m; expected regressed.",
      ]),
    });
  });

  it("fails when the proposed gate delta does not match its MAEs", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_gate_verdict: {
            ...buildReport().proposed_gate_verdict!,
            verdict: "non-regressing",
            shouldFail: false,
            delta: {
              ...buildReport().proposed_gate_verdict!.delta,
              mae_m: 0.6,
              comparison_mae_m: 0.5,
              delta_mae_m: -0.1,
            },
          },
        },
        {
          approval: false,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: false,
          requireBeachSlices: false,
          requireNoRegressedSlices: false,
          requireNoUnmeasuredSlices: false,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: null,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed gate delta_mae_m -0.100 must equal mae_m 0.600 - comparison_mae_m 0.500 (0.100).",
      ]),
    });
  });

  it("fails when proposed gate failure metadata contradicts its sample floor", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_gate_verdict: {
            ...buildReport().proposed_gate_verdict!,
            sampleFloor: {
              minSampleCount: 75,
              insufficientGroups: ["proposed_display"],
              shouldFail: false,
            },
            shouldFail: false,
          },
        },
        {
          approval: false,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: false,
          requireBeachSlices: false,
          requireNoRegressedSlices: false,
          requireNoUnmeasuredSlices: false,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: null,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed gate sampleFloor.shouldFail false is inconsistent with insufficient group count 1; expected true.",
        "Proposed gate shouldFail false is inconsistent with regression/sample-floor state; expected true.",
      ]),
    });
  });

  it("fails when the proposed gate is not the canonical 0-72h proposed-display gate", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_gate_verdict: {
            ...buildReport().proposed_gate_verdict!,
            delta: {
              ...buildReport().proposed_gate_verdict!.delta,
              horizon_group: "73h+",
              baseline: "raw_om",
            },
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed gate horizon_group must be 0-72h, got 73h+.",
        "Proposed gate baseline must be proposed_display, got raw_om.",
      ]),
    });
  });

  it("fails approval when gate slices are not beach-level", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          gate_slices: {
            ...buildReport().gate_slices!,
            group_by: "region",
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Approval requires proposed 0-72h gate slices grouped by beach; got region.",
      ]),
    });
  });

  it("fails approval when beach slice group keys do not cover the report scope", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          gate_slices: {
            ...buildReport().gate_slices!,
            items: [
              {
                groupKey: "beach-1",
                group: "Del Monte Beach",
                proposedCount: 25,
                currentCount: 25,
                deltaMaeM: -0.468,
                verdict: "non-regressing",
              },
              {
                groupKey: "unexpected-beach",
                group: "Unexpected Beach",
                proposedCount: 25,
                currentCount: 25,
                deltaMaeM: -0.1,
                verdict: "non-regressing",
              },
            ],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Beach slice group keys do not match report scope; missing: beach-2, beach-3; unexpected: unexpected-beach.",
      ]),
    });
  });

  it("fails approval when beach slices are missing group keys", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          gate_slices: {
            ...buildReport().gate_slices!,
            items: [
              {
                group: "Del Monte Beach",
                proposedCount: 25,
                currentCount: 25,
                deltaMaeM: -0.468,
                verdict: "non-regressing",
              },
            ],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "1 proposed 0-72h beach slice(s) are missing groupKey.",
        "Beach slice group keys do not match report scope; missing: beach-1, beach-2, beach-3; unexpected: none.",
      ]),
    });
  });

  it("fails approval when beach slices duplicate a group key", () => {
    const report = buildReport();

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          gate_slices: {
            ...report.gate_slices!,
            items: [
              report.gate_slices!.items![0],
              {
                ...report.gate_slices!.items![0],
                group: "Duplicate Del Monte Beach",
              },
              ...report.gate_slices!.items!.slice(1),
            ],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Duplicate proposed 0-72h beach slice groupKey(s): beach-1.",
      ]),
    });
  });

  it("fails for regressed and unmeasured slices", () => {
    const report = buildReport();
    const regressedSlice = {
      ...report.gate_slices!.items![0],
      group: "Bad Beach",
      verdict: "regressed" as const,
      deltaMaeM: 0.1,
    };

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          gate_slices: {
            ...report.gate_slices!,
            items: [regressedSlice],
            verdict: {
              regressedSlices: [regressedSlice],
              shouldFail: true,
            },
            coverage: {
              unmeasuredGroups: ["Missing Beach"],
              shouldFail: true,
            },
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "1 proposed 0-72h slice(s) regressed; worst was Bad Beach by 0.100m MAE.",
        "1 proposed 0-72h slice(s) were unmeasured; first was Missing Beach.",
      ]),
    });
  });

  it("fails approval when slice verdict labels hide numeric regression", () => {
    const report = buildReport();
    const hiddenRegressedSlice = {
      ...report.gate_slices!.items![0],
      deltaMaeM: 0.1,
      verdict: "non-regressing" as const,
    };

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          gate_slices: {
            ...report.gate_slices!,
            items: [
              hiddenRegressedSlice,
              ...report.gate_slices!.items!.slice(1),
            ],
            verdict: {
              regressedSlices: [],
              shouldFail: false,
            },
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Del Monte Beach slice verdict non-regressing is inconsistent with delta 0.100m; expected regressed.",
        "1 proposed 0-72h slice(s) regressed; worst was Del Monte Beach by 0.100m MAE.",
      ]),
    });
  });

  it("fails approval when slice deltas do not match their MAEs", () => {
    const report = buildReport();
    const staleImprovementSlice = {
      ...report.gate_slices!.items![0],
      proposedMaeM: 0.6,
      currentMaeM: 0.5,
      deltaMaeM: -0.1,
      verdict: "non-regressing" as const,
    };

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          gate_slices: {
            ...report.gate_slices!,
            items: [
              staleImprovementSlice,
              ...report.gate_slices!.items!.slice(1),
            ],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Del Monte Beach slice deltaMaeM -0.100 must equal proposedMaeM 0.600 - currentMaeM 0.500 (0.100).",
      ]),
    });
  });

  it("fails approval when slice failure metadata contradicts samples or coverage", () => {
    const report = buildReport();

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          gate_slices: {
            ...report.gate_slices!,
            verdict: {
              regressedSlices: [],
              sampleFloor: {
                minSampleCount: 25,
                insufficientGroups: ["Del Monte Beach: proposed_display"],
                shouldFail: false,
              },
              shouldFail: false,
            },
            coverage: {
              unmeasuredGroups: ["Missing Beach"],
              shouldFail: false,
            },
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Gate slice verdict sampleFloor.shouldFail false is inconsistent with insufficient group count 1; expected true.",
        "Gate slice verdict shouldFail false is inconsistent with regressed slices/sample-floor state; expected true.",
        "Gate slice coverage shouldFail false is inconsistent with unmeasured group count 1; expected true.",
      ]),
    });
  });

  it("fails for thin samples, missing proposed values, and scope mismatch", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          row_counts: {
            matched_prediction_rows: 76,
            proposed_rows_compared: 74,
            rows_without_proposed_value: 1,
          },
          proposed_gate_verdict: {
            ...buildReport().proposed_gate_verdict!,
            delta: {
              ...buildReport().proposed_gate_verdict!.delta,
              sample_count: 74,
              comparison_sample_count: 74,
            },
          },
          gate_slices: {
            ...buildReport().gate_slices!,
            items: [
              {
                groupKey: "beach-1",
                group: "Thin Beach",
                proposedCount: 24,
                currentCount: 24,
                deltaMaeM: -0.1,
                verdict: "non-regressing",
              },
            ],
          },
        },
        {
          approval: false,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: false,
          requireNoUnmeasuredSlices: false,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 4,
          expectProposedJsonPath: "/tmp/other-proposed.json",
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 1,
          now: new Date("2026-06-20T02:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed gate sample count 74 is below 75.",
        "Current gate sample count 74 is below 75.",
        "Thin Beach proposed slice sample count 24 is below 25.",
        "Thin Beach current slice sample count 24 is below 25.",
        "Rows without proposed value 1 exceeds 0.",
        "Scope beach count 3 does not match expected 4.",
        "Report proposed_json_path /tmp/proposed.json does not match expected /tmp/other-proposed.json.",
        "Report age 26.000h exceeds 1h.",
        "Row count invariant failed: proposed_rows_compared 74 + rows_without_proposed_value 1 does not equal matched_prediction_rows 76.",
      ]),
    });
  });

  it("fails when proposed gate sample counts are unpaired", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_gate_verdict: {
            ...buildReport().proposed_gate_verdict!,
            delta: {
              ...buildReport().proposed_gate_verdict!.delta,
              sample_count: 75,
              comparison_sample_count: 76,
            },
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed gate sample_count 75 must equal current comparison_sample_count 76.",
      ]),
    });
  });

  it("fails approval when 0-72h gate samples omit matched short-horizon rows", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          row_counts: {
            ...buildReport().row_counts!,
            matched_0_72h_rows: 80,
            matched_0_72h_rows_with_horizon_bucket_provenance: 80,
            matched_0_72h_rows_with_replay_provenance: 80,
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "0-72h gate sample_count 75 must equal matched_0_72h_rows 80.",
        "0-72h gate comparison_sample_count 75 must equal matched_0_72h_rows 80.",
      ]),
    });
  });

  it("fails approval when matched 0-72h row count is missing", () => {
    const report = buildReport();
    const rowCountsWithoutShortHorizonTotal = { ...report.row_counts! };
    delete rowCountsWithoutShortHorizonTotal.matched_0_72h_rows;
    delete rowCountsWithoutShortHorizonTotal.matched_prediction_rows;
    delete rowCountsWithoutShortHorizonTotal.proposed_rows_compared;

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          row_counts: rowCountsWithoutShortHorizonTotal,
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Missing matched_0_72h_rows in report.",
      ]),
    });
  });

  it("fails when beach slice sample counts are unpaired", () => {
    const report = buildReport();

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          gate_slices: {
            ...report.gate_slices!,
            items: [
              {
                ...report.gate_slices!.items![0],
                currentCount: 26,
              },
              ...report.gate_slices!.items!.slice(1),
            ],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Del Monte Beach proposed slice sample count 25 must equal current slice sample count 26.",
      ]),
    });
  });

  it("fails approval when beach slice sample totals disagree with the gate sample count", () => {
    const report = buildReport();

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          gate_slices: {
            ...report.gate_slices!,
            items: [
              {
                ...report.gate_slices!.items![0],
                proposedCount: 30,
                currentCount: 30,
              },
              ...report.gate_slices!.items!.slice(1),
            ],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: false,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "0-72h proposed slice sample total 80 must equal proposed gate sample_count 75.",
        "0-72h current slice sample total 80 must equal current gate comparison_sample_count 75.",
      ]),
    });
  });

  it("fails approval when numeric report fields are malformed", () => {
    const report = buildReport();

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          row_counts: {
            ...report.row_counts!,
            matched_prediction_rows: "104" as unknown as number,
          },
          proposed_gate_verdict: {
            ...report.proposed_gate_verdict!,
            delta: {
              ...report.proposed_gate_verdict!.delta,
              sample_count: "75" as unknown as number,
              comparison_sample_count: -1,
              mae_m: null as unknown as number,
              comparison_mae_m: "0.431" as unknown as number,
            },
          },
          gate_slices: {
            ...report.gate_slices!,
            items: [
              {
                ...report.gate_slices!.items![0],
                proposedCount: "25" as unknown as number,
                currentCount: -1,
                proposedMaeM: "0.1" as unknown as number,
                currentMaeM: null as unknown as number,
                deltaMaeM: "0" as unknown as number,
              },
              ...report.gate_slices!.items!.slice(1),
            ],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed gate sample_count must be a non-negative integer.",
        "Current gate comparison_sample_count must be a non-negative integer.",
        "Proposed gate mae_m is not finite.",
        "Current gate comparison_mae_m is not finite.",
        "row_counts.matched_prediction_rows must be a non-negative integer.",
        "Del Monte Beach proposed slice sample count is not a non-negative integer.",
        "Del Monte Beach current slice sample count is not a non-negative integer.",
        "Del Monte Beach proposed slice MAE is not finite.",
        "Del Monte Beach current slice MAE is not finite.",
        "Del Monte Beach slice deltaMaeM is not finite.",
      ]),
    });
  });

  it("fails when approval requires a proposed json path and a report has none", () => {
    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(),
          proposed_json_path: null,
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: null,
          expectProposedJsonPath: null,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Missing proposed_json_path in report.",
      ]),
    });
  });

  it("fails when report scope beach ids do not match the proposed json", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-4",
    ]);

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: null,
        minSliceSamples: null,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: null,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Report scope beach IDs do not match proposed JSON; missing: beach-4; unexpected: beach-3.",
      ]),
    });
  });

  it("fails when report scope beach ids contain duplicates", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);
    const report = buildReport(proposedJsonPath);

    expect(
      validateForecastAccuracyReport(
        {
          ...report,
          scope: {
            ...report.scope!,
            beach_ids: ["beach-1", "beach-2", "beach-2", "beach-3"],
          },
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: 75,
          minSliceSamples: 25,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: proposedJsonPath,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: true,
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T12:00:00Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Duplicate scope beach ID(s): beach-2.",
      ]),
    });
  });

  it("fails when proposed JSON beach ids contain duplicates", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      beaches: [
        { id: "beach-1", swell_access_factors: [] },
        { id: "beach-2", swell_access_factors: [] },
        { id: "beach-2", wind_exposure_factors: [] },
        { id: "beach-3", shoaling_factors: { version: 1 } },
      ],
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Duplicate proposed beach ID(s) in proposed JSON: beach-2.",
      ]),
    });
  });

  it("fails when proposed JSON beach slugs contain duplicates", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      beaches: [
        { id: "beach-1", slug: "duplicate-slug", swell_access_factors: [] },
        { id: "beach-2", slug: "duplicate-slug", wind_exposure_factors: [] },
        { id: "beach-3", slug: "unique-slug", shoaling_factors: { version: 1 } },
      ],
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Duplicate proposed beach slug(s) in proposed JSON: duplicate-slug.",
      ]),
    });
  });

  it("fails when top-level proposed JSON beach configs contain duplicate embedded slugs", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      "11111111-1111-4111-8111-111111111111": {
        slug: "duplicate-slug",
        swell_access_factors: [],
      },
      "22222222-2222-4222-8222-222222222222": {
        slug: "duplicate-slug",
        wind_exposure_factors: [],
      },
      "33333333-3333-4333-8333-333333333333": {
        slug: "unique-slug",
        shoaling_factors: { version: 1 },
      },
    });
    const report = {
      ...buildReport(proposedJsonPath),
      scope: {
        beach_count: 3,
        beach_ids: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
      },
    };

    expect(
      validateForecastAccuracyReport(report, {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Duplicate proposed beach slug(s) in proposed JSON: duplicate-slug.",
      ]),
    });
  });

  it("allows repeated prediction rows for the same proposed beach", () => {
    const proposedJsonPath = writeRawProposedJson(tempDirs, {
      approval_policy: approvalPolicy(),
      predictions: [
        { beach_id: "beach-1", proposed_display_height_m: 1.0 },
        { beach_id: "beach-1", proposed_display_height_m: 1.1 },
        { beach_id: "beach-2", proposed_display_height_m: 1.2 },
        { beach_id: "beach-3", proposed_display_height_m: 1.3 },
      ],
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("fails when slug-keyed top-level proposed configs add beaches outside report scope", () => {
    const proposedJsonPath = writeCustomProposedJson(tempDirs, {
      "good-slug": {
        id: "beach-1",
        slug: "good-slug",
        shoaling_factors: { version: 1 },
      },
      "unexpected-slug": {
        id: "beach-4",
        slug: "unexpected-slug",
        swell_access_factors: [1],
      },
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: null,
        minSliceSamples: null,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: null,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Report scope beach IDs do not match proposed JSON; missing: beach-4; unexpected: beach-2, beach-3.",
      ]),
    });
  });

  it("fails when top-level proposed beach configs cannot resolve to beach ids", () => {
    const proposedJsonPath = writeCustomProposedJson(tempDirs, {
      "slug-without-id": {
        slug: "slug-without-id",
        shoaling_factors: { version: 1 },
      },
    });

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: null,
        minSliceSamples: null,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: null,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Top-level proposed beach config key(s) lack resolvable beach IDs: slug-without-id.",
      ]),
    });
  });

  it("fails when report proposed JSON hash does not match the current proposed artifact", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          proposed_json_sha256: "stale-hash",
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: proposedJsonPath,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: true,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.stringContaining(
          "Report proposed_json_sha256 stale-hash does not match current proposed JSON SHA-256"
        ),
      ]),
    });
  });

  it("accepts approval when proposed JSON source hashes match", () => {
    const dir = mkdtempSync(join(tmpdir(), "forecast-report-validate-"));
    tempDirs.push(dir);
    const migrationPath = join(dir, "migration.sql");
    const validatedJsonPath = join(dir, "factors_validated.json");
    writeFileSync(migrationPath, "select 1;\n");
    writeFileSync(validatedJsonPath, "[{\"beach_id\":\"beach-1\"}]\n");
    const proposedJsonPath = writeTempProposedJson(
      tempDirs,
      ["beach-1", "beach-2", "beach-3"],
      {
        sourceMigration: migrationPath,
        sourceMigrationSha256: sha256File(migrationPath),
        sourceValidatedJson: validatedJsonPath,
        sourceValidatedJsonSha256: sha256File(validatedJsonPath),
      }
    );

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("fails approval when proposed JSON source migration hash is stale", () => {
    const dir = mkdtempSync(join(tmpdir(), "forecast-report-validate-"));
    tempDirs.push(dir);
    const migrationPath = join(dir, "migration.sql");
    writeFileSync(migrationPath, "select 1;\n");
    const proposedJsonPath = writeTempProposedJson(
      tempDirs,
      ["beach-1", "beach-2", "beach-3"],
      {
        sourceMigration: migrationPath,
        sourceMigrationSha256: "stale-hash",
      }
    );

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.stringContaining(
          "Proposed JSON source_migration_sha256 stale-hash does not match current source_migration SHA-256"
        ),
      ]),
    });
  });

  it("fails approval when proposed JSON validated source hash is stale", () => {
    const dir = mkdtempSync(join(tmpdir(), "forecast-report-validate-"));
    tempDirs.push(dir);
    const validatedJsonPath = join(dir, "factors_validated.json");
    writeFileSync(validatedJsonPath, "[{\"beach_id\":\"beach-1\"}]\n");
    const proposedJsonPath = writeTempProposedJson(
      tempDirs,
      ["beach-1", "beach-2", "beach-3"],
      {
        sourceValidatedJson: validatedJsonPath,
        sourceValidatedJsonSha256: "stale-hash",
      }
    );

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.stringContaining(
          "Proposed JSON source_validated_json_sha256 stale-hash does not match current source_validated_json SHA-256"
        ),
      ]),
    });
  });

  it("fails approval when proposed JSON has a source migration but no source hash", () => {
    const dir = mkdtempSync(join(tmpdir(), "forecast-report-validate-"));
    tempDirs.push(dir);
    const migrationPath = join(dir, "migration.sql");
    writeFileSync(migrationPath, "select 1;\n");
    const proposedJsonPath = writeTempProposedJson(
      tempDirs,
      ["beach-1", "beach-2", "beach-3"],
      {
        sourceMigration: migrationPath,
      }
    );

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed JSON has source_migration but is missing source_migration_sha256.",
      ]),
    });
  });

  it("fails approval when proposed JSON has a validated source but no source hash", () => {
    const dir = mkdtempSync(join(tmpdir(), "forecast-report-validate-"));
    tempDirs.push(dir);
    const validatedJsonPath = join(dir, "factors_validated.json");
    writeFileSync(validatedJsonPath, "[{\"beach_id\":\"beach-1\"}]\n");
    const proposedJsonPath = writeTempProposedJson(
      tempDirs,
      ["beach-1", "beach-2", "beach-3"],
      {
        sourceValidatedJson: validatedJsonPath,
      }
    );

    expect(
      validateForecastAccuracyReport(buildReport(proposedJsonPath), {
        approval: true,
        requireProposedGate: true,
        requireNonRegressingGate: true,
        requireSlices: true,
        requireBeachSlices: true,
        requireNoRegressedSlices: true,
        requireNoUnmeasuredSlices: true,
        minGateSamples: 75,
        minSliceSamples: 25,
        maxRowsWithoutProposedValue: 0,
        expectScopeBeachCount: 3,
        expectProposedJsonPath: proposedJsonPath,
        requireProposedJson: true,
        requireScopeMatchesProposedJson: true,
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T12:00:00Z"),
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Proposed JSON has source_validated_json but is missing source_validated_json_sha256.",
      ]),
    });
  });

  it("enforces proposed JSON binding for approval callers even when scope matching is disabled", () => {
    const proposedJsonPath = writeTempProposedJson(tempDirs, [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);

    expect(
      validateForecastAccuracyReport(
        {
          ...buildReport(proposedJsonPath),
          proposed_json_sha256: "stale-hash",
        },
        {
          approval: true,
          requireProposedGate: true,
          requireNonRegressingGate: true,
          requireSlices: true,
          requireBeachSlices: true,
          requireNoRegressedSlices: true,
          requireNoUnmeasuredSlices: true,
          minGateSamples: null,
          minSliceSamples: null,
          maxRowsWithoutProposedValue: 0,
          expectScopeBeachCount: 3,
          expectProposedJsonPath: proposedJsonPath,
          requireProposedJson: true,
          requireScopeMatchesProposedJson: false,
          maxReportAgeHours: null,
        }
      )
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.stringContaining(
          "Report proposed_json_sha256 stale-hash does not match current proposed JSON SHA-256"
        ),
      ]),
    });
  });
});

function buildReport(proposedJsonPath = "/tmp/proposed.json"): ForecastAccuracyReport {
  return {
    report_schema_version: 1,
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
    proposed_json_sha256: safeSha256File(proposedJsonPath),
    scope: {
      beach_count: 3,
      beach_ids: ["beach-1", "beach-2", "beach-3"],
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
      verdict: "non-regressing",
      shouldFail: false,
      delta: {
        horizon_group: "0-72h",
        baseline: "proposed_display",
        baseline_label: "Proposed display",
        sample_count: 75,
        comparison_sample_count: 75,
        mae_m: 0.195,
        comparison_mae_m: 0.431,
        delta_mae_m: -0.236,
      },
    },
    gate_slices: {
      group_by: "beach",
      items: [
        {
          groupKey: "beach-1",
          group: "Del Monte Beach",
          proposedCount: 25,
          currentCount: 25,
          proposedMaeM: 0.123,
          currentMaeM: 0.591,
          deltaMaeM: -0.468,
          verdict: "non-regressing",
        },
        {
          groupKey: "beach-2",
          group: "Marina State Beach",
          proposedCount: 25,
          currentCount: 25,
          proposedMaeM: 0.3,
          currentMaeM: 0.44,
          deltaMaeM: -0.14,
          verdict: "non-regressing",
        },
        {
          groupKey: "beach-3",
          group: "Moss Landing",
          proposedCount: 25,
          currentCount: 25,
          proposedMaeM: 0.33,
          currentMaeM: 0.431,
          deltaMaeM: -0.101,
          verdict: "non-regressing",
        },
      ],
      verdict: {
        regressedSlices: [],
        shouldFail: false,
      },
      coverage: {
        unmeasuredGroups: [],
        shouldFail: false,
      },
    },
  };
}

function phase0BaselineOptions(): Parameters<
  typeof validateForecastAccuracyReport
>[1] {
  return {
    approval: false,
    phase0Baseline: true,
    requireProposedGate: false,
    requireNonRegressingGate: false,
    requireSlices: false,
    requireBeachSlices: false,
    requireNoRegressedSlices: false,
    requireNoUnmeasuredSlices: false,
    minGateSamples: 75,
    minSliceSamples: null,
    maxRowsWithoutProposedValue: null,
    expectScopeBeachCount: null,
    expectProposedJsonPath: null,
    requireProposedJson: false,
    requireScopeMatchesProposedJson: false,
    maxReportAgeHours: 24,
    now: new Date("2026-06-20T09:00:00.000Z"),
  };
}

function buildPhase0BaselineReport(): ForecastAccuracyReport {
  const baselines = [
    "current_display",
    "raw_display",
    "raw_om",
    "v5_shadow",
  ];
  const horizons = [
    { id: "0-24h", count: 25 },
    { id: "25-72h", count: 50 },
    { id: "73h+", count: 100 },
  ];

  return {
    report_schema_version: 1,
    generated_at: "2026-06-20T08:34:15.000Z",
    range: {
      start: "2026-05-21T08:24:00.000Z",
      end: "2026-06-20T08:24:00.000Z",
    },
    truth_source: "both",
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
    proposed_json_path: null,
    proposed_json_sha256: null,
    scope: {
      beach_count: "all",
      beach_ids: [],
    },
    row_counts: {
      matched_prediction_rows: 175,
      matched_0_72h_rows: 75,
      matched_0_72h_rows_with_horizon_bucket_provenance: 75,
      matched_0_72h_rows_without_horizon_bucket_provenance: 0,
      matched_0_72h_rows_with_replay_provenance: 75,
      matched_0_72h_rows_without_replay_provenance: 0,
      proposed_rows_compared: 0,
      rows_without_proposed_value: 0,
    },
    metrics: horizons.flatMap((horizon) =>
      baselines.map((baseline, index) => ({
        horizon_bucket: horizon.id,
        baseline,
        baseline_label: baseline,
        sample_count: horizon.count,
        mae_m: 0.2 + index / 100,
        bias_m: -0.1 + index / 100,
      }))
    ),
    gate_metrics: baselines.map((baseline, index) => ({
      horizon_group: "0-72h",
      baseline,
      baseline_label: baseline,
      sample_count: 75,
      mae_m: 0.2 + index / 100,
      bias_m: -0.1 + index / 100,
    })),
    approval_gates: {
      fail_on_regression: false,
      fail_on_slice_regression: false,
      fail_on_unmeasured_slices: false,
      min_gate_samples: null,
      min_slice_samples: null,
    },
    proposed_gate_verdict: null,
    gate_slices: {
      group_by: null,
      items: [],
      verdict: null,
      coverage: null,
    },
  };
}

function safeSha256File(path: string): string {
  try {
    return sha256File(path);
  } catch {
    return "test-sha256";
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeTempProposedJson(
  tempDirs: string[],
  beachIds: string[],
  source?: {
    sourceMigration?: string;
    sourceMigrationSha256?: string;
    sourceValidatedJson?: string;
    sourceValidatedJsonSha256?: string;
  }
): string {
  const dir = mkdtempSync(join(tmpdir(), "forecast-report-validate-"));
  tempDirs.push(dir);
  const path = join(dir, "proposed.json");
  writeFileSync(
    path,
    JSON.stringify({
      approval_policy: approvalPolicy(),
      ...(source
        ? {
            source_migration: source.sourceMigration,
            ...(source.sourceMigrationSha256
              ? { source_migration_sha256: source.sourceMigrationSha256 }
              : {}),
            ...(source.sourceValidatedJson
              ? { source_validated_json: source.sourceValidatedJson }
              : {}),
            ...(source.sourceValidatedJsonSha256
              ? {
                  source_validated_json_sha256:
                    source.sourceValidatedJsonSha256,
                }
              : {}),
          }
        : {}),
      beaches: beachIds.map((id) => ({ id, swell_access_factors: [] })),
    })
  );
  return path;
}

function writeCustomProposedJson(
  tempDirs: string[],
  value: Record<string, unknown>
): string {
  return writeRawProposedJson(tempDirs, value);
}

function writeRawProposedJson(tempDirs: string[], value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "forecast-report-validate-"));
  tempDirs.push(dir);
  const path = join(dir, "proposed.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function approvalPolicy(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    status: "harness_only",
    production_write_allowed: false,
    requires_phase0_approval: true,
    required_gate: "0-72h",
    required_metric: "face_height_mae",
    required_validator: "forecast-accuracy-report-validate --approval",
    min_gate_samples: 75,
    min_slice_samples: 25,
    max_report_age_hours: 24,
    ...overrides,
  };
}
