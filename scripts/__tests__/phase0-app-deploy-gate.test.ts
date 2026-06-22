import { rmSync, writeFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  FORECAST_ROADMAP_GUARD_JEST_TARGETS,
  FORECAST_ROADMAP_SOURCE_ESLINT_TARGETS,
  PHASE0_BASELINE_HARNESS_JSON,
  PHASE0_FOCUSED_ESLINT_TARGETS,
  PHASE0_FOCUSED_JEST_TARGETS,
  buildPhase0GateEvidence,
  buildPhase0AppDeployGateSteps,
  checkRequiredNodeMajorVersion,
  parseCliArgs,
  printPhase0AppDeployGateSteps,
  runPhase0AppDeployGate,
  validatePhase0GateEvidence,
  validatePhase0GateEvidenceFile,
  writePhase0GateEvidence,
  type Phase0GateEvidence,
  type Phase0GateRunResult,
  type Phase0GateRunner,
} from "../phase0-app-deploy-gate";
import { FORECAST_GATE_TYPECHECK_TARGETS } from "../typecheck-forecast-gate";

const PHASE0_PREFLIGHT_STDOUT = `
                 check_name
--------------------------------------------
 phase0_face_hs_display_source_contract_30d
(1 row)

 candidate_rows | face_hs_display_source_rows | model_version_face_hs_without_display_source_rows | missing_display_source_rows | other_display_source_rows
----------------+-----------------------------+---------------------------------------------------+-----------------------------+---------------------------
          75780 |                       75780 |                                                 0 |                           0 |                         0
(1 row)

             check_name
------------------------------------
 phase0_preflight_readiness_summary
(1 row)

 legacy_short_horizon_starvation_detected | can_request_phase0_migration_approval
------------------------------------------+---------------------------------------
 t                                        | t
(1 row)

        check_name
---------------------------
 phase0_preflight_blockers
(1 row)

 blocker_code | blocker_message
--------------+-----------------
(0 rows)

 phase0_preflight_assertions_passed
------------------------------------
                                  1
(1 row)
`;

const SNAPSHOT_LOGGING_HEALTH_STDOUT = `
                  check_name
----------------------------------------------
 phase0_snapshot_logging_health_legacy_window
(1 row)

 total_rows | distinct_beaches | rows_missing_canonical_model_version | rows_missing_valid_horizon_hours | rows_missing_display_heights
------------+------------------+--------------------------------------+----------------------------------+------------------------------
       2589 |              318 |                                    0 |                                0 |                            0
(1 row)

               check_name
-----------------------------------------
 phase0_snapshot_logging_health_blockers
(1 row)

 blocker_code | blocker_message | detail
--------------+-----------------+--------
(0 rows)

 phase0_snapshot_logging_health_assertions_passed
--------------------------------------------------
                                                1
(1 row)
`;

function writeBaselineHarnessFixture(): void {
  const baselines = [
    "current_display",
    "raw_display",
    "raw_om",
    "v5_shadow",
  ];
  writeFileSync(
    PHASE0_BASELINE_HARNESS_JSON,
    `${JSON.stringify(
      {
        report_schema_version: 1,
        generated_at: "2026-06-20T04:00:00.000Z",
        range: {
          start: "2026-05-21T04:00:00.000Z",
          end: "2026-06-20T04:00:00.000Z",
        },
        truth_source: "both",
        row_counts: {
          buoy_observation_rows: 100,
          session_observation_rows: 10,
          matched_prediction_rows: 110,
          matched_0_72h_rows: 75,
          matched_0_72h_rows_with_horizon_bucket_provenance: 75,
          matched_0_72h_rows_without_horizon_bucket_provenance: 0,
          matched_0_72h_rows_with_replay_provenance: 75,
          matched_0_72h_rows_without_replay_provenance: 0,
          proposed_rows_compared: 0,
          rows_without_proposed_value: 0,
        },
        gate_metrics: baselines.map((baseline, index) => ({
          horizon_group: "0-72h",
          baseline,
          baseline_label: baseline,
          sample_count: 75,
          mae_m: 0.2 + index / 100,
          bias_m: -0.1 + index / 100,
        })),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function buildSqlStepOutputs(): Phase0GateRunResult["stepOutputs"] {
  writeBaselineHarnessFixture();
  return [
    {
      id: "phase0-baseline-harness",
      stdout: `Wrote harness report JSON: ${PHASE0_BASELINE_HARNESS_JSON}\n`,
      stderr: "",
    },
    {
      id: "phase0-baseline-validate",
      stdout:
        "Forecast accuracy report validation passed.\nRows compared: 110; rows without proposed value: 0.\n",
      stderr: "",
    },
    {
      id: "phase0-preflight",
      stdout: PHASE0_PREFLIGHT_STDOUT,
      stderr: "",
    },
    {
      id: "snapshot-logging-health",
      stdout: SNAPSHOT_LOGGING_HEALTH_STDOUT,
      stderr: "",
    },
  ];
}

function buildValidEvidenceForValidation(): Phase0GateEvidence {
  writeBaselineHarnessFixture();
  const options = {
    includePreviewBuild: true,
    includeReadOnlySql: true,
    includeBaselineHarness: true,
    envFile: ".env.production.local",
    deployStartUtc: "2026-06-19T18:00:00Z",
    outputJsonPath: "/tmp/phase0-gate.json",
    validateOutputJsonPath: null,
    printOnly: false,
    postgresUrl: "postgres://readonly.example",
  };
  const stepsRun = buildPhase0AppDeployGateSteps(options).map(
    (step) => step.id
  );

  return buildPhase0GateEvidence(
    options,
    {
      stepsRun,
      stepOutputs: buildSqlStepOutputs(),
    },
    new Date("2026-06-20T04:00:00.000Z")
  );
}

describe("phase0-app-deploy-gate", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    rmSync(PHASE0_BASELINE_HARNESS_JSON, { force: true });
  });

  it("parses default gate options", () => {
    expect(parseCliArgs([])).toEqual({
      includePreviewBuild: true,
      includeReadOnlySql: true,
      includeBaselineHarness: true,
      envFile: ".env.production.local",
      deployStartUtc: null,
      outputJsonPath: null,
      validateOutputJsonPath: null,
      maxEvidenceAgeHours: null,
      allowPartialGateEvidence: false,
      requireDeployStartUtc: false,
      printOnly: false,
    });
  });

  it("parses skip flags, evidence modes, env file, and deploy timestamp", () => {
    expect(() =>
      parseCliArgs([
        "--skip-preview-build",
        "--skip-read-only-sql",
        "--skip-baseline-harness",
        "--env-file",
        ".env.phase0",
        "--deploy-start-utc=2026-06-19T18:00:00Z",
        "--output-json",
        "/tmp/phase0-gate.json",
        "--validate-output-json=/tmp/phase0-gate-validation.json",
        "--print-only",
      ])
    ).toThrow("--validate-output-json cannot be combined with --output-json.");

    expect(
      parseCliArgs([
        "--skip-preview-build",
        "--skip-read-only-sql",
        "--skip-baseline-harness",
        "--env-file",
        ".env.phase0",
        "--deploy-start-utc=2026-06-19T18:00:00Z",
        "--output-json",
        "/tmp/phase0-gate.json",
      ])
    ).toEqual({
      includePreviewBuild: false,
      includeReadOnlySql: false,
      includeBaselineHarness: false,
      envFile: ".env.phase0",
      deployStartUtc: "2026-06-19T18:00:00Z",
      outputJsonPath: "/tmp/phase0-gate.json",
      validateOutputJsonPath: null,
      maxEvidenceAgeHours: null,
      allowPartialGateEvidence: false,
      requireDeployStartUtc: false,
      printOnly: false,
    });

    expect(
      parseCliArgs([
        "--validate-output-json",
        "/tmp/phase0-gate.json",
        "--max-evidence-age-hours=12",
        "--require-deploy-start-utc",
      ])
    ).toEqual({
      includePreviewBuild: true,
      includeReadOnlySql: true,
      includeBaselineHarness: true,
      envFile: ".env.production.local",
      deployStartUtc: null,
      outputJsonPath: null,
      validateOutputJsonPath: "/tmp/phase0-gate.json",
      maxEvidenceAgeHours: 12,
      allowPartialGateEvidence: false,
      requireDeployStartUtc: true,
      printOnly: false,
    });

    expect(
      parseCliArgs([
        "--validate-output-json",
        "/tmp/phase0-gate.json",
        "--allow-partial-gate-evidence",
      ])
    ).toMatchObject({
      validateOutputJsonPath: "/tmp/phase0-gate.json",
      allowPartialGateEvidence: true,
    });

    expect(parseCliArgs(["--print-only"])).toMatchObject({
      printOnly: true,
    });
  });

  it("rejects unknown and incomplete arguments", () => {
    expect(() => parseCliArgs(["--env-file"])).toThrow(
      "--env-file requires a value."
    );
    expect(() => parseCliArgs(["--deploy-start-utc="])).toThrow(
      "--deploy-start-utc requires a value."
    );
    expect(() => parseCliArgs(["--output-json"])).toThrow(
      "--output-json requires a value."
    );
    expect(() => parseCliArgs(["--output-json="])).toThrow(
      "--output-json requires a value."
    );
    expect(() => parseCliArgs(["--validate-output-json"])).toThrow(
      "--validate-output-json requires a value."
    );
    expect(() =>
      parseCliArgs([
        "--validate-output-json",
        "/tmp/gate.json",
        "--max-evidence-age-hours",
      ])
    ).toThrow("--max-evidence-age-hours requires a value.");
    expect(() =>
      parseCliArgs([
        "--validate-output-json",
        "/tmp/gate.json",
        "--max-evidence-age-hours=0",
      ])
    ).toThrow("--max-evidence-age-hours must be a positive integer.");
    expect(() =>
      parseCliArgs(["--max-evidence-age-hours", "24"])
    ).toThrow("--max-evidence-age-hours requires --validate-output-json.");
    expect(() => parseCliArgs(["--allow-partial-gate-evidence"])).toThrow(
      "--allow-partial-gate-evidence requires --validate-output-json."
    );
    expect(() => parseCliArgs(["--require-deploy-start-utc"])).toThrow(
      "--require-deploy-start-utc requires --validate-output-json."
    );
    expect(() =>
      parseCliArgs(["--validate-output-json", "/tmp/gate.json", "--print-only"])
    ).toThrow("--validate-output-json cannot be combined with --print-only.");
    expect(() =>
      parseCliArgs(["--deploy-start-utc", "2026-06-19 18:00:00"])
    ).toThrow("--deploy-start-utc must be an ISO UTC timestamp");
    expect(() => parseCliArgs(["--apply-migration"])).toThrow(
      "Unknown argument: --apply-migration."
    );
  });

  it("builds the app-deploy gate steps without a migration apply path", () => {
    const steps = buildPhase0AppDeployGateSteps({
      includePreviewBuild: true,
      includeReadOnlySql: true,
      envFile: ".env.production.local",
      deployStartUtc: null,
      outputJsonPath: null,
      validateOutputJsonPath: null,
      printOnly: false,
      postgresUrl: "postgres://readonly.example",
    });

    expect(steps.map((step) => step.id)).toEqual([
      "focused-jest",
      "forecast-roadmap-guard-jest",
      "focused-eslint",
      "typecheck",
      "forecast-scripts-typecheck",
      "preview-build",
      "phase0-baseline-harness",
      "phase0-baseline-validate",
      "phase0-preflight",
      "snapshot-logging-health",
    ]);
    expect(steps[0].args).toEqual([
      "jest",
      ...PHASE0_FOCUSED_JEST_TARGETS,
      "--runInBand",
    ]);
    expect(steps[1].args).toEqual([
      "jest",
      ...FORECAST_ROADMAP_GUARD_JEST_TARGETS,
      "--runInBand",
    ]);
    expect(PHASE0_FOCUSED_JEST_TARGETS).toContain(
      "scripts/__tests__/phase0-app-deploy-gate.test.ts"
    );
    expect(PHASE0_FOCUSED_JEST_TARGETS).toContain(
      "scripts/__tests__/phase0-migration-preapply-check.test.ts"
    );
    expect(PHASE0_FOCUSED_JEST_TARGETS).toContain(
      "scripts/__tests__/typecheck-forecast-gate.test.ts"
    );
    expect(FORECAST_ROADMAP_GUARD_JEST_TARGETS).toContain(
      "__tests__/scripts/session-truth-relinkability-sql.test.ts"
    );
    expect(FORECAST_ROADMAP_GUARD_JEST_TARGETS).toContain(
      "__tests__/migrations/track-b-session-acquisition-event.test.ts"
    );
    for (const target of FORECAST_ROADMAP_GUARD_JEST_TARGETS) {
      expect(FORECAST_GATE_TYPECHECK_TARGETS).toContain(target);
    }
    expect(FORECAST_ROADMAP_SOURCE_ESLINT_TARGETS).toContain(
      "scripts/validate-match-score-heuristic.ts"
    );
    expect(FORECAST_ROADMAP_SOURCE_ESLINT_TARGETS).toContain(
      "scripts/session-face-height-truth-report.ts"
    );
    expect(PHASE0_FOCUSED_ESLINT_TARGETS).toContain(
      "scripts/phase0-migration-preapply-check.ts"
    );
    expect(FORECAST_GATE_TYPECHECK_TARGETS).toContain(
      "scripts/phase0-migration-preapply-check.ts"
    );
    for (const target of FORECAST_ROADMAP_SOURCE_ESLINT_TARGETS) {
      expect(PHASE0_FOCUSED_ESLINT_TARGETS).toContain(target);
      expect(FORECAST_GATE_TYPECHECK_TARGETS).toContain(target);
    }
    for (const target of PHASE0_FOCUSED_ESLINT_TARGETS) {
      if (target.startsWith("scripts/")) {
        expect(FORECAST_GATE_TYPECHECK_TARGETS).toContain(target);
      }
    }
    expect(steps[2].args).toEqual([
      "eslint",
      "--max-warnings=0",
      "--no-warn-ignored",
      ...PHASE0_FOCUSED_ESLINT_TARGETS,
    ]);
    expect(steps[4]).toMatchObject({
      command: "yarn",
      args: ["typecheck:forecast-gate"],
    });
    expect(steps[5]).toMatchObject({
      command: "yarn",
      args: ["build"],
      env: { VERCEL_ENV: "preview" },
    });
    expect(steps[6]).toMatchObject({
      id: "phase0-baseline-harness",
      command: "yarn",
      args: [
        "tsx",
        "scripts/forecast-accuracy-harness.ts",
        "--days",
        "30",
        "--truth-source",
        "both",
        "--output-json",
        PHASE0_BASELINE_HARNESS_JSON,
      ],
    });
    expect(steps[7]).toMatchObject({
      id: "phase0-baseline-validate",
      command: "yarn",
      args: [
        "tsx",
        "scripts/forecast-accuracy-report-validate.ts",
        "--report-json",
        PHASE0_BASELINE_HARNESS_JSON,
        "--phase0-baseline",
        "--max-report-age-hours",
        "24",
      ],
    });

    const serialized = JSON.stringify(steps);
    expect(serialized).not.toContain("supabase/migrations/");
    expect(serialized).not.toContain("apply_migration");
    expect(serialized).not.toContain("phase0_forecast_accuracy_metrics.sql");
  });

  it("adds deploy-start timestamp only to the snapshot health psql step", () => {
    const steps = buildPhase0AppDeployGateSteps({
      includePreviewBuild: false,
      includeReadOnlySql: true,
      envFile: ".env.production.local",
      deployStartUtc: "2026-06-19T18:00:00Z",
      outputJsonPath: null,
      validateOutputJsonPath: null,
      printOnly: false,
      postgresUrl: "postgres://readonly.example",
    });
    const preflight = steps.find((step) => step.id === "phase0-preflight");
    const health = steps.find(
      (step) => step.id === "snapshot-logging-health"
    );

    expect(preflight?.args).not.toContain(
      "phase0_snapshot_min_created_at=2026-06-19T18:00:00Z"
    );
    expect(health?.args).toEqual([
      "postgres://readonly.example",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "phase0_snapshot_min_created_at=2026-06-19T18:00:00Z",
      "-f",
      "scripts/db/phase0-snapshot-logging-health.sql",
    ]);
    expect(health?.displayCommand).toContain(
      "-v 'phase0_snapshot_min_created_at=2026-06-19T18:00:00Z'"
    );
  });

  it("prints every deploy-review step without resolving production credentials", () => {
    const steps = buildPhase0AppDeployGateSteps({
      includePreviewBuild: true,
      includeReadOnlySql: true,
      envFile: ".env.production.local",
      deployStartUtc: "2026-06-19T18:00:00Z",
      outputJsonPath: null,
      validateOutputJsonPath: null,
      printOnly: true,
    });

    printPhase0AppDeployGateSteps(steps);

    const output = consoleLogSpy.mock.calls
      .map(([message]) => String(message))
      .join("\n");

    expect(output).toContain("1. Focused Phase 0 Jest");
    expect(output).toContain("2. Forecast roadmap guard Jest");
    expect(output).toContain("3. Focused Phase 0 ESLint");
    expect(output).toContain("4. TypeScript check");
    expect(output).toContain("5. Forecast gate scripts TypeScript check");
    expect(output).toContain("6. Preview build");
    expect(output).toContain("7. Read-only Phase 0 baseline harness");
    expect(output).toContain("8. Phase 0 baseline harness validation");
    expect(output).toContain("9. Read-only Phase 0 preflight");
    expect(output).toContain("10. Read-only snapshot logging health");
    expect(output).toContain(PHASE0_BASELINE_HARNESS_JSON);
    expect(output).toContain("scripts/__tests__/session-face-height-truth-report.test.ts");
    expect(output).toContain("scripts/validate-match-score-heuristic.ts");
    expect(output).toContain(
      "-v 'phase0_snapshot_min_created_at=2026-06-19T18:00:00Z'"
    );
    expect(output).toContain('"$POSTGRES_URL_NON_POOLING"');
    expect(output).not.toContain("postgres://");
  });

  it("runs steps in order with an injected runner", async () => {
    const runner = jest.fn<ReturnType<Phase0GateRunner>, Parameters<Phase0GateRunner>>(
      async () => 0
    );

    await expect(
      runPhase0AppDeployGate(
        {
          includePreviewBuild: false,
          includeReadOnlySql: true,
          includeBaselineHarness: true,
          envFile: ".env.production.local",
          deployStartUtc: null,
          outputJsonPath: null,
          validateOutputJsonPath: null,
          printOnly: false,
          postgresUrl: "postgres://readonly.example",
        },
        runner
      )
    ).resolves.toMatchObject({
      stepsRun: [
        "focused-jest",
        "forecast-roadmap-guard-jest",
        "focused-eslint",
        "typecheck",
        "forecast-scripts-typecheck",
        "phase0-baseline-harness",
        "phase0-baseline-validate",
        "phase0-preflight",
        "snapshot-logging-health",
      ],
      stepOutputs: [
        { id: "focused-jest" },
        { id: "forecast-roadmap-guard-jest" },
        { id: "focused-eslint" },
        { id: "typecheck" },
        { id: "forecast-scripts-typecheck" },
        { id: "phase0-baseline-harness" },
        { id: "phase0-baseline-validate" },
        { id: "phase0-preflight" },
        { id: "snapshot-logging-health" },
      ],
    });
    expect(runner.mock.calls.map(([step]) => step.id)).toEqual([
      "focused-jest",
      "forecast-roadmap-guard-jest",
      "focused-eslint",
      "typecheck",
      "forecast-scripts-typecheck",
      "phase0-baseline-harness",
      "phase0-baseline-validate",
      "phase0-preflight",
      "snapshot-logging-health",
    ]);
  });

  it("requires Node 22 before running the deploy-readiness gate", async () => {
    expect(checkRequiredNodeMajorVersion("22.21.1")).toMatchObject({
      ok: true,
      majorVersion: 22,
    });
    expect(checkRequiredNodeMajorVersion("14.21.3")).toMatchObject({
      ok: false,
      majorVersion: 14,
      message:
        "Phase 0 app-deploy gate requires Node 22. Detected Node 14. Run: source ~/.nvm/nvm.sh && nvm use 22",
    });
  });

  it("fails fast when a gate step fails", async () => {
    const runner = jest.fn<ReturnType<Phase0GateRunner>, Parameters<Phase0GateRunner>>(
      async (step) => (step.id === "typecheck" ? 2 : 0)
    );

    await expect(
      runPhase0AppDeployGate(
        {
          includePreviewBuild: true,
          includeReadOnlySql: false,
          envFile: ".env.production.local",
          deployStartUtc: null,
          outputJsonPath: null,
          validateOutputJsonPath: null,
          printOnly: false,
        },
        runner
      )
    ).rejects.toThrow("TypeScript check failed with exit code 2.");
    expect(runner.mock.calls.map(([step]) => step.id)).toEqual([
      "focused-jest",
      "forecast-roadmap-guard-jest",
      "focused-eslint",
      "typecheck",
    ]);
  });

  it("fails fast when the forecast roadmap guard Jest step fails", async () => {
    const runner = jest.fn<ReturnType<Phase0GateRunner>, Parameters<Phase0GateRunner>>(
      async (step) => (step.id === "forecast-roadmap-guard-jest" ? 2 : 0)
    );

    await expect(
      runPhase0AppDeployGate(
        {
          includePreviewBuild: true,
          includeReadOnlySql: false,
          envFile: ".env.production.local",
          deployStartUtc: null,
          outputJsonPath: null,
          validateOutputJsonPath: null,
          printOnly: false,
        },
        runner
      )
    ).rejects.toThrow("Forecast roadmap guard Jest failed with exit code 2.");
    expect(runner.mock.calls.map(([step]) => step.id)).toEqual([
      "focused-jest",
      "forecast-roadmap-guard-jest",
    ]);
  });

  it("fails fast when the forecast script typecheck step fails", async () => {
    const runner = jest.fn<ReturnType<Phase0GateRunner>, Parameters<Phase0GateRunner>>(
      async (step) => (step.id === "forecast-scripts-typecheck" ? 2 : 0)
    );

    await expect(
      runPhase0AppDeployGate(
        {
          includePreviewBuild: true,
          includeReadOnlySql: false,
          envFile: ".env.production.local",
          deployStartUtc: null,
          outputJsonPath: null,
          validateOutputJsonPath: null,
          printOnly: false,
        },
        runner
      )
    ).rejects.toThrow(
      "Forecast gate scripts TypeScript check failed with exit code 2."
    );
    expect(runner.mock.calls.map(([step]) => step.id)).toEqual([
      "focused-jest",
      "forecast-roadmap-guard-jest",
      "focused-eslint",
      "typecheck",
      "forecast-scripts-typecheck",
    ]);
  });

  it("builds a sanitized evidence packet for completed gate runs", () => {
    const evidence = buildPhase0GateEvidence(
      {
        includePreviewBuild: false,
        includeReadOnlySql: true,
        includeBaselineHarness: true,
        envFile: ".env.production.local",
        deployStartUtc: "2026-06-19T18:00:00Z",
        outputJsonPath: "/tmp/phase0-gate.json",
        validateOutputJsonPath: null,
        printOnly: false,
        postgresUrl: "postgres://readonly.example",
      },
      {
        stepsRun: [
          "focused-jest",
          "forecast-roadmap-guard-jest",
          "focused-eslint",
          "typecheck",
          "forecast-scripts-typecheck",
          "phase0-baseline-harness",
          "phase0-baseline-validate",
          "phase0-preflight",
          "snapshot-logging-health",
        ],
        stepOutputs: buildSqlStepOutputs(),
      },
      new Date("2026-06-20T04:00:00.000Z")
    );

    expect(evidence).toMatchObject({
      evidence_schema_version: 5,
      generated_at: "2026-06-20T04:00:00.000Z",
      status: "passed",
      options: {
        include_preview_build: false,
        include_read_only_sql: true,
        include_baseline_harness: true,
        deploy_start_utc: "2026-06-19T18:00:00Z",
      },
      steps_run: [
        "focused-jest",
        "forecast-roadmap-guard-jest",
        "focused-eslint",
        "typecheck",
        "forecast-scripts-typecheck",
        "phase0-baseline-harness",
        "phase0-baseline-validate",
        "phase0-preflight",
        "snapshot-logging-health",
      ],
      step_results: [
        {
          id: "focused-jest",
          label: "Focused Phase 0 Jest",
          status: "passed",
        },
        {
          id: "forecast-roadmap-guard-jest",
          label: "Forecast roadmap guard Jest",
          status: "passed",
        },
        {
          id: "focused-eslint",
          label: "Focused Phase 0 ESLint",
          status: "passed",
        },
        {
          id: "typecheck",
          label: "TypeScript check",
          status: "passed",
        },
        {
          id: "forecast-scripts-typecheck",
          label: "Forecast gate scripts TypeScript check",
          status: "passed",
        },
        {
          id: "phase0-baseline-harness",
          label: "Read-only Phase 0 baseline harness",
          status: "passed",
        },
        {
          id: "phase0-baseline-validate",
          label: "Phase 0 baseline harness validation",
          status: "passed",
        },
        {
          id: "phase0-preflight",
          label: "Read-only Phase 0 preflight",
          status: "passed",
        },
        {
          id: "snapshot-logging-health",
          label: "Read-only snapshot logging health",
          status: "passed",
        },
      ],
      baseline_harness: {
        report_path: PHASE0_BASELINE_HARNESS_JSON,
        validation_passed: true,
        report_schema_version: 1,
        generated_at: "2026-06-20T04:00:00.000Z",
        range: {
          start: "2026-05-21T04:00:00.000Z",
          end: "2026-06-20T04:00:00.000Z",
        },
        truth_source: "both",
        row_counts: {
          buoy_observation_rows: 100,
          session_observation_rows: 10,
          matched_prediction_rows: 110,
          matched_0_72h_rows: 75,
          matched_0_72h_rows_with_horizon_bucket_provenance: 75,
          matched_0_72h_rows_without_horizon_bucket_provenance: 0,
          matched_0_72h_rows_with_replay_provenance: 75,
          matched_0_72h_rows_without_replay_provenance: 0,
          proposed_rows_compared: 0,
          rows_without_proposed_value: 0,
        },
        gate_metrics_0_72h: {
          current_display: {
            sample_count: 75,
            mae_m: 0.2,
            bias_m: -0.1,
          },
          raw_display: {
            sample_count: 75,
            mae_m: 0.21000000000000002,
            bias_m: -0.09000000000000001,
          },
          raw_om: {
            sample_count: 75,
            mae_m: 0.22,
            bias_m: -0.08,
          },
          v5_shadow: {
            sample_count: 75,
            mae_m: 0.23,
            bias_m: -0.07,
          },
        },
      },
      read_only_sql: {
        phase0_preflight: {
          script_path: "scripts/db/phase0-forecast-accuracy-preflight.sql",
          assertion_passed: true,
          blockers_empty: true,
          can_request_phase0_migration_approval: true,
          legacy_short_horizon_starvation_detected: true,
          face_hs_display_source_contract_30d: {
            candidate_rows: 75780,
            face_hs_display_source_rows: 75780,
            model_version_face_hs_without_display_source_rows: 0,
            missing_display_source_rows: 0,
            other_display_source_rows: 0,
          },
        },
        snapshot_logging_health: {
          script_path: "scripts/db/phase0-snapshot-logging-health.sql",
          assertion_passed: true,
          blockers_empty: true,
          legacy_window: {
            total_rows: 2589,
            distinct_beaches: 318,
            rows_missing_canonical_model_version: 0,
            rows_missing_valid_horizon_hours: 0,
            rows_missing_display_heights: 0,
          },
        },
      },
    });
    const serialized = JSON.stringify(evidence);
    expect(serialized).toContain("$POSTGRES_URL_NON_POOLING");
    expect(serialized).toContain(
      "phase0_snapshot_min_created_at=2026-06-19T18:00:00Z"
    );
    expect(serialized).not.toContain("postgres://readonly.example");
  });

  it("validates sanitized evidence packets against the current gate shape", () => {
    const evidence = buildValidEvidenceForValidation();

    expect(validatePhase0GateEvidence(evidence)).toEqual({
      ok: true,
      blockers: [],
      expectedSteps: [
        "focused-jest",
        "forecast-roadmap-guard-jest",
        "focused-eslint",
        "typecheck",
        "forecast-scripts-typecheck",
        "preview-build",
        "phase0-baseline-harness",
        "phase0-baseline-validate",
        "phase0-preflight",
        "snapshot-logging-health",
      ],
    });
  });

  it("rejects partial gate evidence by default", () => {
    const options = {
      includePreviewBuild: false,
      includeReadOnlySql: true,
      envFile: ".env.production.local",
      deployStartUtc: null,
      outputJsonPath: "/tmp/phase0-partial-gate.json",
      validateOutputJsonPath: null,
      printOnly: false,
      includeBaselineHarness: true,
      postgresUrl: "postgres://readonly.example",
    };
    const partialEvidence = buildPhase0GateEvidence(
      options,
      {
        stepsRun: buildPhase0AppDeployGateSteps(options).map((step) => step.id),
        stepOutputs: buildSqlStepOutputs(),
      },
      new Date("2026-06-20T04:00:00.000Z")
    );

    expect(validatePhase0GateEvidence(partialEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["partial_gate_evidence_not_allowed"]),
    });
    expect(
      validatePhase0GateEvidence(partialEvidence, {
        requireFullGate: false,
      })
    ).toMatchObject({
      ok: true,
      blockers: [],
    });
  });

  it("can require deploy-start provenance for post-deploy migration evidence", () => {
    const evidence = buildValidEvidenceForValidation();
    const preDeployOptions = {
      includePreviewBuild: true,
      includeReadOnlySql: true,
      includeBaselineHarness: true,
      envFile: ".env.production.local",
      deployStartUtc: null,
      outputJsonPath: "/tmp/phase0-gate.json",
      validateOutputJsonPath: null,
      printOnly: false,
      postgresUrl: "postgres://readonly.example",
    };
    const preDeployEvidence = buildPhase0GateEvidence(
      preDeployOptions,
      {
        stepsRun: buildPhase0AppDeployGateSteps(preDeployOptions).map(
          (step) => step.id
        ),
        stepOutputs: buildSqlStepOutputs(),
      },
      new Date("2026-06-20T04:00:00.000Z")
    );

    expect(
      validatePhase0GateEvidence(evidence, {
        requireDeployStartUtc: true,
      })
    ).toEqual({
      ok: true,
      blockers: [],
      expectedSteps: [
        "focused-jest",
        "forecast-roadmap-guard-jest",
        "focused-eslint",
        "typecheck",
        "forecast-scripts-typecheck",
        "preview-build",
        "phase0-baseline-harness",
        "phase0-baseline-validate",
        "phase0-preflight",
        "snapshot-logging-health",
      ],
    });
    expect(
      validatePhase0GateEvidence(preDeployEvidence, {
        requireDeployStartUtc: true,
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["deploy_start_utc_required"]),
    });

    expect(
      validatePhase0GateEvidence(
        buildPhase0GateEvidence(
          {
            ...preDeployOptions,
            deployStartUtc: "2026-06-20T04:00:01.000Z",
          },
          {
            stepsRun: buildPhase0AppDeployGateSteps({
              ...preDeployOptions,
              deployStartUtc: "2026-06-20T04:00:01.000Z",
            }).map((step) => step.id),
            stepOutputs: buildSqlStepOutputs(),
          },
          new Date("2026-06-20T04:00:00.000Z")
        ),
        {
          requireDeployStartUtc: true,
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "deploy_start_utc_after_generated_at",
      ]),
    });
  });

  it("rejects evidence packets that leak production database URLs", () => {
    const evidence = buildValidEvidenceForValidation();
    const leakedEvidence = {
      ...evidence,
      steps: evidence.steps.map((step) =>
        step.id === "phase0-preflight"
          ? {
              ...step,
              display_command:
                'psql "postgres://readonly.example" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-preflight.sql',
            }
          : step
      ),
    };

    expect(validatePhase0GateEvidence(leakedEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "evidence_contains_postgres_url",
        "steps_mismatch",
      ]),
    });
  });

  it("rejects evidence packets with missing or stale gate steps", () => {
    const evidence = buildValidEvidenceForValidation();
    const missingStepEvidence = {
      ...evidence,
      steps_run: evidence.steps_run.slice(0, -1),
    };

    expect(validatePhase0GateEvidence(missingStepEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["steps_run_mismatch"]),
    });
  });

  it("rejects evidence packets with missing or stale step results", () => {
    const evidence = buildValidEvidenceForValidation();
    const missingStepResults = { ...evidence } as Record<string, unknown>;
    delete missingStepResults.step_results;
    const editedStepResult = {
      ...evidence,
      step_results: evidence.step_results.map((step) =>
        step.id === "typecheck"
          ? {
              ...step,
              status: "failed",
            }
          : step
      ),
    };
    const staleStepResults = {
      ...evidence,
      step_results: evidence.step_results.slice(0, -1),
    };

    expect(validatePhase0GateEvidence(missingStepResults)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["step_results_invalid"]),
    });
    expect(validatePhase0GateEvidence(editedStepResult)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["step_results_invalid"]),
    });
    expect(validatePhase0GateEvidence(staleStepResults)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "step_results_mismatch",
        "step_results_steps_run_mismatch",
      ]),
    });
  });

  it("rejects missing or failed read-only SQL summaries", () => {
    const evidence = buildValidEvidenceForValidation();
    const missingSqlEvidence = { ...evidence } as Record<string, unknown>;
    delete missingSqlEvidence.read_only_sql;
    const failedPreflightEvidence = {
      ...evidence,
      read_only_sql: {
        ...evidence.read_only_sql,
        phase0_preflight: {
          ...evidence.read_only_sql?.phase0_preflight,
          assertion_passed: false,
        },
      },
    };
    const driftedPreflightCountsEvidence = {
      ...evidence,
      read_only_sql: {
        ...evidence.read_only_sql,
        phase0_preflight: {
          ...evidence.read_only_sql?.phase0_preflight,
          face_hs_display_source_contract_30d: {
            ...evidence.read_only_sql?.phase0_preflight
              .face_hs_display_source_contract_30d,
            face_hs_display_source_rows: 75779,
          },
        },
      },
    };
    const degradedSnapshotHealthEvidence = {
      ...evidence,
      read_only_sql: {
        ...evidence.read_only_sql,
        snapshot_logging_health: {
          ...evidence.read_only_sql?.snapshot_logging_health,
          legacy_window: {
            ...evidence.read_only_sql?.snapshot_logging_health.legacy_window,
            rows_missing_display_heights: 1,
          },
        },
      },
    };

    expect(validatePhase0GateEvidence(missingSqlEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["read_only_sql_invalid"]),
    });
    expect(validatePhase0GateEvidence(failedPreflightEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["phase0_preflight_assertion_not_passed"]),
    });
    expect(
      validatePhase0GateEvidence(driftedPreflightCountsEvidence)
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "phase0_preflight_face_hs_contract_mismatch",
      ]),
    });
    expect(
      validatePhase0GateEvidence(degradedSnapshotHealthEvidence)
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "snapshot_logging_health_missing_display_height_rows",
      ]),
    });
  });

  it("rejects missing or degraded baseline harness summaries", () => {
    const evidence = buildValidEvidenceForValidation();
    const missingBaselineEvidence = { ...evidence } as Record<string, unknown>;
    delete missingBaselineEvidence.baseline_harness;
    const failedValidationEvidence = {
      ...evidence,
      baseline_harness: {
        ...evidence.baseline_harness,
        validation_passed: false,
      },
    };
    const lowShortHorizonRowsEvidence = {
      ...evidence,
      baseline_harness: {
        ...evidence.baseline_harness,
        row_counts: {
          ...evidence.baseline_harness?.row_counts,
          matched_0_72h_rows: 74,
        },
      },
    };
    const lowGateMetricSampleEvidence = {
      ...evidence,
      baseline_harness: {
        ...evidence.baseline_harness,
        gate_metrics_0_72h: {
          ...evidence.baseline_harness?.gate_metrics_0_72h,
          current_display: {
            ...evidence.baseline_harness?.gate_metrics_0_72h.current_display,
            sample_count: 74,
          },
        },
      },
    };

    expect(validatePhase0GateEvidence(missingBaselineEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["baseline_harness_invalid"]),
    });
    expect(validatePhase0GateEvidence(failedValidationEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "baseline_harness_validation_not_passed",
      ]),
    });
    expect(
      validatePhase0GateEvidence(lowShortHorizonRowsEvidence)
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "baseline_harness_short_horizon_rows_below_floor",
        "baseline_harness_current_display_sample_mismatch",
      ]),
    });
    expect(
      validatePhase0GateEvidence(lowGateMetricSampleEvidence)
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "baseline_harness_current_display_sample_count_below_floor",
        "baseline_harness_current_display_sample_mismatch",
      ]),
    });
  });

  it("rejects failed or wrong-Node evidence packets", () => {
    const evidence = buildValidEvidenceForValidation();

    expect(
      validatePhase0GateEvidence({
        ...evidence,
        status: "failed",
        node_version: "20.19.0",
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "status_not_passed",
        "node_version_not_22",
      ]),
    });
  });

  it("rejects evidence packets without the current schema version", () => {
    const evidence = buildValidEvidenceForValidation();
    const staleSchemaEvidence = {
      ...evidence,
      evidence_schema_version: 0,
    };
    const missingSchemaEvidence = { ...evidence } as Record<string, unknown>;
    delete missingSchemaEvidence.evidence_schema_version;

    expect(validatePhase0GateEvidence(staleSchemaEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["evidence_schema_version_invalid"]),
    });
    expect(validatePhase0GateEvidence(missingSchemaEvidence)).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["evidence_schema_version_invalid"]),
    });
  });

  it("rejects stale or future-dated evidence packets when an age limit is set", () => {
    const evidence = buildValidEvidenceForValidation();

    expect(
      validatePhase0GateEvidence(evidence, {
        maxEvidenceAgeHours: 24,
        now: new Date("2026-06-21T05:00:00.000Z"),
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["generated_at_too_old"]),
    });
    expect(
      validatePhase0GateEvidence(
        {
          ...evidence,
          generated_at: "2026-06-21T05:10:01.000Z",
        },
        {
          maxEvidenceAgeHours: 24,
          now: new Date("2026-06-21T05:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["generated_at_in_future"]),
    });
  });

  it("rejects stale or future-dated embedded baseline harness evidence", () => {
    const evidence = buildValidEvidenceForValidation();

    expect(
      validatePhase0GateEvidence(
        {
          ...evidence,
          generated_at: "2026-06-21T05:00:00.000Z",
          baseline_harness: {
            ...evidence.baseline_harness,
            generated_at: "2026-06-19T04:59:59.000Z",
          },
        },
        {
          maxEvidenceAgeHours: 24,
          now: new Date("2026-06-21T05:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "baseline_harness_generated_at_too_old",
      ]),
    });

    expect(
      validatePhase0GateEvidence(
        {
          ...evidence,
          baseline_harness: {
            ...evidence.baseline_harness,
            generated_at: "2026-06-20T05:10:01.000Z",
          },
        },
        {
          maxEvidenceAgeHours: 24,
          now: new Date("2026-06-20T05:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "baseline_harness_generated_at_in_future",
      ]),
    });
  });

  it("rejects invalid or stale embedded baseline harness measured ranges", () => {
    const evidence = buildValidEvidenceForValidation();

    expect(
      validatePhase0GateEvidence(
        {
          ...evidence,
          baseline_harness: {
            ...evidence.baseline_harness,
            range: {
              start: "2026-05-21T04:00:00.000Z",
              end: "2026-06-18T04:00:00.000Z",
            },
          },
        },
        {
          maxEvidenceAgeHours: 24,
          now: new Date("2026-06-20T04:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["baseline_harness_range_end_too_old"]),
    });

    expect(
      validatePhase0GateEvidence({
        ...evidence,
        baseline_harness: {
          ...evidence.baseline_harness,
          range: {
            start: "2026-06-20T04:00:00.000Z",
            end: "2026-05-21T04:00:00.000Z",
          },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "baseline_harness_range_order_invalid",
      ]),
    });

    expect(
      validatePhase0GateEvidence({
        ...evidence,
        baseline_harness: {
          ...evidence.baseline_harness,
          range: {
            start: "2026-05-21T04:00:00.000Z",
            end: "2026-06-20T04:10:01.000Z",
          },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "baseline_harness_range_end_after_generated_at",
      ]),
    });
  });

  it("writes a newline-terminated evidence JSON file", async () => {
    const outputJsonPath = join(
      tmpdir(),
      `quiver-phase0-gate-${process.pid}.json`
    );
    const evidence = buildPhase0GateEvidence(
      {
        includePreviewBuild: false,
        includeReadOnlySql: false,
        includeBaselineHarness: false,
        envFile: ".env.production.local",
        deployStartUtc: null,
        outputJsonPath,
        validateOutputJsonPath: null,
        printOnly: false,
      },
      {
        stepsRun: [
          "focused-jest",
          "forecast-roadmap-guard-jest",
          "focused-eslint",
        ],
        stepOutputs: [],
      },
      new Date("2026-06-20T04:00:00.000Z")
    );

    await writePhase0GateEvidence(outputJsonPath, evidence);

    const raw = await readFile(outputJsonPath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toMatchObject({
      evidence_schema_version: 5,
      generated_at: "2026-06-20T04:00:00.000Z",
      status: "passed",
    });

    await rm(outputJsonPath, { force: true });
  });

  it("validates an evidence JSON file from disk", async () => {
    const outputJsonPath = join(
      tmpdir(),
      `quiver-phase0-gate-validate-${process.pid}.json`
    );
    const evidence = buildValidEvidenceForValidation();

    await writePhase0GateEvidence(outputJsonPath, evidence);

    await expect(
      validatePhase0GateEvidenceFile(outputJsonPath, {
        maxEvidenceAgeHours: 24,
        now: new Date("2026-06-20T05:00:00.000Z"),
      })
    ).resolves.toEqual({
      ok: true,
      blockers: [],
      expectedSteps: [
        "focused-jest",
        "forecast-roadmap-guard-jest",
        "focused-eslint",
        "typecheck",
        "forecast-scripts-typecheck",
        "preview-build",
        "phase0-baseline-harness",
        "phase0-baseline-validate",
        "phase0-preflight",
        "snapshot-logging-health",
      ],
    });

    await rm(outputJsonPath, { force: true });
  });
});
