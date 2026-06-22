#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Verdict = "non-regressing" | "regressed";
type SliceGroupBy = "region" | "beach";
type TruthSource = "buoy" | "session" | "both";

const DEFAULT_APPROVAL_MIN_GATE_SAMPLES = 75;
const DEFAULT_APPROVAL_MIN_SLICE_SAMPLES = 25;
const DEFAULT_APPROVAL_MAX_REPORT_AGE_HOURS = 24;
const FORECAST_ACCURACY_REPORT_SCHEMA_VERSION = 1;
const METRIC_ARITHMETIC_TOLERANCE_M = 0.0005;
const PHASE0_BASELINE_HORIZON_BUCKETS = ["0-24h", "25-72h", "73h+"] as const;
const PHASE0_BASELINE_GATE_HORIZON = "0-72h";
const PHASE0_BASELINE_BASELINES = [
  "current_display",
  "raw_display",
  "raw_om",
  "v5_shadow",
] as const;

interface CliOptions {
  reportJsonPath: string;
  approval: boolean;
  phase0Baseline: boolean;
  requireProposedGate: boolean;
  requireNonRegressingGate: boolean;
  requireSlices: boolean;
  requireBeachSlices: boolean;
  requireNoRegressedSlices: boolean;
  requireNoUnmeasuredSlices: boolean;
  minGateSamples: number | null;
  minSliceSamples: number | null;
  maxRowsWithoutProposedValue: number | null;
  expectScopeBeachCount: number | null;
  expectProposedJsonPath: string | null;
  requireProposedJson: boolean;
  requireScopeMatchesProposedJson: boolean;
  maxReportAgeHours: number | null;
}

interface ForecastAccuracyReportDelta {
  horizon_group: string;
  baseline?: string;
  baseline_label?: string;
  sample_count: number;
  comparison_sample_count: number;
  mae_m: number;
  comparison_mae_m: number;
  delta_mae_m: number;
}

interface ForecastAccuracyReportMetric {
  horizon_bucket: string;
  baseline: string;
  baseline_label?: string;
  sample_count: number;
  mae_m: number;
  bias_m: number;
}

interface ForecastAccuracyReportGateMetric {
  horizon_group: string;
  baseline: string;
  baseline_label?: string;
  sample_count: number;
  mae_m: number;
  bias_m: number;
}

interface ForecastAccuracyReportGateVerdict {
  delta: ForecastAccuracyReportDelta;
  verdict: Verdict;
  sampleFloor?: ForecastAccuracyReportSampleFloor | null;
  shouldFail: boolean;
}

interface ForecastAccuracyReportSampleFloor {
  minSampleCount?: number;
  insufficientGroups?: string[];
  shouldFail?: boolean;
}

interface ForecastAccuracyReportSlice {
  groupKey?: string;
  group: string;
  proposedCount: number;
  currentCount: number;
  proposedMaeM?: number;
  currentMaeM?: number;
  deltaMaeM: number;
  verdict: Verdict;
}

interface ForecastAccuracyReport {
  report_schema_version?: number;
  generated_at?: string;
  range?: {
    start?: string;
    end?: string;
  };
  truth_source?: TruthSource | string;
  truth_contract?: {
    observed_field?: string;
    truth_quantity?: string;
    metric?: string;
    session_truth_requires_canonical_display_source?: boolean;
    canonical_display_source?: string;
  };
  measurement_contract?: {
    proposed_delta_method?: string;
    comparison_baseline?: string;
    candidate_baseline?: string;
    gate_horizon?: string;
  };
  proposed_json_path?: string | null;
  proposed_json_sha256?: string | null;
  scope?: {
    beach_count?: number | "all";
    beach_ids?: string[];
  };
  row_counts?: {
    matched_prediction_rows?: number;
    matched_0_72h_rows?: number;
    matched_0_72h_rows_with_horizon_bucket_provenance?: number;
    matched_0_72h_rows_without_horizon_bucket_provenance?: number;
    matched_0_72h_rows_with_replay_provenance?: number;
    matched_0_72h_rows_without_replay_provenance?: number;
    proposed_rows_compared?: number;
    rows_without_proposed_value?: number;
  };
  metrics?: ForecastAccuracyReportMetric[];
  gate_metrics?: ForecastAccuracyReportGateMetric[];
  approval_gates?: {
    fail_on_regression?: boolean;
    fail_on_slice_regression?: boolean;
    fail_on_unmeasured_slices?: boolean;
    min_gate_samples?: number | null;
    min_slice_samples?: number | null;
  };
  proposed_gate_verdict?: ForecastAccuracyReportGateVerdict | null;
  gate_slices?: {
    group_by?: SliceGroupBy | null;
    items?: ForecastAccuracyReportSlice[];
    verdict?: {
      regressedSlices?: ForecastAccuracyReportSlice[];
      sampleFloor?: ForecastAccuracyReportSampleFloor | null;
      shouldFail?: boolean;
    } | null;
    coverage?: {
      unmeasuredGroups?: string[];
      shouldFail?: boolean;
    } | null;
  };
}

interface ReportValidationResult {
  ok: boolean;
  findings: string[];
}

interface ReportValidationOptions
  extends Omit<CliOptions, "reportJsonPath" | "phase0Baseline"> {
  phase0Baseline?: boolean;
  now?: Date;
  requireApprovalGateFlags?: boolean;
  requireTruthContract?: boolean;
  requireMeasurementContract?: boolean;
  requireProposedApprovalPolicy?: boolean;
  proposedApprovalPolicyMinGateSamples?: number | null;
  proposedApprovalPolicyMinSliceSamples?: number | null;
  proposedApprovalPolicyMaxReportAgeHours?: number | null;
  requireShortHorizonHorizonBucketProvenance?: boolean;
  requireShortHorizonReplayProvenance?: boolean;
  requireReportRange?: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  let reportJsonPath = "";
  let approval = false;
  let phase0Baseline = false;
  let requireProposedGate = false;
  let requireNonRegressingGate = false;
  let requireSlices = false;
  let requireBeachSlices = false;
  let requireNoRegressedSlices = false;
  let requireNoUnmeasuredSlices = false;
  let minGateSamples: number | null = null;
  let minSliceSamples: number | null = null;
  let maxRowsWithoutProposedValue: number | null = null;
  let expectScopeBeachCount: number | null = null;
  let expectProposedJsonPath: string | null = null;
  let requireProposedJson = false;
  let requireScopeMatchesProposedJson = false;
  let maxReportAgeHours: number | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--report-json") {
      reportJsonPath = readFlagValue(next, "--report-json");
      i++;
      continue;
    }
    if (arg.startsWith("--report-json=")) {
      reportJsonPath = readFlagValue(arg.split("=")[1], "--report-json");
      continue;
    }
    if (arg === "--approval") {
      approval = true;
      continue;
    }
    if (arg === "--phase0-baseline") {
      phase0Baseline = true;
      continue;
    }
    if (arg === "--require-proposed-gate") {
      requireProposedGate = true;
      continue;
    }
    if (arg === "--require-non-regressing-gate") {
      requireNonRegressingGate = true;
      continue;
    }
    if (arg === "--require-slices") {
      requireSlices = true;
      continue;
    }
    if (arg === "--require-beach-slices") {
      requireBeachSlices = true;
      continue;
    }
    if (arg === "--require-no-regressed-slices") {
      requireNoRegressedSlices = true;
      continue;
    }
    if (arg === "--require-no-unmeasured-slices") {
      requireNoUnmeasuredSlices = true;
      continue;
    }
    if (arg === "--min-gate-samples") {
      minGateSamples = parseNonNegativeInteger(
        readFlagValue(next, "--min-gate-samples"),
        "--min-gate-samples"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--min-gate-samples=")) {
      minGateSamples = parseNonNegativeInteger(
        readFlagValue(arg.split("=")[1], "--min-gate-samples"),
        "--min-gate-samples"
      );
      continue;
    }
    if (arg === "--min-slice-samples") {
      minSliceSamples = parseNonNegativeInteger(
        readFlagValue(next, "--min-slice-samples"),
        "--min-slice-samples"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--min-slice-samples=")) {
      minSliceSamples = parseNonNegativeInteger(
        readFlagValue(arg.split("=")[1], "--min-slice-samples"),
        "--min-slice-samples"
      );
      continue;
    }
    if (arg === "--max-rows-without-proposed-value") {
      maxRowsWithoutProposedValue = parseNonNegativeInteger(
        readFlagValue(next, "--max-rows-without-proposed-value"),
        "--max-rows-without-proposed-value"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--max-rows-without-proposed-value=")) {
      maxRowsWithoutProposedValue = parseNonNegativeInteger(
        readFlagValue(
          arg.split("=")[1],
          "--max-rows-without-proposed-value"
        ),
        "--max-rows-without-proposed-value"
      );
      continue;
    }
    if (arg === "--expect-scope-beach-count") {
      expectScopeBeachCount = parseNonNegativeInteger(
        readFlagValue(next, "--expect-scope-beach-count"),
        "--expect-scope-beach-count"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--expect-scope-beach-count=")) {
      expectScopeBeachCount = parseNonNegativeInteger(
        readFlagValue(arg.split("=")[1], "--expect-scope-beach-count"),
        "--expect-scope-beach-count"
      );
      continue;
    }
    if (arg === "--expect-proposed-json") {
      expectProposedJsonPath = readFlagValue(next, "--expect-proposed-json");
      i++;
      continue;
    }
    if (arg.startsWith("--expect-proposed-json=")) {
      expectProposedJsonPath = readFlagValue(
        arg.split("=")[1],
        "--expect-proposed-json"
      );
      continue;
    }
    if (arg === "--require-proposed-json") {
      requireProposedJson = true;
      continue;
    }
    if (arg === "--require-scope-matches-proposed-json") {
      requireScopeMatchesProposedJson = true;
      continue;
    }
    if (arg === "--max-report-age-hours") {
      maxReportAgeHours = parseNonNegativeInteger(
        readFlagValue(next, "--max-report-age-hours"),
        "--max-report-age-hours"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--max-report-age-hours=")) {
      maxReportAgeHours = parseNonNegativeInteger(
        readFlagValue(arg.split("=")[1], "--max-report-age-hours"),
        "--max-report-age-hours"
      );
      continue;
    }
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (!reportJsonPath) {
    throw new Error("Missing --report-json");
  }

  if (approval) {
    requireProposedGate = true;
    requireNonRegressingGate = true;
    requireSlices = true;
    requireBeachSlices = true;
    requireNoRegressedSlices = true;
    requireNoUnmeasuredSlices = true;
    requireProposedJson = true;
    requireScopeMatchesProposedJson = true;
    maxRowsWithoutProposedValue = maxRowsWithoutProposedValue ?? 0;
    minGateSamples = minGateSamples ?? DEFAULT_APPROVAL_MIN_GATE_SAMPLES;
    minSliceSamples = minSliceSamples ?? DEFAULT_APPROVAL_MIN_SLICE_SAMPLES;
    maxReportAgeHours =
      maxReportAgeHours ?? DEFAULT_APPROVAL_MAX_REPORT_AGE_HOURS;
  }
  if (phase0Baseline) {
    minGateSamples = minGateSamples ?? DEFAULT_APPROVAL_MIN_GATE_SAMPLES;
    maxReportAgeHours =
      maxReportAgeHours ?? DEFAULT_APPROVAL_MAX_REPORT_AGE_HOURS;
  }

  return {
    reportJsonPath,
    approval,
    phase0Baseline,
    requireProposedGate,
    requireNonRegressingGate,
    requireSlices,
    requireBeachSlices,
    requireNoRegressedSlices,
    requireNoUnmeasuredSlices,
    minGateSamples,
    minSliceSamples,
    maxRowsWithoutProposedValue,
    expectScopeBeachCount,
    expectProposedJsonPath,
    requireProposedJson,
    requireScopeMatchesProposedJson,
    maxReportAgeHours,
  };
}

function validateForecastAccuracyReport(
  report: ForecastAccuracyReport,
  options: ReportValidationOptions
): ReportValidationResult {
  const findings: string[] = [];
  const gateVerdict = report.proposed_gate_verdict ?? null;
  const slices = report.gate_slices?.items ?? [];
  const declaredRegressedSlices =
    report.gate_slices?.verdict?.regressedSlices ?? [];
  const computedRegressedSlices = slices.filter(
    (slice) => slice.deltaMaeM > 0
  );
  const regressedSlices = mergeSlicesByGroupKey(
    declaredRegressedSlices,
    computedRegressedSlices
  );
  const unmeasuredGroups =
    report.gate_slices?.coverage?.unmeasuredGroups ?? [];

  validateNumericReportFields(report, findings, {
    requireSliceMae:
      options.approval ||
      options.requireBeachSlices ||
      options.requireNoRegressedSlices,
  });
  validateReportScopeBeachIds(report, findings);

  if (options.approval) {
    validateApprovalRequiredOptions(options, findings);
    validateReportSchemaVersion(report, findings);
  }
  if (options.phase0Baseline) {
    validateReportSchemaVersion(report, findings, "Phase 0 baseline report");
  }

  if (options.requireProposedJson && !report.proposed_json_path) {
    findings.push("Missing proposed_json_path in report.");
  }

  if (
    options.expectProposedJsonPath != null &&
    report.proposed_json_path !== options.expectProposedJsonPath
  ) {
    findings.push(
      `Report proposed_json_path ${String(report.proposed_json_path)} does not match expected ${options.expectProposedJsonPath}.`
    );
  }

  if (options.approval || options.requireScopeMatchesProposedJson) {
    validateProposedJsonHash(report, options, findings);
    validateProposedJsonSourceBindings(report, options, findings);
    validateScopeMatchesProposedJson(report, options, findings);
  }

  if (options.approval || options.requireProposedApprovalPolicy) {
    validateProposedJsonApprovalPolicy(report, options, findings);
  }

  if (options.maxReportAgeHours != null) {
    const generatedAt = report.generated_at
      ? new Date(report.generated_at)
      : null;
    if (!generatedAt || Number.isNaN(generatedAt.getTime())) {
      findings.push("Missing or invalid generated_at in report.");
    } else {
      const reportAgeMs =
        (options.now ?? new Date()).getTime() - generatedAt.getTime();
      const reportAgeHours = reportAgeMs / (60 * 60 * 1000);
      if (reportAgeHours < 0) {
        findings.push(
          `Report generated_at is ${formatNumber(Math.abs(reportAgeHours))}h in the future.`
        );
      } else if (reportAgeHours > options.maxReportAgeHours) {
        findings.push(
          `Report age ${formatNumber(reportAgeHours)}h exceeds ${options.maxReportAgeHours}h.`
        );
      }
    }
  }

  if (options.approval || options.phase0Baseline || options.requireReportRange) {
    validateReportRange(
      report,
      options.now ?? new Date(),
      options.maxReportAgeHours,
      findings
    );
  }

  validateRowCountInvariant(report, findings);

  if (options.approval || options.requireApprovalGateFlags) {
    validateApprovalGateFlags(report, options, findings);
  }

  if (options.approval || options.phase0Baseline || options.requireTruthContract) {
    validateTruthContract(report, findings);
  }

  if (
    options.approval ||
    options.phase0Baseline ||
    options.requireMeasurementContract
  ) {
    validateMeasurementContract(report, findings);
  }

  if (options.phase0Baseline) {
    validatePhase0BaselineReport(report, options, findings);
  }

  if (options.approval || options.requireShortHorizonReplayProvenance) {
    validateShortHorizonReplayProvenance(report, gateVerdict, findings);
  }

  if (
    options.approval ||
    options.requireShortHorizonHorizonBucketProvenance
  ) {
    validateShortHorizonHorizonBucketProvenance(
      report,
      gateVerdict,
      findings
    );
  }

  if (options.requireProposedGate && !gateVerdict) {
    findings.push("Missing proposed 0-72h gate verdict.");
  }

  if (
    gateVerdict &&
    (options.requireProposedGate || options.requireNonRegressingGate)
  ) {
    validateProposedGateTarget(gateVerdict, findings);
    validateProposedGateVerdictConsistency(gateVerdict, findings);
    validateProposedGateFailureMetadata(gateVerdict, findings);
  }

  if (
    options.requireNonRegressingGate &&
    gateVerdict &&
    gateVerdict.verdict !== "non-regressing"
  ) {
    findings.push(
      `Proposed 0-72h gate verdict is ${gateVerdict.verdict}, delta ${formatNumber(gateVerdict.delta.delta_mae_m)}m.`
    );
  }

  if (options.minGateSamples != null && gateVerdict) {
    if (gateVerdict.delta.sample_count < options.minGateSamples) {
      findings.push(
        `Proposed gate sample count ${gateVerdict.delta.sample_count} is below ${options.minGateSamples}.`
      );
    }
    if (gateVerdict.delta.comparison_sample_count < options.minGateSamples) {
      findings.push(
        `Current gate sample count ${gateVerdict.delta.comparison_sample_count} is below ${options.minGateSamples}.`
      );
    }
  }

  if (options.requireSlices && slices.length === 0) {
    findings.push("Missing proposed 0-72h gate slices.");
  }

  if (
    options.requireBeachSlices &&
    report.gate_slices?.group_by !== "beach"
  ) {
    findings.push(
      `Approval requires proposed 0-72h gate slices grouped by beach; got ${String(report.gate_slices?.group_by)}.`
    );
  }

  if (
    options.requireBeachSlices &&
    report.gate_slices?.group_by === "beach"
  ) {
    validateBeachSliceScopeCoverage(report, findings);
  }

  if (options.requireNoRegressedSlices || options.approval) {
    validateSliceVerdictConsistency(slices, findings);
    validateSliceFailureMetadata(
      report.gate_slices?.verdict ?? null,
      computedRegressedSlices,
      findings
    );
    validateSliceCoverageMetadata(
      report.gate_slices?.coverage ?? null,
      findings
    );
  }

  if (options.requireNoRegressedSlices && regressedSlices.length > 0) {
    findings.push(
      `${regressedSlices.length} proposed 0-72h slice(s) regressed; worst was ${getWorstRegressedSlice(regressedSlices)}.`
    );
  }

  if (options.requireNoUnmeasuredSlices && unmeasuredGroups.length > 0) {
    findings.push(
      `${unmeasuredGroups.length} proposed 0-72h slice(s) were unmeasured; first was ${unmeasuredGroups[0]}.`
    );
  }

  if (options.minSliceSamples != null) {
    if (slices.length === 0) {
      findings.push(
        `Cannot verify --min-slice-samples ${options.minSliceSamples} because report has no slices.`
      );
    }
    for (const slice of slices) {
      if (slice.proposedCount < options.minSliceSamples) {
        findings.push(
          `${slice.group} proposed slice sample count ${slice.proposedCount} is below ${options.minSliceSamples}.`
        );
      }
      if (slice.currentCount < options.minSliceSamples) {
        findings.push(
          `${slice.group} current slice sample count ${slice.currentCount} is below ${options.minSliceSamples}.`
        );
      }
    }
  }

  if (options.maxRowsWithoutProposedValue != null) {
    const missingRows = report.row_counts?.rows_without_proposed_value;
    if (missingRows == null) {
      findings.push("Missing rows_without_proposed_value in report.");
    } else if (missingRows > options.maxRowsWithoutProposedValue) {
      findings.push(
        `Rows without proposed value ${missingRows} exceeds ${options.maxRowsWithoutProposedValue}.`
      );
    }
  }

  if (options.expectScopeBeachCount != null) {
    const actualBeachCount = report.scope?.beach_count;
    if (actualBeachCount !== options.expectScopeBeachCount) {
      findings.push(
        `Scope beach count ${String(actualBeachCount)} does not match expected ${options.expectScopeBeachCount}.`
      );
    }
  }

  return {
    ok: findings.length === 0,
    findings,
  };
}

function validateReportSchemaVersion(
  report: ForecastAccuracyReport,
  findings: string[],
  reportLabel = "Approval report"
): void {
  if (
    report.report_schema_version !==
    FORECAST_ACCURACY_REPORT_SCHEMA_VERSION
  ) {
    findings.push(
      `${reportLabel} must declare report_schema_version ${FORECAST_ACCURACY_REPORT_SCHEMA_VERSION}.`
    );
  }
}

function validateTruthContract(
  report: ForecastAccuracyReport,
  findings: string[]
): void {
  if (
    report.truth_source !== "buoy" &&
    report.truth_source !== "session" &&
    report.truth_source !== "both"
  ) {
    findings.push("Missing or invalid truth_source in report.");
    return;
  }

  if (report.truth_contract?.observed_field !== "observed_m") {
    findings.push(
      "Approval report must declare truth_contract.observed_field observed_m."
    );
  }
  if (report.truth_contract?.truth_quantity !== "breaking_face_height_m") {
    findings.push(
      "Approval report must declare truth_contract.truth_quantity breaking_face_height_m."
    );
  }
  if (report.truth_contract?.metric !== "mae_m") {
    findings.push("Approval report must declare truth_contract.metric mae_m.");
  }

  if (report.truth_source === "buoy") {
    return;
  }

  if (
    report.truth_contract?.session_truth_requires_canonical_display_source !==
    true
  ) {
    findings.push(
      "Approval report with session truth must require canonical display-source session links."
    );
  }
  if (
    report.truth_contract?.canonical_display_source !==
    "face-Hs-transformer-v1"
  ) {
    findings.push(
      "Approval report with session truth must declare canonical_display_source face-Hs-transformer-v1."
    );
  }
}

function validateReportRange(
  report: ForecastAccuracyReport,
  now: Date,
  maxRangeEndLagHours: number | null,
  findings: string[]
): void {
  const rangeStart = parseReportDate(report.range?.start);
  const rangeEnd = parseReportDate(report.range?.end);
  const generatedAt = parseReportDate(report.generated_at);

  if (!rangeStart) {
    findings.push("Missing or invalid report range.start.");
  }
  if (!rangeEnd) {
    findings.push("Missing or invalid report range.end.");
  }
  if (!rangeStart || !rangeEnd) {
    return;
  }

  if (rangeStart.getTime() >= rangeEnd.getTime()) {
    findings.push("Report range.start must be before range.end.");
  }
  if (rangeEnd.getTime() > now.getTime()) {
    findings.push(
      `Report range.end ${rangeEnd.toISOString()} is after validation time ${now.toISOString()}.`
    );
  }
  if (generatedAt && rangeEnd.getTime() > generatedAt.getTime()) {
    findings.push(
      `Report range.end ${rangeEnd.toISOString()} is after generated_at ${generatedAt.toISOString()}.`
    );
  }
  if (
    generatedAt &&
    isPositiveInteger(maxRangeEndLagHours) &&
    rangeEnd.getTime() <= generatedAt.getTime()
  ) {
    const rangeEndLagHours =
      (generatedAt.getTime() - rangeEnd.getTime()) / (60 * 60 * 1000);
    if (rangeEndLagHours > maxRangeEndLagHours) {
      findings.push(
        `Report range.end is ${formatNumber(rangeEndLagHours)}h before generated_at, exceeding ${maxRangeEndLagHours}h.`
      );
    }
  }
}

function validateMeasurementContract(
  report: ForecastAccuracyReport,
  findings: string[]
): void {
  if (report.measurement_contract?.proposed_delta_method !== "row-paired") {
    findings.push(
      "Approval report must declare measurement_contract.proposed_delta_method row-paired."
    );
  }
  if (report.measurement_contract?.comparison_baseline !== "current_display") {
    findings.push(
      "Approval report must declare measurement_contract.comparison_baseline current_display."
    );
  }
  if (report.measurement_contract?.candidate_baseline !== "proposed_display") {
    findings.push(
      "Approval report must declare measurement_contract.candidate_baseline proposed_display."
    );
  }
  if (report.measurement_contract?.gate_horizon !== "0-72h") {
    findings.push(
      "Approval report must declare measurement_contract.gate_horizon 0-72h."
    );
  }
}

function validatePhase0BaselineReport(
  report: ForecastAccuracyReport,
  options: ReportValidationOptions,
  findings: string[]
): void {
  if (report.proposed_json_path !== null) {
    findings.push("Phase 0 baseline report must not include proposed_json_path.");
  }
  if (report.proposed_json_sha256 !== null) {
    findings.push("Phase 0 baseline report must not include proposed_json_sha256.");
  }
  if (report.proposed_gate_verdict != null) {
    findings.push("Phase 0 baseline report must not include proposed_gate_verdict.");
  }
  if ((report.gate_slices?.items ?? []).length > 0) {
    findings.push("Phase 0 baseline report must not include proposed gate slices.");
  }

  const matchedRows = report.row_counts?.matched_prediction_rows;
  const shortHorizonRows = report.row_counts?.matched_0_72h_rows;
  if (!isPositiveInteger(matchedRows)) {
    findings.push("Phase 0 baseline matched_prediction_rows must be positive.");
  }
  if (!isPositiveInteger(shortHorizonRows)) {
    findings.push("Phase 0 baseline matched_0_72h_rows must be positive.");
  } else if (
    options.minGateSamples != null &&
    shortHorizonRows < options.minGateSamples
  ) {
    findings.push(
      `Phase 0 baseline matched_0_72h_rows ${shortHorizonRows} is below ${options.minGateSamples}.`
    );
  }

  validatePhase0BaselineMetrics(report.metrics, findings);
  validatePhase0BaselineGateMetrics(
    report.gate_metrics,
    options.minGateSamples,
    shortHorizonRows,
    findings
  );
}

function validatePhase0BaselineMetrics(
  metrics: ForecastAccuracyReportMetric[] | undefined,
  findings: string[]
): void {
  if (!Array.isArray(metrics)) {
    findings.push("Phase 0 baseline report must include metrics.");
    return;
  }

  const metricsByKey = new Map(
    metrics.map((metric) => [
      phase0BaselineMetricKey(metric.horizon_bucket, metric.baseline),
      metric,
    ])
  );

  for (const horizon of PHASE0_BASELINE_HORIZON_BUCKETS) {
    for (const baseline of PHASE0_BASELINE_BASELINES) {
      const metric = metricsByKey.get(phase0BaselineMetricKey(horizon, baseline));
      if (!metric) {
        findings.push(
          `Phase 0 baseline metric missing for ${horizon} / ${baseline}.`
        );
        continue;
      }
      validatePhase0BaselineMetric(metric, `${horizon} / ${baseline}`, findings);
    }
  }
}

function validatePhase0BaselineGateMetrics(
  gateMetrics: ForecastAccuracyReportGateMetric[] | undefined,
  minGateSamples: number | null,
  matchedShortHorizonRows: number | undefined,
  findings: string[]
): void {
  if (!Array.isArray(gateMetrics)) {
    findings.push("Phase 0 baseline report must include gate_metrics.");
    return;
  }

  const metricsByKey = new Map(
    gateMetrics.map((metric) => [
      phase0BaselineMetricKey(metric.horizon_group, metric.baseline),
      metric,
    ])
  );

  for (const baseline of PHASE0_BASELINE_BASELINES) {
    const metric = metricsByKey.get(
      phase0BaselineMetricKey(PHASE0_BASELINE_GATE_HORIZON, baseline)
    );
    if (!metric) {
      findings.push(
        `Phase 0 baseline gate metric missing for ${PHASE0_BASELINE_GATE_HORIZON} / ${baseline}.`
      );
      continue;
    }
    validatePhase0BaselineMetric(
      metric,
      `${PHASE0_BASELINE_GATE_HORIZON} / ${baseline}`,
      findings
    );
    if (
      minGateSamples != null &&
      isNonNegativeInteger(metric.sample_count) &&
      metric.sample_count < minGateSamples
    ) {
      findings.push(
        `Phase 0 baseline ${baseline} 0-72h sample_count ${metric.sample_count} is below ${minGateSamples}.`
      );
    }
  }

  const currentDisplayGate = metricsByKey.get(
    phase0BaselineMetricKey(PHASE0_BASELINE_GATE_HORIZON, "current_display")
  );
  if (
    isNonNegativeInteger(currentDisplayGate?.sample_count) &&
    isNonNegativeInteger(matchedShortHorizonRows) &&
    currentDisplayGate.sample_count !== matchedShortHorizonRows
  ) {
    findings.push(
      `Phase 0 baseline current_display gate sample_count ${currentDisplayGate.sample_count} must equal matched_0_72h_rows ${matchedShortHorizonRows}.`
    );
  }
}

function validatePhase0BaselineMetric(
  metric: ForecastAccuracyReportMetric | ForecastAccuracyReportGateMetric,
  label: string,
  findings: string[]
): void {
  if (!isPositiveInteger(metric.sample_count)) {
    findings.push(`Phase 0 baseline ${label} sample_count must be positive.`);
  }
  if (!isFiniteNumber(metric.mae_m)) {
    findings.push(`Phase 0 baseline ${label} mae_m must be finite.`);
  }
  if (!isFiniteNumber(metric.bias_m)) {
    findings.push(`Phase 0 baseline ${label} bias_m must be finite.`);
  }
}

function phase0BaselineMetricKey(horizon: string, baseline: string): string {
  return `${horizon}:${baseline}`;
}

function validateNumericReportFields(
  report: ForecastAccuracyReport,
  findings: string[],
  options: { requireSliceMae: boolean }
): void {
  if (report.proposed_gate_verdict) {
    validateGateDeltaNumericFields(report.proposed_gate_verdict.delta, findings);
  }

  for (const [field, value] of Object.entries(report.row_counts ?? {})) {
    if (!isNonNegativeInteger(value)) {
      findings.push(`row_counts.${field} must be a non-negative integer.`);
    }
  }

  for (const slice of report.gate_slices?.items ?? []) {
    if (!isNonNegativeInteger(slice.proposedCount)) {
      findings.push(`${slice.group} proposed slice sample count is not a non-negative integer.`);
    }
    if (!isNonNegativeInteger(slice.currentCount)) {
      findings.push(`${slice.group} current slice sample count is not a non-negative integer.`);
    }
    validateSliceMaeFields(slice, findings, options);
    if (
      isNonNegativeInteger(slice.proposedCount) &&
      isNonNegativeInteger(slice.currentCount) &&
      slice.proposedCount !== slice.currentCount
    ) {
      findings.push(
        `${slice.group} proposed slice sample count ${slice.proposedCount} must equal current slice sample count ${slice.currentCount}.`
      );
    }
    if (!isFiniteNumber(slice.deltaMaeM)) {
      findings.push(`${slice.group} slice deltaMaeM is not finite.`);
    }
  }
}

function validateGateDeltaNumericFields(
  delta: ForecastAccuracyReportDelta,
  findings: string[]
): void {
  if (!isNonNegativeInteger(delta.sample_count)) {
    findings.push("Proposed gate sample_count must be a non-negative integer.");
  }
  if (!isNonNegativeInteger(delta.comparison_sample_count)) {
    findings.push(
      "Current gate comparison_sample_count must be a non-negative integer."
    );
  }
  if (
    isNonNegativeInteger(delta.sample_count) &&
    isNonNegativeInteger(delta.comparison_sample_count) &&
    delta.sample_count !== delta.comparison_sample_count
  ) {
    findings.push(
      `Proposed gate sample_count ${delta.sample_count} must equal current comparison_sample_count ${delta.comparison_sample_count}.`
    );
  }
  if (!isFiniteNumber(delta.mae_m)) {
    findings.push("Proposed gate mae_m is not finite.");
  }
  if (!isFiniteNumber(delta.comparison_mae_m)) {
    findings.push("Current gate comparison_mae_m is not finite.");
  }
  if (
    isFiniteNumber(delta.mae_m) &&
    isFiniteNumber(delta.comparison_mae_m) &&
    isFiniteNumber(delta.delta_mae_m)
  ) {
    const expectedDelta = roundReportMetric(
      delta.mae_m - delta.comparison_mae_m
    );
    if (!metricsMatch(delta.delta_mae_m, expectedDelta)) {
      findings.push(
        `Proposed gate delta_mae_m ${formatNumber(delta.delta_mae_m)} must equal mae_m ${formatNumber(delta.mae_m)} - comparison_mae_m ${formatNumber(delta.comparison_mae_m)} (${formatNumber(expectedDelta)}).`
      );
    }
  }
}

function validateSliceMaeFields(
  slice: ForecastAccuracyReportSlice,
  findings: string[],
  options: { requireSliceMae: boolean }
): void {
  if (options.requireSliceMae && !isFiniteNumber(slice.proposedMaeM)) {
    findings.push(`${slice.group} proposed slice MAE is not finite.`);
  }
  if (options.requireSliceMae && !isFiniteNumber(slice.currentMaeM)) {
    findings.push(`${slice.group} current slice MAE is not finite.`);
  }
  if (
    isFiniteNumber(slice.proposedMaeM) &&
    isFiniteNumber(slice.currentMaeM) &&
    isFiniteNumber(slice.deltaMaeM)
  ) {
    const expectedDelta = roundReportMetric(
      slice.proposedMaeM - slice.currentMaeM
    );
    if (!metricsMatch(slice.deltaMaeM, expectedDelta)) {
      findings.push(
        `${slice.group} slice deltaMaeM ${formatNumber(slice.deltaMaeM)} must equal proposedMaeM ${formatNumber(slice.proposedMaeM)} - currentMaeM ${formatNumber(slice.currentMaeM)} (${formatNumber(expectedDelta)}).`
      );
    }
  }
}

function validateApprovalGateFlags(
  report: ForecastAccuracyReport,
  options: ReportValidationOptions,
  findings: string[]
): void {
  const gates = report.approval_gates;
  if (gates?.fail_on_regression !== true) {
    findings.push(
      "Approval report must be generated with --fail-on-regression."
    );
  }
  if (gates?.fail_on_slice_regression !== true) {
    findings.push(
      "Approval report must be generated with --fail-on-slice-regression."
    );
  }
  if (gates?.fail_on_unmeasured_slices !== true) {
    findings.push(
      "Approval report must be generated with --fail-on-unmeasured-slices."
    );
  }
  if (
    options.minGateSamples != null &&
    gates?.min_gate_samples !== options.minGateSamples
  ) {
    findings.push(
      `Approval report min_gate_samples ${String(gates?.min_gate_samples)} does not match required --min-gate-samples ${options.minGateSamples}.`
    );
  }
  if (
    options.minSliceSamples != null &&
    gates?.min_slice_samples !== options.minSliceSamples
  ) {
    findings.push(
      `Approval report min_slice_samples ${String(gates?.min_slice_samples)} does not match required --min-slice-samples ${options.minSliceSamples}.`
    );
  }
}

function validateApprovalRequiredOptions(
  options: ReportValidationOptions,
  findings: string[]
): void {
  if (options.minGateSamples == null) {
    findings.push("Approval validation requires --min-gate-samples.");
  } else if (!isPositiveInteger(options.minGateSamples)) {
    findings.push("Approval --min-gate-samples must be at least 1.");
  }

  if (options.minSliceSamples == null) {
    findings.push("Approval validation requires --min-slice-samples.");
  } else if (!isPositiveInteger(options.minSliceSamples)) {
    findings.push("Approval --min-slice-samples must be at least 1.");
  }

  if (options.maxReportAgeHours == null) {
    findings.push("Approval validation requires --max-report-age-hours.");
  } else if (!isPositiveInteger(options.maxReportAgeHours)) {
    findings.push("Approval --max-report-age-hours must be at least 1.");
  }
}

function validateShortHorizonReplayProvenance(
  report: ForecastAccuracyReport,
  gateVerdict: ForecastAccuracyReportGateVerdict | null,
  findings: string[]
): void {
  const withProvenance =
    report.row_counts?.matched_0_72h_rows_with_replay_provenance;
  const withoutProvenance =
    report.row_counts?.matched_0_72h_rows_without_replay_provenance;

  if (withProvenance == null) {
    findings.push(
      "Missing matched_0_72h_rows_with_replay_provenance in report."
    );
  }
  if (withoutProvenance == null) {
    findings.push(
      "Missing matched_0_72h_rows_without_replay_provenance in report."
    );
  } else if (withoutProvenance > 0) {
    findings.push(
      `Matched 0-72h rows without replay provenance ${withoutProvenance} exceeds 0.`
    );
  }

  if (
    withProvenance != null &&
    gateVerdict != null &&
    withProvenance < gateVerdict.delta.sample_count
  ) {
    findings.push(
      `0-72h rows with replay provenance ${withProvenance} is below proposed gate sample count ${gateVerdict.delta.sample_count}.`
    );
  }
}

function validateShortHorizonHorizonBucketProvenance(
  report: ForecastAccuracyReport,
  gateVerdict: ForecastAccuracyReportGateVerdict | null,
  findings: string[]
): void {
  const withProvenance =
    report.row_counts?.matched_0_72h_rows_with_horizon_bucket_provenance;
  const withoutProvenance =
    report.row_counts?.matched_0_72h_rows_without_horizon_bucket_provenance;

  if (withProvenance == null) {
    findings.push(
      "Missing matched_0_72h_rows_with_horizon_bucket_provenance in report."
    );
  }
  if (withoutProvenance == null) {
    findings.push(
      "Missing matched_0_72h_rows_without_horizon_bucket_provenance in report."
    );
  } else if (withoutProvenance > 0) {
    findings.push(
      `Matched 0-72h rows without horizon-bucket provenance ${withoutProvenance} exceeds 0.`
    );
  }

  if (
    withProvenance != null &&
    gateVerdict != null &&
    withProvenance < gateVerdict.delta.sample_count
  ) {
    findings.push(
      `0-72h rows with horizon-bucket provenance ${withProvenance} is below proposed gate sample count ${gateVerdict.delta.sample_count}.`
    );
  }
}

function validateProposedGateTarget(
  gateVerdict: ForecastAccuracyReportGateVerdict,
  findings: string[]
): void {
  if (gateVerdict.delta.horizon_group !== "0-72h") {
    findings.push(
      `Proposed gate horizon_group must be 0-72h, got ${gateVerdict.delta.horizon_group}.`
    );
  }

  if (gateVerdict.delta.baseline !== "proposed_display") {
    findings.push(
      `Proposed gate baseline must be proposed_display, got ${String(gateVerdict.delta.baseline)}.`
    );
  }
}

function validateProposedGateVerdictConsistency(
  gateVerdict: ForecastAccuracyReportGateVerdict,
  findings: string[]
): void {
  if (!isFiniteNumber(gateVerdict.delta.delta_mae_m)) {
    findings.push("Proposed 0-72h gate delta_mae_m is not finite.");
    return;
  }

  const expectedVerdict = verdictForDelta(gateVerdict.delta.delta_mae_m);
  if (gateVerdict.verdict !== expectedVerdict) {
    findings.push(
      `Proposed 0-72h gate verdict ${gateVerdict.verdict} is inconsistent with delta ${formatNumber(gateVerdict.delta.delta_mae_m)}m; expected ${expectedVerdict}.`
    );
  }
}

function validateProposedGateFailureMetadata(
  gateVerdict: ForecastAccuracyReportGateVerdict,
  findings: string[]
): void {
  const sampleFloorShouldFail = validateSampleFloorMetadata(
    gateVerdict.sampleFloor,
    "Proposed gate",
    findings
  );
  if (!isFiniteNumber(gateVerdict.delta.delta_mae_m)) {
    return;
  }

  const expectedShouldFail =
    gateVerdict.delta.delta_mae_m > 0 || sampleFloorShouldFail === true;
  if (gateVerdict.shouldFail !== expectedShouldFail) {
    findings.push(
      `Proposed gate shouldFail ${String(gateVerdict.shouldFail)} is inconsistent with regression/sample-floor state; expected ${String(expectedShouldFail)}.`
    );
  }
}

function validateSliceVerdictConsistency(
  slices: ForecastAccuracyReportSlice[],
  findings: string[]
): void {
  for (const slice of slices) {
    if (!isFiniteNumber(slice.deltaMaeM)) {
      continue;
    }

    const expectedVerdict = verdictForDelta(slice.deltaMaeM);
    if (slice.verdict !== expectedVerdict) {
      findings.push(
        `${slice.group} slice verdict ${slice.verdict} is inconsistent with delta ${formatNumber(slice.deltaMaeM)}m; expected ${expectedVerdict}.`
      );
    }
  }
}

function validateSliceFailureMetadata(
  verdict:
    | {
        regressedSlices?: ForecastAccuracyReportSlice[];
        sampleFloor?: ForecastAccuracyReportSampleFloor | null;
        shouldFail?: boolean;
      }
    | null,
  computedRegressedSlices: ForecastAccuracyReportSlice[],
  findings: string[]
): void {
  if (!verdict) {
    return;
  }

  const sampleFloorShouldFail = validateSampleFloorMetadata(
    verdict.sampleFloor,
    "Gate slice verdict",
    findings
  );
  const expectedShouldFail =
    computedRegressedSlices.length > 0 || sampleFloorShouldFail === true;
  if (verdict.shouldFail !== expectedShouldFail) {
    findings.push(
      `Gate slice verdict shouldFail ${String(verdict.shouldFail)} is inconsistent with regressed slices/sample-floor state; expected ${String(expectedShouldFail)}.`
    );
  }
}

function validateSliceCoverageMetadata(
  coverage:
    | {
        unmeasuredGroups?: string[];
        shouldFail?: boolean;
      }
    | null,
  findings: string[]
): void {
  if (!coverage) {
    return;
  }

  const unmeasuredGroups = Array.isArray(coverage.unmeasuredGroups)
    ? coverage.unmeasuredGroups
    : [];
  const expectedShouldFail = unmeasuredGroups.length > 0;
  if (coverage.shouldFail !== expectedShouldFail) {
    findings.push(
      `Gate slice coverage shouldFail ${String(coverage.shouldFail)} is inconsistent with unmeasured group count ${unmeasuredGroups.length}; expected ${String(expectedShouldFail)}.`
    );
  }
}

function validateSampleFloorMetadata(
  sampleFloor: ForecastAccuracyReportSampleFloor | null | undefined,
  label: string,
  findings: string[]
): boolean | null {
  if (sampleFloor == null) {
    return null;
  }

  if (!Array.isArray(sampleFloor.insufficientGroups)) {
    findings.push(`${label} sampleFloor.insufficientGroups must be an array.`);
    return null;
  }

  const expectedShouldFail = sampleFloor.insufficientGroups.length > 0;
  if (sampleFloor.shouldFail !== expectedShouldFail) {
    findings.push(
      `${label} sampleFloor.shouldFail ${String(sampleFloor.shouldFail)} is inconsistent with insufficient group count ${sampleFloor.insufficientGroups.length}; expected ${String(expectedShouldFail)}.`
    );
  }
  return expectedShouldFail;
}

function verdictForDelta(deltaMaeM: number): Verdict {
  return deltaMaeM > 0 ? "regressed" : "non-regressing";
}

function validateScopeMatchesProposedJson(
  report: ForecastAccuracyReport,
  options: ReportValidationOptions,
  findings: string[]
): void {
  const proposedJsonPath =
    options.expectProposedJsonPath ?? report.proposed_json_path;
  if (!proposedJsonPath) {
    findings.push(
      "Cannot compare scope to proposed JSON because no proposed JSON path is available."
    );
    return;
  }

  let proposedScope: ProposedBeachScopeExtraction;
  try {
    proposedScope = extractProposedBeachScopeFromFile(proposedJsonPath);
  } catch (error) {
    findings.push(
      `Cannot read proposed JSON ${proposedJsonPath}: ${formatError(error)}.`
    );
    return;
  }
  if (proposedScope.unresolvedTopLevelKeys.length > 0) {
    findings.push(
      `Top-level proposed beach config key(s) lack resolvable beach IDs: ${proposedScope.unresolvedTopLevelKeys.join(", ")}.`
    );
    return;
  }
  if (proposedScope.duplicateBeachIds.length > 0) {
    findings.push(
      `Duplicate proposed beach ID(s) in proposed JSON: ${proposedScope.duplicateBeachIds.join(", ")}.`
    );
  }
  if (proposedScope.duplicateBeachSlugs.length > 0) {
    findings.push(
      `Duplicate proposed beach slug(s) in proposed JSON: ${proposedScope.duplicateBeachSlugs.join(", ")}.`
    );
  }
  const expectedBeachIds = proposedScope.beachIds;
  if (expectedBeachIds.length === 0) {
    findings.push(`No proposed beach IDs found in ${proposedJsonPath}.`);
    return;
  }

  const actualBeachIds = report.scope?.beach_ids;
  if (!Array.isArray(actualBeachIds)) {
    findings.push("Missing scope.beach_ids in report.");
    return;
  }

  const expected = normalizeUniqueStrings(expectedBeachIds);
  const actual = normalizeUniqueStrings(actualBeachIds);
  const missing = expected.filter((id) => !actual.includes(id));
  const unexpected = actual.filter((id) => !expected.includes(id));

  if (missing.length > 0 || unexpected.length > 0) {
    const missingText = missing.length > 0 ? missing.join(", ") : "none";
    const unexpectedText =
      unexpected.length > 0 ? unexpected.join(", ") : "none";
    findings.push(
      `Report scope beach IDs do not match proposed JSON; missing: ${missingText}; unexpected: ${unexpectedText}.`
    );
  }
}

function validateProposedJsonHash(
  report: ForecastAccuracyReport,
  options: ReportValidationOptions,
  findings: string[]
): void {
  const proposedJsonPath =
    options.expectProposedJsonPath ?? report.proposed_json_path;
  if (!proposedJsonPath) {
    findings.push(
      "Cannot compare proposed JSON hash because no proposed JSON path is available."
    );
    return;
  }

  if (!report.proposed_json_sha256) {
    findings.push("Missing proposed_json_sha256 in report.");
    return;
  }

  let expectedHash: string;
  try {
    expectedHash = sha256File(proposedJsonPath);
  } catch (error) {
    findings.push(
      `Cannot read proposed JSON ${proposedJsonPath}: ${formatError(error)}.`
    );
    return;
  }
  if (report.proposed_json_sha256 !== expectedHash) {
    findings.push(
      `Report proposed_json_sha256 ${report.proposed_json_sha256} does not match current proposed JSON SHA-256 ${expectedHash}.`
    );
  }
}

function validateProposedJsonSourceBindings(
  report: ForecastAccuracyReport,
  options: ReportValidationOptions,
  findings: string[]
): void {
  const proposedJsonPath =
    options.expectProposedJsonPath ?? report.proposed_json_path;
  if (!proposedJsonPath) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      readFileSync(resolve(proposedJsonPath), "utf8")
    ) as unknown;
  } catch {
    return;
  }

  if (!isRecord(parsed)) {
    return;
  }

  validateProposedJsonSourceHash(
    parsed,
    "source_migration",
    "source_migration_sha256",
    findings
  );
  validateProposedJsonSourceHash(
    parsed,
    "source_validated_json",
    "source_validated_json_sha256",
    findings
  );
}

function validateProposedJsonSourceHash(
  proposedJson: Record<string, unknown>,
  sourcePathField: string,
  sourceHashField: string,
  findings: string[]
): void {
  if (typeof proposedJson[sourcePathField] !== "string") {
    return;
  }

  const sourcePath = proposedJson[sourcePathField];
  if (typeof proposedJson[sourceHashField] !== "string") {
    findings.push(
      `Proposed JSON has ${sourcePathField} but is missing ${sourceHashField}.`
    );
    return;
  }

  let currentHash: string;
  try {
    currentHash = sha256File(sourcePath);
  } catch (error) {
    findings.push(
      `Cannot read proposed JSON ${sourcePathField} ${sourcePath}: ${formatError(error)}.`
    );
    return;
  }

  if (proposedJson[sourceHashField] !== currentHash) {
    findings.push(
      `Proposed JSON ${sourceHashField} ${proposedJson[sourceHashField]} does not match current ${sourcePathField} SHA-256 ${currentHash}.`
    );
  }
}

function validateProposedJsonApprovalPolicy(
  report: ForecastAccuracyReport,
  options: ReportValidationOptions,
  findings: string[]
): void {
  const proposedJsonPath =
    options.expectProposedJsonPath ?? report.proposed_json_path;
  if (!proposedJsonPath) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      readFileSync(resolve(proposedJsonPath), "utf8")
    ) as unknown;
  } catch {
    return;
  }

  if (!isRecord(parsed) || !isRecord(parsed.approval_policy)) {
    findings.push(
      "Approval proposed JSON must include approval_policy."
    );
    return;
  }

  const policy = parsed.approval_policy;
  if (policy.status !== "phase0_required" && policy.status !== "harness_only") {
    findings.push(
      `Proposed JSON approval_policy.status must be phase0_required or harness_only; got ${String(policy.status)}.`
    );
  }
  if (policy.production_write_allowed !== false) {
    findings.push(
      "Proposed JSON approval_policy.production_write_allowed must be false for approval artifacts."
    );
  }
  if (policy.requires_phase0_approval !== true) {
    findings.push(
      "Proposed JSON approval_policy.requires_phase0_approval must be true."
    );
  }
  if (policy.required_gate !== "0-72h") {
    findings.push(
      `Proposed JSON approval_policy.required_gate must be 0-72h; got ${String(policy.required_gate)}.`
    );
  }
  if (policy.required_metric !== "face_height_mae") {
    findings.push(
      `Proposed JSON approval_policy.required_metric must be face_height_mae; got ${String(policy.required_metric)}.`
    );
  }
  if (
    policy.required_validator !==
    "forecast-accuracy-report-validate --approval"
  ) {
    findings.push(
      `Proposed JSON approval_policy.required_validator must be forecast-accuracy-report-validate --approval; got ${String(policy.required_validator)}.`
    );
  }

  validateProposedJsonSamplePolicy({
    fieldName: "min_gate_samples",
    value: policy.min_gate_samples,
    optionValue:
      options.proposedApprovalPolicyMinGateSamples ?? options.minGateSamples,
    findings,
  });
  validateProposedJsonSamplePolicy({
    fieldName: "min_slice_samples",
    value: policy.min_slice_samples,
    optionValue:
      options.proposedApprovalPolicyMinSliceSamples ?? options.minSliceSamples,
    findings,
  });
  const maxReportAgeHours =
    options.proposedApprovalPolicyMaxReportAgeHours ??
    options.maxReportAgeHours;

  if (!isPositiveInteger(policy.max_report_age_hours)) {
    findings.push(
      "Proposed JSON approval_policy.max_report_age_hours must be a positive integer."
    );
  } else if (
    maxReportAgeHours == null ||
    maxReportAgeHours > policy.max_report_age_hours
  ) {
    findings.push(
      `Approval --max-report-age-hours ${String(maxReportAgeHours)} is weaker than proposed JSON approval_policy.max_report_age_hours ${policy.max_report_age_hours}.`
    );
  }
}

function validateProposedJsonSamplePolicy({
  fieldName,
  value,
  optionValue,
  findings,
}: {
  fieldName: "min_gate_samples" | "min_slice_samples";
  value: unknown;
  optionValue: number | null;
  findings: string[];
}): void {
  if (!isPositiveInteger(value)) {
    findings.push(
      `Proposed JSON approval_policy.${fieldName} must be a positive integer.`
    );
    return;
  }
  const optionName =
    fieldName === "min_gate_samples"
      ? "--min-gate-samples"
      : "--min-slice-samples";
  if (optionValue == null || optionValue < value) {
    findings.push(
      `Approval ${optionName} ${String(optionValue)} is weaker than proposed JSON approval_policy.${fieldName} ${value}.`
    );
  }
}

function sha256File(path: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(path)))
    .digest("hex");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseReportDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateBeachSliceScopeCoverage(
  report: ForecastAccuracyReport,
  findings: string[]
): void {
  const scopeBeachIds = report.scope?.beach_ids;
  if (!Array.isArray(scopeBeachIds) || scopeBeachIds.length === 0) {
    findings.push("Missing scope.beach_ids for beach-slice approval.");
    return;
  }

  const slices = report.gate_slices?.items ?? [];
  const missingGroupKeySlices = slices.filter((slice) => !slice.groupKey);
  if (missingGroupKeySlices.length > 0) {
    findings.push(
      `${missingGroupKeySlices.length} proposed 0-72h beach slice(s) are missing groupKey.`
    );
  }
  const duplicateGroupKeys = findDuplicateGroupKeys(slices);
  if (duplicateGroupKeys.length > 0) {
    findings.push(
      `Duplicate proposed 0-72h beach slice groupKey(s): ${duplicateGroupKeys.join(", ")}.`
    );
  }

  const expected = normalizeUniqueStrings(scopeBeachIds);
  const actual = normalizeUniqueStrings(
    slices.flatMap((slice) => (slice.groupKey ? [slice.groupKey] : []))
  );
  const missing = expected.filter((id) => !actual.includes(id));
  const unexpected = actual.filter((id) => !expected.includes(id));
  if (missing.length > 0 || unexpected.length > 0) {
    const missingText = missing.length > 0 ? missing.join(", ") : "none";
    const unexpectedText =
      unexpected.length > 0 ? unexpected.join(", ") : "none";
    findings.push(
      `Beach slice group keys do not match report scope; missing: ${missingText}; unexpected: ${unexpectedText}.`
    );
  }
}

interface ProposedBeachScopeExtraction {
  beachIds: string[];
  duplicateBeachIds: string[];
  duplicateBeachSlugs: string[];
  unresolvedTopLevelKeys: string[];
}

function extractProposedBeachScopeFromFile(
  path: string
): ProposedBeachScopeExtraction {
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
  return extractProposedBeachScope(parsed);
}

function extractProposedBeachScope(value: unknown): ProposedBeachScopeExtraction {
  if (Array.isArray(value)) {
    const beachIds = value.flatMap((item) =>
      isRecord(item) && typeof item.beach_id === "string"
        ? [item.beach_id]
        : []
    );
    return {
      beachIds: normalizeUniqueStrings(beachIds),
      duplicateBeachIds: [],
      duplicateBeachSlugs: [],
      unresolvedTopLevelKeys: [],
    };
  }

  if (!isRecord(value)) {
    return {
      beachIds: [],
      duplicateBeachIds: [],
      duplicateBeachSlugs: [],
      unresolvedTopLevelKeys: [],
    };
  }

  const ids: string[] = [];
  const beachConfigIds: string[] = [];
  const beachConfigSlugs: string[] = [];
  const unresolvedTopLevelKeys: string[] = [];
  if (Array.isArray(value.predictions)) {
    ids.push(
      ...value.predictions.flatMap((prediction) =>
        isRecord(prediction) && typeof prediction.beach_id === "string"
          ? [prediction.beach_id]
          : []
      )
    );
  }
  if (Array.isArray(value.beaches)) {
    const beachIds = value.beaches.flatMap((beach) =>
      isRecord(beach) && typeof beach.id === "string" ? [beach.id] : []
    );
    const beachSlugs = value.beaches.flatMap((beach) =>
      isRecord(beach) && typeof beach.slug === "string" ? [beach.slug] : []
    );
    ids.push(...beachIds);
    beachConfigIds.push(...beachIds);
    beachConfigSlugs.push(...beachSlugs);
  }

  for (const [key, proposedValue] of Object.entries(value)) {
    if (key === "predictions" || key === "beaches") {
      continue;
    }
    if (!isRecord(proposedValue) || !isProposedBeachConfigRecord(proposedValue)) {
      continue;
    }
    const beachId = getTopLevelProposedBeachId(key, proposedValue);
    if (beachId) {
      ids.push(beachId);
      beachConfigIds.push(beachId);
    } else {
      unresolvedTopLevelKeys.push(key);
    }
    if (typeof proposedValue.slug === "string" && proposedValue.slug) {
      beachConfigSlugs.push(proposedValue.slug);
    } else if (!isUuidLike(key)) {
      beachConfigSlugs.push(key);
    }
  }

  return {
    beachIds: normalizeUniqueStrings(ids),
    duplicateBeachIds: findDuplicateStrings(beachConfigIds),
    duplicateBeachSlugs: findDuplicateStrings(beachConfigSlugs),
    unresolvedTopLevelKeys: normalizeUniqueStrings(unresolvedTopLevelKeys),
  };
}

function validateReportScopeBeachIds(
  report: ForecastAccuracyReport,
  findings: string[]
): void {
  const scopeBeachIds = report.scope?.beach_ids;
  if (!Array.isArray(scopeBeachIds)) {
    return;
  }

  const duplicateBeachIds = findDuplicateStrings(scopeBeachIds);
  if (duplicateBeachIds.length > 0) {
    findings.push(
      `Duplicate scope beach ID(s): ${duplicateBeachIds.join(", ")}.`
    );
  }

  const beachCount = report.scope?.beach_count;
  if (typeof beachCount !== "number") {
    return;
  }
  const uniqueBeachCount = normalizeUniqueStrings(scopeBeachIds).length;
  if (beachCount !== uniqueBeachCount) {
    findings.push(
      `Scope beach count ${beachCount} does not match unique scope.beach_ids count ${uniqueBeachCount}.`
    );
  }
}

function validateRowCountInvariant(
  report: ForecastAccuracyReport,
  findings: string[]
): void {
  const gateDelta = report.proposed_gate_verdict?.delta;
  const matchedRows = report.row_counts?.matched_prediction_rows;
  const proposedRows = report.row_counts?.proposed_rows_compared;
  const missingRows = report.row_counts?.rows_without_proposed_value;
  const hasProposedArtifact =
    report.proposed_json_path != null || report.proposed_gate_verdict != null;

  if (
    hasProposedArtifact &&
    matchedRows != null &&
    proposedRows != null &&
    missingRows != null &&
    proposedRows + missingRows !== matchedRows
  ) {
    findings.push(
      `Row count invariant failed: proposed_rows_compared ${proposedRows} + rows_without_proposed_value ${missingRows} does not equal matched_prediction_rows ${matchedRows}.`
    );
  }

  const shortRows = report.row_counts?.matched_0_72h_rows;
  const shortRowsWithHorizonBucketProvenance =
    report.row_counts?.matched_0_72h_rows_with_horizon_bucket_provenance;
  const shortRowsWithoutHorizonBucketProvenance =
    report.row_counts?.matched_0_72h_rows_without_horizon_bucket_provenance;
  const shortRowsWithProvenance =
    report.row_counts?.matched_0_72h_rows_with_replay_provenance;
  const shortRowsWithoutProvenance =
    report.row_counts?.matched_0_72h_rows_without_replay_provenance;

  if (gateDelta && shortRows == null) {
    findings.push("Missing matched_0_72h_rows in report.");
    return;
  }
  if (!isNonNegativeInteger(shortRows)) {
    return;
  }

  if (
    gateDelta &&
    isNonNegativeInteger(gateDelta.sample_count) &&
    gateDelta.sample_count !== shortRows
  ) {
    findings.push(
      `0-72h gate sample_count ${gateDelta.sample_count} must equal matched_0_72h_rows ${shortRows}.`
    );
  }
  if (
    gateDelta &&
    isNonNegativeInteger(gateDelta.comparison_sample_count) &&
    gateDelta.comparison_sample_count !== shortRows
  ) {
    findings.push(
      `0-72h gate comparison_sample_count ${gateDelta.comparison_sample_count} must equal matched_0_72h_rows ${shortRows}.`
    );
  }

  validateSliceSampleTotals(report, gateDelta, findings);

  if (
    shortRowsWithHorizonBucketProvenance != null &&
    shortRowsWithoutHorizonBucketProvenance != null &&
    shortRowsWithHorizonBucketProvenance +
      shortRowsWithoutHorizonBucketProvenance !==
      shortRows
  ) {
    findings.push(
      `0-72h horizon-bucket provenance invariant failed: matched_0_72h_rows_with_horizon_bucket_provenance ${shortRowsWithHorizonBucketProvenance} + matched_0_72h_rows_without_horizon_bucket_provenance ${shortRowsWithoutHorizonBucketProvenance} does not equal matched_0_72h_rows ${shortRows}.`
    );
  }

  if (
    shortRowsWithProvenance != null &&
    shortRowsWithoutProvenance != null &&
    shortRowsWithProvenance + shortRowsWithoutProvenance !== shortRows
  ) {
    findings.push(
      `0-72h replay provenance invariant failed: matched_0_72h_rows_with_replay_provenance ${shortRowsWithProvenance} + matched_0_72h_rows_without_replay_provenance ${shortRowsWithoutProvenance} does not equal matched_0_72h_rows ${shortRows}.`
    );
  }
}

function validateSliceSampleTotals(
  report: ForecastAccuracyReport,
  gateDelta: ForecastAccuracyReportDelta | undefined,
  findings: string[]
): void {
  const slices = report.gate_slices?.items ?? [];
  if (!gateDelta || slices.length === 0) {
    return;
  }
  const hasValidSliceCounts = slices.every(
    (slice) =>
      isNonNegativeInteger(slice.proposedCount) &&
      isNonNegativeInteger(slice.currentCount)
  );
  if (!hasValidSliceCounts) {
    return;
  }

  const proposedSliceTotal = slices.reduce(
    (total, slice) => total + slice.proposedCount,
    0
  );
  const currentSliceTotal = slices.reduce(
    (total, slice) => total + slice.currentCount,
    0
  );

  if (
    isNonNegativeInteger(gateDelta.sample_count) &&
    proposedSliceTotal !== gateDelta.sample_count
  ) {
    findings.push(
      `0-72h proposed slice sample total ${proposedSliceTotal} must equal proposed gate sample_count ${gateDelta.sample_count}.`
    );
  }
  if (
    isNonNegativeInteger(gateDelta.comparison_sample_count) &&
    currentSliceTotal !== gateDelta.comparison_sample_count
  ) {
    findings.push(
      `0-72h current slice sample total ${currentSliceTotal} must equal current gate comparison_sample_count ${gateDelta.comparison_sample_count}.`
    );
  }
}

function loadForecastAccuracyReport(path: string): ForecastAccuracyReport {
  return JSON.parse(
    readFileSync(resolve(path), "utf8")
  ) as ForecastAccuracyReport;
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function parseNonNegativeInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flagName} must be a non-negative integer.`);
  }
  return parsed;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 1;
}

function normalizeUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function findDuplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value) {
      continue;
    }
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }
  return Array.from(duplicates).sort((a, b) => a.localeCompare(b));
}

function findDuplicateGroupKeys(slices: ForecastAccuracyReportSlice[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slice of slices) {
    if (!slice.groupKey) {
      continue;
    }
    if (seen.has(slice.groupKey)) {
      duplicates.add(slice.groupKey);
    } else {
      seen.add(slice.groupKey);
    }
  }
  return Array.from(duplicates).sort((a, b) => a.localeCompare(b));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getTopLevelProposedBeachId(
  key: string,
  value: Record<string, unknown>
): string | null {
  if (typeof value.id === "string" && value.id) {
    return value.id;
  }
  if (isUuidLike(key)) {
    return key;
  }
  return null;
}

function isProposedBeachConfigRecord(value: Record<string, unknown>): boolean {
  return [
    "id",
    "slug",
    "shoaling_factors",
    "swell_access_factors",
    "wind_exposure_factors",
    "terrain_enabled",
    "terrain_method",
    "terrain_status",
    "terrain_params",
    "terrain_params_hash",
    "swell_window_center_deg",
    "swell_window_halfwidth_deg",
    "deepwater_decay_factor",
  ].some((key) => key in value);
}

function mergeSlicesByGroupKey(
  first: ForecastAccuracyReportSlice[],
  second: ForecastAccuracyReportSlice[]
): ForecastAccuracyReportSlice[] {
  const merged = new Map<string, ForecastAccuracyReportSlice>();
  for (const slice of [...first, ...second]) {
    merged.set(sliceKey(slice), slice);
  }
  return Array.from(merged.values());
}

function sliceKey(slice: ForecastAccuracyReportSlice): string {
  return slice.groupKey ? `key:${slice.groupKey}` : `group:${slice.group}`;
}

function getWorstRegressedSlice(
  slices: ForecastAccuracyReportSlice[]
): string {
  const worstSlice = slices.reduce(
    (worst, slice) => (slice.deltaMaeM > worst.deltaMaeM ? slice : worst),
    slices[0]
  );
  return `${worstSlice.group} by ${formatNumber(worstSlice.deltaMaeM)}m MAE`;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : String(value);
}

function roundReportMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function metricsMatch(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= METRIC_ARITHMETIC_TOLERANCE_M;
}

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/harness-report.json --approval
  yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/baseline-report.json --phase0-baseline
  yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/harness-report.json --require-beach-slices
  yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/harness-report.json --approval --expect-proposed-json /tmp/proposed.json --require-scope-matches-proposed-json --min-gate-samples 75 --min-slice-samples 25 --expect-scope-beach-count 3 --max-report-age-hours 24`);
}

function main(): void {
  const options = parseCliArgs(process.argv.slice(2));
  const report = loadForecastAccuracyReport(options.reportJsonPath);
  const result = validateForecastAccuracyReport(report, options);

  if (!result.ok) {
    console.error("Forecast accuracy report validation failed:");
    for (const finding of result.findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 2;
    return;
  }

  const gate = report.proposed_gate_verdict;
  console.log("Forecast accuracy report validation passed.");
  if (gate) {
    console.log(
      `0-72h gate: ${gate.verdict}, proposed N ${gate.delta.sample_count}, current N ${gate.delta.comparison_sample_count}, delta ${formatNumber(gate.delta.delta_mae_m)}m.`
    );
  }
  console.log(
    `Rows compared: ${report.row_counts?.matched_prediction_rows ?? "unknown"}; rows without proposed value: ${report.row_counts?.rows_without_proposed_value ?? "unknown"}.`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export {
  parseCliArgs,
  validateForecastAccuracyReport,
  type ForecastAccuracyReport,
};
