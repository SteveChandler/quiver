#!/usr/bin/env tsx
/**
 * Read-only Track A session face-height truth report.
 *
 * Usage:
 *   yarn tsx scripts/session-face-height-truth-report.ts --days 365
 *   yarn tsx scripts/session-face-height-truth-report.ts --days 365 --output-json /tmp/quiver-session-face-height-truth-report.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getForecastAccuracyHorizonBucket } from "../lib/services/forecast/accuracy-metrics";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const DEFAULT_DAYS = 365;
const DEFAULT_MIN_MATCHED_POSITIVE_CANDIDATES = 100;
const DEFAULT_MIN_SHORT_HORIZON_MATCHED_CANDIDATES = 75;
const DEFAULT_MIN_MATCHED_POSITIVE_BEACHES = 10;
const DEFAULT_MIN_MATCHED_POSITIVE_USERS = 10;
const DEFAULT_MIN_SNAPSHOT_COMPLETENESS_RATE = 0.95;
const DEFAULT_MIN_REPORTED_HEIGHT_CONSISTENCY_RATE = 1;
const DEFAULT_MAX_FORECAST_ECHO_RISK_RATE = 0.25;
const DEFAULT_FORECAST_ECHO_TOLERANCE_FT = 0.05;
const DEFAULT_MAX_SHORT_HORIZON_MATCHED_AGE_DAYS = 30;
const REPORTED_HEIGHT_CONSISTENCY_TOLERANCE_M = 0.01;
const PAGE_SIZE = 1000;
const METERS_TO_FEET = 3.28084;
const MS_PER_DAY = 86_400_000;
const CANONICAL_DISPLAY_SOURCE = "face-Hs-transformer-v1";
const SESSION_FACE_HEIGHT_TRUTH_REPORT_SCHEMA_VERSION = 2;
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const SESSION_FACE_HEIGHT_HORIZONS = [
  "0-24h",
  "25-72h",
  "73h+",
  "unknown",
] as const;

type SessionFaceHeightTruthReadinessFindingCode =
  | "matched_positive_candidates_floor"
  | "short_horizon_matched_candidates_floor"
  | "matched_positive_beaches_floor"
  | "matched_positive_users_floor"
  | "display_snapshot_completeness_floor"
  | "raw_om_snapshot_completeness_floor"
  | "v5_shadow_snapshot_completeness_floor"
  | "reported_height_consistency_floor"
  | "display_forecast_echo_risk_ceiling"
  | "short_horizon_freshness_missing"
  | "short_horizon_freshness_stale";

export interface CliOptions {
  start: string;
  end: string;
  days: number;
  minMatchedPositiveCandidates: number;
  minShortHorizonMatchedCandidates: number;
  minMatchedPositiveBeaches: number;
  minMatchedPositiveUsers: number;
  minSnapshotCompletenessRate: number;
  minReportedHeightConsistencyRate: number;
  maxForecastEchoRiskRate: number;
  forecastEchoToleranceFt: number;
  maxShortHorizonMatchedAgeDays: number;
  failOnNotReady: boolean;
  outputJsonPath: string | null;
  validateOutputJsonPath: string | null;
  maxReportAgeHours: number | null;
}

export interface SessionFaceHeightTruthReadinessCriteria {
  minMatchedPositiveCandidates: number;
  minShortHorizonMatchedCandidates: number;
  minMatchedPositiveBeaches: number;
  minMatchedPositiveUsers: number;
  minSnapshotCompletenessRate: number;
  minReportedHeightConsistencyRate: number;
  maxForecastEchoRiskRate: number;
  forecastEchoToleranceFt: number;
  maxShortHorizonMatchedAgeDays: number;
}

export interface SessionFaceHeightCandidateRow {
  user_id: string | null;
  beach_id: string | null;
  observed_at: string;
  reported_wave_height_ft: number | null;
  observed_m: number | null;
  ml_prediction_id: string | null;
  forecast_horizon_hours: number | null;
  quality_state: string | null;
  rejection_reason: string | null;
  observation_weight: number | null;
  source_created_by: string | null;
  snapshot_display_height_m: number | null;
  snapshot_raw_om_height_m: number | null;
  snapshot_v5_shadow_height_m: number | null;
  snapshot_display_source: string | null;
}

export interface SessionFaceHeightProfileRow {
  id: string;
  deleted_at: string | null;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
}

export interface SessionFaceHeightHorizonCoverage {
  horizon: string;
  positiveObservedCandidates: number;
  linkedPositiveCandidates: number;
  unlinkedPositiveCandidates: number;
  nonCanonicalLinkedPositiveCandidates: number;
  matchedPositiveCandidates: number;
  unmatchedPositiveCandidates: number;
  matchedPositiveBeachCount: number;
  matchedPositiveUserCount: number;
}

export interface SessionFaceHeightUnmatchedPositiveDiagnostics {
  reasons: Record<string, number>;
  byHorizon: Record<string, number>;
  bySourceCreatedBy: Record<string, number>;
  nonCanonicalDisplaySources: Record<string, number>;
}

export interface SessionFaceHeightTruthReport {
  reportSchemaVersion: 2;
  generatedAt: string;
  start: string;
  end: string;
  days: number;
  totalCandidates: number;
  acceptedCandidates: number;
  rejectedCandidates: number;
  positiveObservedCandidates: number;
  linkedPositiveCandidates: number;
  nonCanonicalLinkedPositiveCandidates: number;
  matchedPositiveCandidates: number;
  unmatchedPositiveCandidates: number;
  matchedPositiveBeachCount: number;
  matchedPositiveUserCount: number;
  latestMatchedPositiveObservedAt: string | null;
  latestShortHorizonMatchedObservedAt: string | null;
  qualityStates: Record<string, number>;
  rejectionReasons: Record<string, number>;
  sourcesCreatedBy: Record<string, number>;
  linkedPositiveDisplaySources: Record<string, number>;
  matchedPositiveByHorizon: Record<string, number>;
  positiveLabelsByHorizon: SessionFaceHeightHorizonCoverage[];
  unmatchedPositiveDiagnostics: SessionFaceHeightUnmatchedPositiveDiagnostics;
  snapshotCompleteness: {
    displayHeight: number;
    rawOmHeight: number;
    v5ShadowHeight: number;
  };
  forecastEchoRisk: {
    toleranceFt: number;
    comparableMatchedPositiveCandidates: number;
    displayEchoCandidates: number;
    displayEchoRiskRate: number | null;
  };
  reportedHeightConsistency: {
    toleranceM: number;
    consistentMatchedPositiveCandidates: number;
    inconsistentMatchedPositiveCandidates: number;
    consistencyRate: number | null;
  };
  readiness: SessionFaceHeightTruthReadiness;
}

export interface SessionFaceHeightTruthReportValidationResult {
  ok: boolean;
  blockers: string[];
}

export interface SessionFaceHeightTruthReadiness {
  verdict: "ready" | "not-ready";
  readyForHarnessTruth: boolean;
  criteria: SessionFaceHeightTruthReadinessCriteria;
  observed: {
    matchedPositiveCandidates: number;
    shortHorizonMatchedCandidates: number;
    matchedPositiveBeachCount: number;
    matchedPositiveUserCount: number;
    displaySnapshotCompletenessRate: number | null;
    rawOmSnapshotCompletenessRate: number | null;
    v5ShadowSnapshotCompletenessRate: number | null;
    reportedHeightConsistencyRate: number | null;
    displayForecastEchoRiskRate: number | null;
    latestShortHorizonMatchedObservedAt: string | null;
    shortHorizonMatchedAgeDays: number | null;
  };
  findings: string[];
  findingCodes: SessionFaceHeightTruthReadinessFindingCode[];
}

interface SessionFaceHeightTruthReadinessFinding {
  code: SessionFaceHeightTruthReadinessFindingCode;
  message: string;
}

type AdminClient = SupabaseClient;

export function parseCliArgs(
  argv: string[],
  now: Date = new Date()
): CliOptions {
  let days = DEFAULT_DAYS;
  let start: string | null = null;
  let end = now.toISOString();
  let minMatchedPositiveCandidates = DEFAULT_MIN_MATCHED_POSITIVE_CANDIDATES;
  let minShortHorizonMatchedCandidates =
    DEFAULT_MIN_SHORT_HORIZON_MATCHED_CANDIDATES;
  let minMatchedPositiveBeaches = DEFAULT_MIN_MATCHED_POSITIVE_BEACHES;
  let minMatchedPositiveUsers = DEFAULT_MIN_MATCHED_POSITIVE_USERS;
  let minSnapshotCompletenessRate = DEFAULT_MIN_SNAPSHOT_COMPLETENESS_RATE;
  let minReportedHeightConsistencyRate =
    DEFAULT_MIN_REPORTED_HEIGHT_CONSISTENCY_RATE;
  let maxForecastEchoRiskRate = DEFAULT_MAX_FORECAST_ECHO_RISK_RATE;
  let forecastEchoToleranceFt = DEFAULT_FORECAST_ECHO_TOLERANCE_FT;
  let maxShortHorizonMatchedAgeDays =
    DEFAULT_MAX_SHORT_HORIZON_MATCHED_AGE_DAYS;
  let failOnNotReady = false;
  let outputJsonPath: string | null = null;
  let validateOutputJsonPath: string | null = null;
  let maxReportAgeHours: number | null = null;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--days") {
      const value = readFlagValue(next, "--days");
      days = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--days=")) {
      days = Number(readFlagValue(arg.split("=")[1], "--days"));
      continue;
    }
    if (arg === "--min-matched-positive") {
      const value = readFlagValue(next, "--min-matched-positive");
      minMatchedPositiveCandidates = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--min-matched-positive=")) {
      minMatchedPositiveCandidates = Number(
        readFlagValue(arg.split("=")[1], "--min-matched-positive")
      );
      continue;
    }
    if (arg === "--min-short-horizon-matched") {
      const value = readFlagValue(next, "--min-short-horizon-matched");
      minShortHorizonMatchedCandidates = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--min-short-horizon-matched=")) {
      minShortHorizonMatchedCandidates = Number(
        readFlagValue(arg.split("=")[1], "--min-short-horizon-matched")
      );
      continue;
    }
    if (arg === "--min-matched-positive-beaches") {
      const value = readFlagValue(next, "--min-matched-positive-beaches");
      minMatchedPositiveBeaches = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--min-matched-positive-beaches=")) {
      minMatchedPositiveBeaches = Number(
        readFlagValue(arg.split("=")[1], "--min-matched-positive-beaches")
      );
      continue;
    }
    if (arg === "--min-matched-positive-users") {
      const value = readFlagValue(next, "--min-matched-positive-users");
      minMatchedPositiveUsers = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--min-matched-positive-users=")) {
      minMatchedPositiveUsers = Number(
        readFlagValue(arg.split("=")[1], "--min-matched-positive-users")
      );
      continue;
    }
    if (arg === "--min-snapshot-completeness-rate") {
      const value = readFlagValue(next, "--min-snapshot-completeness-rate");
      minSnapshotCompletenessRate = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--min-snapshot-completeness-rate=")) {
      minSnapshotCompletenessRate = Number(
        readFlagValue(arg.split("=")[1], "--min-snapshot-completeness-rate")
      );
      continue;
    }
    if (arg === "--min-reported-height-consistency-rate") {
      const value = readFlagValue(
        next,
        "--min-reported-height-consistency-rate"
      );
      minReportedHeightConsistencyRate = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--min-reported-height-consistency-rate=")) {
      minReportedHeightConsistencyRate = Number(
        readFlagValue(
          arg.split("=")[1],
          "--min-reported-height-consistency-rate"
        )
      );
      continue;
    }
    if (arg === "--max-forecast-echo-risk-rate") {
      const value = readFlagValue(next, "--max-forecast-echo-risk-rate");
      maxForecastEchoRiskRate = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--max-forecast-echo-risk-rate=")) {
      maxForecastEchoRiskRate = Number(
        readFlagValue(arg.split("=")[1], "--max-forecast-echo-risk-rate")
      );
      continue;
    }
    if (arg === "--forecast-echo-tolerance-ft") {
      const value = readFlagValue(next, "--forecast-echo-tolerance-ft");
      forecastEchoToleranceFt = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--forecast-echo-tolerance-ft=")) {
      forecastEchoToleranceFt = Number(
        readFlagValue(arg.split("=")[1], "--forecast-echo-tolerance-ft")
      );
      continue;
    }
    if (arg === "--max-short-horizon-matched-age-days") {
      const value = readFlagValue(next, "--max-short-horizon-matched-age-days");
      maxShortHorizonMatchedAgeDays = Number(value);
      index++;
      continue;
    }
    if (arg.startsWith("--max-short-horizon-matched-age-days=")) {
      maxShortHorizonMatchedAgeDays = Number(
        readFlagValue(
          arg.split("=")[1],
          "--max-short-horizon-matched-age-days"
        )
      );
      continue;
    }
    if (arg === "--fail-on-not-ready") {
      failOnNotReady = true;
      continue;
    }
    if (arg === "--start") {
      const value = readFlagValue(next, "--start");
      start = parseDateFlag(value, "--start");
      index++;
      continue;
    }
    if (arg.startsWith("--start=")) {
      start = parseDateFlag(
        readFlagValue(arg.split("=")[1], "--start"),
        "--start"
      );
      continue;
    }
    if (arg === "--end") {
      const value = readFlagValue(next, "--end");
      end = parseDateFlag(value, "--end");
      index++;
      continue;
    }
    if (arg.startsWith("--end=")) {
      end = parseDateFlag(
        readFlagValue(arg.split("=")[1], "--end"),
        "--end"
      );
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
    if (arg === "--validate-output-json") {
      validateOutputJsonPath = readFlagValue(next, "--validate-output-json");
      index++;
      continue;
    }
    if (arg.startsWith("--validate-output-json=")) {
      validateOutputJsonPath = readFlagValue(
        arg.split("=")[1],
        "--validate-output-json"
      );
      continue;
    }
    if (arg === "--max-report-age-hours") {
      maxReportAgeHours = Number(
        readFlagValue(next, "--max-report-age-hours")
      );
      index++;
      continue;
    }
    if (arg.startsWith("--max-report-age-hours=")) {
      maxReportAgeHours = Number(
        readFlagValue(arg.split("=")[1], "--max-report-age-hours")
      );
      continue;
    }
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (!isPositiveInteger(days)) {
    throw new Error("--days must be a positive integer");
  }
  if (!isNonNegativeInteger(minMatchedPositiveCandidates)) {
    throw new Error("--min-matched-positive must be a non-negative integer");
  }
  if (!isNonNegativeInteger(minShortHorizonMatchedCandidates)) {
    throw new Error(
      "--min-short-horizon-matched must be a non-negative integer"
    );
  }
  if (!isNonNegativeInteger(minMatchedPositiveBeaches)) {
    throw new Error(
      "--min-matched-positive-beaches must be a non-negative integer"
    );
  }
  if (!isNonNegativeInteger(minMatchedPositiveUsers)) {
    throw new Error(
      "--min-matched-positive-users must be a non-negative integer"
    );
  }
  if (
    !Number.isFinite(minSnapshotCompletenessRate) ||
    minSnapshotCompletenessRate < 0 ||
    minSnapshotCompletenessRate > 1
  ) {
    throw new Error(
      "--min-snapshot-completeness-rate must be between 0 and 1"
    );
  }
  if (
    !Number.isFinite(minReportedHeightConsistencyRate) ||
    minReportedHeightConsistencyRate < 0 ||
    minReportedHeightConsistencyRate > 1
  ) {
    throw new Error(
      "--min-reported-height-consistency-rate must be between 0 and 1"
    );
  }
  if (
    !Number.isFinite(maxForecastEchoRiskRate) ||
    maxForecastEchoRiskRate < 0 ||
    maxForecastEchoRiskRate > 1
  ) {
    throw new Error("--max-forecast-echo-risk-rate must be between 0 and 1");
  }
  if (
    !Number.isFinite(forecastEchoToleranceFt) ||
    forecastEchoToleranceFt < 0
  ) {
    throw new Error("--forecast-echo-tolerance-ft must be non-negative");
  }
  if (!isPositiveInteger(maxShortHorizonMatchedAgeDays)) {
    throw new Error(
      "--max-short-horizon-matched-age-days must be a positive integer"
    );
  }
  if (
    maxReportAgeHours !== null &&
    !isPositiveInteger(maxReportAgeHours)
  ) {
    throw new Error("--max-report-age-hours must be a positive integer");
  }
  if (outputJsonPath && validateOutputJsonPath) {
    throw new Error(
      "--validate-output-json cannot be combined with --output-json."
    );
  }
  if (maxReportAgeHours !== null && !validateOutputJsonPath) {
    throw new Error(
      "--max-report-age-hours requires --validate-output-json."
    );
  }

  if (!start) {
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - days);
    start = startDate.toISOString();
  }

  assertMeasurementWindow(start, end);

  return {
    start,
    end,
    days,
    minMatchedPositiveCandidates,
    minShortHorizonMatchedCandidates,
    minMatchedPositiveBeaches,
    minMatchedPositiveUsers,
    minSnapshotCompletenessRate,
    minReportedHeightConsistencyRate,
    maxForecastEchoRiskRate,
    forecastEchoToleranceFt,
    maxShortHorizonMatchedAgeDays,
    failOnNotReady,
    outputJsonPath,
    validateOutputJsonPath,
    maxReportAgeHours,
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function parseDateFlag(value: string, flagName: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${flagName} must be a valid date.`);
  }
  return parsed.toISOString();
}

function assertMeasurementWindow(start: string, end: string): void {
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw new Error("Measurement start must be before end.");
  }
}

export function computeSessionFaceHeightTruthReport(input: {
  start: string;
  end: string;
  days: number;
  rows: SessionFaceHeightCandidateRow[];
  readinessCriteria?: SessionFaceHeightTruthReadinessCriteria;
  generatedAt?: string;
}): SessionFaceHeightTruthReport {
  const acceptedRows = input.rows.filter((row) => row.quality_state !== "rejected");
  const positiveRows = acceptedRows.filter((row) => isPositive(row.observed_m));
  const linkedPositiveRows = positiveRows.filter((row) => !!row.ml_prediction_id);
  const matchedPositiveRows = linkedPositiveRows.filter(
    (row) => row.snapshot_display_source === CANONICAL_DISPLAY_SOURCE
  );
  const nonCanonicalLinkedPositiveCandidates =
    linkedPositiveRows.length - matchedPositiveRows.length;
  const matchedPositiveByHorizon = countBy(matchedPositiveRows, (row) => {
    return getForecastAccuracyHorizonBucket(row.forecast_horizon_hours) ?? "unknown";
  });
  const shortHorizonMatchedRows = matchedPositiveRows.filter((row) =>
    isShortHorizon(row.forecast_horizon_hours)
  );
  const positiveLabelsByHorizon = computePositiveLabelsByHorizon({
    positiveRows,
    linkedPositiveRows,
    matchedPositiveRows,
  });
  const unmatchedPositiveDiagnostics = computeUnmatchedPositiveDiagnostics(
    positiveRows
  );
  const matchedPositiveBeachCount = countDistinctNonNull(
    matchedPositiveRows,
    (row) => row.beach_id
  );
  const matchedPositiveUserCount = countDistinctNonNull(
    matchedPositiveRows,
    (row) => row.user_id
  );
  const snapshotCompleteness = {
    displayHeight: matchedPositiveRows.filter((row) =>
      isFiniteNumber(row.snapshot_display_height_m)
    ).length,
    rawOmHeight: matchedPositiveRows.filter((row) =>
      isFiniteNumber(row.snapshot_raw_om_height_m)
    ).length,
    v5ShadowHeight: matchedPositiveRows.filter((row) =>
      isFiniteNumber(row.snapshot_v5_shadow_height_m)
    ).length,
  };
  const readinessCriteria =
    input.readinessCriteria ?? defaultSessionFaceHeightTruthReadinessCriteria();
  const forecastEchoRisk = computeForecastEchoRisk(
    matchedPositiveRows,
    readinessCriteria.forecastEchoToleranceFt
  );
  const reportedHeightConsistency = computeReportedHeightConsistency(
    matchedPositiveRows
  );

  const report: Omit<SessionFaceHeightTruthReport, "readiness"> = {
    reportSchemaVersion: SESSION_FACE_HEIGHT_TRUTH_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    start: input.start,
    end: input.end,
    days: input.days,
    totalCandidates: input.rows.length,
    acceptedCandidates: acceptedRows.length,
    rejectedCandidates: input.rows.length - acceptedRows.length,
    positiveObservedCandidates: positiveRows.length,
    linkedPositiveCandidates: linkedPositiveRows.length,
    nonCanonicalLinkedPositiveCandidates,
    matchedPositiveCandidates: matchedPositiveRows.length,
    unmatchedPositiveCandidates: positiveRows.length - matchedPositiveRows.length,
    matchedPositiveBeachCount,
    matchedPositiveUserCount,
    latestMatchedPositiveObservedAt: latestObservedAt(matchedPositiveRows),
    latestShortHorizonMatchedObservedAt: latestObservedAt(shortHorizonMatchedRows),
    qualityStates: countBy(input.rows, (row) => row.quality_state ?? "unknown"),
    rejectionReasons: countBy(
      input.rows.filter((row) => row.quality_state === "rejected"),
      (row) => row.rejection_reason ?? "unknown"
    ),
    sourcesCreatedBy: countBy(input.rows, (row) => row.source_created_by ?? "unknown"),
    linkedPositiveDisplaySources: countBy(
      linkedPositiveRows,
      (row) => row.snapshot_display_source ?? "unknown"
    ),
    matchedPositiveByHorizon,
    positiveLabelsByHorizon,
    unmatchedPositiveDiagnostics,
    snapshotCompleteness,
    forecastEchoRisk,
    reportedHeightConsistency,
  };

  return {
    ...report,
    readiness: buildSessionFaceHeightTruthReadiness(report, readinessCriteria),
  };
}

export function renderSessionFaceHeightTruthReport(
  report: SessionFaceHeightTruthReport
): string {
  const lines: string[] = [];
  lines.push("# Track A Session Face-Height Truth Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Window: ${report.start} to ${report.end} (${report.days} days)`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| Candidate rows | ${report.totalCandidates.toLocaleString()} |`);
  lines.push(`| Accepted weak labels | ${report.acceptedCandidates.toLocaleString()} |`);
  lines.push(`| Rejected candidates | ${report.rejectedCandidates.toLocaleString()} |`);
  lines.push(
    `| Positive observed labels | ${report.positiveObservedCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Linked positive labels | ${report.linkedPositiveCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Non-canonical linked labels | ${report.nonCanonicalLinkedPositiveCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Matched positive labels | ${report.matchedPositiveCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Matched positive beaches | ${report.matchedPositiveBeachCount.toLocaleString()} |`
  );
  lines.push(
    `| Matched positive users | ${report.matchedPositiveUserCount.toLocaleString()} |`
  );
  lines.push(
    `| Latest matched positive observed at | ${report.latestMatchedPositiveObservedAt ?? "none"} |`
  );
  lines.push(
    `| Latest 0-72h matched positive observed at | ${report.latestShortHorizonMatchedObservedAt ?? "none"} |`
  );
  lines.push(
    `| Unmatched positive labels | ${report.unmatchedPositiveCandidates.toLocaleString()} |`
  );
  lines.push("");
  lines.push("## Linked Positive Display Sources");
  lines.push("");
  lines.push(renderCountTable(report.linkedPositiveDisplaySources, "Display source"));
  lines.push("");
  lines.push("## Matched Positive Labels By Horizon");
  lines.push("");
  lines.push(renderCountTable(report.matchedPositiveByHorizon, "Horizon"));
  lines.push("");
  lines.push("## Positive Label Coverage By Horizon");
  lines.push("");
  lines.push(renderHorizonCoverageTable(report.positiveLabelsByHorizon));
  lines.push("");
  lines.push("## Unmatched Positive Diagnostics");
  lines.push("");
  lines.push("### Reasons");
  lines.push("");
  lines.push(renderCountTable(report.unmatchedPositiveDiagnostics.reasons, "Reason"));
  lines.push("");
  lines.push("### By Horizon");
  lines.push("");
  lines.push(renderCountTable(report.unmatchedPositiveDiagnostics.byHorizon, "Horizon"));
  lines.push("");
  lines.push("### By Source");
  lines.push("");
  lines.push(
    renderCountTable(
      report.unmatchedPositiveDiagnostics.bySourceCreatedBy,
      "Source"
    )
  );
  lines.push("");
  lines.push("### Non-Canonical Display Sources");
  lines.push("");
  lines.push(
    renderCountTable(
      report.unmatchedPositiveDiagnostics.nonCanonicalDisplaySources,
      "Display source"
    )
  );
  lines.push("");
  lines.push("## Snapshot Completeness");
  lines.push("");
  lines.push("| Snapshot field | Matched positive rows |");
  lines.push("| --- | ---: |");
  lines.push(
    `| Display height | ${report.snapshotCompleteness.displayHeight.toLocaleString()} |`
  );
  lines.push(
    `| Raw OM height | ${report.snapshotCompleteness.rawOmHeight.toLocaleString()} |`
  );
  lines.push(
    `| v5 shadow height | ${report.snapshotCompleteness.v5ShadowHeight.toLocaleString()} |`
  );
  lines.push("");
  lines.push("## Reported Height Consistency");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | ---: |");
  lines.push(
    `| Consistency tolerance | ${report.reportedHeightConsistency.toleranceM.toFixed(3)} m |`
  );
  lines.push(
    `| Consistent matched positive rows | ${report.reportedHeightConsistency.consistentMatchedPositiveCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Inconsistent matched positive rows | ${report.reportedHeightConsistency.inconsistentMatchedPositiveCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Consistency rate | ${formatPercent(
      report.reportedHeightConsistency.consistencyRate
    )} |`
  );
  lines.push("");
  lines.push("## Forecast Echo Risk");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | ---: |");
  lines.push(
    `| Display echo tolerance | ${report.forecastEchoRisk.toleranceFt.toFixed(2)} ft |`
  );
  lines.push(
    `| Comparable matched positive rows | ${report.forecastEchoRisk.comparableMatchedPositiveCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Display-height echo candidates | ${report.forecastEchoRisk.displayEchoCandidates.toLocaleString()} |`
  );
  lines.push(
    `| Display-height echo risk | ${formatPercent(
      report.forecastEchoRisk.displayEchoRiskRate
    )} |`
  );
  lines.push("");
  lines.push("## Readiness Gate");
  lines.push("");
  lines.push(`- Verdict: ${report.readiness.verdict}`);
  lines.push(
    `- Criteria: matched positive >= ${report.readiness.criteria.minMatchedPositiveCandidates.toLocaleString()}, 0-72h matched >= ${report.readiness.criteria.minShortHorizonMatchedCandidates.toLocaleString()}, matched beaches >= ${report.readiness.criteria.minMatchedPositiveBeaches.toLocaleString()}, matched users >= ${report.readiness.criteria.minMatchedPositiveUsers.toLocaleString()}, snapshot completeness >= ${formatPercent(
      report.readiness.criteria.minSnapshotCompletenessRate
    )}, reported-height consistency >= ${formatPercent(
      report.readiness.criteria.minReportedHeightConsistencyRate
    )}, display echo risk <= ${formatPercent(
      report.readiness.criteria.maxForecastEchoRiskRate
    )}, latest 0-72h matched label age <= ${report.readiness.criteria.maxShortHorizonMatchedAgeDays.toLocaleString()} days`
  );
  lines.push(
    `- Observed: matched positive ${report.readiness.observed.matchedPositiveCandidates.toLocaleString()}, 0-72h matched ${report.readiness.observed.shortHorizonMatchedCandidates.toLocaleString()}, matched beaches ${report.readiness.observed.matchedPositiveBeachCount.toLocaleString()}, matched users ${report.readiness.observed.matchedPositiveUserCount.toLocaleString()}, display/raw OM/v5 completeness ${formatPercent(
      report.readiness.observed.displaySnapshotCompletenessRate
    )}/${formatPercent(
      report.readiness.observed.rawOmSnapshotCompletenessRate
    )}/${formatPercent(
      report.readiness.observed.v5ShadowSnapshotCompletenessRate
    )}, reported-height consistency ${formatPercent(
      report.readiness.observed.reportedHeightConsistencyRate
    )}, display echo risk ${formatPercent(
      report.readiness.observed.displayForecastEchoRiskRate
    )}, latest 0-72h matched label ${report.readiness.observed.latestShortHorizonMatchedObservedAt ?? "none"}, 0-72h matched label age ${formatNumber(
      report.readiness.observed.shortHorizonMatchedAgeDays
    )} days`
  );
  for (const finding of report.readiness.findings) {
    lines.push(`- ${finding}`);
  }
  lines.push("");
  lines.push("## Quality States");
  lines.push("");
  lines.push(renderCountTable(report.qualityStates, "Quality state"));
  lines.push("");
  lines.push("## Rejection Reasons");
  lines.push("");
  lines.push(renderCountTable(report.rejectionReasons, "Reason"));
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  lines.push(renderCountTable(report.sourcesCreatedBy, "Source"));
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Candidate/session/prediction IDs are used only in-memory and are not rendered."
  );
  lines.push(
    "- Session truth is a weak face-height label; it does not write back to ml_predictions_log.observed_m."
  );
  return `${lines.join("\n")}\n`;
}

export function buildSessionFaceHeightTruthReadiness(
  report: Omit<SessionFaceHeightTruthReport, "readiness">,
  criteria: SessionFaceHeightTruthReadinessCriteria =
    defaultSessionFaceHeightTruthReadinessCriteria()
): SessionFaceHeightTruthReadiness {
  const shortHorizonMatchedCandidates =
    (report.matchedPositiveByHorizon["0-24h"] ?? 0) +
    (report.matchedPositiveByHorizon["25-72h"] ?? 0);
  const displaySnapshotCompletenessRate = ratio(
    report.snapshotCompleteness.displayHeight,
    report.matchedPositiveCandidates
  );
  const rawOmSnapshotCompletenessRate = ratio(
    report.snapshotCompleteness.rawOmHeight,
    report.matchedPositiveCandidates
  );
  const v5ShadowSnapshotCompletenessRate = ratio(
    report.snapshotCompleteness.v5ShadowHeight,
    report.matchedPositiveCandidates
  );
  const reportedHeightConsistencyRate =
    report.reportedHeightConsistency.consistencyRate;
  const shortHorizonMatchedAgeDays = ageDays(
    report.latestShortHorizonMatchedObservedAt,
    report.generatedAt
  );
  const findings: SessionFaceHeightTruthReadinessFinding[] = [];

  if (
    report.matchedPositiveCandidates < criteria.minMatchedPositiveCandidates
  ) {
    findings.push({
      code: "matched_positive_candidates_floor",
      message: `Matched positive weak labels are below the ${criteria.minMatchedPositiveCandidates.toLocaleString()}-row floor.`,
    });
  }
  if (
    shortHorizonMatchedCandidates <
    criteria.minShortHorizonMatchedCandidates
  ) {
    findings.push({
      code: "short_horizon_matched_candidates_floor",
      message: `Matched 0-72h weak labels are below the ${criteria.minShortHorizonMatchedCandidates.toLocaleString()}-row floor.`,
    });
  }
  if (
    report.matchedPositiveBeachCount < criteria.minMatchedPositiveBeaches
  ) {
    findings.push({
      code: "matched_positive_beaches_floor",
      message: `Matched positive beach coverage is below the ${criteria.minMatchedPositiveBeaches.toLocaleString()}-beach floor.`,
    });
  }
  if (report.matchedPositiveUserCount < criteria.minMatchedPositiveUsers) {
    findings.push({
      code: "matched_positive_users_floor",
      message: `Matched positive user coverage is below the ${criteria.minMatchedPositiveUsers.toLocaleString()}-user floor.`,
    });
  }

  const completenessChecks = [
    [
      "display",
      displaySnapshotCompletenessRate,
      "display_snapshot_completeness_floor",
    ],
    [
      "raw OM",
      rawOmSnapshotCompletenessRate,
      "raw_om_snapshot_completeness_floor",
    ],
    [
      "v5 shadow",
      v5ShadowSnapshotCompletenessRate,
      "v5_shadow_snapshot_completeness_floor",
    ],
  ] as const;
  for (const [label, completenessRate, code] of completenessChecks) {
    if (
      completenessRate === null ||
      completenessRate < criteria.minSnapshotCompletenessRate
    ) {
      findings.push({
        code,
        message: `${label} snapshot completeness is below ${formatPercent(
          criteria.minSnapshotCompletenessRate
        )}.`,
      });
    }
  }
  if (
    reportedHeightConsistencyRate === null ||
    reportedHeightConsistencyRate <
      criteria.minReportedHeightConsistencyRate
  ) {
    findings.push({
      code: "reported_height_consistency_floor",
      message: `Reported-height consistency is below ${formatPercent(
        criteria.minReportedHeightConsistencyRate
      )}.`,
    });
  }
  if (
    report.forecastEchoRisk.displayEchoRiskRate === null ||
    report.forecastEchoRisk.displayEchoRiskRate >
      criteria.maxForecastEchoRiskRate
  ) {
    findings.push({
      code: "display_forecast_echo_risk_ceiling",
      message: `Display-height forecast echo risk is above ${formatPercent(
        criteria.maxForecastEchoRiskRate
      )}.`,
    });
  }
  if (
    criteria.minShortHorizonMatchedCandidates > 0 &&
    shortHorizonMatchedAgeDays === null
  ) {
    findings.push({
      code: "short_horizon_freshness_missing",
      message: "No matched 0-72h weak label exists for freshness proof.",
    });
  } else if (
    criteria.minShortHorizonMatchedCandidates > 0 &&
    shortHorizonMatchedAgeDays !== null &&
    shortHorizonMatchedAgeDays > criteria.maxShortHorizonMatchedAgeDays
  ) {
    findings.push({
      code: "short_horizon_freshness_stale",
      message: `Latest matched 0-72h weak label is older than ${criteria.maxShortHorizonMatchedAgeDays.toLocaleString()} days.`,
    });
  }

  const readyForHarnessTruth = findings.length === 0;
  const findingMessages = findings.map((finding) => finding.message);
  const findingCodes = findings.map((finding) => finding.code);
  return {
    verdict: readyForHarnessTruth ? "ready" : "not-ready",
    readyForHarnessTruth,
    criteria,
    observed: {
      matchedPositiveCandidates: report.matchedPositiveCandidates,
      shortHorizonMatchedCandidates,
      matchedPositiveBeachCount: report.matchedPositiveBeachCount,
      matchedPositiveUserCount: report.matchedPositiveUserCount,
      displaySnapshotCompletenessRate,
      rawOmSnapshotCompletenessRate,
      v5ShadowSnapshotCompletenessRate,
      reportedHeightConsistencyRate,
      displayForecastEchoRiskRate:
        report.forecastEchoRisk.displayEchoRiskRate,
      latestShortHorizonMatchedObservedAt:
        report.latestShortHorizonMatchedObservedAt,
      shortHorizonMatchedAgeDays,
    },
    findings: findingMessages,
    findingCodes,
  };
}

function defaultSessionFaceHeightTruthReadinessCriteria(): SessionFaceHeightTruthReadinessCriteria {
  return {
    minMatchedPositiveCandidates: DEFAULT_MIN_MATCHED_POSITIVE_CANDIDATES,
    minShortHorizonMatchedCandidates:
      DEFAULT_MIN_SHORT_HORIZON_MATCHED_CANDIDATES,
    minMatchedPositiveBeaches: DEFAULT_MIN_MATCHED_POSITIVE_BEACHES,
    minMatchedPositiveUsers: DEFAULT_MIN_MATCHED_POSITIVE_USERS,
    minSnapshotCompletenessRate: DEFAULT_MIN_SNAPSHOT_COMPLETENESS_RATE,
    minReportedHeightConsistencyRate:
      DEFAULT_MIN_REPORTED_HEIGHT_CONSISTENCY_RATE,
    maxForecastEchoRiskRate: DEFAULT_MAX_FORECAST_ECHO_RISK_RATE,
    forecastEchoToleranceFt: DEFAULT_FORECAST_ECHO_TOLERANCE_FT,
    maxShortHorizonMatchedAgeDays:
      DEFAULT_MAX_SHORT_HORIZON_MATCHED_AGE_DAYS,
  };
}

function computePositiveLabelsByHorizon(input: {
  positiveRows: SessionFaceHeightCandidateRow[];
  linkedPositiveRows: SessionFaceHeightCandidateRow[];
  matchedPositiveRows: SessionFaceHeightCandidateRow[];
}): SessionFaceHeightHorizonCoverage[] {
  const positiveByHorizon = groupRowsByHorizon(input.positiveRows);
  const linkedByHorizon = groupRowsByHorizon(input.linkedPositiveRows);
  const matchedByHorizon = groupRowsByHorizon(input.matchedPositiveRows);

  return SESSION_FACE_HEIGHT_HORIZONS.map((horizon) => {
    const positiveRows = positiveByHorizon.get(horizon) ?? [];
    const linkedPositiveRows = linkedByHorizon.get(horizon) ?? [];
    const matchedPositiveRows = matchedByHorizon.get(horizon) ?? [];
    const nonCanonicalLinkedPositiveCandidates = linkedPositiveRows.filter(
      (row) => row.snapshot_display_source !== CANONICAL_DISPLAY_SOURCE
    ).length;

    return {
      horizon,
      positiveObservedCandidates: positiveRows.length,
      linkedPositiveCandidates: linkedPositiveRows.length,
      unlinkedPositiveCandidates: positiveRows.length - linkedPositiveRows.length,
      nonCanonicalLinkedPositiveCandidates,
      matchedPositiveCandidates: matchedPositiveRows.length,
      unmatchedPositiveCandidates: positiveRows.length - matchedPositiveRows.length,
      matchedPositiveBeachCount: countDistinctNonNull(
        matchedPositiveRows,
        (row) => row.beach_id
      ),
      matchedPositiveUserCount: countDistinctNonNull(
        matchedPositiveRows,
        (row) => row.user_id
      ),
    };
  });
}

function computeUnmatchedPositiveDiagnostics(
  positiveRows: SessionFaceHeightCandidateRow[]
): SessionFaceHeightUnmatchedPositiveDiagnostics {
  const unmatchedRows = positiveRows.filter(
    (row) =>
      !row.ml_prediction_id ||
      row.snapshot_display_source !== CANONICAL_DISPLAY_SOURCE
  );
  const nonCanonicalLinkedRows = unmatchedRows.filter(
    (row) => row.ml_prediction_id && row.snapshot_display_source !== CANONICAL_DISPLAY_SOURCE
  );

  return {
    reasons: countBy(unmatchedRows, unmatchedPositiveReason),
    byHorizon: countBy(unmatchedRows, (row) => {
      return getForecastAccuracyHorizonBucket(row.forecast_horizon_hours) ?? "unknown";
    }),
    bySourceCreatedBy: countBy(
      unmatchedRows,
      (row) => row.source_created_by ?? "unknown"
    ),
    nonCanonicalDisplaySources: countBy(
      nonCanonicalLinkedRows,
      (row) => row.snapshot_display_source ?? "unknown"
    ),
  };
}

function unmatchedPositiveReason(row: SessionFaceHeightCandidateRow): string {
  if (!row.ml_prediction_id) return "unlinked_prediction";
  if (row.snapshot_display_source !== CANONICAL_DISPLAY_SOURCE) {
    return "non_canonical_display_source";
  }
  return "matched";
}

function groupRowsByHorizon(
  rows: SessionFaceHeightCandidateRow[]
): Map<string, SessionFaceHeightCandidateRow[]> {
  const groups = new Map<string, SessionFaceHeightCandidateRow[]>();
  for (const row of rows) {
    const horizon =
      getForecastAccuracyHorizonBucket(row.forecast_horizon_hours) ?? "unknown";
    const group = groups.get(horizon) ?? [];
    group.push(row);
    groups.set(horizon, group);
  }
  return groups;
}

function isShortHorizon(forecastHorizonHours: number | null): boolean {
  const horizon = getForecastAccuracyHorizonBucket(forecastHorizonHours);
  return horizon === "0-24h" || horizon === "25-72h";
}

function latestObservedAt(rows: SessionFaceHeightCandidateRow[]): string | null {
  let latestMs: number | null = null;
  for (const row of rows) {
    const observedMs = Date.parse(row.observed_at);
    if (!Number.isFinite(observedMs)) {
      continue;
    }
    if (latestMs === null || observedMs > latestMs) {
      latestMs = observedMs;
    }
  }
  return latestMs === null ? null : new Date(latestMs).toISOString();
}

function ageDays(olderTimestamp: string | null, newerTimestamp: string): number | null {
  if (!olderTimestamp) {
    return null;
  }
  const olderMs = Date.parse(olderTimestamp);
  const newerMs = Date.parse(newerTimestamp);
  if (!Number.isFinite(olderMs) || !Number.isFinite(newerMs)) {
    return null;
  }
  return Math.max(0, (newerMs - olderMs) / MS_PER_DAY);
}

export function writeSessionFaceHeightTruthReportJson(
  outputJsonPath: string,
  report: SessionFaceHeightTruthReport
): string {
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`);
  return resolvedPath;
}

export function validateSessionFaceHeightTruthReport(
  report: unknown,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): SessionFaceHeightTruthReportValidationResult {
  const blockers: string[] = [];
  const serializedReport = JSON.stringify(report) ?? "";
  if (UUID_PATTERN.test(serializedReport)) {
    blockers.push("report_contains_uuid");
  }

  if (!isRecord(report)) {
    return {
      ok: false,
      blockers: [...blockers, "report_not_object"],
    };
  }

  if (
    report.reportSchemaVersion !==
    SESSION_FACE_HEIGHT_TRUTH_REPORT_SCHEMA_VERSION
  ) {
    blockers.push("report_schema_version_invalid");
  }
  validateGeneratedAt(report.generatedAt, options, blockers);
  validateUtcTimestampField(report.start, "start_invalid", blockers);
  validateUtcTimestampField(report.end, "end_invalid", blockers);
  if (
    isUtcTimestamp(report.start) &&
    isUtcTimestamp(report.end) &&
    Date.parse(report.start) >= Date.parse(report.end)
  ) {
    blockers.push("measurement_window_invalid");
  }
  validateReportWindowFreshness(report, options, blockers);
  validateNonNegativeIntegerField(report.days, "days_invalid", blockers);

  for (const field of [
    "totalCandidates",
    "acceptedCandidates",
    "rejectedCandidates",
    "positiveObservedCandidates",
    "linkedPositiveCandidates",
    "nonCanonicalLinkedPositiveCandidates",
    "matchedPositiveCandidates",
    "unmatchedPositiveCandidates",
    "matchedPositiveBeachCount",
    "matchedPositiveUserCount",
  ] as const) {
    validateNonNegativeIntegerField(report[field], `${field}_invalid`, blockers);
  }
  if (
    isNonNegativeIntegerValue(report.acceptedCandidates) &&
    isNonNegativeIntegerValue(report.rejectedCandidates) &&
    isNonNegativeIntegerValue(report.totalCandidates) &&
    report.acceptedCandidates + report.rejectedCandidates !==
      report.totalCandidates
  ) {
    blockers.push("candidate_counts_inconsistent");
  }
  if (
    isNonNegativeIntegerValue(report.matchedPositiveCandidates) &&
    isNonNegativeIntegerValue(report.linkedPositiveCandidates) &&
    report.matchedPositiveCandidates > report.linkedPositiveCandidates
  ) {
    blockers.push("matched_exceeds_linked_positive");
  }
  if (
    isNonNegativeIntegerValue(report.unmatchedPositiveCandidates) &&
    isNonNegativeIntegerValue(report.matchedPositiveCandidates) &&
    isNonNegativeIntegerValue(report.positiveObservedCandidates) &&
    report.unmatchedPositiveCandidates + report.matchedPositiveCandidates !==
      report.positiveObservedCandidates
  ) {
    blockers.push("positive_match_counts_inconsistent");
  }

  validateNullableUtcTimestampField(
    report.latestMatchedPositiveObservedAt,
    "latest_matched_positive_observed_at_invalid",
    blockers
  );
  validateNullableUtcTimestampField(
    report.latestShortHorizonMatchedObservedAt,
    "latest_short_horizon_matched_observed_at_invalid",
    blockers
  );
  validateCountMap(report.qualityStates, "quality_states_invalid", blockers);
  validateCountMap(report.rejectionReasons, "rejection_reasons_invalid", blockers);
  validateCountMap(report.sourcesCreatedBy, "sources_created_by_invalid", blockers);
  validateCountMap(
    report.linkedPositiveDisplaySources,
    "linked_positive_display_sources_invalid",
    blockers
  );
  validateCountMap(
    report.matchedPositiveByHorizon,
    "matched_positive_by_horizon_invalid",
    blockers,
    SESSION_FACE_HEIGHT_HORIZONS
  );
  validateMatchedPositiveTimestampConsistency(report, blockers);
  validatePositiveLabelsByHorizon(report.positiveLabelsByHorizon, blockers);
  validatePositiveLabelsByHorizonConsistency(report, blockers);
  validateUnmatchedPositiveDiagnostics(
    report.unmatchedPositiveDiagnostics,
    blockers
  );
  validateUnmatchedPositiveDiagnosticsConsistency(report, blockers);
  validateSnapshotCompleteness(
    report.snapshotCompleteness,
    report.matchedPositiveCandidates,
    blockers
  );
  validateForecastEchoRisk(report.forecastEchoRisk, blockers);
  validateReportedHeightConsistency(
    report.reportedHeightConsistency,
    report.matchedPositiveCandidates,
    blockers
  );
  validateReadiness(report.readiness, blockers);
  validateReadinessConsistency(report, blockers);

  return {
    ok: blockers.length === 0,
    blockers,
  };
}

export function validateSessionFaceHeightTruthReportFile(
  inputJsonPath: string,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): SessionFaceHeightTruthReportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(inputJsonPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      blockers: [
        `report_json_unreadable:${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  return validateSessionFaceHeightTruthReport(parsed, options);
}

function validateGeneratedAt(
  generatedAt: unknown,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(generatedAt)) {
    blockers.push("generated_at_invalid");
    return;
  }
  const now = options.now ?? new Date();
  const generatedAtDate = new Date(generatedAt);
  const ageMs = now.getTime() - generatedAtDate.getTime();
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    blockers.push("generated_at_in_future");
  }
  if (
    typeof options.maxReportAgeHours === "number" &&
    ageMs > options.maxReportAgeHours * 60 * 60 * 1000
  ) {
    blockers.push("generated_at_too_old");
  }
}

function validateReportWindowFreshness(
  report: Record<string, unknown>,
  options: {
    maxReportAgeHours?: number | null;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(report.generatedAt)) {
    return;
  }

  validateTimestampFreshnessAgainstGeneratedAt(
    report.end,
    report.generatedAt,
    "measurement_end_after_generated_at",
    "measurement_end_too_old",
    options,
    blockers
  );
}

function validateTimestampFreshnessAgainstGeneratedAt(
  value: unknown,
  generatedAt: string,
  futureBlockerCode: string,
  staleBlockerCode: string,
  options: {
    maxReportAgeHours?: number | null;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(value)) {
    return;
  }

  const ageMs = Date.parse(generatedAt) - Date.parse(value);
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    blockers.push(futureBlockerCode);
  }
  if (
    typeof options.maxReportAgeHours === "number" &&
    ageMs > options.maxReportAgeHours * 60 * 60 * 1000
  ) {
    blockers.push(staleBlockerCode);
  }
}

function validatePositiveLabelsByHorizon(
  coverage: unknown,
  blockers: string[]
): void {
  if (!Array.isArray(coverage)) {
    blockers.push("positive_labels_by_horizon_invalid");
    return;
  }
  const horizons = coverage.map((row) =>
    isRecord(row) ? row.horizon : null
  );
  if (
    horizons.length !== SESSION_FACE_HEIGHT_HORIZONS.length ||
    SESSION_FACE_HEIGHT_HORIZONS.some((horizon) => !horizons.includes(horizon))
  ) {
    blockers.push("positive_labels_by_horizon_horizons_invalid");
  }
  for (const row of coverage) {
    if (!isRecord(row) || !isSessionFaceHeightHorizon(row.horizon)) {
      blockers.push("positive_labels_by_horizon_invalid");
      return;
    }
    for (const field of [
      "positiveObservedCandidates",
      "linkedPositiveCandidates",
      "unlinkedPositiveCandidates",
      "nonCanonicalLinkedPositiveCandidates",
      "matchedPositiveCandidates",
      "unmatchedPositiveCandidates",
      "matchedPositiveBeachCount",
      "matchedPositiveUserCount",
    ] as const) {
      if (!isNonNegativeIntegerValue(row[field])) {
        blockers.push("positive_labels_by_horizon_invalid");
        return;
      }
    }
    const positiveObservedCandidates = readNonNegativeInteger(
      row.positiveObservedCandidates
    );
    const linkedPositiveCandidates = readNonNegativeInteger(
      row.linkedPositiveCandidates
    );
    const unlinkedPositiveCandidates = readNonNegativeInteger(
      row.unlinkedPositiveCandidates
    );
    const nonCanonicalLinkedPositiveCandidates = readNonNegativeInteger(
      row.nonCanonicalLinkedPositiveCandidates
    );
    const matchedPositiveCandidates = readNonNegativeInteger(
      row.matchedPositiveCandidates
    );
    const unmatchedPositiveCandidates = readNonNegativeInteger(
      row.unmatchedPositiveCandidates
    );
    if (
      positiveObservedCandidates === null ||
      linkedPositiveCandidates === null ||
      unlinkedPositiveCandidates === null ||
      nonCanonicalLinkedPositiveCandidates === null ||
      matchedPositiveCandidates === null ||
      unmatchedPositiveCandidates === null
    ) {
      blockers.push("positive_labels_by_horizon_invalid");
      return;
    }
    if (
      linkedPositiveCandidates + unlinkedPositiveCandidates !==
        positiveObservedCandidates ||
      matchedPositiveCandidates + unmatchedPositiveCandidates !==
        positiveObservedCandidates ||
      matchedPositiveCandidates + nonCanonicalLinkedPositiveCandidates !==
        linkedPositiveCandidates ||
      unlinkedPositiveCandidates + nonCanonicalLinkedPositiveCandidates !==
        unmatchedPositiveCandidates
    ) {
      blockers.push("positive_labels_by_horizon_row_counts_mismatch");
      return;
    }
  }
}

function validatePositiveLabelsByHorizonConsistency(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  const coverage = report.positiveLabelsByHorizon;
  if (
    !Array.isArray(coverage) ||
    coverage.some(
      (row) => !isRecord(row) || !isSessionFaceHeightHorizon(row.horizon)
    )
  ) {
    return;
  }

  for (const [coverageField, reportField] of [
    ["positiveObservedCandidates", "positiveObservedCandidates"],
    ["linkedPositiveCandidates", "linkedPositiveCandidates"],
    [
      "nonCanonicalLinkedPositiveCandidates",
      "nonCanonicalLinkedPositiveCandidates",
    ],
    ["matchedPositiveCandidates", "matchedPositiveCandidates"],
    ["unmatchedPositiveCandidates", "unmatchedPositiveCandidates"],
  ] as const) {
    const expected = readNonNegativeInteger(report[reportField]);
    if (expected === null) {
      continue;
    }
    const actual = sumIntegerField(coverage, coverageField);
    if (actual === null) {
      continue;
    }
    if (actual !== expected) {
      blockers.push("positive_labels_by_horizon_counts_mismatch");
      return;
    }
  }

  if (
    !countMapsMatch(
      report.matchedPositiveByHorizon,
      sumCoverageByHorizon(coverage, "matchedPositiveCandidates")
    )
  ) {
    blockers.push("matched_positive_by_horizon_counts_mismatch");
  }
}

function validateUnmatchedPositiveDiagnostics(
  diagnostics: unknown,
  blockers: string[]
): void {
  if (!isRecord(diagnostics)) {
    blockers.push("unmatched_positive_diagnostics_invalid");
    return;
  }
  validateCountMap(
    diagnostics.reasons,
    "unmatched_positive_reasons_invalid",
    blockers
  );
  validateCountMap(
    diagnostics.byHorizon,
    "unmatched_positive_by_horizon_invalid",
    blockers,
    SESSION_FACE_HEIGHT_HORIZONS
  );
  validateCountMap(
    diagnostics.bySourceCreatedBy,
    "unmatched_positive_by_source_invalid",
    blockers
  );
  validateCountMap(
    diagnostics.nonCanonicalDisplaySources,
    "unmatched_positive_non_canonical_sources_invalid",
    blockers
  );
}

function validateUnmatchedPositiveDiagnosticsConsistency(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  const diagnostics = report.unmatchedPositiveDiagnostics;
  if (!isRecord(diagnostics)) {
    return;
  }

  const unmatchedPositiveCandidates = readNonNegativeInteger(
    report.unmatchedPositiveCandidates
  );
  if (unmatchedPositiveCandidates !== null) {
    for (const [field, blockerCode] of [
      ["reasons", "unmatched_positive_reasons_counts_mismatch"],
      ["byHorizon", "unmatched_positive_by_horizon_counts_mismatch"],
      ["bySourceCreatedBy", "unmatched_positive_by_source_counts_mismatch"],
    ] as const) {
      const actual = sumCountMap(diagnostics[field]);
      if (actual !== null && actual !== unmatchedPositiveCandidates) {
        blockers.push(blockerCode);
        return;
      }
    }
  }

  const nonCanonicalLinkedPositiveCandidates = readNonNegativeInteger(
    report.nonCanonicalLinkedPositiveCandidates
  );
  const nonCanonicalSourceCount = sumCountMap(
    diagnostics.nonCanonicalDisplaySources
  );
  if (
    nonCanonicalLinkedPositiveCandidates !== null &&
    nonCanonicalSourceCount !== null &&
    nonCanonicalSourceCount !== nonCanonicalLinkedPositiveCandidates
  ) {
    blockers.push("unmatched_positive_non_canonical_sources_counts_mismatch");
  }
}

function validateMatchedPositiveTimestampConsistency(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  const matchedPositiveCandidates = readNonNegativeInteger(
    report.matchedPositiveCandidates
  );
  const latestMatchedPositiveObservedAt =
    report.latestMatchedPositiveObservedAt;

  if (
    matchedPositiveCandidates !== null &&
    ((matchedPositiveCandidates === 0 &&
      latestMatchedPositiveObservedAt !== null) ||
      (matchedPositiveCandidates > 0 &&
        latestMatchedPositiveObservedAt === null))
  ) {
    blockers.push("latest_matched_positive_observed_at_count_mismatch");
  }

  const shortHorizonMatchedCandidates = getShortHorizonMatchedCandidateCount(
    report.matchedPositiveByHorizon
  );
  const latestShortHorizonMatchedObservedAt =
    report.latestShortHorizonMatchedObservedAt;

  if (
    shortHorizonMatchedCandidates !== null &&
    ((shortHorizonMatchedCandidates === 0 &&
      latestShortHorizonMatchedObservedAt !== null) ||
      (shortHorizonMatchedCandidates > 0 &&
        latestShortHorizonMatchedObservedAt === null))
  ) {
    blockers.push("latest_short_horizon_matched_observed_at_count_mismatch");
  }

  if (
    isUtcTimestamp(latestMatchedPositiveObservedAt) &&
    isUtcTimestamp(latestShortHorizonMatchedObservedAt) &&
    Date.parse(latestShortHorizonMatchedObservedAt) >
      Date.parse(latestMatchedPositiveObservedAt)
  ) {
    blockers.push("latest_short_horizon_after_latest_matched_positive");
  }
}

function validateSnapshotCompleteness(
  completeness: unknown,
  matchedPositiveCandidates: unknown,
  blockers: string[]
): void {
  if (!isRecord(completeness)) {
    blockers.push("snapshot_completeness_invalid");
    return;
  }
  for (const field of ["displayHeight", "rawOmHeight", "v5ShadowHeight"] as const) {
    if (!isNonNegativeIntegerValue(completeness[field])) {
      blockers.push("snapshot_completeness_invalid");
      return;
    }
    if (
      isNonNegativeIntegerValue(matchedPositiveCandidates) &&
      completeness[field] > matchedPositiveCandidates
    ) {
      blockers.push("snapshot_completeness_exceeds_matched");
    }
  }
}

function validateForecastEchoRisk(
  echoRisk: unknown,
  blockers: string[]
): void {
  if (!isRecord(echoRisk)) {
    blockers.push("forecast_echo_risk_invalid");
    return;
  }
  if (!isNonNegativeFiniteNumber(echoRisk.toleranceFt)) {
    blockers.push("forecast_echo_tolerance_invalid");
  }
  if (
    !isNonNegativeIntegerValue(echoRisk.comparableMatchedPositiveCandidates) ||
    !isNonNegativeIntegerValue(echoRisk.displayEchoCandidates)
  ) {
    blockers.push("forecast_echo_counts_invalid");
  }
  if (
    isNonNegativeIntegerValue(echoRisk.comparableMatchedPositiveCandidates) &&
    isNonNegativeIntegerValue(echoRisk.displayEchoCandidates) &&
    echoRisk.displayEchoCandidates >
      echoRisk.comparableMatchedPositiveCandidates
  ) {
    blockers.push("forecast_echo_counts_inconsistent");
  }
  validateRateOrNull(
    echoRisk.displayEchoRiskRate,
    "forecast_echo_risk_rate_invalid",
    blockers
  );
}

function validateReportedHeightConsistency(
  consistency: unknown,
  matchedPositiveCandidates: unknown,
  blockers: string[]
): void {
  if (!isRecord(consistency)) {
    blockers.push("reported_height_consistency_invalid");
    return;
  }
  if (!isNonNegativeFiniteNumber(consistency.toleranceM)) {
    blockers.push("reported_height_consistency_tolerance_invalid");
  }
  if (
    !isNonNegativeIntegerValue(
      consistency.consistentMatchedPositiveCandidates
    ) ||
    !isNonNegativeIntegerValue(
      consistency.inconsistentMatchedPositiveCandidates
    )
  ) {
    blockers.push("reported_height_consistency_counts_invalid");
  }
  if (
    isNonNegativeIntegerValue(matchedPositiveCandidates) &&
    isNonNegativeIntegerValue(
      consistency.consistentMatchedPositiveCandidates
    ) &&
    isNonNegativeIntegerValue(
      consistency.inconsistentMatchedPositiveCandidates
    ) &&
    consistency.consistentMatchedPositiveCandidates +
      consistency.inconsistentMatchedPositiveCandidates !==
      matchedPositiveCandidates
  ) {
    blockers.push("reported_height_consistency_counts_inconsistent");
  }
  validateRateOrNull(
    consistency.consistencyRate,
    "reported_height_consistency_rate_invalid",
    blockers
  );
}

function validateReadiness(
  readiness: unknown,
  blockers: string[]
): void {
  if (!isRecord(readiness)) {
    blockers.push("readiness_invalid");
    return;
  }
  if (readiness.verdict !== "ready" && readiness.verdict !== "not-ready") {
    blockers.push("readiness_verdict_invalid");
  }
  if (typeof readiness.readyForHarnessTruth !== "boolean") {
    blockers.push("readiness_ready_for_harness_truth_invalid");
  }
  if ((readiness.verdict === "ready") !== readiness.readyForHarnessTruth) {
    blockers.push("readiness_verdict_ready_mismatch");
  }
  validateReadinessCriteria(readiness.criteria, blockers);
  validateReadinessObserved(readiness.observed, blockers);
  validateStringArray(readiness.findings, "readiness_findings_invalid", blockers);
  validateFindingCodes(readiness.findingCodes, blockers);
}

function validateReadinessConsistency(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  const readiness = report.readiness;
  if (!isRecord(readiness) || !isRecord(readiness.observed)) {
    return;
  }

  const observed = readiness.observed;
  for (const [observedField, reportField] of [
    ["matchedPositiveCandidates", "matchedPositiveCandidates"],
    ["matchedPositiveBeachCount", "matchedPositiveBeachCount"],
    ["matchedPositiveUserCount", "matchedPositiveUserCount"],
    ["latestShortHorizonMatchedObservedAt", "latestShortHorizonMatchedObservedAt"],
  ] as const) {
    if (observed[observedField] !== report[reportField]) {
      blockers.push("readiness_observed_mismatch");
      break;
    }
  }

  const expectedShortHorizonMatchedCandidates =
    getShortHorizonMatchedCandidateCount(report.matchedPositiveByHorizon);
  if (
    expectedShortHorizonMatchedCandidates !== null &&
    observed.shortHorizonMatchedCandidates !==
      expectedShortHorizonMatchedCandidates
  ) {
    blockers.push("readiness_observed_mismatch");
  }

  const expectedCompletenessRates = getSnapshotCompletenessRates(
    report.snapshotCompleteness,
    report.matchedPositiveCandidates
  );
  if (
    expectedCompletenessRates &&
    (!nullableNumbersMatch(
      observed.displaySnapshotCompletenessRate,
      expectedCompletenessRates.displaySnapshotCompletenessRate
    ) ||
      !nullableNumbersMatch(
        observed.rawOmSnapshotCompletenessRate,
        expectedCompletenessRates.rawOmSnapshotCompletenessRate
      ) ||
      !nullableNumbersMatch(
        observed.v5ShadowSnapshotCompletenessRate,
        expectedCompletenessRates.v5ShadowSnapshotCompletenessRate
      ))
  ) {
    blockers.push("readiness_observed_mismatch");
  }

  const reportedHeightConsistencyRate = isRecord(
    report.reportedHeightConsistency
  )
    ? readRateOrNull(report.reportedHeightConsistency.consistencyRate)
    : undefined;
  if (
    reportedHeightConsistencyRate !== undefined &&
    !nullableNumbersMatch(
      observed.reportedHeightConsistencyRate,
      reportedHeightConsistencyRate
    )
  ) {
    blockers.push("readiness_observed_mismatch");
  }
  const displayForecastEchoRiskRate = isRecord(report.forecastEchoRisk)
    ? readRateOrNull(report.forecastEchoRisk.displayEchoRiskRate)
    : undefined;
  if (
    displayForecastEchoRiskRate !== undefined &&
    !nullableNumbersMatch(
      observed.displayForecastEchoRiskRate,
      displayForecastEchoRiskRate
    )
  ) {
    blockers.push("readiness_observed_mismatch");
  }

  const expectedShortHorizonMatchedAgeDays = getShortHorizonMatchedAgeDays(
    report.latestShortHorizonMatchedObservedAt,
    report.generatedAt
  );
  if (
    expectedShortHorizonMatchedAgeDays !== undefined &&
    !nullableNumbersMatch(
      observed.shortHorizonMatchedAgeDays,
      expectedShortHorizonMatchedAgeDays
    )
  ) {
    blockers.push("readiness_observed_mismatch");
  }

  const expectedFindingCodes = getExpectedReadinessFindingCodes(report);
  if (expectedFindingCodes === null) {
    return;
  }

  const findingCodes = readiness.findingCodes;
  if (
    !Array.isArray(findingCodes) ||
    !stringArraysMatch(findingCodes, expectedFindingCodes)
  ) {
    blockers.push("readiness_finding_codes_mismatch");
  }

  const expectedReady = expectedFindingCodes.length === 0;
  if (readiness.readyForHarnessTruth !== expectedReady) {
    blockers.push("readiness_ready_for_harness_truth_mismatch");
  }
  if (readiness.verdict !== (expectedReady ? "ready" : "not-ready")) {
    blockers.push("readiness_verdict_mismatch");
  }
  if (
    (Array.isArray(readiness.findings) &&
      readiness.findings.length !== expectedFindingCodes.length) ||
    (Array.isArray(findingCodes) &&
      findingCodes.length !== expectedFindingCodes.length)
  ) {
    blockers.push("readiness_findings_mismatch");
  }
}

function getExpectedReadinessFindingCodes(
  report: Record<string, unknown>
): SessionFaceHeightTruthReadinessFindingCode[] | null {
  if (!isRecord(report.readiness) || !isRecord(report.readiness.criteria)) {
    return null;
  }
  const criteria = report.readiness.criteria;
  const matchedPositiveCandidates = readNonNegativeInteger(
    report.matchedPositiveCandidates
  );
  const shortHorizonMatchedCandidates = getShortHorizonMatchedCandidateCount(
    report.matchedPositiveByHorizon
  );
  const matchedPositiveBeachCount = readNonNegativeInteger(
    report.matchedPositiveBeachCount
  );
  const matchedPositiveUserCount = readNonNegativeInteger(
    report.matchedPositiveUserCount
  );
  const minMatchedPositiveCandidates = readNonNegativeInteger(
    criteria.minMatchedPositiveCandidates
  );
  const minShortHorizonMatchedCandidates = readNonNegativeInteger(
    criteria.minShortHorizonMatchedCandidates
  );
  const minMatchedPositiveBeaches = readNonNegativeInteger(
    criteria.minMatchedPositiveBeaches
  );
  const minMatchedPositiveUsers = readNonNegativeInteger(
    criteria.minMatchedPositiveUsers
  );
  const minSnapshotCompletenessRate = readRate(
    criteria.minSnapshotCompletenessRate
  );
  const minReportedHeightConsistencyRate = readRate(
    criteria.minReportedHeightConsistencyRate
  );
  const maxForecastEchoRiskRate = readRate(criteria.maxForecastEchoRiskRate);
  const maxShortHorizonMatchedAgeDays = readNonNegativeInteger(
    criteria.maxShortHorizonMatchedAgeDays
  );
  const snapshotCompletenessRates = getSnapshotCompletenessRates(
    report.snapshotCompleteness,
    report.matchedPositiveCandidates
  );
  const reportedHeightConsistencyRate = isRecord(
    report.reportedHeightConsistency
  )
    ? readRateOrNull(report.reportedHeightConsistency.consistencyRate)
    : undefined;
  const displayForecastEchoRiskRate = isRecord(report.forecastEchoRisk)
    ? readRateOrNull(report.forecastEchoRisk.displayEchoRiskRate)
    : undefined;
  const shortHorizonMatchedAgeDays = getShortHorizonMatchedAgeDays(
    report.latestShortHorizonMatchedObservedAt,
    report.generatedAt
  );

  if (
    matchedPositiveCandidates === null ||
    shortHorizonMatchedCandidates === null ||
    matchedPositiveBeachCount === null ||
    matchedPositiveUserCount === null ||
    minMatchedPositiveCandidates === null ||
    minShortHorizonMatchedCandidates === null ||
    minMatchedPositiveBeaches === null ||
    minMatchedPositiveUsers === null ||
    minSnapshotCompletenessRate === null ||
    minReportedHeightConsistencyRate === null ||
    maxForecastEchoRiskRate === null ||
    maxShortHorizonMatchedAgeDays === null ||
    !snapshotCompletenessRates ||
    reportedHeightConsistencyRate === undefined ||
    displayForecastEchoRiskRate === undefined ||
    shortHorizonMatchedAgeDays === undefined
  ) {
    return null;
  }

  const findingCodes: SessionFaceHeightTruthReadinessFindingCode[] = [];
  if (matchedPositiveCandidates < minMatchedPositiveCandidates) {
    findingCodes.push("matched_positive_candidates_floor");
  }
  if (shortHorizonMatchedCandidates < minShortHorizonMatchedCandidates) {
    findingCodes.push("short_horizon_matched_candidates_floor");
  }
  if (matchedPositiveBeachCount < minMatchedPositiveBeaches) {
    findingCodes.push("matched_positive_beaches_floor");
  }
  if (matchedPositiveUserCount < minMatchedPositiveUsers) {
    findingCodes.push("matched_positive_users_floor");
  }
  if (
    snapshotCompletenessRates.displaySnapshotCompletenessRate === null ||
    snapshotCompletenessRates.displaySnapshotCompletenessRate <
      minSnapshotCompletenessRate
  ) {
    findingCodes.push("display_snapshot_completeness_floor");
  }
  if (
    snapshotCompletenessRates.rawOmSnapshotCompletenessRate === null ||
    snapshotCompletenessRates.rawOmSnapshotCompletenessRate <
      minSnapshotCompletenessRate
  ) {
    findingCodes.push("raw_om_snapshot_completeness_floor");
  }
  if (
    snapshotCompletenessRates.v5ShadowSnapshotCompletenessRate === null ||
    snapshotCompletenessRates.v5ShadowSnapshotCompletenessRate <
      minSnapshotCompletenessRate
  ) {
    findingCodes.push("v5_shadow_snapshot_completeness_floor");
  }
  if (
    reportedHeightConsistencyRate === null ||
    reportedHeightConsistencyRate < minReportedHeightConsistencyRate
  ) {
    findingCodes.push("reported_height_consistency_floor");
  }
  if (
    displayForecastEchoRiskRate === null ||
    displayForecastEchoRiskRate > maxForecastEchoRiskRate
  ) {
    findingCodes.push("display_forecast_echo_risk_ceiling");
  }
  if (
    minShortHorizonMatchedCandidates > 0 &&
    shortHorizonMatchedAgeDays === null
  ) {
    findingCodes.push("short_horizon_freshness_missing");
  } else if (
    minShortHorizonMatchedCandidates > 0 &&
    shortHorizonMatchedAgeDays !== null &&
    shortHorizonMatchedAgeDays > maxShortHorizonMatchedAgeDays
  ) {
    findingCodes.push("short_horizon_freshness_stale");
  }

  return findingCodes;
}

function getShortHorizonMatchedCandidateCount(
  matchedPositiveByHorizon: unknown
): number | null {
  if (!isRecord(matchedPositiveByHorizon)) {
    return null;
  }
  const zeroToTwentyFour = readNonNegativeInteger(
    matchedPositiveByHorizon["0-24h"] ?? 0
  );
  const twentyFiveToSeventyTwo = readNonNegativeInteger(
    matchedPositiveByHorizon["25-72h"] ?? 0
  );
  if (zeroToTwentyFour === null || twentyFiveToSeventyTwo === null) {
    return null;
  }
  return zeroToTwentyFour + twentyFiveToSeventyTwo;
}

function getSnapshotCompletenessRates(
  snapshotCompleteness: unknown,
  matchedPositiveCandidates: unknown
): {
  displaySnapshotCompletenessRate: number | null;
  rawOmSnapshotCompletenessRate: number | null;
  v5ShadowSnapshotCompletenessRate: number | null;
} | null {
  if (!isRecord(snapshotCompleteness)) {
    return null;
  }
  const matchedCount = readNonNegativeInteger(matchedPositiveCandidates);
  const displayHeightCount = readNonNegativeInteger(
    snapshotCompleteness.displayHeight
  );
  const rawOmHeightCount = readNonNegativeInteger(snapshotCompleteness.rawOmHeight);
  const v5ShadowHeightCount = readNonNegativeInteger(
    snapshotCompleteness.v5ShadowHeight
  );
  if (
    matchedCount === null ||
    displayHeightCount === null ||
    rawOmHeightCount === null ||
    v5ShadowHeightCount === null
  ) {
    return null;
  }
  return {
    displaySnapshotCompletenessRate: ratio(displayHeightCount, matchedCount),
    rawOmSnapshotCompletenessRate: ratio(rawOmHeightCount, matchedCount),
    v5ShadowSnapshotCompletenessRate: ratio(v5ShadowHeightCount, matchedCount),
  };
}

function getShortHorizonMatchedAgeDays(
  latestShortHorizonMatchedObservedAt: unknown,
  generatedAt: unknown
): number | null | undefined {
  if (latestShortHorizonMatchedObservedAt === null && isUtcTimestamp(generatedAt)) {
    return null;
  }
  if (
    isUtcTimestamp(latestShortHorizonMatchedObservedAt) &&
    isUtcTimestamp(generatedAt)
  ) {
    return ageDays(latestShortHorizonMatchedObservedAt, generatedAt);
  }
  return undefined;
}

function readNonNegativeInteger(value: unknown): number | null {
  return isNonNegativeIntegerValue(value) ? value : null;
}

function readRate(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

function readRateOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return readRate(value) ?? undefined;
}

function nullableNumbersMatch(
  actual: unknown,
  expected: number | null
): boolean {
  if (actual === null || expected === null) {
    return actual === expected;
  }
  return (
    typeof actual === "number" &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) < 0.000_000_001
  );
}

function stringArraysMatch(
  actual: unknown[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function validateReadinessCriteria(
  criteria: unknown,
  blockers: string[]
): void {
  if (!isRecord(criteria)) {
    blockers.push("readiness_criteria_invalid");
    return;
  }
  for (const field of [
    "minMatchedPositiveCandidates",
    "minShortHorizonMatchedCandidates",
    "minMatchedPositiveBeaches",
    "minMatchedPositiveUsers",
  ] as const) {
    validateNonNegativeIntegerField(
      criteria[field],
      `readiness_criteria_${field}_invalid`,
      blockers
    );
  }
  for (const field of [
    "minSnapshotCompletenessRate",
    "minReportedHeightConsistencyRate",
    "maxForecastEchoRiskRate",
  ] as const) {
    validateRate(
      criteria[field],
      `readiness_criteria_${field}_invalid`,
      blockers
    );
  }
  if (!isNonNegativeFiniteNumber(criteria.forecastEchoToleranceFt)) {
    blockers.push("readiness_criteria_forecast_echo_tolerance_invalid");
  }
  validateNonNegativeIntegerField(
    criteria.maxShortHorizonMatchedAgeDays,
    "readiness_criteria_max_short_horizon_age_invalid",
    blockers
  );
}

function validateReadinessObserved(
  observed: unknown,
  blockers: string[]
): void {
  if (!isRecord(observed)) {
    blockers.push("readiness_observed_invalid");
    return;
  }
  for (const field of [
    "matchedPositiveCandidates",
    "shortHorizonMatchedCandidates",
    "matchedPositiveBeachCount",
    "matchedPositiveUserCount",
  ] as const) {
    validateNonNegativeIntegerField(
      observed[field],
      `readiness_observed_${field}_invalid`,
      blockers
    );
  }
  for (const field of [
    "displaySnapshotCompletenessRate",
    "rawOmSnapshotCompletenessRate",
    "v5ShadowSnapshotCompletenessRate",
    "reportedHeightConsistencyRate",
    "displayForecastEchoRiskRate",
  ] as const) {
    validateRateOrNull(
      observed[field],
      `readiness_observed_${field}_invalid`,
      blockers
    );
  }
  validateNullableUtcTimestampField(
    observed.latestShortHorizonMatchedObservedAt,
    "readiness_observed_latest_short_horizon_invalid",
    blockers
  );
  if (
    observed.shortHorizonMatchedAgeDays !== null &&
    !isNonNegativeFiniteNumber(observed.shortHorizonMatchedAgeDays)
  ) {
    blockers.push("readiness_observed_short_horizon_age_invalid");
  }
}

function validateCountMap(
  value: unknown,
  blockerCode: string,
  blockers: string[],
  allowedKeys?: readonly string[]
): void {
  if (!isRecord(value)) {
    blockers.push(blockerCode);
    return;
  }
  for (const [key, count] of Object.entries(value)) {
    if (
      (allowedKeys && !allowedKeys.includes(key)) ||
      !isNonNegativeIntegerValue(count)
    ) {
      blockers.push(blockerCode);
      return;
    }
  }
}

function sumIntegerField(rows: unknown[], field: string): number | null {
  let total = 0;
  for (const row of rows) {
    if (!isRecord(row) || !isNonNegativeIntegerValue(row[field])) {
      return null;
    }
    total += row[field];
  }
  return total;
}

function sumCoverageByHorizon(
  rows: unknown[],
  field: string
): Record<string, number> | null {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!isRecord(row) || !isSessionFaceHeightHorizon(row.horizon)) {
      return null;
    }
    const count = readNonNegativeInteger(row[field]);
    if (count === null) {
      return null;
    }
    if (count === 0) {
      continue;
    }
    counts[row.horizon] = (counts[row.horizon] ?? 0) + count;
  }
  return counts;
}

function sumCountMap(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }
  return Object.values(value).reduce<number | null>((total, count) => {
    if (total === null || !isNonNegativeIntegerValue(count)) {
      return null;
    }
    return total + count;
  }, 0);
}

function countMapsMatch(
  actual: unknown,
  expected: Record<string, number> | null
): boolean {
  if (!isRecord(actual) || expected === null) {
    return false;
  }
  const actualNonZeroEntries = Object.entries(actual).filter(
    ([, count]) => count !== 0
  );
  const expectedEntries = Object.entries(expected).filter(
    ([, count]) => count !== 0
  );
  return (
    actualNonZeroEntries.length === expectedEntries.length &&
    expectedEntries.every(([key, value]) => actual[key] === value)
  );
}

function validateStringArray(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    blockers.push(blockerCode);
  }
}

function validateFindingCodes(value: unknown, blockers: string[]): void {
  const allowedCodes: readonly string[] = [
    "matched_positive_candidates_floor",
    "short_horizon_matched_candidates_floor",
    "matched_positive_beaches_floor",
    "matched_positive_users_floor",
    "display_snapshot_completeness_floor",
    "raw_om_snapshot_completeness_floor",
    "v5_shadow_snapshot_completeness_floor",
    "reported_height_consistency_floor",
    "display_forecast_echo_risk_ceiling",
    "short_horizon_freshness_missing",
    "short_horizon_freshness_stale",
  ];
  if (
    !Array.isArray(value) ||
    value.some(
      (code) => typeof code !== "string" || !allowedCodes.includes(code)
    )
  ) {
    blockers.push("readiness_finding_codes_invalid");
  }
}

function validateUtcTimestampField(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isUtcTimestamp(value)) {
    blockers.push(blockerCode);
  }
}

function validateNullableUtcTimestampField(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (value !== null && !isUtcTimestamp(value)) {
    blockers.push(blockerCode);
  }
}

function validateNonNegativeIntegerField(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isNonNegativeIntegerValue(value)) {
    blockers.push(blockerCode);
  }
}

function validateRate(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    blockers.push(blockerCode);
  }
}

function validateRateOrNull(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (value !== null) {
    validateRate(value, blockerCode, blockers);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeIntegerValue(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isSessionFaceHeightHorizon(
  value: unknown
): value is (typeof SESSION_FACE_HEIGHT_HORIZONS)[number] {
  return (
    typeof value === "string" &&
    SESSION_FACE_HEIGHT_HORIZONS.includes(
      value as (typeof SESSION_FACE_HEIGHT_HORIZONS)[number]
    )
  );
}

function createAdminClient(): AdminClient {
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function fetchSessionFaceHeightCandidateRows(
  supabase: AdminClient,
  options: CliOptions
): Promise<SessionFaceHeightCandidateRow[]> {
  const rows: SessionFaceHeightCandidateRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("session_wave_observation_candidates")
      .select(
        [
          "user_id",
          "beach_id",
          "observed_at",
          "reported_wave_height_ft",
          "observed_m",
          "ml_prediction_id",
          "forecast_horizon_hours",
          "quality_state",
          "rejection_reason",
          "observation_weight",
          "source_created_by",
          "snapshot_display_height_m",
          "snapshot_raw_om_height_m",
          "snapshot_v5_shadow_height_m",
          "snapshot_display_source",
        ].join(",")
      )
      .gte("observed_at", options.start)
      .lt("observed_at", options.end)
      .order("observed_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `session_wave_observation_candidates lookup failed: ${error.message}`
      );
    }

    const page = (data ?? []) as unknown as SessionFaceHeightCandidateRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      const profilesById = await fetchProfilesById(
        supabase,
        Array.from(
          new Set(rows.flatMap((row) => (row.user_id ? [row.user_id] : [])))
        )
      );
      return filterCandidateRowsByRealProfiles(rows, profilesById);
    }
  }
}

async function fetchProfilesById(
  supabase: AdminClient,
  userIds: string[]
): Promise<Map<string, SessionFaceHeightProfileRow>> {
  const profilesById = new Map<string, SessionFaceHeightProfileRow>();
  for (let offset = 0; offset < userIds.length; offset += PAGE_SIZE) {
    const chunk = userIds.slice(offset, offset + PAGE_SIZE);
    if (chunk.length === 0) {
      continue;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id,deleted_at,is_mock,analytics_is_real_user,is_system_account")
      .in("id", chunk);

    if (error) {
      throw new Error(`profiles lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as SessionFaceHeightProfileRow[]) {
      profilesById.set(row.id, row);
    }
  }
  return profilesById;
}

export function filterCandidateRowsByRealProfiles(
  rows: SessionFaceHeightCandidateRow[],
  profilesById: Map<string, SessionFaceHeightProfileRow>
): SessionFaceHeightCandidateRow[] {
  return rows.filter((row) => isRealProfile(row.user_id, profilesById));
}

function isRealProfile(
  userId: string | null,
  profilesById: Map<string, SessionFaceHeightProfileRow>
): boolean {
  if (!userId) {
    return false;
  }
  const profile = profilesById.get(userId);
  if (!profile) {
    return false;
  }
  if (profile.deleted_at !== null) {
    return false;
  }
  if (profile.is_mock === true) {
    return false;
  }
  if (profile.analytics_is_real_user === false) {
    return false;
  }
  if (profile.is_system_account === true) {
    return false;
  }
  return true;
}

function countBy<T>(rows: T[], keyFn: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function countDistinctNonNull<T>(
  rows: T[],
  keyFn: (row: T) => string | null
): number {
  const keys = new Set<string>();
  for (const row of rows) {
    const key = keyFn(row);
    if (key) {
      keys.add(key);
    }
  }
  return keys.size;
}

function renderCountTable(counts: Record<string, number>, label: string): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "_No rows._";

  const lines = [`| ${label} | Count |`, "| --- | ---: |"];
  for (const [key, count] of entries) {
    lines.push(`| ${key} | ${count.toLocaleString()} |`);
  }
  return lines.join("\n");
}

function renderHorizonCoverageTable(
  coverage: SessionFaceHeightHorizonCoverage[]
): string {
  const lines = [
    [
      "| Horizon",
      "Positive labels",
      "Linked",
      "Unlinked",
      "Non-canonical linked",
      "Canonical matched",
      "Unmatched",
      "Matched beaches",
      "Matched users |",
    ].join(" | "),
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of coverage) {
    lines.push(
      [
        `| ${row.horizon}`,
        row.positiveObservedCandidates.toLocaleString(),
        row.linkedPositiveCandidates.toLocaleString(),
        row.unlinkedPositiveCandidates.toLocaleString(),
        row.nonCanonicalLinkedPositiveCandidates.toLocaleString(),
        row.matchedPositiveCandidates.toLocaleString(),
        row.unmatchedPositiveCandidates.toLocaleString(),
        row.matchedPositiveBeachCount.toLocaleString(),
        `${row.matchedPositiveUserCount.toLocaleString()} |`,
      ].join(" | ")
    );
  }

  return lines.join("\n");
}

function isPositive(value: number | null): boolean {
  return isFiniteNumber(value) && value > 0;
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function computeForecastEchoRisk(
  rows: SessionFaceHeightCandidateRow[],
  toleranceFt: number
): SessionFaceHeightTruthReport["forecastEchoRisk"] {
  const comparableRows = rows.filter(
    (
      row
    ): row is SessionFaceHeightCandidateRow & {
      reported_wave_height_ft: number;
      snapshot_display_height_m: number;
    } =>
      isFiniteNumber(row.reported_wave_height_ft) &&
      isFiniteNumber(row.snapshot_display_height_m)
  );
  const displayEchoCandidates = comparableRows.filter((row) => {
    const displayHeightFt = row.snapshot_display_height_m * METERS_TO_FEET;
    return Math.abs(row.reported_wave_height_ft - displayHeightFt) <= toleranceFt;
  }).length;

  return {
    toleranceFt,
    comparableMatchedPositiveCandidates: comparableRows.length,
    displayEchoCandidates,
    displayEchoRiskRate: ratio(displayEchoCandidates, comparableRows.length),
  };
}

function computeReportedHeightConsistency(
  rows: SessionFaceHeightCandidateRow[]
): SessionFaceHeightTruthReport["reportedHeightConsistency"] {
  const consistentMatchedPositiveCandidates = rows.filter(
    hasConsistentReportedFaceHeight
  ).length;
  const inconsistentMatchedPositiveCandidates =
    rows.length - consistentMatchedPositiveCandidates;

  return {
    toleranceM: REPORTED_HEIGHT_CONSISTENCY_TOLERANCE_M,
    consistentMatchedPositiveCandidates,
    inconsistentMatchedPositiveCandidates,
    consistencyRate: ratio(consistentMatchedPositiveCandidates, rows.length),
  };
}

function hasConsistentReportedFaceHeight(
  row: SessionFaceHeightCandidateRow
): boolean {
  if (
    !isFiniteNumber(row.reported_wave_height_ft) ||
    !isFiniteNumber(row.observed_m)
  ) {
    return false;
  }

  return (
    Math.abs(
      row.observed_m - roundReportedFaceHeightToMeters(row.reported_wave_height_ft)
    ) <= REPORTED_HEIGHT_CONSISTENCY_TOLERANCE_M
  );
}

function roundReportedFaceHeightToMeters(reportedWaveHeightFt: number): number {
  return Math.round(reportedWaveHeightFt * 0.3048 * 1000) / 1000;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(1);
}

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/session-face-height-truth-report.ts --days 365
  yarn tsx scripts/session-face-height-truth-report.ts --days 365 --output-json /tmp/quiver-session-face-height-truth-report.json
  yarn tsx scripts/session-face-height-truth-report.ts --days 365 --min-matched-positive 100 --min-short-horizon-matched 75 --min-matched-positive-beaches 10 --min-matched-positive-users 10 --min-reported-height-consistency-rate 1 --max-forecast-echo-risk-rate 0.25 --max-short-horizon-matched-age-days 30 --fail-on-not-ready
  yarn tsx scripts/session-face-height-truth-report.ts --validate-output-json /tmp/quiver-session-face-height-truth-report.json --max-report-age-hours 24`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.validateOutputJsonPath) {
    const result = validateSessionFaceHeightTruthReportFile(
      options.validateOutputJsonPath,
      {
        maxReportAgeHours: options.maxReportAgeHours,
      }
    );
    if (!result.ok) {
      throw new Error(
        `Session face-height truth report JSON failed validation:\n- ${result.blockers.join(
          "\n- "
        )}`
      );
    }
    console.log(
      `Session face-height truth report JSON is valid: ${options.validateOutputJsonPath}`
    );
    return;
  }
  const supabase = createAdminClient();
  const rows = await fetchSessionFaceHeightCandidateRows(supabase, options);
  const report = computeSessionFaceHeightTruthReport({
    ...options,
    rows,
    readinessCriteria: {
      minMatchedPositiveCandidates: options.minMatchedPositiveCandidates,
      minShortHorizonMatchedCandidates:
        options.minShortHorizonMatchedCandidates,
      minMatchedPositiveBeaches: options.minMatchedPositiveBeaches,
      minMatchedPositiveUsers: options.minMatchedPositiveUsers,
      minSnapshotCompletenessRate: options.minSnapshotCompletenessRate,
      minReportedHeightConsistencyRate:
        options.minReportedHeightConsistencyRate,
      maxForecastEchoRiskRate: options.maxForecastEchoRiskRate,
      forecastEchoToleranceFt: options.forecastEchoToleranceFt,
      maxShortHorizonMatchedAgeDays:
        options.maxShortHorizonMatchedAgeDays,
    },
  });

  if (options.outputJsonPath) {
    const outputPath = writeSessionFaceHeightTruthReportJson(
      options.outputJsonPath,
      report
    );
    console.error(`Wrote session face-height truth JSON: ${outputPath}`);
  }

  process.stdout.write(renderSessionFaceHeightTruthReport(report));
  if (options.failOnNotReady && !report.readiness.readyForHarnessTruth) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
