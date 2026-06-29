#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { config as loadDotenv } from "dotenv";

export const PHASE0_FOCUSED_JEST_TARGETS = [
  "__tests__/migrations/phase0-forecast-accuracy-metrics.test.ts",
  "scripts/__tests__/phase0-app-deploy-gate.test.ts",
  "scripts/__tests__/phase0-migration-preapply-check.test.ts",
  "scripts/__tests__/typecheck-forecast-gate.test.ts",
  "scripts/__tests__/forecast-accuracy-readiness-report.test.ts",
  "scripts/__tests__/forecast-accuracy-report-validate.test.ts",
  "scripts/__tests__/forecast-accuracy-harness.test.ts",
  "lib/services/forecast/__tests__/log-display-prediction.test.ts",
  "lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts",
  "lib/services/forecast/__tests__/accuracy-metrics.test.ts",
] as const;

export const FORECAST_ROADMAP_GUARD_JEST_TARGETS = [
  "__tests__/migrations/phase1-shoaling-apply-gap.test.ts",
  "__tests__/migrations/track-b-session-acquisition-event.test.ts",
  "__tests__/scripts/phase2-terrain-gap-sql.test.ts",
  "__tests__/scripts/session-truth-relinkability-sql.test.ts",
  "scripts/__tests__/analog-shoaling-proposed-export.test.ts",
  "scripts/__tests__/forecast-accuracy-approval-subset.test.ts",
  "scripts/__tests__/phase1-shoaling-proposed-export.test.ts",
  "scripts/__tests__/session-acquisition-funnel-report.test.ts",
  "scripts/__tests__/session-face-height-truth-report.test.ts",
  "scripts/__tests__/terrain-filter-proposed-export.test.ts",
  "scripts/__tests__/validate-match-score-heuristic.test.ts",
  "scripts/terrain/__tests__/database.test.ts",
  "scripts/terrain/__tests__/proposed-export.test.ts",
  "scripts/terrain/__tests__/write-guard.test.ts",
] as const;

export const FORECAST_ROADMAP_SOURCE_ESLINT_TARGETS = [
  "scripts/typecheck-forecast-gate.ts",
  "scripts/phase1-shoaling-proposed-export.ts",
  "scripts/analog-shoaling-proposed-export.ts",
  "scripts/session-acquisition-funnel-report.ts",
  "scripts/session-face-height-truth-report.ts",
  "scripts/terrain-filter-proposed-export.ts",
  "scripts/terrain-analysis.ts",
  "scripts/validate-match-score-heuristic.ts",
  "scripts/terrain/cli.ts",
  "scripts/terrain/database.ts",
  "scripts/terrain/proposed-export.ts",
  "scripts/terrain/types.ts",
  "scripts/terrain/write-guard.ts",
] as const;

export const PHASE0_FOCUSED_ESLINT_TARGETS = [
  "lib/services/forecast/accuracy-metrics.ts",
  "lib/services/forecast/forecast-builder.ts",
  "lib/services/forecast/log-display-prediction.ts",
  "lib/utils/wave-height-source.ts",
  "scripts/forecast-accuracy-harness.ts",
  "scripts/forecast-accuracy-readiness-report.ts",
  "scripts/forecast-accuracy-report-validate.ts",
  "scripts/phase0-app-deploy-gate.ts",
  "scripts/phase0-migration-preapply-check.ts",
  "scripts/diag-snapshot-writer.ts",
  "scripts/ml-stats.ts",
  ...FORECAST_ROADMAP_SOURCE_ESLINT_TARGETS,
  ...PHASE0_FOCUSED_JEST_TARGETS,
  ...FORECAST_ROADMAP_GUARD_JEST_TARGETS,
] as const;

type Phase0GateStepId =
  | "focused-jest"
  | "forecast-roadmap-guard-jest"
  | "focused-eslint"
  | "typecheck"
  | "forecast-scripts-typecheck"
  | "preview-build"
  | "phase0-baseline-harness"
  | "phase0-baseline-validate"
  | "phase0-preflight"
  | "snapshot-logging-health";

interface Phase0GateCliOptions {
  includePreviewBuild: boolean;
  includeReadOnlySql: boolean;
  includeBaselineHarness?: boolean;
  envFile: string;
  deployStartUtc: string | null;
  outputJsonPath: string | null;
  validateOutputJsonPath: string | null;
  maxEvidenceAgeHours?: number | null;
  allowPartialGateEvidence?: boolean;
  requireDeployStartUtc?: boolean;
  printOnly: boolean;
}

export interface NodeMajorVersionCheckResult {
  ok: boolean;
  majorVersion: number | null;
  message: string;
}

interface Phase0GateBuildOptions extends Phase0GateCliOptions {
  postgresUrl?: string | null;
}

export interface Phase0GateStep {
  id: Phase0GateStepId;
  label: string;
  command: string;
  args: string[];
  displayCommand: string;
  env?: Record<string, string>;
  requiresPostgresUrl: boolean;
}

export interface Phase0GateRunResult {
  stepsRun: Phase0GateStepId[];
  stepOutputs: Array<{
    id: Phase0GateStepId;
    stdout: string;
    stderr: string;
  }>;
}

export interface Phase0GateEvidence {
  evidence_schema_version: 5;
  generated_at: string;
  status: "passed";
  node_version: string;
  options: {
    include_preview_build: boolean;
    include_read_only_sql: boolean;
    include_baseline_harness: boolean;
    deploy_start_utc: string | null;
  };
  steps_run: Phase0GateStepId[];
  step_results: Array<{
    id: Phase0GateStepId;
    label: string;
    status: "passed";
    display_command: string;
    requires_postgres_url: boolean;
  }>;
  steps: Array<{
    id: Phase0GateStepId;
    label: string;
    display_command: string;
    requires_postgres_url: boolean;
  }>;
  baseline_harness: Phase0GateBaselineHarnessEvidence | null;
  read_only_sql: Phase0GateReadOnlySqlEvidence | null;
}

export interface Phase0GateEvidenceValidationResult {
  ok: boolean;
  blockers: string[];
  expectedSteps: Phase0GateStepId[];
}

export interface Phase0GateEvidenceValidationOptions {
  maxEvidenceAgeHours?: number | null;
  requireFullGate?: boolean;
  requireDeployStartUtc?: boolean;
  now?: Date;
}

export interface Phase0GateCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type Phase0GateRunner = (
  step: Phase0GateStep
) => Promise<number | Phase0GateCommandResult>;

export interface Phase0GateReadOnlySqlEvidence {
  phase0_preflight: {
    script_path: typeof PHASE0_PREFLIGHT_SQL;
    assertion_passed: boolean;
    blockers_empty: boolean;
    can_request_phase0_migration_approval: boolean | null;
    legacy_short_horizon_starvation_detected: boolean | null;
    face_hs_display_source_contract_30d: {
      candidate_rows: number | null;
      face_hs_display_source_rows: number | null;
      model_version_face_hs_without_display_source_rows: number | null;
      missing_display_source_rows: number | null;
      other_display_source_rows: number | null;
    };
  };
  snapshot_logging_health: {
    script_path: typeof SNAPSHOT_HEALTH_SQL;
    assertion_passed: boolean;
    blockers_empty: boolean;
    legacy_window: {
      total_rows: number | null;
      distinct_beaches: number | null;
      rows_missing_canonical_model_version: number | null;
      rows_missing_valid_horizon_hours: number | null;
      rows_missing_display_heights: number | null;
    };
  };
}

export interface Phase0GateBaselineHarnessEvidence {
  report_path: typeof PHASE0_BASELINE_HARNESS_JSON;
  validation_passed: boolean;
  report_schema_version: number | null;
  generated_at: string | null;
  range: {
    start: string | null;
    end: string | null;
  };
  truth_source: string | null;
  row_counts: {
    buoy_observation_rows: number | null;
    session_observation_rows: number | null;
    matched_prediction_rows: number | null;
    matched_0_72h_rows: number | null;
    matched_0_72h_rows_with_horizon_bucket_provenance: number | null;
    matched_0_72h_rows_without_horizon_bucket_provenance: number | null;
    matched_0_72h_rows_with_replay_provenance: number | null;
    matched_0_72h_rows_without_replay_provenance: number | null;
    proposed_rows_compared: number | null;
    rows_without_proposed_value: number | null;
  };
  gate_metrics_0_72h: Record<
    "current_display" | "raw_display" | "raw_om" | "v5_shadow",
    {
      sample_count: number | null;
      mae_m: number | null;
      bias_m: number | null;
    }
  >;
}

const DEFAULT_ENV_FILE = ".env.production.local";
const POSTGRES_URL_PLACEHOLDER = "$POSTGRES_URL_NON_POOLING";
const PHASE0_PREFLIGHT_SQL = "scripts/db/phase0-forecast-accuracy-preflight.sql";
const SNAPSHOT_HEALTH_SQL = "scripts/db/phase0-snapshot-logging-health.sql";
export const PHASE0_BASELINE_HARNESS_JSON =
  "/tmp/quiver-phase0-app-deploy-gate-baseline-harness.json";
const REQUIRED_NODE_MAJOR_VERSION = 22;
const PHASE0_GATE_EVIDENCE_SCHEMA_VERSION = 5;
const DEFAULT_MAX_EVIDENCE_AGE_HOURS = 24;
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
const PHASE0_BASELINE_GATE_BASELINES = [
  "current_display",
  "raw_display",
  "raw_om",
  "v5_shadow",
] as const;
const PHASE0_GATE_STEP_IDS: readonly Phase0GateStepId[] = [
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
];

export function parseCliArgs(argv: string[]): Phase0GateCliOptions {
  let includePreviewBuild = true;
  let includeReadOnlySql = true;
  let includeBaselineHarness = true;
  let envFile = DEFAULT_ENV_FILE;
  let deployStartUtc: string | null = null;
  let outputJsonPath: string | null = null;
  let validateOutputJsonPath: string | null = null;
  let maxEvidenceAgeHours: number | null = null;
  let allowPartialGateEvidence = false;
  let requireDeployStartUtc = false;
  let printOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--skip-preview-build") {
      includePreviewBuild = false;
      continue;
    }
    if (arg === "--skip-read-only-sql") {
      includeReadOnlySql = false;
      continue;
    }
    if (arg === "--skip-baseline-harness") {
      includeBaselineHarness = false;
      continue;
    }
    if (arg === "--print-only") {
      printOnly = true;
      continue;
    }
    if (arg === "--output-json") {
      outputJsonPath = readFlagValue(next, "--output-json");
      index += 1;
      continue;
    }
    if (arg.startsWith("--output-json=")) {
      outputJsonPath = readFlagValue(arg.split("=")[1], "--output-json");
      continue;
    }
    if (arg === "--validate-output-json") {
      validateOutputJsonPath = readFlagValue(next, "--validate-output-json");
      index += 1;
      continue;
    }
    if (arg.startsWith("--validate-output-json=")) {
      validateOutputJsonPath = readFlagValue(
        arg.split("=")[1],
        "--validate-output-json"
      );
      continue;
    }
    if (arg === "--max-evidence-age-hours") {
      maxEvidenceAgeHours = parsePositiveInteger(
        readFlagValue(next, "--max-evidence-age-hours"),
        "--max-evidence-age-hours"
      );
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-evidence-age-hours=")) {
      maxEvidenceAgeHours = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--max-evidence-age-hours"),
        "--max-evidence-age-hours"
      );
      continue;
    }
    if (arg === "--allow-partial-gate-evidence") {
      allowPartialGateEvidence = true;
      continue;
    }
    if (arg === "--require-deploy-start-utc") {
      requireDeployStartUtc = true;
      continue;
    }
    if (arg === "--env-file") {
      envFile = readFlagValue(next, "--env-file");
      index += 1;
      continue;
    }
    if (arg.startsWith("--env-file=")) {
      envFile = readFlagValue(arg.split("=")[1], "--env-file");
      continue;
    }
    if (arg === "--deploy-start-utc") {
      deployStartUtc = parseUtcTimestamp(
        readFlagValue(next, "--deploy-start-utc")
      );
      index += 1;
      continue;
    }
    if (arg.startsWith("--deploy-start-utc=")) {
      deployStartUtc = parseUtcTimestamp(
        readFlagValue(arg.split("=")[1], "--deploy-start-utc")
      );
      continue;
    }

    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (validateOutputJsonPath && outputJsonPath) {
    throw new Error(
      "--validate-output-json cannot be combined with --output-json."
    );
  }
  if (validateOutputJsonPath && printOnly) {
    throw new Error(
      "--validate-output-json cannot be combined with --print-only."
    );
  }
  if (maxEvidenceAgeHours !== null && !validateOutputJsonPath) {
    throw new Error(
      "--max-evidence-age-hours requires --validate-output-json."
    );
  }
  if (allowPartialGateEvidence && !validateOutputJsonPath) {
    throw new Error(
      "--allow-partial-gate-evidence requires --validate-output-json."
    );
  }
  if (requireDeployStartUtc && !validateOutputJsonPath) {
    throw new Error(
      "--require-deploy-start-utc requires --validate-output-json."
    );
  }

  return {
    includePreviewBuild,
    includeReadOnlySql,
    includeBaselineHarness,
    envFile,
    deployStartUtc,
    outputJsonPath,
    validateOutputJsonPath,
    maxEvidenceAgeHours,
    allowPartialGateEvidence,
    requireDeployStartUtc,
    printOnly,
  };
}

export function buildPhase0AppDeployGateSteps(
  options: Phase0GateBuildOptions = {
    includePreviewBuild: true,
    includeReadOnlySql: true,
    includeBaselineHarness: true,
    envFile: DEFAULT_ENV_FILE,
    deployStartUtc: null,
    outputJsonPath: null,
    validateOutputJsonPath: null,
    allowPartialGateEvidence: false,
    printOnly: false,
  }
): Phase0GateStep[] {
  const steps: Phase0GateStep[] = [
    {
      id: "focused-jest",
      label: "Focused Phase 0 Jest",
      command: "yarn",
      args: ["jest", ...PHASE0_FOCUSED_JEST_TARGETS, "--runInBand"],
      displayCommand: `yarn jest ${PHASE0_FOCUSED_JEST_TARGETS.join(
        " "
      )} --runInBand`,
      requiresPostgresUrl: false,
    },
    {
      id: "forecast-roadmap-guard-jest",
      label: "Forecast roadmap guard Jest",
      command: "yarn",
      args: ["jest", ...FORECAST_ROADMAP_GUARD_JEST_TARGETS, "--runInBand"],
      displayCommand: `yarn jest ${FORECAST_ROADMAP_GUARD_JEST_TARGETS.join(
        " "
      )} --runInBand`,
      requiresPostgresUrl: false,
    },
    {
      id: "focused-eslint",
      label: "Focused Phase 0 ESLint",
      command: "npx",
      args: [
        "eslint",
        "--max-warnings=0",
        "--no-warn-ignored",
        ...PHASE0_FOCUSED_ESLINT_TARGETS,
      ],
      displayCommand: `npx eslint --max-warnings=0 --no-warn-ignored ${PHASE0_FOCUSED_ESLINT_TARGETS.join(
        " "
      )}`,
      requiresPostgresUrl: false,
    },
    {
      id: "typecheck",
      label: "TypeScript check",
      command: "yarn",
      args: ["typecheck"],
      displayCommand: "yarn typecheck",
      requiresPostgresUrl: false,
    },
    {
      id: "forecast-scripts-typecheck",
      label: "Forecast gate scripts TypeScript check",
      command: "yarn",
      args: ["typecheck:forecast-gate"],
      displayCommand: "yarn typecheck:forecast-gate",
      requiresPostgresUrl: false,
    },
  ];

  if (options.includePreviewBuild) {
    steps.push({
      id: "preview-build",
      label: "Preview build",
      command: "yarn",
      args: ["build"],
      displayCommand: "VERCEL_ENV=preview yarn build",
      env: { VERCEL_ENV: "preview" },
      requiresPostgresUrl: false,
    });
  }

  if (shouldIncludeBaselineHarness(options)) {
    steps.push(
      {
        id: "phase0-baseline-harness",
        label: "Read-only Phase 0 baseline harness",
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
        displayCommand: `yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --output-json ${PHASE0_BASELINE_HARNESS_JSON}`,
        requiresPostgresUrl: false,
      },
      {
        id: "phase0-baseline-validate",
        label: "Phase 0 baseline harness validation",
        command: "yarn",
        args: [
          "tsx",
          "scripts/forecast-accuracy-report-validate.ts",
          "--report-json",
          PHASE0_BASELINE_HARNESS_JSON,
          "--phase0-baseline",
          "--max-report-age-hours",
          String(DEFAULT_MAX_EVIDENCE_AGE_HOURS),
        ],
        displayCommand: `yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json ${PHASE0_BASELINE_HARNESS_JSON} --phase0-baseline --max-report-age-hours ${DEFAULT_MAX_EVIDENCE_AGE_HOURS}`,
        requiresPostgresUrl: false,
      }
    );
  }

  if (options.includeReadOnlySql) {
    steps.push(
      buildPsqlStep({
        id: "phase0-preflight",
        label: "Read-only Phase 0 preflight",
        scriptPath: PHASE0_PREFLIGHT_SQL,
        postgresUrl: options.postgresUrl ?? null,
      }),
      buildPsqlStep({
        id: "snapshot-logging-health",
        label: "Read-only snapshot logging health",
        scriptPath: SNAPSHOT_HEALTH_SQL,
        postgresUrl: options.postgresUrl ?? null,
        psqlVars: options.deployStartUtc
          ? [`phase0_snapshot_min_created_at=${options.deployStartUtc}`]
          : [],
      })
    );
  }

  return steps;
}

export async function runPhase0AppDeployGate(
  options: Phase0GateBuildOptions,
  runner: Phase0GateRunner = runCommand
): Promise<Phase0GateRunResult> {
  enforceRequiredNodeMajorVersion(process.versions.node);
  const postgresUrl = options.includeReadOnlySql
    ? resolvePostgresUrl(options.envFile, options.postgresUrl ?? null)
    : options.postgresUrl ?? null;
  const steps = buildPhase0AppDeployGateSteps({ ...options, postgresUrl });
  const stepsRun: Phase0GateStepId[] = [];
  const stepOutputs: Phase0GateRunResult["stepOutputs"] = [];

  for (const step of steps) {
    console.log(`[phase0-gate] ${step.label}`);
    const runOutput = normalizeRunnerResult(await runner(step));
    if (runOutput.exitCode !== 0) {
      throw new Error(
        `${step.label} failed with exit code ${runOutput.exitCode}.`
      );
    }
    stepsRun.push(step.id);
    stepOutputs.push({
      id: step.id,
      stdout: runOutput.stdout,
      stderr: runOutput.stderr,
    });
  }

  return { stepsRun, stepOutputs };
}

export function printPhase0AppDeployGateSteps(steps: Phase0GateStep[]): void {
  for (const [index, step] of steps.entries()) {
    console.log(`${index + 1}. ${step.label}`);
    console.log(`   ${step.displayCommand}`);
  }
}

export function buildPhase0GateEvidence(
  options: Phase0GateBuildOptions,
  result: Phase0GateRunResult,
  generatedAt: Date = new Date()
): Phase0GateEvidence {
  const steps = buildPhase0AppDeployGateSteps({
    ...options,
    postgresUrl: null,
  });
  const stepsById = new Map(steps.map((step) => [step.id, step]));

  return {
    evidence_schema_version: PHASE0_GATE_EVIDENCE_SCHEMA_VERSION,
    generated_at: generatedAt.toISOString(),
    status: "passed",
    node_version: process.versions.node,
    options: {
      include_preview_build: options.includePreviewBuild,
      include_read_only_sql: options.includeReadOnlySql,
      include_baseline_harness: shouldIncludeBaselineHarness(options),
      deploy_start_utc: options.deployStartUtc,
    },
    steps_run: result.stepsRun,
    step_results: result.stepsRun.map((stepId) => {
      const step = stepsById.get(stepId);
      if (!step) {
        throw new Error(`Unknown Phase 0 gate step result: ${stepId}.`);
      }
      return {
        id: step.id,
        label: step.label,
        status: "passed",
        display_command: step.displayCommand,
        requires_postgres_url: step.requiresPostgresUrl,
      };
    }),
    steps: steps.map((step) => ({
      id: step.id,
      label: step.label,
      display_command: step.displayCommand,
      requires_postgres_url: step.requiresPostgresUrl,
    })),
    baseline_harness: shouldIncludeBaselineHarness(options)
      ? buildBaselineHarnessEvidence(result.stepOutputs ?? [])
      : null,
    read_only_sql: options.includeReadOnlySql
      ? buildReadOnlySqlEvidence(result.stepOutputs ?? [])
      : null,
  };
}

function buildBaselineHarnessEvidence(
  stepOutputs: Phase0GateRunResult["stepOutputs"]
): Phase0GateBaselineHarnessEvidence {
  const validateOutput =
    stepOutputs.find((output) => output.id === "phase0-baseline-validate")
      ?.stdout ?? "";
  const report = readBaselineHarnessReport(PHASE0_BASELINE_HARNESS_JSON);
  const rowCounts = isRecord(report?.row_counts) ? report.row_counts : {};

  return {
    report_path: PHASE0_BASELINE_HARNESS_JSON,
    validation_passed: validateOutput.includes(
      "Forecast accuracy report validation passed."
    ),
    report_schema_version: readNullableNumber(report?.report_schema_version),
    generated_at:
      typeof report?.generated_at === "string" ? report.generated_at : null,
    range: {
      start:
        isRecord(report?.range) && typeof report.range.start === "string"
          ? report.range.start
          : null,
      end:
        isRecord(report?.range) && typeof report.range.end === "string"
          ? report.range.end
          : null,
    },
    truth_source:
      typeof report?.truth_source === "string" ? report.truth_source : null,
    row_counts: {
      buoy_observation_rows: readNullableNumber(rowCounts.buoy_observation_rows),
      session_observation_rows: readNullableNumber(
        rowCounts.session_observation_rows
      ),
      matched_prediction_rows: readNullableNumber(
        rowCounts.matched_prediction_rows
      ),
      matched_0_72h_rows: readNullableNumber(rowCounts.matched_0_72h_rows),
      matched_0_72h_rows_with_horizon_bucket_provenance: readNullableNumber(
        rowCounts.matched_0_72h_rows_with_horizon_bucket_provenance
      ),
      matched_0_72h_rows_without_horizon_bucket_provenance: readNullableNumber(
        rowCounts.matched_0_72h_rows_without_horizon_bucket_provenance
      ),
      matched_0_72h_rows_with_replay_provenance: readNullableNumber(
        rowCounts.matched_0_72h_rows_with_replay_provenance
      ),
      matched_0_72h_rows_without_replay_provenance: readNullableNumber(
        rowCounts.matched_0_72h_rows_without_replay_provenance
      ),
      proposed_rows_compared: readNullableNumber(
        rowCounts.proposed_rows_compared
      ),
      rows_without_proposed_value: readNullableNumber(
        rowCounts.rows_without_proposed_value
      ),
    },
    gate_metrics_0_72h: buildBaselineGateMetricEvidence(report?.gate_metrics),
  };
}

function readBaselineHarnessReport(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildBaselineGateMetricEvidence(
  gateMetrics: unknown
): Phase0GateBaselineHarnessEvidence["gate_metrics_0_72h"] {
  const metrics = Array.isArray(gateMetrics) ? gateMetrics : [];
  const metricsByBaseline = new Map<string, Record<string, unknown>>();
  for (const metric of metrics) {
    if (!isRecord(metric)) {
      continue;
    }
    if (metric.horizon_group !== "0-72h" || typeof metric.baseline !== "string") {
      continue;
    }
    metricsByBaseline.set(metric.baseline, metric);
  }

  return Object.fromEntries(
    PHASE0_BASELINE_GATE_BASELINES.map((baseline) => {
      const metric = metricsByBaseline.get(baseline);
      return [
        baseline,
        {
          sample_count: readNullableNumber(metric?.sample_count),
          mae_m: readNullableNumber(metric?.mae_m),
          bias_m: readNullableNumber(metric?.bias_m),
        },
      ];
    })
  ) as Phase0GateBaselineHarnessEvidence["gate_metrics_0_72h"];
}

function buildReadOnlySqlEvidence(
  stepOutputs: Phase0GateRunResult["stepOutputs"]
): Phase0GateReadOnlySqlEvidence {
  const preflightOutput =
    stepOutputs.find((output) => output.id === "phase0-preflight")?.stdout ??
    "";
  const snapshotHealthOutput =
    stepOutputs.find((output) => output.id === "snapshot-logging-health")
      ?.stdout ?? "";

  return {
    phase0_preflight: {
      script_path: PHASE0_PREFLIGHT_SQL,
      assertion_passed:
        parsePsqlSingleColumnValue(
          preflightOutput,
          "phase0_preflight_assertions_passed"
        ) === "1",
      blockers_empty: psqlTableIsEmpty(
        preflightOutput,
        "phase0_preflight_blockers"
      ),
      can_request_phase0_migration_approval: parsePsqlBooleanColumn(
        preflightOutput,
        "phase0_preflight_readiness_summary",
        "can_request_phase0_migration_approval"
      ),
      legacy_short_horizon_starvation_detected: parsePsqlBooleanColumn(
        preflightOutput,
        "phase0_preflight_readiness_summary",
        "legacy_short_horizon_starvation_detected"
      ),
      face_hs_display_source_contract_30d: {
        candidate_rows: parsePsqlNumberColumn(
          preflightOutput,
          "phase0_face_hs_display_source_contract_30d",
          "candidate_rows"
        ),
        face_hs_display_source_rows: parsePsqlNumberColumn(
          preflightOutput,
          "phase0_face_hs_display_source_contract_30d",
          "face_hs_display_source_rows"
        ),
        model_version_face_hs_without_display_source_rows: parsePsqlNumberColumn(
          preflightOutput,
          "phase0_face_hs_display_source_contract_30d",
          "model_version_face_hs_without_display_source_rows"
        ),
        missing_display_source_rows: parsePsqlNumberColumn(
          preflightOutput,
          "phase0_face_hs_display_source_contract_30d",
          "missing_display_source_rows"
        ),
        other_display_source_rows: parsePsqlNumberColumn(
          preflightOutput,
          "phase0_face_hs_display_source_contract_30d",
          "other_display_source_rows"
        ),
      },
    },
    snapshot_logging_health: {
      script_path: SNAPSHOT_HEALTH_SQL,
      assertion_passed:
        parsePsqlSingleColumnValue(
          snapshotHealthOutput,
          "phase0_snapshot_logging_health_assertions_passed"
        ) === "1",
      blockers_empty: psqlTableIsEmpty(
        snapshotHealthOutput,
        "phase0_snapshot_logging_health_blockers"
      ),
      legacy_window: {
        total_rows: parsePsqlNumberColumn(
          snapshotHealthOutput,
          "phase0_snapshot_logging_health_legacy_window",
          "total_rows"
        ),
        distinct_beaches: parsePsqlNumberColumn(
          snapshotHealthOutput,
          "phase0_snapshot_logging_health_legacy_window",
          "distinct_beaches"
        ),
        rows_missing_canonical_model_version: parsePsqlNumberColumn(
          snapshotHealthOutput,
          "phase0_snapshot_logging_health_legacy_window",
          "rows_missing_canonical_model_version"
        ),
        rows_missing_valid_horizon_hours: parsePsqlNumberColumn(
          snapshotHealthOutput,
          "phase0_snapshot_logging_health_legacy_window",
          "rows_missing_valid_horizon_hours"
        ),
        rows_missing_display_heights: parsePsqlNumberColumn(
          snapshotHealthOutput,
          "phase0_snapshot_logging_health_legacy_window",
          "rows_missing_display_heights"
        ),
      },
    },
  };
}

function parsePsqlSingleColumnValue(output: string, columnName: string): string | null {
  const lines = output.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === columnName);
  if (headerIndex < 0) {
    return null;
  }
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const value = lines[index].trim();
    if (!value || /^-+$/.test(value)) {
      continue;
    }
    if (value.startsWith("(")) {
      return null;
    }
    return value;
  }
  return null;
}

function parsePsqlBooleanColumn(
  output: string,
  tableMarker: string,
  columnName: string
): boolean | null {
  const value = parsePsqlTableValue(output, tableMarker, columnName);
  if (value === "t" || value === "true" || value === "1") {
    return true;
  }
  if (value === "f" || value === "false" || value === "0") {
    return false;
  }
  return null;
}

function parsePsqlNumberColumn(
  output: string,
  tableMarker: string,
  columnName: string
): number | null {
  const value = parsePsqlTableValue(output, tableMarker, columnName);
  if (value == null) {
    return null;
  }
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePsqlTableValue(
  output: string,
  tableMarker: string,
  columnName: string
): string | null {
  const lines = output.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.includes(tableMarker));
  if (markerIndex < 0) {
    return null;
  }

  for (let index = markerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes(columnName)) {
      continue;
    }
    const columns = splitPsqlRow(line);
    const columnIndex = columns.indexOf(columnName);
    if (columnIndex < 0) {
      return null;
    }
    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex];
      const trimmed = row.trim();
      if (!trimmed || /^[\s+|-]+$/.test(row)) {
        continue;
      }
      if (trimmed.startsWith("(")) {
        return null;
      }
      const cells = splitPsqlRow(row);
      return cells[columnIndex] ?? null;
    }
  }

  return null;
}

function psqlTableIsEmpty(output: string, tableMarker: string): boolean {
  const markerIndex = output.indexOf(tableMarker);
  if (markerIndex < 0) {
    return false;
  }
  const section = output.slice(markerIndex, markerIndex + 1_500);
  return /\(0 rows\)/.test(section);
}

function splitPsqlRow(line: string): string[] {
  return line.split("|").map((cell) => cell.trim());
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shouldIncludeBaselineHarness(options: {
  includeBaselineHarness?: boolean;
}): boolean {
  return options.includeBaselineHarness !== false;
}

export async function writePhase0GateEvidence(
  outputJsonPath: string,
  evidence: Phase0GateEvidence
): Promise<void> {
  const outputDirectory = dirname(outputJsonPath);
  if (outputDirectory !== ".") {
    await mkdir(outputDirectory, { recursive: true });
  }
  await writeFile(outputJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
  });
}

export function validatePhase0GateEvidence(
  evidence: unknown,
  options: Phase0GateEvidenceValidationOptions = {}
): Phase0GateEvidenceValidationResult {
  const blockers: string[] = [];
  const serializedEvidence = JSON.stringify(evidence) ?? "";
  if (/postgres(?:ql)?:\/\//i.test(serializedEvidence)) {
    blockers.push("evidence_contains_postgres_url");
  }

  if (!isRecord(evidence)) {
    return {
      ok: false,
      blockers: [...blockers, "evidence_not_object"],
      expectedSteps: [],
    };
  }

  if (evidence.status !== "passed") {
    blockers.push("status_not_passed");
  }
  if (evidence.evidence_schema_version !== PHASE0_GATE_EVIDENCE_SCHEMA_VERSION) {
    blockers.push("evidence_schema_version_invalid");
  }
  let generatedAt: Date | null = null;
  if (!isUtcTimestamp(evidence.generated_at)) {
    blockers.push("generated_at_invalid");
  } else {
    generatedAt = new Date(evidence.generated_at);
    const now = options.now ?? new Date();
    const ageMs = now.getTime() - generatedAt.getTime();
    if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
      blockers.push("generated_at_in_future");
    }
    if (
      typeof options.maxEvidenceAgeHours === "number" &&
      ageMs > options.maxEvidenceAgeHours * 60 * 60 * 1000
    ) {
      blockers.push("generated_at_too_old");
    }
  }
  if (typeof evidence.node_version !== "string") {
    blockers.push("node_version_invalid");
  } else if (!checkRequiredNodeMajorVersion(evidence.node_version).ok) {
    blockers.push("node_version_not_22");
  }

  const evidenceOptions = parseEvidenceOptions(evidence.options, blockers);
  if (
    options.requireFullGate !== false &&
    evidenceOptions &&
    (!evidenceOptions.include_preview_build ||
      !evidenceOptions.include_baseline_harness ||
      !evidenceOptions.include_read_only_sql)
  ) {
    blockers.push("partial_gate_evidence_not_allowed");
  }
  if (
    options.requireDeployStartUtc === true &&
    evidenceOptions &&
    evidenceOptions.deploy_start_utc === null
  ) {
    blockers.push("deploy_start_utc_required");
  }
  if (evidenceOptions?.deploy_start_utc && generatedAt) {
    const deployStartAt = new Date(evidenceOptions.deploy_start_utc);
    if (deployStartAt.getTime() > generatedAt.getTime()) {
      blockers.push("deploy_start_utc_after_generated_at");
    }
  }
  const stepsRun = parseEvidenceStepIds(
    evidence.steps_run,
    "steps_run",
    blockers
  );
  const stepResults = parseEvidenceStepResults(
    evidence.step_results,
    blockers
  );
  const steps = parseEvidenceSteps(evidence.steps, blockers);
  const expectedSteps = evidenceOptions
    ? buildPhase0AppDeployGateSteps({
        includePreviewBuild: evidenceOptions.include_preview_build,
        includeReadOnlySql: evidenceOptions.include_read_only_sql,
        includeBaselineHarness: evidenceOptions.include_baseline_harness,
        envFile: DEFAULT_ENV_FILE,
        deployStartUtc: evidenceOptions.deploy_start_utc,
        outputJsonPath: null,
        validateOutputJsonPath: null,
        printOnly: false,
        postgresUrl: null,
      })
    : [];
  const expectedStepIds = expectedSteps.map((step) => step.id);

  if (stepsRun && !arraysEqual(stepsRun, expectedStepIds)) {
    blockers.push("steps_run_mismatch");
  }
  if (stepResults) {
    const expectedStepResults = expectedSteps.map((step) => ({
      id: step.id,
      label: step.label,
      status: "passed" as const,
      display_command: step.displayCommand,
      requires_postgres_url: step.requiresPostgresUrl,
    }));
    if (JSON.stringify(stepResults) !== JSON.stringify(expectedStepResults)) {
      blockers.push("step_results_mismatch");
    }
    if (
      stepsRun &&
      !arraysEqual(
        stepResults.map((step) => step.id),
        stepsRun
      )
    ) {
      blockers.push("step_results_steps_run_mismatch");
    }
  }
  if (steps) {
    const expectedStepEvidence = expectedSteps.map((step) => ({
      id: step.id,
      label: step.label,
      display_command: step.displayCommand,
      requires_postgres_url: step.requiresPostgresUrl,
    }));
    if (JSON.stringify(steps) !== JSON.stringify(expectedStepEvidence)) {
      blockers.push("steps_mismatch");
    }
  }
  validateReadOnlySqlEvidence(
    evidence.read_only_sql,
    evidenceOptions?.include_read_only_sql === true,
    blockers
  );
  validateBaselineHarnessEvidence(
    evidence.baseline_harness,
    evidenceOptions?.include_baseline_harness === true,
    options.now ?? new Date(),
    options.maxEvidenceAgeHours ?? null,
    blockers
  );

  return {
    ok: blockers.length === 0,
    blockers,
    expectedSteps: expectedStepIds,
  };
}

function validateReadOnlySqlEvidence(
  value: unknown,
  readOnlySqlRequired: boolean,
  blockers: string[]
): void {
  if (!readOnlySqlRequired) {
    if (value !== null && value !== undefined) {
      blockers.push("read_only_sql_unexpected");
    }
    return;
  }

  if (!isRecord(value)) {
    blockers.push("read_only_sql_invalid");
    return;
  }

  const preflight = value.phase0_preflight;
  const snapshotHealth = value.snapshot_logging_health;
  if (!isRecord(preflight)) {
    blockers.push("phase0_preflight_sql_summary_invalid");
  } else {
    if (preflight.script_path !== PHASE0_PREFLIGHT_SQL) {
      blockers.push("phase0_preflight_sql_script_mismatch");
    }
    if (preflight.assertion_passed !== true) {
      blockers.push("phase0_preflight_assertion_not_passed");
    }
    if (preflight.blockers_empty !== true) {
      blockers.push("phase0_preflight_blockers_not_empty");
    }
    if (preflight.can_request_phase0_migration_approval !== true) {
      blockers.push("phase0_preflight_approval_not_ready");
    }
    if (preflight.legacy_short_horizon_starvation_detected !== true) {
      blockers.push("phase0_preflight_starvation_diagnostic_missing");
    }
    validatePreflightFaceHsContract(
      preflight.face_hs_display_source_contract_30d,
      blockers
    );
  }

  if (!isRecord(snapshotHealth)) {
    blockers.push("snapshot_logging_health_sql_summary_invalid");
  } else {
    if (snapshotHealth.script_path !== SNAPSHOT_HEALTH_SQL) {
      blockers.push("snapshot_logging_health_sql_script_mismatch");
    }
    if (snapshotHealth.assertion_passed !== true) {
      blockers.push("snapshot_logging_health_assertion_not_passed");
    }
    if (snapshotHealth.blockers_empty !== true) {
      blockers.push("snapshot_logging_health_blockers_not_empty");
    }
    validateSnapshotHealthLegacyWindow(
      snapshotHealth.legacy_window,
      blockers
    );
  }
}

function validateBaselineHarnessEvidence(
  value: unknown,
  baselineHarnessRequired: boolean,
  now: Date,
  maxEvidenceAgeHours: number | null,
  blockers: string[]
): void {
  if (!baselineHarnessRequired) {
    if (value !== null && value !== undefined) {
      blockers.push("baseline_harness_unexpected");
    }
    return;
  }

  if (!isRecord(value)) {
    blockers.push("baseline_harness_invalid");
    return;
  }
  if (value.report_path !== PHASE0_BASELINE_HARNESS_JSON) {
    blockers.push("baseline_harness_report_path_mismatch");
  }
  if (value.validation_passed !== true) {
    blockers.push("baseline_harness_validation_not_passed");
  }
  if (value.report_schema_version !== 1) {
    blockers.push("baseline_harness_report_schema_invalid");
  }
  if (!isUtcTimestamp(value.generated_at)) {
    blockers.push("baseline_harness_generated_at_invalid");
  } else {
    const generatedAt = new Date(value.generated_at);
    const ageMs = now.getTime() - generatedAt.getTime();
    if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
      blockers.push("baseline_harness_generated_at_in_future");
    }
    if (
      maxEvidenceAgeHours != null &&
      ageMs > maxEvidenceAgeHours * 60 * 60 * 1000
    ) {
      blockers.push("baseline_harness_generated_at_too_old");
    }
  }
  validateBaselineHarnessRange(
    value.range,
    isUtcTimestamp(value.generated_at) ? new Date(value.generated_at) : null,
    now,
    maxEvidenceAgeHours,
    blockers
  );
  if (value.truth_source !== "both") {
    blockers.push("baseline_harness_truth_source_invalid");
  }

  validateBaselineHarnessRowCounts(value.row_counts, blockers);
  validateBaselineHarnessGateMetrics(
    value.gate_metrics_0_72h,
    isRecord(value.row_counts)
      ? readEvidenceNonNegativeInteger(
          value.row_counts.matched_0_72h_rows,
          "baseline_harness_short_horizon_rows_invalid",
          blockers
        )
      : null,
    blockers
  );
}

function validateBaselineHarnessRange(
  value: unknown,
  generatedAt: Date | null,
  now: Date,
  maxEvidenceAgeHours: number | null,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push("baseline_harness_range_invalid");
    return;
  }
  if (!isUtcTimestamp(value.start)) {
    blockers.push("baseline_harness_range_start_invalid");
  }
  if (!isUtcTimestamp(value.end)) {
    blockers.push("baseline_harness_range_end_invalid");
  }
  if (!isUtcTimestamp(value.start) || !isUtcTimestamp(value.end)) {
    return;
  }

  const rangeStart = new Date(value.start);
  const rangeEnd = new Date(value.end);
  if (rangeStart.getTime() >= rangeEnd.getTime()) {
    blockers.push("baseline_harness_range_order_invalid");
  }
  if (rangeEnd.getTime() > now.getTime()) {
    blockers.push("baseline_harness_range_end_in_future");
  }
  if (generatedAt && rangeEnd.getTime() > generatedAt.getTime()) {
    blockers.push("baseline_harness_range_end_after_generated_at");
  }
  if (
    generatedAt &&
    maxEvidenceAgeHours != null &&
    generatedAt.getTime() - rangeEnd.getTime() >
      maxEvidenceAgeHours * 60 * 60 * 1000
  ) {
    blockers.push("baseline_harness_range_end_too_old");
  }
}

function validateBaselineHarnessRowCounts(
  value: unknown,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push("baseline_harness_row_counts_invalid");
    return;
  }

  const matchedRows = readEvidenceNonNegativeInteger(
    value.matched_prediction_rows,
    "baseline_harness_matched_rows_invalid",
    blockers
  );
  const shortHorizonRows = readEvidenceNonNegativeInteger(
    value.matched_0_72h_rows,
    "baseline_harness_short_horizon_rows_invalid",
    blockers
  );
  const proposedRowsCompared = readEvidenceNonNegativeInteger(
    value.proposed_rows_compared,
    "baseline_harness_proposed_rows_invalid",
    blockers
  );
  const rowsWithoutProposedValue = readEvidenceNonNegativeInteger(
    value.rows_without_proposed_value,
    "baseline_harness_missing_proposed_rows_invalid",
    blockers
  );

  if (matchedRows !== null && matchedRows <= 0) {
    blockers.push("baseline_harness_matched_rows_empty");
  }
  if (shortHorizonRows !== null && shortHorizonRows < 75) {
    blockers.push("baseline_harness_short_horizon_rows_below_floor");
  }
  if (proposedRowsCompared !== null && proposedRowsCompared !== 0) {
    blockers.push("baseline_harness_proposed_rows_present");
  }
  if (rowsWithoutProposedValue !== null && rowsWithoutProposedValue !== 0) {
    blockers.push("baseline_harness_missing_proposed_rows_present");
  }
}

function validateBaselineHarnessGateMetrics(
  value: unknown,
  shortHorizonRows: number | null,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push("baseline_harness_gate_metrics_invalid");
    return;
  }

  for (const baseline of PHASE0_BASELINE_GATE_BASELINES) {
    const metric = value[baseline];
    if (!isRecord(metric)) {
      blockers.push(`baseline_harness_${baseline}_gate_metric_invalid`);
      continue;
    }
    const sampleCount = readEvidenceNonNegativeInteger(
      metric.sample_count,
      `baseline_harness_${baseline}_sample_count_invalid`,
      blockers
    );
    if (sampleCount !== null && sampleCount < 75) {
      blockers.push(`baseline_harness_${baseline}_sample_count_below_floor`);
    }
    if (typeof metric.mae_m !== "number" || !Number.isFinite(metric.mae_m)) {
      blockers.push(`baseline_harness_${baseline}_mae_invalid`);
    }
    if (typeof metric.bias_m !== "number" || !Number.isFinite(metric.bias_m)) {
      blockers.push(`baseline_harness_${baseline}_bias_invalid`);
    }
    if (
      baseline === "current_display" &&
      sampleCount !== null &&
      shortHorizonRows !== null &&
      sampleCount !== shortHorizonRows
    ) {
      blockers.push("baseline_harness_current_display_sample_mismatch");
    }
  }
}

function validatePreflightFaceHsContract(
  value: unknown,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push("phase0_preflight_face_hs_contract_invalid");
    return;
  }

  const candidateRows = readEvidenceNonNegativeInteger(
    value.candidate_rows,
    "phase0_preflight_candidate_rows_invalid",
    blockers
  );
  const canonicalRows = readEvidenceNonNegativeInteger(
    value.face_hs_display_source_rows,
    "phase0_preflight_face_hs_rows_invalid",
    blockers
  );
  const modelVersionRowsWithoutDisplaySource = readEvidenceNonNegativeInteger(
    value.model_version_face_hs_without_display_source_rows,
    "phase0_preflight_model_version_without_display_source_invalid",
    blockers
  );
  const missingDisplaySourceRows = readEvidenceNonNegativeInteger(
    value.missing_display_source_rows,
    "phase0_preflight_missing_display_source_rows_invalid",
    blockers
  );
  const otherDisplaySourceRows = readEvidenceNonNegativeInteger(
    value.other_display_source_rows,
    "phase0_preflight_other_display_source_rows_invalid",
    blockers
  );

  if (candidateRows !== null && candidateRows <= 0) {
    blockers.push("phase0_preflight_candidate_rows_empty");
  }
  if (
    candidateRows !== null &&
    canonicalRows !== null &&
    candidateRows !== canonicalRows
  ) {
    blockers.push("phase0_preflight_face_hs_contract_mismatch");
  }
  if (
    modelVersionRowsWithoutDisplaySource !== null &&
    modelVersionRowsWithoutDisplaySource !== 0
  ) {
    blockers.push("phase0_preflight_model_version_without_display_source");
  }
  if (missingDisplaySourceRows !== null && missingDisplaySourceRows !== 0) {
    blockers.push("phase0_preflight_missing_display_source_rows");
  }
  if (otherDisplaySourceRows !== null && otherDisplaySourceRows !== 0) {
    blockers.push("phase0_preflight_other_display_source_rows");
  }
}

function validateSnapshotHealthLegacyWindow(
  value: unknown,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push("snapshot_logging_health_legacy_window_invalid");
    return;
  }

  const totalRows = readEvidenceNonNegativeInteger(
    value.total_rows,
    "snapshot_logging_health_total_rows_invalid",
    blockers
  );
  const distinctBeaches = readEvidenceNonNegativeInteger(
    value.distinct_beaches,
    "snapshot_logging_health_distinct_beaches_invalid",
    blockers
  );
  const rowsMissingCanonicalModelVersion = readEvidenceNonNegativeInteger(
    value.rows_missing_canonical_model_version,
    "snapshot_logging_health_missing_model_version_invalid",
    blockers
  );
  const rowsMissingValidHorizonHours = readEvidenceNonNegativeInteger(
    value.rows_missing_valid_horizon_hours,
    "snapshot_logging_health_missing_horizon_hours_invalid",
    blockers
  );
  const rowsMissingDisplayHeights = readEvidenceNonNegativeInteger(
    value.rows_missing_display_heights,
    "snapshot_logging_health_missing_display_heights_invalid",
    blockers
  );

  if (totalRows !== null && totalRows <= 0) {
    blockers.push("snapshot_logging_health_total_rows_empty");
  }
  if (distinctBeaches !== null && distinctBeaches <= 0) {
    blockers.push("snapshot_logging_health_distinct_beaches_empty");
  }
  if (
    rowsMissingCanonicalModelVersion !== null &&
    rowsMissingCanonicalModelVersion !== 0
  ) {
    blockers.push("snapshot_logging_health_missing_model_version_rows");
  }
  if (
    rowsMissingValidHorizonHours !== null &&
    rowsMissingValidHorizonHours !== 0
  ) {
    blockers.push("snapshot_logging_health_missing_horizon_hour_rows");
  }
  if (rowsMissingDisplayHeights !== null && rowsMissingDisplayHeights !== 0) {
    blockers.push("snapshot_logging_health_missing_display_height_rows");
  }
}

function readEvidenceNonNegativeInteger(
  value: unknown,
  blocker: string,
  blockers: string[]
): number | null {
  if (!Number.isInteger(value) || Number(value) < 0) {
    blockers.push(blocker);
    return null;
  }
  return Number(value);
}

export async function validatePhase0GateEvidenceFile(
  inputJsonPath: string,
  options: Phase0GateEvidenceValidationOptions = {}
): Promise<Phase0GateEvidenceValidationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(inputJsonPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      blockers: [
        `evidence_json_unreadable:${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      expectedSteps: [],
    };
  }

  return validatePhase0GateEvidence(parsed, options);
}

export function checkRequiredNodeMajorVersion(
  nodeVersion: string
): NodeMajorVersionCheckResult {
  const majorVersion = Number.parseInt(nodeVersion.split(".")[0] ?? "", 10);
  if (majorVersion === REQUIRED_NODE_MAJOR_VERSION) {
    return {
      ok: true,
      majorVersion,
      message: `Node ${REQUIRED_NODE_MAJOR_VERSION} detected.`,
    };
  }

  const detected = Number.isFinite(majorVersion)
    ? `Node ${majorVersion}`
    : `Node version ${nodeVersion}`;

  return {
    ok: false,
    majorVersion: Number.isFinite(majorVersion) ? majorVersion : null,
    message:
      `Phase 0 app-deploy gate requires Node ${REQUIRED_NODE_MAJOR_VERSION}. ` +
      `Detected ${detected}. Run: source ~/.nvm/nvm.sh && nvm use 22`,
  };
}

function enforceRequiredNodeMajorVersion(nodeVersion: string): void {
  const result = checkRequiredNodeMajorVersion(nodeVersion);
  if (!result.ok) {
    throw new Error(result.message);
  }
}

function buildPsqlStep(options: {
  id: Extract<Phase0GateStepId, "phase0-preflight" | "snapshot-logging-health">;
  label: string;
  scriptPath: string;
  postgresUrl: string | null;
  psqlVars?: string[];
}): Phase0GateStep {
  const psqlVars = options.psqlVars ?? [];
  const args = [
    options.postgresUrl ?? POSTGRES_URL_PLACEHOLDER,
    "-v",
    "ON_ERROR_STOP=1",
    ...psqlVars.flatMap((psqlVar) => ["-v", psqlVar]),
    "-f",
    options.scriptPath,
  ];
  const displayVars = psqlVars
    .map((psqlVar) => ` -v ${shellQuote(psqlVar)}`)
    .join("");

  return {
    id: options.id,
    label: options.label,
    command: "psql",
    args,
    displayCommand: `psql "${POSTGRES_URL_PLACEHOLDER}" -v ON_ERROR_STOP=1${displayVars} -f ${options.scriptPath}`,
    requiresPostgresUrl: true,
  };
}

function resolvePostgresUrl(
  envFile: string,
  explicitPostgresUrl: string | null
): string {
  if (explicitPostgresUrl) {
    return explicitPostgresUrl;
  }

  loadDotenv({ path: envFile, override: false });
  const postgresUrl = process.env.POSTGRES_URL_NON_POOLING;
  if (!postgresUrl) {
    throw new Error(
      `Missing POSTGRES_URL_NON_POOLING. Set it or provide it in ${envFile} before running read-only SQL gates.`
    );
  }
  return postgresUrl;
}

async function runCommand(step: Phase0GateStep): Promise<Phase0GateCommandResult> {
  return new Promise<Phase0GateCommandResult>((resolvePromise, reject) => {
    const child = spawn(step.command, step.args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: step.env ? { ...process.env, ...step.env } : process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function normalizeRunnerResult(
  result: number | Phase0GateCommandResult
): Phase0GateCommandResult {
  if (typeof result === "number") {
    return {
      exitCode: result,
      stdout: "",
      stderr: "",
    };
  }
  return result;
}

function readFlagValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseUtcTimestamp(value: string): string {
  const isUtcIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
    value
  );
  if (!isUtcIso || Number.isNaN(Date.parse(value))) {
    throw new Error(
      "--deploy-start-utc must be an ISO UTC timestamp like 2026-06-19T18:00:00Z."
    );
  }
  return value;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  try {
    parseUtcTimestamp(value);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEvidenceOptions(
  options: unknown,
  blockers: string[]
):
  | {
      include_preview_build: boolean;
      include_read_only_sql: boolean;
      include_baseline_harness: boolean;
      deploy_start_utc: string | null;
    }
  | null {
  if (!isRecord(options)) {
    blockers.push("options_missing");
    return null;
  }

  if (typeof options.include_preview_build !== "boolean") {
    blockers.push("include_preview_build_invalid");
  }
  if (typeof options.include_read_only_sql !== "boolean") {
    blockers.push("include_read_only_sql_invalid");
  }
  if (typeof options.include_baseline_harness !== "boolean") {
    blockers.push("include_baseline_harness_invalid");
  }
  if (
    options.deploy_start_utc !== null &&
    !isUtcTimestamp(options.deploy_start_utc)
  ) {
    blockers.push("deploy_start_utc_invalid");
  }

  if (
    typeof options.include_preview_build !== "boolean" ||
    typeof options.include_read_only_sql !== "boolean" ||
    typeof options.include_baseline_harness !== "boolean" ||
    (options.deploy_start_utc !== null &&
      typeof options.deploy_start_utc !== "string")
  ) {
    return null;
  }

  return {
    include_preview_build: options.include_preview_build,
    include_read_only_sql: options.include_read_only_sql,
    include_baseline_harness: options.include_baseline_harness,
    deploy_start_utc: options.deploy_start_utc,
  };
}

function parseEvidenceStepIds(
  value: unknown,
  fieldName: string,
  blockers: string[]
): Phase0GateStepId[] | null {
  if (!Array.isArray(value)) {
    blockers.push(`${fieldName}_invalid`);
    return null;
  }

  const stepIds: Phase0GateStepId[] = [];
  for (const stepId of value) {
    if (!isPhase0GateStepId(stepId)) {
      blockers.push(`${fieldName}_invalid`);
      return null;
    }
    stepIds.push(stepId);
  }

  return stepIds;
}

function parseEvidenceStepResults(
  value: unknown,
  blockers: string[]
):
  | Array<{
      id: Phase0GateStepId;
      label: string;
      status: "passed";
      display_command: string;
      requires_postgres_url: boolean;
    }>
  | null {
  if (!Array.isArray(value)) {
    blockers.push("step_results_invalid");
    return null;
  }

  const stepResults: Array<{
    id: Phase0GateStepId;
    label: string;
    status: "passed";
    display_command: string;
    requires_postgres_url: boolean;
  }> = [];

  for (const step of value) {
    if (
      !isRecord(step) ||
      !isPhase0GateStepId(step.id) ||
      typeof step.label !== "string" ||
      step.status !== "passed" ||
      typeof step.display_command !== "string" ||
      typeof step.requires_postgres_url !== "boolean"
    ) {
      blockers.push("step_results_invalid");
      return null;
    }
    stepResults.push({
      id: step.id,
      label: step.label,
      status: step.status,
      display_command: step.display_command,
      requires_postgres_url: step.requires_postgres_url,
    });
  }

  return stepResults;
}

function parseEvidenceSteps(
  value: unknown,
  blockers: string[]
):
  | Array<{
      id: Phase0GateStepId;
      label: string;
      display_command: string;
      requires_postgres_url: boolean;
    }>
  | null {
  if (!Array.isArray(value)) {
    blockers.push("steps_invalid");
    return null;
  }

  const steps: Array<{
    id: Phase0GateStepId;
    label: string;
    display_command: string;
    requires_postgres_url: boolean;
  }> = [];

  for (const step of value) {
    if (
      !isRecord(step) ||
      !isPhase0GateStepId(step.id) ||
      typeof step.label !== "string" ||
      typeof step.display_command !== "string" ||
      typeof step.requires_postgres_url !== "boolean"
    ) {
      blockers.push("steps_invalid");
      return null;
    }
    steps.push({
      id: step.id,
      label: step.label,
      display_command: step.display_command,
      requires_postgres_url: step.requires_postgres_url,
    });
  }

  return steps;
}

function isPhase0GateStepId(value: unknown): value is Phase0GateStepId {
  return (
    typeof value === "string" &&
    PHASE0_GATE_STEP_IDS.includes(value as Phase0GateStepId)
  );
}

function arraysEqual<T>(left: T[], right: T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function printUsage(): void {
  console.log(`Usage:
  yarn phase0:app-deploy-gate
  yarn phase0:app-deploy-gate --print-only
  yarn phase0:app-deploy-gate --output-json /tmp/quiver-phase0-app-deploy-gate.json
  yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate.json
  yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate.json --max-evidence-age-hours 24
  yarn phase0:app-deploy-gate --validate-output-json /tmp/post-deploy-gate.json --require-deploy-start-utc
  yarn phase0:app-deploy-gate --validate-output-json /tmp/smoke-gate.json --allow-partial-gate-evidence
  yarn phase0:app-deploy-gate --deploy-start-utc 2026-06-19T18:00:00Z
  yarn phase0:app-deploy-gate --skip-preview-build
  yarn phase0:app-deploy-gate --skip-baseline-harness
  yarn phase0:app-deploy-gate --skip-read-only-sql`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const options = parseCliArgs(process.argv.slice(2));
  if (options.validateOutputJsonPath) {
    const result = await validatePhase0GateEvidenceFile(
      options.validateOutputJsonPath,
      {
        maxEvidenceAgeHours:
          options.maxEvidenceAgeHours ?? DEFAULT_MAX_EVIDENCE_AGE_HOURS,
        requireFullGate: !options.allowPartialGateEvidence,
        requireDeployStartUtc: options.requireDeployStartUtc,
      }
    );
    if (!result.ok) {
      throw new Error(
        `Phase 0 evidence JSON validation failed:\n- ${result.blockers.join(
          "\n- "
        )}`
      );
    }
    console.log(
      `[phase0-gate] Evidence JSON is valid: ${options.validateOutputJsonPath}`
    );
    console.log(
      `[phase0-gate] Verified steps: ${result.expectedSteps.join(", ")}`
    );
    return;
  }
  if (options.printOnly) {
    printPhase0AppDeployGateSteps(buildPhase0AppDeployGateSteps(options));
    return;
  }

  const result = await runPhase0AppDeployGate(options);
  if (options.outputJsonPath) {
    await writePhase0GateEvidence(
      options.outputJsonPath,
      buildPhase0GateEvidence(options, result)
    );
    console.log(`[phase0-gate] Wrote evidence JSON to ${options.outputJsonPath}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
