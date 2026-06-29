#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  validateForecastAccuracyReport,
  type ForecastAccuracyReport,
} from "./forecast-accuracy-report-validate";

const DEFAULT_MIN_GATE_SAMPLES = 75;
const DEFAULT_MAX_REPORT_AGE_HOURS = 24;
const METRIC_ARITHMETIC_TOLERANCE_M = 0.0005;

type Verdict = "non-regressing" | "regressed";

interface CliOptions {
  reportJsonPath: string;
  proposedJsonPath: string;
  outputJsonPath: string;
  minGateSamples: number;
  minSliceSamples: number;
  maxReportAgeHours: number;
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

interface ApprovalEligibleSlice extends ForecastAccuracyReportSlice {
  groupKey: string;
  proposedMaeM: number;
  currentMaeM: number;
}

interface ApprovalSubset {
  selectedBeachIds: string[];
  selectedSlices: ApprovalEligibleSlice[];
  selectedProposedCount: number;
  selectedCurrentCount: number;
  excludedSlices: ForecastAccuracyReportSlice[];
  unmeasuredGroups: string[];
}

interface ApprovalSubsetMetadata {
  generated_at: string;
  source_report_json_path: string;
  source_report_json_sha256: string;
  source_proposed_json_path: string;
  source_proposed_json_sha256: string;
  selection_rule: string;
  criteria: {
    min_gate_samples: number;
    min_slice_samples: number;
    max_report_age_hours: number;
  };
  selected_beach_ids: string[];
  selected_slice_count: number;
  selected_proposed_count: number;
  selected_current_count: number;
  excluded_measured_slice_count: number;
  excluded_unmeasured_group_count: number;
  selected_slices: Array<{
    beach_id: string;
    group: string;
    proposed_count: number;
    current_count: number;
    proposed_mae_m: number;
    current_mae_m: number;
    delta_mae_m: number;
  }>;
}

interface ProposedBeachConfig {
  id?: string | null;
  slug?: string | null;
  [key: string]: unknown;
}

interface ProposedPrediction {
  beach_id?: string | null;
  [key: string]: unknown;
}

interface ProposedObject {
  predictions?: ProposedPrediction[];
  beaches?: ProposedBeachConfig[];
  approval_subset?: ApprovalSubsetMetadata;
  [key: string]: unknown;
}

type ProposedInput = ProposedObject | ProposedPrediction[];

function parseCliArgs(argv: string[]): CliOptions {
  let reportJsonPath = "";
  let proposedJsonPath = "";
  let outputJsonPath = "";
  let minGateSamples = DEFAULT_MIN_GATE_SAMPLES;
  let minSliceSamples = 25;
  let maxReportAgeHours = DEFAULT_MAX_REPORT_AGE_HOURS;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--report-json") {
      reportJsonPath = readFlagValue(next, "--report-json");
      index++;
      continue;
    }
    if (arg.startsWith("--report-json=")) {
      reportJsonPath = readFlagValue(arg.split("=")[1], "--report-json");
      continue;
    }
    if (arg === "--proposed-json") {
      proposedJsonPath = readFlagValue(next, "--proposed-json");
      index++;
      continue;
    }
    if (arg.startsWith("--proposed-json=")) {
      proposedJsonPath = readFlagValue(arg.split("=")[1], "--proposed-json");
      continue;
    }
    if (arg === "--output-json") {
      outputJsonPath = readFlagValue(next, "--output-json");
      index++;
      continue;
    }
    if (arg.startsWith("--output-json=")) {
      outputJsonPath = readFlagValue(arg.split("=")[1], "--output-json");
      continue;
    }
    if (arg === "--min-slice-samples") {
      minSliceSamples = parsePositiveInteger(
        readFlagValue(next, "--min-slice-samples"),
        "--min-slice-samples"
      );
      index++;
      continue;
    }
    if (arg.startsWith("--min-slice-samples=")) {
      minSliceSamples = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-slice-samples"),
        "--min-slice-samples"
      );
      continue;
    }
    if (arg === "--min-gate-samples") {
      minGateSamples = parsePositiveInteger(
        readFlagValue(next, "--min-gate-samples"),
        "--min-gate-samples"
      );
      index++;
      continue;
    }
    if (arg.startsWith("--min-gate-samples=")) {
      minGateSamples = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-gate-samples"),
        "--min-gate-samples"
      );
      continue;
    }
    if (arg === "--max-report-age-hours") {
      maxReportAgeHours = parsePositiveInteger(
        readFlagValue(next, "--max-report-age-hours"),
        "--max-report-age-hours"
      );
      index++;
      continue;
    }
    if (arg.startsWith("--max-report-age-hours=")) {
      maxReportAgeHours = parsePositiveInteger(
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
  if (!proposedJsonPath) {
    throw new Error("Missing --proposed-json");
  }
  if (!outputJsonPath) {
    throw new Error("Missing --output-json");
  }

  return {
    reportJsonPath,
    proposedJsonPath,
    outputJsonPath,
    minGateSamples,
    minSliceSamples,
    maxReportAgeHours,
  };
}

function validateApprovalSubsetSourceReport(
  report: ForecastAccuracyReport,
  {
    proposedJsonPath,
    minGateSamples,
    minSliceSamples,
    maxReportAgeHours,
    now,
  }: {
    proposedJsonPath: string;
    minGateSamples: number;
    minSliceSamples: number;
    maxReportAgeHours: number;
    now?: Date;
  }
): void {
  const sourceMinGateSamples = isPositiveInteger(
    report.approval_gates?.min_gate_samples
  )
    ? report.approval_gates.min_gate_samples
    : minGateSamples;
  const result = validateForecastAccuracyReport(report, {
    approval: false,
    requireProposedGate: true,
    requireNonRegressingGate: false,
    requireSlices: true,
    requireBeachSlices: false,
    requireNoRegressedSlices: false,
    requireNoUnmeasuredSlices: false,
    minGateSamples: sourceMinGateSamples,
    minSliceSamples: null,
    maxRowsWithoutProposedValue: 0,
    expectScopeBeachCount: null,
    expectProposedJsonPath: proposedJsonPath,
    requireProposedJson: true,
    requireScopeMatchesProposedJson: true,
    maxReportAgeHours,
    requireApprovalGateFlags: true,
    requireTruthContract: true,
    requireMeasurementContract: true,
    requireProposedApprovalPolicy: true,
    proposedApprovalPolicyMinGateSamples: minGateSamples,
    proposedApprovalPolicyMinSliceSamples: minSliceSamples,
    requireShortHorizonHorizonBucketProvenance: true,
    requireShortHorizonReplayProvenance: true,
    requireReportRange: true,
    now,
  });

  if (!result.ok) {
    throw new Error(
      `Approval subset source report failed validation: ${result.findings.join("; ")}`
    );
  }
}

function buildApprovalSubsetFromReport(
  report: ForecastAccuracyReport,
  options: { minGateSamples: number; minSliceSamples: number }
): ApprovalSubset {
  if (report.gate_slices?.group_by !== "beach") {
    throw new Error(
      `Approval subset requires a beach-level harness report; got ${String(report.gate_slices?.group_by)}.`
    );
  }

  const slices = report.gate_slices.items ?? [];
  const duplicateGroupKeys = findDuplicateGroupKeys(slices);
  if (duplicateGroupKeys.length > 0) {
    throw new Error(
      `Approval subset report has duplicate beach slice groupKey(s): ${duplicateGroupKeys.join(", ")}.`
    );
  }
  const selectedSlices = slices.filter(
    (slice): slice is ApprovalEligibleSlice =>
      typeof slice.groupKey === "string" &&
      slice.groupKey.length > 0 &&
      Number.isFinite(slice.deltaMaeM) &&
      slice.deltaMaeM <= 0 &&
      hasConsistentSliceMae(slice) &&
      isNonNegativeInteger(slice.proposedCount) &&
      isNonNegativeInteger(slice.currentCount) &&
      slice.proposedCount === slice.currentCount &&
      slice.proposedCount >= options.minSliceSamples &&
      slice.currentCount >= options.minSliceSamples
  );
  const selectedBeachIds = normalizeUniqueStrings(
    selectedSlices.flatMap((slice) => (slice.groupKey ? [slice.groupKey] : []))
  );

  if (selectedBeachIds.length === 0) {
    throw new Error("No approval-eligible beach slices found in report.");
  }
  const selectedProposedCount = sumSliceCounts(
    selectedSlices,
    (slice) => slice.proposedCount
  );
  const selectedCurrentCount = sumSliceCounts(
    selectedSlices,
    (slice) => slice.currentCount
  );
  const sampleFindings: string[] = [];
  if (selectedProposedCount < options.minGateSamples) {
    sampleFindings.push(
      `selected proposed gate sample count ${selectedProposedCount} is below ${options.minGateSamples}`
    );
  }
  if (selectedCurrentCount < options.minGateSamples) {
    sampleFindings.push(
      `selected current gate sample count ${selectedCurrentCount} is below ${options.minGateSamples}`
    );
  }
  if (sampleFindings.length > 0) {
    throw new Error(`Approval subset ${sampleFindings.join("; ")}.`);
  }

  return {
    selectedBeachIds,
    selectedSlices,
    selectedProposedCount,
    selectedCurrentCount,
    excludedSlices: slices.filter(
      (slice) => !slice.groupKey || !selectedBeachIds.includes(slice.groupKey)
    ),
    unmeasuredGroups: report.gate_slices.coverage?.unmeasuredGroups ?? [],
  };
}

function buildProposedInputSubset(
  proposedInput: ProposedInput,
  selectedBeachIds: string[]
): ProposedInput {
  const selected = new Set(selectedBeachIds);
  if (Array.isArray(proposedInput)) {
    return proposedInput.filter(
      (prediction) => prediction.beach_id && selected.has(prediction.beach_id)
    );
  }

  const output: ProposedObject = {};
  for (const [key, value] of Object.entries(proposedInput)) {
    if (key === "predictions" && Array.isArray(value)) {
      output.predictions = value.filter(
        (prediction): prediction is ProposedPrediction =>
          isRecord(prediction) &&
          typeof prediction.beach_id === "string" &&
          selected.has(prediction.beach_id)
      );
      continue;
    }
    if (key === "beaches" && Array.isArray(value)) {
      output.beaches = value.filter(
        (beach): beach is ProposedBeachConfig =>
          isRecord(beach) &&
          typeof beach.id === "string" &&
          selected.has(beach.id)
      );
      continue;
    }
    if (isRecord(value) && isProposedBeachConfigRecord(value)) {
      const beachId = getTopLevelProposedBeachId(key, value);
      if (beachId != null && selected.has(beachId)) {
        output[key] = value;
      }
      continue;
    }
    output[key] = value;
  }

  return normalizeSubsetMetadata(output, selectedBeachIds);
}

function attachApprovalSubsetMetadata(
  proposedInput: ProposedInput,
  metadata: ApprovalSubsetMetadata
): ProposedObject {
  if (Array.isArray(proposedInput)) {
    return {
      predictions: proposedInput,
      approval_subset: metadata,
    };
  }

  return {
    ...proposedInput,
    approval_subset: metadata,
  };
}

function buildApprovalSubsetMetadata({
  subset,
  reportJsonPath,
  reportJsonSha256,
  proposedJsonPath,
  proposedJsonSha256,
  minGateSamples,
  minSliceSamples,
  maxReportAgeHours,
  generatedAt = new Date(),
}: {
  subset: ApprovalSubset;
  reportJsonPath: string;
  reportJsonSha256: string;
  proposedJsonPath: string;
  proposedJsonSha256: string;
  minGateSamples: number;
  minSliceSamples: number;
  maxReportAgeHours: number;
  generatedAt?: Date;
}): ApprovalSubsetMetadata {
  return {
    generated_at: generatedAt.toISOString(),
    source_report_json_path: reportJsonPath,
    source_report_json_sha256: reportJsonSha256,
    source_proposed_json_path: proposedJsonPath,
    source_proposed_json_sha256: proposedJsonSha256,
    selection_rule:
      "beach-level 0-72h row-paired slices with finite proposed/current MAE, numeric delta_mae_m <= 0, and proposed/current sample counts at or above min_slice_samples",
    criteria: {
      min_gate_samples: minGateSamples,
      min_slice_samples: minSliceSamples,
      max_report_age_hours: maxReportAgeHours,
    },
    selected_beach_ids: subset.selectedBeachIds,
    selected_slice_count: subset.selectedSlices.length,
    selected_proposed_count: subset.selectedProposedCount,
    selected_current_count: subset.selectedCurrentCount,
    excluded_measured_slice_count: subset.excludedSlices.length,
    excluded_unmeasured_group_count: subset.unmeasuredGroups.length,
    selected_slices: subset.selectedSlices.map((slice) => ({
      beach_id: slice.groupKey,
      group: slice.group,
      proposed_count: slice.proposedCount,
      current_count: slice.currentCount,
      proposed_mae_m: slice.proposedMaeM,
      current_mae_m: slice.currentMaeM,
      delta_mae_m: slice.deltaMaeM,
    })),
  };
}

function extractProposedBeachIds(value: ProposedInput): string[] {
  if (Array.isArray(value)) {
    return normalizeUniqueStrings(
      value.flatMap((prediction) =>
        prediction.beach_id ? [prediction.beach_id] : []
      )
    );
  }

  const ids: string[] = [];
  if (Array.isArray(value.predictions)) {
    ids.push(
      ...value.predictions.flatMap((prediction) =>
        prediction.beach_id ? [prediction.beach_id] : []
      )
    );
  }
  if (Array.isArray(value.beaches)) {
    ids.push(
      ...value.beaches.flatMap((beach) =>
        beach.id ? [beach.id] : []
      )
    );
  }
  for (const [key, proposedValue] of Object.entries(value)) {
    if (
      key !== "predictions" &&
      key !== "beaches" &&
      isRecord(proposedValue) &&
      isProposedBeachConfigRecord(proposedValue)
    ) {
      const beachId = getTopLevelProposedBeachId(key, proposedValue);
      if (beachId) {
        ids.push(beachId);
      }
    }
  }
  return normalizeUniqueStrings(ids);
}

function assertNoDuplicateProposedBeachConfigIds(value: ProposedInput): void {
  const duplicates = findDuplicateStrings(extractProposedBeachConfigIds(value));
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate proposed output beach id(s): ${duplicates.join(", ")}.`
    );
  }
}

function assertNoDuplicateProposedBeachConfigSlugs(value: ProposedInput): void {
  const duplicates = findDuplicateStrings(
    extractProposedBeachConfigSlugs(value)
  );
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate proposed output beach slug(s): ${duplicates.join(", ")}.`
    );
  }
}

function extractProposedBeachConfigIds(value: ProposedInput): string[] {
  if (Array.isArray(value)) {
    return [];
  }

  const ids: string[] = [];
  if (Array.isArray(value.beaches)) {
    ids.push(
      ...value.beaches.flatMap((beach) =>
        beach.id ? [beach.id] : []
      )
    );
  }
  for (const [key, proposedValue] of Object.entries(value)) {
    if (
      key !== "predictions" &&
      key !== "beaches" &&
      isRecord(proposedValue) &&
      isProposedBeachConfigRecord(proposedValue)
    ) {
      const beachId = getTopLevelProposedBeachId(key, proposedValue);
      if (beachId) {
        ids.push(beachId);
      }
    }
  }
  return ids;
}

function extractProposedBeachConfigSlugs(value: ProposedInput): string[] {
  if (Array.isArray(value)) {
    return [];
  }

  const slugs: string[] = [];
  if (Array.isArray(value.beaches)) {
    slugs.push(
      ...value.beaches.flatMap((beach) =>
        beach.slug ? [beach.slug] : []
      )
    );
  }
  for (const [key, proposedValue] of Object.entries(value)) {
    if (
      key !== "predictions" &&
      key !== "beaches" &&
      isRecord(proposedValue) &&
      isProposedBeachConfigRecord(proposedValue)
    ) {
      if (typeof proposedValue.slug === "string" && proposedValue.slug) {
        slugs.push(proposedValue.slug);
      } else if (!isUuidLike(key)) {
        slugs.push(key);
      }
    }
  }
  return slugs;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

function writeJson(outputJsonPath: string, value: unknown): string {
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
  return resolvedPath;
}

function assertSubsetOutputBeachIdsMatchSelection(
  outputBeachIds: string[],
  selectedBeachIds: string[]
): void {
  const duplicateOutputIds = findDuplicateStrings(outputBeachIds);
  if (duplicateOutputIds.length > 0) {
    throw new Error(
      `Duplicate proposed output beach id(s): ${duplicateOutputIds.join(", ")}.`
    );
  }
  const output = normalizeUniqueStrings(outputBeachIds);
  const selected = normalizeUniqueStrings(selectedBeachIds);
  const missingOutputIds = selected.filter((id) => !output.includes(id));
  const unexpectedOutputIds = output.filter((id) => !selected.includes(id));

  if (missingOutputIds.length > 0) {
    throw new Error(
      `Selected beach ids missing from proposed output: ${missingOutputIds.join(", ")}`
    );
  }
  if (unexpectedOutputIds.length > 0) {
    throw new Error(
      `Unselected beach ids survived in proposed output: ${unexpectedOutputIds.join(", ")}`
    );
  }
}

function sha256File(path: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(path)))
    .digest("hex");
}

function normalizeSubsetMetadata(
  output: ProposedObject,
  selectedBeachIds: string[]
): ProposedObject {
  const beachCount = Array.isArray(output.beaches) ? output.beaches.length : null;
  if (beachCount == null) {
    return output;
  }

  const summary = isRecord(output.summary) ? output.summary : null;
  if (summary) {
    const avgTimePerBeachMs = parseFiniteNumber(
      summary.avg_time_per_beach_ms
    );
    output.summary = {
      ...summary,
      total_beaches: beachCount,
      successful: beachCount,
      failed: 0,
      skipped: 0,
      total_time_ms:
        avgTimePerBeachMs == null
          ? summary.total_time_ms
          : Math.round(avgTimePerBeachMs * beachCount),
    };
  }

  if (Array.isArray(output.failures)) {
    output.failures = [];
  }

  if (isRecord(output.filters)) {
    const { beachId: _beachId, beachIds: _beachIds, ...filters } = output.filters;
    output.filters = {
      ...filters,
      ...(selectedBeachIds.length === 1
        ? { beachId: selectedBeachIds[0] }
        : { beachIds: selectedBeachIds }),
    };
  }

  return output;
}

function parseFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function hasConsistentSliceMae(
  slice: ForecastAccuracyReportSlice
): slice is ApprovalEligibleSlice {
  const { currentMaeM, deltaMaeM, proposedMaeM } = slice;
  if (
    typeof slice.groupKey !== "string" ||
    slice.groupKey.length === 0 ||
    typeof proposedMaeM !== "number" ||
    typeof currentMaeM !== "number" ||
    typeof deltaMaeM !== "number" ||
    !Number.isFinite(proposedMaeM) ||
    !Number.isFinite(currentMaeM) ||
    !Number.isFinite(deltaMaeM)
  ) {
    return false;
  }

  const expectedDelta = roundMetric(proposedMaeM - currentMaeM);
  return (
    Math.abs(deltaMaeM - expectedDelta) <=
    METRIC_ARITHMETIC_TOLERANCE_M
  );
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sumSliceCounts(
  slices: ApprovalEligibleSlice[],
  getCount: (slice: ApprovalEligibleSlice) => number
): number {
  return slices.reduce((total, slice) => total + getCount(slice), 0);
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return parsed;
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function normalizeUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function findDuplicateGroupKeys(slices: ForecastAccuracyReportSlice[]): string[] {
  return findDuplicateStrings(
    slices.flatMap((slice) => (slice.groupKey ? [slice.groupKey] : []))
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

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/forecast-accuracy-approval-subset.ts --report-json /tmp/full-beach-harness-report.json --proposed-json /tmp/full-proposed.json --output-json /tmp/approval-subset.json --min-gate-samples 75 --min-slice-samples 25 --max-report-age-hours 24`);
}

function main(): void {
  const options = parseCliArgs(process.argv.slice(2));
  const report = loadJson<ForecastAccuracyReport>(options.reportJsonPath);
  const proposedInput = loadJson<ProposedInput>(options.proposedJsonPath);
  validateApprovalSubsetSourceReport(report, {
    proposedJsonPath: options.proposedJsonPath,
    minGateSamples: options.minGateSamples,
    minSliceSamples: options.minSliceSamples,
    maxReportAgeHours: options.maxReportAgeHours,
  });
  const subset = buildApprovalSubsetFromReport(report, {
    minGateSamples: options.minGateSamples,
    minSliceSamples: options.minSliceSamples,
  });
  const subsetProposedInput = buildProposedInputSubset(
    proposedInput,
    subset.selectedBeachIds
  );
  const outputWithMetadata = attachApprovalSubsetMetadata(
    subsetProposedInput,
    buildApprovalSubsetMetadata({
      subset,
      reportJsonPath: options.reportJsonPath,
      reportJsonSha256: sha256File(options.reportJsonPath),
      proposedJsonPath: options.proposedJsonPath,
      proposedJsonSha256: sha256File(options.proposedJsonPath),
      minGateSamples: options.minGateSamples,
      minSliceSamples: options.minSliceSamples,
      maxReportAgeHours: options.maxReportAgeHours,
    })
  );
  assertNoDuplicateProposedBeachConfigIds(outputWithMetadata);
  assertNoDuplicateProposedBeachConfigSlugs(outputWithMetadata);
  const outputBeachIds = extractProposedBeachIds(outputWithMetadata);
  assertSubsetOutputBeachIdsMatchSelection(
    outputBeachIds,
    subset.selectedBeachIds
  );

  const outputPath = writeJson(options.outputJsonPath, outputWithMetadata);
  console.log(
    `Wrote ${outputBeachIds.length} approval-eligible beach config(s) to ${outputPath}`
  );
  console.log(
    `Selected ${subset.selectedBeachIds.length} beach slice(s); excluded ${subset.excludedSlices.length} measured slice(s) and ${subset.unmeasuredGroups.length} unmeasured group(s).`
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
  assertSubsetOutputBeachIdsMatchSelection,
  attachApprovalSubsetMetadata,
  assertNoDuplicateProposedBeachConfigIds,
  assertNoDuplicateProposedBeachConfigSlugs,
  buildApprovalSubsetMetadata,
  buildApprovalSubsetFromReport,
  buildProposedInputSubset,
  extractProposedBeachIds,
  parseCliArgs,
  validateApprovalSubsetSourceReport,
  writeJson,
  type ForecastAccuracyReport,
  type ProposedInput,
};
