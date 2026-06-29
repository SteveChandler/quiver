#!/usr/bin/env tsx
/**
 * Read-only Phase 0 forecast accuracy harness.
 *
 * Examples:
 *   yarn tsx scripts/forecast-accuracy-harness.ts --days 30
 *   yarn tsx scripts/forecast-accuracy-harness.ts --beach-slugs blacks,lower-trestles --days 14
 *   yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed-factors.json
 *   yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed-factors.json --group-by region
 *   yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed-factors.json --fail-on-regression
 *   yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed-factors.json --group-by beach --fail-on-slice-regression
 *   yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed-factors.json --group-by beach --fail-on-unmeasured-slices
 *   yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed-factors.json --min-gate-samples 25 --min-slice-samples 25 --group-by beach
 *
 * Proposed JSON can be either:
 *   { "predictions": [{ "beach_id": "...", "predicted_at": "...", "forecast_horizon_bucket": "0-24h", "proposed_display_height_m": 1.2 }] }
 * or:
 *   { "beaches": [{ "id": "...", "shoaling_factors": {...}, "swell_access_factors": [...], ... }] }
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  computeForecastAccuracyGateMetrics,
  computeForecastAccuracyMetrics,
  computeForecastAccuracyPairedDeltas,
  computeForecastAccuracyPairedGateDeltas,
  getForecastAccuracyHorizonBucket,
  getForecastAccuracyRowHorizonBucket,
  type ForecastAccuracyDelta,
  type ForecastAccuracyGateDelta,
  type ForecastAccuracyGateMetric,
  type ForecastAccuracyHorizonBucket,
  type ForecastAccuracyInputRow,
  type ForecastAccuracyMetric,
} from "../lib/services/forecast/accuracy-metrics";
import {
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
  type SwellComponentInput,
  type WaveHeightSourceTag,
} from "../lib/utils/wave-height-transformer";
import { WAVE_HEIGHT_SOURCE_TAG_SET } from "../lib/utils/wave-height-source";
import { METERS_TO_FEET } from "../lib/utils/unit-conversions";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const PAGE_SIZE = 1000;
const CANONICAL_DISPLAY_SOURCE = "face-Hs-transformer-v1";
const FORECAST_ACCURACY_HARNESS_REPORT_SCHEMA_VERSION = 1;
const SESSION_FACE_HEIGHT_CONSISTENCY_TOLERANCE_M = 0.01;

type TruthSource = "buoy" | "session" | "both";
type SliceGroupBy = "region" | "beach";

interface CliOptions {
  start: string;
  end: string;
  beachIds: string[];
  beachSlugs: string[];
  proposedJsonPath: string | null;
  outputJsonPath: string | null;
  truthSource: TruthSource;
  groupBy: SliceGroupBy | null;
  failOnRegression: boolean;
  failOnSliceRegression: boolean;
  failOnUnmeasuredSlices: boolean;
  minGateSamples: number | null;
  minSliceSamples: number | null;
}

interface BeachScope {
  beachIds: string[];
  beachSlugs: string[];
  source: "explicit" | "proposed-json" | "all";
}

interface PredictionRow extends ForecastAccuracyInputRow {
  id?: string | null;
  beach_id: string;
  predicted_at: string;
  display_source?: string | null;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
  has_horizon_bucket_provenance?: boolean;
  display_wave_source?: WaveHeightSourceTag | null;
  display_raw_input_height_m?: number | null;
  noaa_swell_1_height_m: number | null;
  noaa_swell_1_period_s: number | null;
  noaa_swell_1_direction_deg: number | null;
  noaa_swell_2_height_m: number | null;
  noaa_swell_2_period_s: number | null;
  noaa_swell_2_direction_deg: number | null;
  noaa_wind_wave_height_m: number | null;
  noaa_wind_wave_period_s: number | null;
  noaa_wind_wave_direction_deg: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  wave_period_om: number | null;
  wave_direction_om: number | null;
}

export interface SessionObservationRow {
  user_id: string | null;
  beach_id: string;
  observed_at: string;
  reported_wave_height_ft: number | null;
  observed_m: number | null;
  ml_prediction_id: string;
  matched_prediction_at: string | null;
  forecast_horizon_hours: number | null;
  snapshot_display_height_m: number | null;
  snapshot_raw_om_height_m: number | null;
  snapshot_v5_shadow_height_m: number | null;
  snapshot_display_source?: string | null;
}

export interface ProfileRow {
  id: string;
  deleted_at: string | null;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
}

interface BeachRow extends BeachTerrainConfig {
  id: string;
  slug: string | null;
  name: string;
  region: string | null;
}

interface ProposedPrediction {
  beach_id: string;
  predicted_at: string;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket;
  forecast_horizon_hours?: number;
  proposed_display_height_m: number;
}

interface ProposedBeachConfig extends Partial<BeachTerrainConfig> {
  id?: string;
  slug?: string;
}

interface ProposedInput {
  predictions?: ProposedPrediction[];
  beaches?: ProposedBeachConfig[];
  [key: string]: unknown;
}

interface ProposedApplicationResult {
  rows: PredictionRow[];
  proposedCount: number;
  missingCount: number;
}

interface ProposedGateSlice {
  groupKey: string;
  group: string;
  proposedCount: number;
  currentCount: number;
  proposedMaeM: number;
  currentMaeM: number;
  deltaMaeM: number;
  verdict: "non-regressing" | "regressed";
}

interface ProposedSampleFloorCheck {
  minSampleCount: number;
  insufficientGroups: string[];
  shouldFail: boolean;
}

interface ProposedGateVerdict {
  delta: ForecastAccuracyGateDelta;
  verdict: ProposedGateSlice["verdict"];
  sampleFloor: ProposedSampleFloorCheck | null;
  shouldFail: boolean;
}

interface ProposedGateSliceCoverage {
  expectedGroups: string[];
  measuredGroups: string[];
  unmeasuredGroups: string[];
  shouldFail: boolean;
}

interface ProposedGateSliceVerdict {
  slices: ProposedGateSlice[];
  regressedSlices: ProposedGateSlice[];
  sampleFloor: ProposedSampleFloorCheck | null;
  shouldFail: boolean;
}

interface ForecastAccuracyHarnessReport {
  report_schema_version: typeof FORECAST_ACCURACY_HARNESS_REPORT_SCHEMA_VERSION;
  generated_at: string;
  range: {
    start: string;
    end: string;
  };
  truth_source: TruthSource;
  truth_contract: {
    observed_field: "observed_m";
    truth_quantity: "breaking_face_height_m";
    metric: "mae_m";
    session_truth_requires_canonical_display_source: boolean;
    canonical_display_source: string;
  };
  measurement_contract: {
    proposed_delta_method: "row-paired";
    comparison_baseline: "current_display";
    candidate_baseline: "proposed_display";
    gate_horizon: "0-72h";
  };
  proposed_json_path: string | null;
  proposed_json_sha256: string | null;
  approval_gates: {
    fail_on_regression: boolean;
    fail_on_slice_regression: boolean;
    fail_on_unmeasured_slices: boolean;
    min_gate_samples: number | null;
    min_slice_samples: number | null;
  };
  scope: {
    source: BeachScope["source"];
    beach_count: number | "all";
    beach_ids: string[];
    beach_slugs: string[];
    beaches: Array<Pick<BeachRow, "id" | "slug" | "name" | "region">>;
  };
  row_counts: {
    buoy_observation_rows: number;
    session_observation_rows: number;
    matched_prediction_rows: number;
    matched_0_72h_rows: number;
    matched_0_72h_rows_with_horizon_bucket_provenance: number;
    matched_0_72h_rows_without_horizon_bucket_provenance: number;
    matched_0_72h_rows_with_replay_provenance: number;
    matched_0_72h_rows_without_replay_provenance: number;
    proposed_rows_compared: number;
    rows_without_proposed_value: number;
  };
  metrics: ForecastAccuracyMetric[];
  proposed_deltas: ForecastAccuracyDelta[];
  gate_metrics: ForecastAccuracyGateMetric[];
  proposed_gate_verdict: ProposedGateVerdict | null;
  gate_slices: {
    group_by: SliceGroupBy | null;
    items: ProposedGateSlice[];
    verdict: ProposedGateSliceVerdict | null;
    coverage: ProposedGateSliceCoverage | null;
  };
}

function parseCliArgs(argv: string[]): CliOptions {
  const now = new Date();
  let start: string | null = null;
  let end = now.toISOString();
  let days = 30;
  let proposedJsonPath: string | null = null;
  let outputJsonPath: string | null = null;
  let truthSource: TruthSource = "buoy";
  let groupBy: SliceGroupBy | null = null;
  let failOnRegression = false;
  let failOnSliceRegression = false;
  let failOnUnmeasuredSlices = false;
  let minGateSamples: number | null = null;
  let minSliceSamples: number | null = null;
  const beachIds: string[] = [];
  const beachSlugs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--start") {
      start = parseDateArg(readFlagValue(next, "--start"), "--start");
      i++;
      continue;
    }
    if (arg.startsWith("--start=")) {
      start = parseDateArg(
        readFlagValue(arg.split("=")[1], "--start"),
        "--start"
      );
      continue;
    }
    if (arg === "--end") {
      end = parseDateArg(readFlagValue(next, "--end"), "--end");
      i++;
      continue;
    }
    if (arg.startsWith("--end=")) {
      end = parseDateArg(
        readFlagValue(arg.split("=")[1], "--end"),
        "--end"
      );
      continue;
    }
    if (arg === "--days") {
      days = parsePositiveInteger(readFlagValue(next, "--days"), "--days");
      i++;
      continue;
    }
    if (arg.startsWith("--days=")) {
      days = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--days"),
        "--days"
      );
      continue;
    }
    if (arg === "--beach-id" || arg === "--beach-ids") {
      beachIds.push(...splitList(readFlagValue(next, arg)));
      i++;
      continue;
    }
    if (arg.startsWith("--beach-id=") || arg.startsWith("--beach-ids=")) {
      const flagName = arg.startsWith("--beach-ids=")
        ? "--beach-ids"
        : "--beach-id";
      beachIds.push(
        ...splitList(readFlagValue(arg.split("=")[1], flagName))
      );
      continue;
    }
    if (arg === "--beach-slug" || arg === "--beach-slugs") {
      beachSlugs.push(...splitList(readFlagValue(next, arg)));
      i++;
      continue;
    }
    if (arg.startsWith("--beach-slug=") || arg.startsWith("--beach-slugs=")) {
      const flagName = arg.startsWith("--beach-slugs=")
        ? "--beach-slugs"
        : "--beach-slug";
      beachSlugs.push(
        ...splitList(readFlagValue(arg.split("=")[1], flagName))
      );
      continue;
    }
    if (arg === "--proposed-json") {
      proposedJsonPath = readFlagValue(next, "--proposed-json");
      i++;
      continue;
    }
    if (arg.startsWith("--proposed-json=")) {
      proposedJsonPath = readFlagValue(arg.split("=")[1], "--proposed-json");
      continue;
    }
    if (arg === "--output-json") {
      outputJsonPath = readFlagValue(next, "--output-json");
      i++;
      continue;
    }
    if (arg.startsWith("--output-json=")) {
      outputJsonPath = readFlagValue(arg.split("=")[1], "--output-json");
      continue;
    }
    if (arg === "--truth-source" || arg === "--truth-sources") {
      truthSource = parseTruthSource(readFlagValue(next, arg));
      i++;
      continue;
    }
    if (
      arg.startsWith("--truth-source=") ||
      arg.startsWith("--truth-sources=")
    ) {
      const flagName = arg.startsWith("--truth-sources=")
        ? "--truth-sources"
        : "--truth-source";
      truthSource = parseTruthSource(
        readFlagValue(arg.split("=")[1], flagName)
      );
      continue;
    }
    if (arg === "--group-by") {
      groupBy = parseSliceGroupBy(readFlagValue(next, "--group-by"));
      i++;
      continue;
    }
    if (arg.startsWith("--group-by=")) {
      groupBy = parseSliceGroupBy(
        readFlagValue(arg.split("=")[1], "--group-by")
      );
      continue;
    }
    if (arg === "--fail-on-regression") {
      failOnRegression = true;
      continue;
    }
    if (arg === "--fail-on-slice-regression") {
      failOnSliceRegression = true;
      continue;
    }
    if (arg === "--fail-on-unmeasured-slices") {
      failOnUnmeasuredSlices = true;
      continue;
    }
    if (arg === "--min-gate-samples") {
      minGateSamples = parsePositiveInteger(
        readFlagValue(next, "--min-gate-samples"),
        "--min-gate-samples"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--min-gate-samples=")) {
      minGateSamples = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-gate-samples"),
        "--min-gate-samples"
      );
      continue;
    }
    if (arg === "--min-slice-samples") {
      minSliceSamples = parsePositiveInteger(
        readFlagValue(next, "--min-slice-samples"),
        "--min-slice-samples"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--min-slice-samples=")) {
      minSliceSamples = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-slice-samples"),
        "--min-slice-samples"
      );
      continue;
    }
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (!start) {
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - days);
    start = startDate.toISOString();
  }
  validateDateRange(start, end);
  assertNoDuplicateScopeValues(beachIds, "--beach-ids");
  assertNoDuplicateScopeValues(beachSlugs, "--beach-slugs");

  return {
    start,
    end,
    beachIds,
    beachSlugs,
    proposedJsonPath,
    outputJsonPath,
    truthSource,
    groupBy,
    failOnRegression,
    failOnSliceRegression,
    failOnUnmeasuredSlices,
    minGateSamples,
    minSliceSamples,
  };
}

function parseTruthSource(value: string): TruthSource {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "buoy" ||
    normalized === "session" ||
    normalized === "both"
  ) {
    return normalized;
  }
  throw new Error(
    `Invalid --truth-source ${value}. Expected buoy, session, or both.`
  );
}

function parseSliceGroupBy(value: string): SliceGroupBy {
  const normalized = value.trim().toLowerCase();
  if (normalized === "region" || normalized === "beach") {
    return normalized;
  }
  throw new Error(`Invalid --group-by ${value}. Expected region or beach.`);
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

function parseDateArg(value: string, flagName: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${flagName} must be a valid date/time.`);
  }
  return parsed.toISOString();
}

function validateDateRange(start: string, end: string): void {
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw new Error("--start must be before --end.");
  }
}

function createAdminClient(): SupabaseClient {
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

async function fetchBeachRows(
  supabase: SupabaseClient,
  scope: BeachScope
): Promise<BeachRow[]> {
  if (scope.beachIds.length === 0 && scope.beachSlugs.length === 0) {
    const { data, error } = await baseBeachQuery(supabase);
    if (error) {
      throw new Error(`Beach lookup failed: ${error.message}`);
    }
    return (data ?? []) as BeachRow[];
  }

  const byId = new Map<string, BeachRow>();

  if (scope.beachIds.length > 0) {
    const { data, error } = await baseBeachQuery(supabase).in(
      "id",
      scope.beachIds
    );
    if (error) {
      throw new Error(`Beach lookup by id failed: ${error.message}`);
    }
    for (const beach of (data ?? []) as BeachRow[]) {
      byId.set(beach.id, beach);
    }
  }

  if (scope.beachSlugs.length > 0) {
    const { data, error } = await baseBeachQuery(supabase).in(
      "slug",
      scope.beachSlugs
    );
    if (error) {
      throw new Error(`Beach lookup by slug failed: ${error.message}`);
    }
    for (const beach of (data ?? []) as BeachRow[]) {
      byId.set(beach.id, beach);
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function baseBeachQuery(supabase: SupabaseClient) {
  return supabase
    .from("beaches")
    .select(
      "id, slug, name, region, terrain_enabled, swell_access_factors, shoaling_factors, swell_window_center_deg, swell_window_halfwidth_deg, deepwater_decay_factor"
    )
    .is("deleted_at", null);
}

const PREDICTION_SELECT_COLUMNS = [
  "id",
  "beach_id",
  "predicted_at",
  "display_source",
  "forecast_horizon_hours",
  "observed_m",
  "raw_display_height_m",
  "offset_corrected_display_height_m",
  "wave_height_om",
  "v5_shadow_height_m",
  "noaa_swell_1_height_m",
  "noaa_swell_1_period_s",
  "noaa_swell_1_direction_deg",
  "noaa_swell_2_height_m",
  "noaa_swell_2_period_s",
  "noaa_swell_2_direction_deg",
  "noaa_wind_wave_height_m",
  "noaa_wind_wave_period_s",
  "noaa_wind_wave_direction_deg",
  "wave_period_s",
  "wave_direction_deg",
  "wave_period_om",
  "wave_direction_om",
];

const PREDICTION_HORIZON_BUCKET_SELECT_COLUMNS = ["forecast_horizon_bucket"];

const PREDICTION_REPLAY_SELECT_COLUMNS = [
  "display_wave_source",
  "display_raw_input_height_m",
];

function predictionSelectColumns({
  includeReplayColumns,
  includeHorizonBucketColumn,
}: {
  includeReplayColumns: boolean;
  includeHorizonBucketColumn: boolean;
}): string {
  return [
    ...PREDICTION_SELECT_COLUMNS,
    ...(includeHorizonBucketColumn
      ? PREDICTION_HORIZON_BUCKET_SELECT_COLUMNS
      : []),
    ...(includeReplayColumns ? PREDICTION_REPLAY_SELECT_COLUMNS : []),
  ].join(",");
}

function isMissingOptionalPredictionColumnError(error: {
  code?: string;
  message?: string;
}): "horizon-bucket" | "replay" | null {
  const message = (error.message ?? "").toLowerCase();
  const isMissingColumn = error.code === "PGRST204" || error.code === "42703";
  if (isMissingColumn && message.includes("forecast_horizon_bucket")) {
    return "horizon-bucket";
  }
  if (
    isMissingColumn &&
    (message.includes("display_wave_source") ||
      message.includes("display_raw_input_height_m"))
  ) {
    return "replay";
  }
  if (message.includes("forecast_horizon_bucket")) {
    return "horizon-bucket";
  }
  if (
    message.includes("display_wave_source") ||
    message.includes("display_raw_input_height_m")
  ) {
    return "replay";
  }
  return null;
}

async function fetchPredictionRows(
  supabase: SupabaseClient,
  options: CliOptions,
  beachIds: string[]
): Promise<PredictionRow[]> {
  return fetchPredictionRowsWithOptionalColumns(supabase, options, beachIds, {
    includeReplayColumns: true,
    includeHorizonBucketColumn: true,
  });
}

async function fetchPredictionRowsWithOptionalColumns(
  supabase: SupabaseClient,
  options: CliOptions,
  beachIds: string[],
  columns: {
    includeReplayColumns: boolean;
    includeHorizonBucketColumn: boolean;
  }
): Promise<PredictionRow[]> {
  const rows: PredictionRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("ml_predictions_log")
      .select(predictionSelectColumns(columns))
      .gt("observed_m", 0)
      .eq("display_source", CANONICAL_DISPLAY_SOURCE)
      .gte("predicted_at", options.start)
      .lt("predicted_at", options.end)
      .order("predicted_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (beachIds.length > 0) {
      query = query.in("beach_id", beachIds);
    }

    const { data, error } = await query;
    if (error) {
      const missingOptionalColumn =
        isMissingOptionalPredictionColumnError(error);
      if (
        columns.includeHorizonBucketColumn &&
        missingOptionalColumn === "horizon-bucket"
      ) {
        return fetchPredictionRowsWithOptionalColumns(
          supabase,
          options,
          beachIds,
          {
            ...columns,
            includeHorizonBucketColumn: false,
          }
        );
      }
      if (columns.includeReplayColumns && missingOptionalColumn === "replay") {
        return fetchPredictionRowsWithOptionalColumns(
          supabase,
          options,
          beachIds,
          {
            ...columns,
            includeReplayColumns: false,
          }
        );
      }
      throw new Error(`Prediction lookup failed: ${error.message}`);
    }

    const page = ((data ?? []) as unknown as PredictionRow[]).map((row) =>
      normalizePredictionRow(row, columns)
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchPredictionRowsById(
  supabase: SupabaseClient,
  predictionIds: string[]
): Promise<Map<string, PredictionRow>> {
  return fetchPredictionRowsByIdWithOptionalColumns(supabase, predictionIds, {
    includeReplayColumns: true,
    includeHorizonBucketColumn: true,
  });
}

async function fetchPredictionRowsByIdWithOptionalColumns(
  supabase: SupabaseClient,
  predictionIds: string[],
  columns: {
    includeReplayColumns: boolean;
    includeHorizonBucketColumn: boolean;
  }
): Promise<Map<string, PredictionRow>> {
  const rows = new Map<string, PredictionRow>();
  const uniqueIds = Array.from(new Set(predictionIds.filter(Boolean)));

  for (let i = 0; i < uniqueIds.length; i += PAGE_SIZE) {
    const chunk = uniqueIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await supabase
      .from("ml_predictions_log")
      .select(predictionSelectColumns(columns))
      .in("id", chunk);

    if (error) {
      const missingOptionalColumn =
        isMissingOptionalPredictionColumnError(error);
      if (
        columns.includeHorizonBucketColumn &&
        missingOptionalColumn === "horizon-bucket"
      ) {
        return fetchPredictionRowsByIdWithOptionalColumns(
          supabase,
          predictionIds,
          {
            ...columns,
            includeHorizonBucketColumn: false,
          }
        );
      }
      if (columns.includeReplayColumns && missingOptionalColumn === "replay") {
        return fetchPredictionRowsByIdWithOptionalColumns(
          supabase,
          predictionIds,
          {
            ...columns,
            includeReplayColumns: false,
          }
        );
      }
      throw new Error(`Prediction by-id lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as unknown as PredictionRow[]) {
      const normalizedRow = normalizePredictionRow(row, columns);
      if (normalizedRow.id) {
        rows.set(normalizedRow.id, normalizedRow);
      }
    }
  }

  return rows;
}

function normalizePredictionRow(
  row: PredictionRow,
  columns: { includeHorizonBucketColumn: boolean }
): PredictionRow {
  return {
    ...row,
    has_horizon_bucket_provenance:
      columns.includeHorizonBucketColumn &&
      isForecastAccuracyHorizonBucket(row.forecast_horizon_bucket),
  };
}

async function fetchSessionObservationRows(
  supabase: SupabaseClient,
  options: CliOptions,
  beachIds: string[]
): Promise<PredictionRow[]> {
  const candidates: SessionObservationRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("session_wave_observation_candidates")
      .select(
        [
          "beach_id",
          "user_id",
          "observed_at",
          "reported_wave_height_ft",
          "observed_m",
          "ml_prediction_id",
          "matched_prediction_at",
          "forecast_horizon_hours",
          "snapshot_display_height_m",
          "snapshot_raw_om_height_m",
          "snapshot_v5_shadow_height_m",
          "snapshot_display_source",
        ].join(",")
      )
      .gt("observed_m", 0)
      .neq("quality_state", "rejected")
      .not("ml_prediction_id", "is", null)
      .gte("observed_at", options.start)
      .lt("observed_at", options.end)
      .order("observed_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (beachIds.length > 0) {
      query = query.in("beach_id", beachIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Session observation lookup failed: ${error.message}`);
    }

    const page = (data ?? []) as unknown as SessionObservationRow[];
    candidates.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  const profilesById = await fetchProfilesById(
    supabase,
    Array.from(
      new Set(
        candidates.flatMap((candidate) =>
          candidate.user_id ? [candidate.user_id] : []
        )
      )
    )
  );
  const realUserCandidates = filterSessionObservationRowsByRealProfiles(
    candidates,
    profilesById
  );
  const predictionsById = await fetchPredictionRowsById(
    supabase,
    realUserCandidates.map((candidate) => candidate.ml_prediction_id)
  );

  return buildSessionTruthPredictionRows(realUserCandidates, predictionsById);
}

async function fetchProfilesById(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ProfileRow>> {
  const profilesById = new Map<string, ProfileRow>();
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

    for (const row of (data ?? []) as ProfileRow[]) {
      profilesById.set(row.id, row);
    }
  }
  return profilesById;
}

export function filterSessionObservationRowsByRealProfiles(
  candidates: SessionObservationRow[],
  profilesById: Map<string, ProfileRow>
): SessionObservationRow[] {
  return candidates.filter((candidate) =>
    isRealProfile(candidate.user_id, profilesById)
  );
}

function isRealProfile(
  userId: string | null,
  profilesById: Map<string, ProfileRow>
): boolean {
  if (!userId) return false;
  const profile = profilesById.get(userId);
  if (!profile) return false;
  if (profile.deleted_at !== null) return false;
  if (profile.is_mock === true) return false;
  if (profile.analytics_is_real_user === false) return false;
  if (profile.is_system_account === true) return false;
  return true;
}

function buildSessionTruthPredictionRows(
  candidates: SessionObservationRow[],
  predictionsById: Map<string, PredictionRow>
): PredictionRow[] {
  return candidates.flatMap((candidate) => {
    const prediction = predictionsById.get(candidate.ml_prediction_id);
    const predictedAt =
      prediction?.predicted_at ??
      candidate.matched_prediction_at ??
      candidate.observed_at;

    if (!prediction || prediction.display_source !== CANONICAL_DISPLAY_SOURCE) {
      return [];
    }

    if (
      !candidate.observed_m ||
      !predictedAt ||
      !hasConsistentReportedFaceHeight(candidate)
    ) {
      return [];
    }

    return [
      {
        id: candidate.ml_prediction_id,
        beach_id: candidate.beach_id,
        predicted_at: predictedAt,
        observed_m: candidate.observed_m,
        forecast_horizon_hours:
          candidate.forecast_horizon_hours ??
          prediction?.forecast_horizon_hours ??
          null,
        forecast_horizon_bucket: prediction?.forecast_horizon_bucket ?? null,
        has_horizon_bucket_provenance:
          prediction?.has_horizon_bucket_provenance === true,
        raw_display_height_m: prediction?.raw_display_height_m ?? null,
        offset_corrected_display_height_m:
          candidate.snapshot_display_height_m ??
          prediction?.offset_corrected_display_height_m ??
          prediction?.raw_display_height_m ??
          null,
        wave_height_om:
          candidate.snapshot_raw_om_height_m ??
          prediction?.wave_height_om ??
          null,
        v5_shadow_height_m:
          candidate.snapshot_v5_shadow_height_m ??
          prediction?.v5_shadow_height_m ??
          null,
        display_wave_source: prediction?.display_wave_source ?? null,
        display_raw_input_height_m:
          prediction?.display_raw_input_height_m ?? null,
        noaa_swell_1_height_m: prediction?.noaa_swell_1_height_m ?? null,
        noaa_swell_1_period_s: prediction?.noaa_swell_1_period_s ?? null,
        noaa_swell_1_direction_deg:
          prediction?.noaa_swell_1_direction_deg ?? null,
        noaa_swell_2_height_m: prediction?.noaa_swell_2_height_m ?? null,
        noaa_swell_2_period_s: prediction?.noaa_swell_2_period_s ?? null,
        noaa_swell_2_direction_deg:
          prediction?.noaa_swell_2_direction_deg ?? null,
        noaa_wind_wave_height_m:
          prediction?.noaa_wind_wave_height_m ?? null,
        noaa_wind_wave_period_s:
          prediction?.noaa_wind_wave_period_s ?? null,
        noaa_wind_wave_direction_deg:
          prediction?.noaa_wind_wave_direction_deg ?? null,
        wave_period_s: prediction?.wave_period_s ?? null,
        wave_direction_deg: prediction?.wave_direction_deg ?? null,
        wave_period_om: prediction?.wave_period_om ?? null,
        wave_direction_om: prediction?.wave_direction_om ?? null,
      },
    ];
  });
}

function hasConsistentReportedFaceHeight(
  candidate: SessionObservationRow
): boolean {
  if (
    typeof candidate.reported_wave_height_ft !== "number" ||
    !Number.isFinite(candidate.reported_wave_height_ft) ||
    typeof candidate.observed_m !== "number" ||
    !Number.isFinite(candidate.observed_m)
  ) {
    return false;
  }

  return (
    Math.abs(
      candidate.observed_m -
        roundReportedFaceHeightToMeters(candidate.reported_wave_height_ft)
    ) <= SESSION_FACE_HEIGHT_CONSISTENCY_TOLERANCE_M
  );
}

function roundReportedFaceHeightToMeters(reportedWaveHeightFt: number): number {
  return Math.round(reportedWaveHeightFt * 0.3048 * 1000) / 1000;
}

function applyProposedInput(
  rows: PredictionRow[],
  beaches: BeachRow[],
  proposedInput: ProposedInput | null
): ProposedApplicationResult {
  if (!proposedInput) {
    return { rows, proposedCount: 0, missingCount: 0 };
  }

  if (Array.isArray(proposedInput.predictions)) {
    return applyProposedPredictions(rows, proposedInput.predictions);
  }

  const overrides = buildProposedBeachMap(proposedInput);
  if (overrides.size === 0) {
    return { rows, proposedCount: 0, missingCount: rows.length };
  }

  const beachesById = new Map(beaches.map((beach) => [beach.id, beach]));
  const output: PredictionRow[] = [];
  let proposedCount = 0;
  let missingCount = 0;

  for (const row of rows) {
    const beach = beachesById.get(row.beach_id);
    const override = beach
      ? overrides.get(beach.id) ?? overrides.get(beach.slug ?? "")
      : null;
    if (!beach || !override) {
      output.push(row);
      missingCount++;
      continue;
    }

    const proposedM = computeProposedDisplayHeightM(row, {
      ...beach,
      ...override,
    });
    if (proposedM == null) {
      output.push(row);
      missingCount++;
      continue;
    }

    output.push({ ...row, proposed_display_height_m: proposedM });
    proposedCount++;
  }

  return { rows: output, proposedCount, missingCount };
}

function applyProposedPredictions(
  rows: PredictionRow[],
  proposedPredictions: ProposedPrediction[]
): ProposedApplicationResult {
  assertNoDuplicateProposedPredictionKeys(proposedPredictions);
  const proposedByHorizonKey = new Map<string, number>();
  const proposedByLegacyKey = new Map<string, number>();
  for (const prediction of proposedPredictions) {
    const horizonBucket = getProposedPredictionHorizonBucket(prediction);
    const key = predictionKey(
      prediction.beach_id,
      prediction.predicted_at,
      horizonBucket
    );
    if (horizonBucket) {
      proposedByHorizonKey.set(key, prediction.proposed_display_height_m);
    } else {
      proposedByLegacyKey.set(key, prediction.proposed_display_height_m);
    }
  }
  let proposedCount = 0;
  let missingCount = 0;

  return {
    rows: rows.map((row) => {
      const horizonBucket = getPredictionRowHorizonBucket(row);
      const proposed =
        proposedByHorizonKey.get(
          predictionKey(row.beach_id, row.predicted_at, horizonBucket)
        ) ??
        proposedByLegacyKey.get(predictionKey(row.beach_id, row.predicted_at));
      if (proposed == null || !Number.isFinite(proposed)) {
        missingCount++;
        return row;
      }
      proposedCount++;
      return { ...row, proposed_display_height_m: proposed };
    }),
    proposedCount,
    missingCount,
  };
}

function getProposedPredictionHorizonBucket(
  prediction: ProposedPrediction
): ForecastAccuracyHorizonBucket | null {
  if (isForecastAccuracyHorizonBucket(prediction.forecast_horizon_bucket)) {
    return prediction.forecast_horizon_bucket;
  }
  return getForecastAccuracyHorizonBucket(prediction.forecast_horizon_hours);
}

function assertNoDuplicateProposedPredictionKeys(
  proposedPredictions: ProposedPrediction[]
): void {
  const keys = proposedPredictions.map((prediction) => {
    const horizonBucket = getProposedPredictionHorizonBucket(prediction);
    const key = predictionKey(
      prediction.beach_id,
      prediction.predicted_at,
      horizonBucket
    );
    return horizonBucket ? `horizon:${key}` : `legacy:${key}`;
  });
  const duplicates = findDuplicateStrings(keys);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate proposed prediction key(s): ${duplicates.join(", ")}.`
    );
  }
}

function isForecastAccuracyHorizonBucket(
  value: unknown
): value is ForecastAccuracyHorizonBucket {
  return value === "0-24h" || value === "25-72h" || value === "73h+";
}

function getPredictionRowHorizonBucket(
  row: PredictionRow
): ForecastAccuracyHorizonBucket | null {
  return getForecastAccuracyRowHorizonBucket(row);
}

function isShortHorizonPrediction(row: PredictionRow): boolean {
  const bucket = getPredictionRowHorizonBucket(row);
  return bucket === "0-24h" || bucket === "25-72h";
}

function hasHorizonBucketProvenance(row: PredictionRow): boolean {
  return row.has_horizon_bucket_provenance === true;
}

function hasDisplayReplayProvenance(row: PredictionRow): boolean {
  return (
    row.display_wave_source != null &&
    WAVE_HEIGHT_SOURCE_TAG_SET.has(row.display_wave_source) &&
    typeof row.display_raw_input_height_m === "number" &&
    Number.isFinite(row.display_raw_input_height_m) &&
    row.display_raw_input_height_m >= 0
  );
}

function computeProposedDisplayHeightM(
  row: PredictionRow,
  beach: BeachTerrainConfig
): number | null {
  const components = [
    toComponent(
      row.noaa_swell_1_height_m,
      row.noaa_swell_1_period_s,
      row.noaa_swell_1_direction_deg
    ),
    toComponent(
      row.noaa_swell_2_height_m,
      row.noaa_swell_2_period_s,
      row.noaa_swell_2_direction_deg
    ),
    toComponent(
      row.noaa_wind_wave_height_m,
      row.noaa_wind_wave_period_s,
      row.noaa_wind_wave_direction_deg,
      "wind_wave"
    ),
  ];
  const hasComponent = components.some((component) => component != null);
  const replaySource = getReplayWaveSource(row, hasComponent);
  const replayComponents =
    replaySource === "model_swell" ? components : [null, null, null];
  const rawHeightM = firstNonnegativeFinite([
    row.display_raw_input_height_m ?? null,
    row.wave_height_om,
    row.raw_display_height_m,
    row.noaa_swell_1_height_m,
    row.noaa_swell_2_height_m,
    row.noaa_wind_wave_height_m,
  ]);

  if (rawHeightM == null) {
    return null;
  }

  const result = transformToFaceHeightDecomposed({
    components: replayComponents,
    beach,
    source: replaySource,
    rawHeightFt: rawHeightM * METERS_TO_FEET,
    periodS: row.wave_period_s ?? row.wave_period_om,
    swellDirectionDeg: row.wave_direction_deg ?? row.wave_direction_om,
  });

  return Math.round((result.faceHeightFt / METERS_TO_FEET) * 1000) / 1000;
}

function getReplayWaveSource(
  row: PredictionRow,
  hasComponent: boolean
): WaveHeightSourceTag {
  if (
    row.display_wave_source != null &&
    WAVE_HEIGHT_SOURCE_TAG_SET.has(row.display_wave_source)
  ) {
    return row.display_wave_source;
  }
  return hasComponent ? "model_swell" : "model_hs";
}

function toComponent(
  heightM: number | null,
  periodS: number | null,
  directionDeg: number | null,
  partition?: "wind_wave"
): SwellComponentInput | null {
  if (
    heightM == null ||
    periodS == null ||
    !Number.isFinite(heightM) ||
    !Number.isFinite(periodS) ||
    heightM <= 0 ||
    periodS <= 0
  ) {
    return null;
  }

  return {
    heightFt: heightM * METERS_TO_FEET,
    periodS,
    directionDeg,
    ...(partition ? { partition } : {}),
  };
}

function buildProposedBeachMap(
  proposedInput: ProposedInput
): Map<string, ProposedBeachConfig> {
  const entries = new Map<string, ProposedBeachConfig>();

  if (Array.isArray(proposedInput.beaches)) {
    assertNoDuplicateProposedBeachConfigs(proposedInput.beaches);
    for (const beach of proposedInput.beaches) {
      if (beach.id) {
        entries.set(beach.id, beach);
      }
      if (beach.slug) {
        entries.set(beach.slug, beach);
      }
    }
    return entries;
  }

  const topLevelEntries: Array<[string, ProposedBeachConfig]> = [];
  for (const [key, value] of Object.entries(proposedInput)) {
    if (key === "predictions" || key === "beaches") {
      continue;
    }
    if (isRecord(value) && isProposedBeachConfigRecord(value)) {
      topLevelEntries.push([key, value as ProposedBeachConfig]);
    }
  }

  assertNoDuplicateProposedBeachConfigs(
    topLevelEntries.map(([, config]) => config)
  );
  for (const [key, config] of topLevelEntries) {
    entries.set(key, config);
  }

  return entries;
}

function assertNoDuplicateProposedBeachConfigs(
  beaches: ProposedBeachConfig[]
): void {
  const duplicateIds = findDuplicateStrings(
    beaches.flatMap((beach) => (beach.id ? [beach.id] : []))
  );
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate proposed beach config id(s): ${duplicateIds.join(", ")}.`
    );
  }

  const duplicateSlugs = findDuplicateStrings(
    beaches.flatMap((beach) => (beach.slug ? [beach.slug] : []))
  );
  if (duplicateSlugs.length > 0) {
    throw new Error(
      `Duplicate proposed beach config slug(s): ${duplicateSlugs.join(", ")}.`
    );
  }
}

function loadProposedInput(path: string | null): ProposedInput | null {
  if (!path) {
    return null;
  }
  const raw = readFileSync(resolve(path), "utf8");
  const parsed = JSON.parse(raw) as ProposedInput | ProposedPrediction[];
  if (Array.isArray(parsed)) {
    return { predictions: parsed };
  }
  return parsed;
}

function sha256File(path: string | null): string | null {
  if (!path) {
    return null;
  }
  return createHash("sha256")
    .update(readFileSync(resolve(path)))
    .digest("hex");
}

function resolveBeachScope(
  options: CliOptions,
  proposedInput: ProposedInput | null
): BeachScope {
  if (options.beachIds.length > 0 || options.beachSlugs.length > 0) {
    assertNoDuplicateScopeValues(options.beachIds, "--beach-ids");
    assertNoDuplicateScopeValues(options.beachSlugs, "--beach-slugs");
    return {
      beachIds: Array.from(new Set(options.beachIds)),
      beachSlugs: Array.from(new Set(options.beachSlugs)),
      source: "explicit",
    };
  }

  const proposedScope = getProposedBeachScope(proposedInput);
  if (
    proposedScope.beachIds.length > 0 ||
    proposedScope.beachSlugs.length > 0
  ) {
    return proposedScope;
  }

  return { beachIds: [], beachSlugs: [], source: "all" };
}

function getProposedBeachScope(
  proposedInput: ProposedInput | null
): BeachScope {
  if (!proposedInput) {
    return { beachIds: [], beachSlugs: [], source: "all" };
  }

  const beachIds = new Set<string>();
  const beachSlugs = new Set<string>();

  if (Array.isArray(proposedInput.predictions)) {
    for (const prediction of proposedInput.predictions) {
      if (prediction.beach_id) {
        beachIds.add(prediction.beach_id);
      }
    }
  }

  if (Array.isArray(proposedInput.beaches)) {
    for (const beach of proposedInput.beaches) {
      if (beach.id) {
        beachIds.add(beach.id);
      }
      if (beach.slug) {
        beachSlugs.add(beach.slug);
      }
    }
  }

  for (const [key, value] of Object.entries(proposedInput)) {
    if (key === "predictions" || key === "beaches") {
      continue;
    }
    if (!isRecord(value) || !isProposedBeachConfigRecord(value)) {
      continue;
    }
    if (isUuidLike(key)) {
      beachIds.add(key);
    } else {
      beachSlugs.add(key);
    }
  }

  return {
    beachIds: Array.from(beachIds),
    beachSlugs: Array.from(beachSlugs),
    source: beachIds.size > 0 || beachSlugs.size > 0 ? "proposed-json" : "all",
  };
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

function printMetricTable(metrics: ForecastAccuracyMetric[]): void {
  console.log("| Horizon | Baseline | N | MAE (m) | Bias (m) |");
  console.log("|---------|----------|---|---------|----------|");
  for (const metric of metrics) {
    console.log(
      `| ${metric.horizon_bucket} | ${metric.baseline_label} | ${metric.sample_count} | ${fmt(metric.mae_m)} | ${fmt(metric.bias_m)} |`
    );
  }
}

function printDeltaTable(deltas: ForecastAccuracyDelta[]): void {
  const proposedDeltas = deltas.filter(
    (delta) => delta.baseline === "proposed_display"
  );
  if (proposedDeltas.length === 0) {
    return;
  }

  console.log("");
  console.log("## Proposed vs Current Display Delta");
  console.log("");
  console.log("| Horizon | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE |");
  console.log("|---------|------------|-----------|--------------|-------------|-----------|");
  for (const delta of proposedDeltas) {
    console.log(
      `| ${delta.horizon_bucket} | ${delta.sample_count} | ${delta.comparison_sample_count} | ${fmt(delta.mae_m)} | ${fmt(delta.comparison_mae_m)} | ${fmt(delta.delta_mae_m)} |`
    );
  }
}

function printGateDeltaTable(
  deltas: ForecastAccuracyGateDelta[],
  minSampleCount: number | null
): void {
  const gateVerdict = getProposedGateVerdictFromDeltas(deltas, {
    minSampleCount,
  });
  if (!gateVerdict) {
    return;
  }

  console.log("");
  console.log("## 0-72h Proposed Gate Delta");
  console.log("");
  const sampleFloorLabel =
    gateVerdict.sampleFloor == null
      ? "n/a"
      : gateVerdict.sampleFloor.shouldFail
        ? `fail >=${gateVerdict.sampleFloor.minSampleCount}`
        : `pass >=${gateVerdict.sampleFloor.minSampleCount}`;
  console.log("| Gate | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict | Sample Floor |");
  console.log("|------|------------|-----------|--------------|-------------|-----------|---------|--------------|");
  console.log(
    `| ${gateVerdict.delta.horizon_group} | ${gateVerdict.delta.sample_count} | ${gateVerdict.delta.comparison_sample_count} | ${fmt(gateVerdict.delta.mae_m)} | ${fmt(gateVerdict.delta.comparison_mae_m)} | ${fmt(gateVerdict.delta.delta_mae_m)} | ${gateVerdict.verdict} | ${sampleFloorLabel} |`
  );
}

function getProposedGateVerdictFromDeltas(
  deltas: ForecastAccuracyGateDelta[],
  options: { minSampleCount?: number | null } = {}
): ProposedGateVerdict | null {
  const proposedDelta = deltas.find(
    (delta) => delta.baseline === "proposed_display"
  );
  if (!proposedDelta) {
    return null;
  }

  const regressionFailed = proposedDelta.delta_mae_m > 0;
  const sampleFloor = buildSampleFloorCheck(
    [
      {
        label: "proposed_display",
        sampleCount: proposedDelta.sample_count,
      },
      {
        label: "current_display",
        sampleCount: proposedDelta.comparison_sample_count,
      },
    ],
    options.minSampleCount
  );
  return {
    delta: proposedDelta,
    verdict: regressionFailed ? "regressed" : "non-regressing",
    sampleFloor,
    shouldFail: regressionFailed || (sampleFloor?.shouldFail ?? false),
  };
}

function computeProposedGateSlices(
  rows: PredictionRow[],
  beaches: BeachRow[],
  groupBy: SliceGroupBy
): ProposedGateSlice[] {
  const beachesById = new Map(beaches.map((beach) => [beach.id, beach]));
  const rowsByGroup = new Map<string, PredictionRow[]>();

  for (const row of rows) {
    const beach = beachesById.get(row.beach_id);
    if (!beach) {
      continue;
    }

    const group = getSliceGroup(beach, groupBy);
    const existingRows = rowsByGroup.get(group.key) ?? [];
    existingRows.push(row);
    rowsByGroup.set(group.key, existingRows);
  }

  return Array.from(rowsByGroup.entries())
    .flatMap(([groupKey, groupRows]) => {
      const gateDeltas = computeForecastAccuracyPairedGateDeltas(groupRows, {
        includeProposed: true,
      });
      const proposedDelta = gateDeltas.find(
        (delta) => delta.baseline === "proposed_display"
      );

      if (!proposedDelta) {
        return [];
      }

      return [
        {
          groupKey,
          group:
            groupBy === "region"
              ? groupKey
              : getBeachSliceLabel(beachesById.get(groupRows[0].beach_id)),
          proposedCount: proposedDelta.sample_count,
          currentCount: proposedDelta.comparison_sample_count,
          proposedMaeM: proposedDelta.mae_m,
          currentMaeM: proposedDelta.comparison_mae_m,
          deltaMaeM: proposedDelta.delta_mae_m,
          verdict:
            proposedDelta.delta_mae_m <= 0 ? "non-regressing" : "regressed",
        } satisfies ProposedGateSlice,
      ];
    })
    .sort((a, b) => {
      if (a.deltaMaeM !== b.deltaMaeM) {
        return a.deltaMaeM - b.deltaMaeM;
      }
      return b.proposedCount - a.proposedCount;
    });
}

function printProposedGateSlices({
  slices,
  groupBy,
  minSampleCount,
}: {
  slices: ProposedGateSlice[];
  groupBy: SliceGroupBy;
  minSampleCount: number | null;
}): void {
  if (slices.length === 0) {
    return;
  }

  console.log("");
  console.log(`## 0-72h Proposed Gate Slices by ${groupBy}`);
  console.log("");
  console.log("| Group | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict | Sample Floor |");
  console.log("|-------|------------|-----------|--------------|-------------|-----------|---------|--------------|");
  for (const slice of slices) {
    const sampleFloorLabel =
      minSampleCount == null
        ? "n/a"
        : slice.proposedCount >= minSampleCount &&
            slice.currentCount >= minSampleCount
          ? `pass >=${minSampleCount}`
          : `fail >=${minSampleCount}`;
    console.log(
      `| ${escapeMarkdownCell(slice.group)} | ${slice.proposedCount} | ${slice.currentCount} | ${fmt(slice.proposedMaeM)} | ${fmt(slice.currentMaeM)} | ${fmt(slice.deltaMaeM)} | ${slice.verdict} | ${sampleFloorLabel} |`
    );
  }
}

function getProposedGateSliceVerdict(
  slices: ProposedGateSlice[],
  options: { minSampleCount?: number | null } = {}
): ProposedGateSliceVerdict {
  const regressedSlices = slices.filter(
    (slice) => slice.verdict === "regressed"
  );
  const sampleFloor = buildSampleFloorCheck(
    slices.flatMap((slice) => [
      {
        label: `${slice.group}: proposed_display`,
        sampleCount: slice.proposedCount,
      },
      {
        label: `${slice.group}: current_display`,
        sampleCount: slice.currentCount,
      },
    ]),
    options.minSampleCount
  );

  return {
    slices,
    regressedSlices,
    sampleFloor,
    shouldFail: regressedSlices.length > 0 || (sampleFloor?.shouldFail ?? false),
  };
}

function buildSampleFloorCheck(
  groups: Array<{ label: string; sampleCount: number }>,
  minSampleCount?: number | null
): ProposedSampleFloorCheck | null {
  if (minSampleCount == null) {
    return null;
  }

  const insufficientGroups = groups
    .filter((group) => group.sampleCount < minSampleCount)
    .map((group) => group.label)
    .sort((a, b) => a.localeCompare(b));

  return {
    minSampleCount,
    insufficientGroups,
    shouldFail: insufficientGroups.length > 0,
  };
}

function getProposedGateSliceCoverage(
  beaches: BeachRow[],
  slices: ProposedGateSlice[],
  groupBy: SliceGroupBy
): ProposedGateSliceCoverage {
  const expectedGroupsByKey = new Map<string, string>();
  for (const beach of beaches) {
    const group = getSliceGroup(beach, groupBy);
    expectedGroupsByKey.set(group.key, group.label);
  }

  const measuredKeys = new Set(slices.map((slice) => slice.groupKey));
  const unmeasuredGroups = Array.from(expectedGroupsByKey.entries())
    .filter(([key]) => !measuredKeys.has(key))
    .map(([, label]) => label)
    .sort((a, b) => a.localeCompare(b));

  return {
    expectedGroups: Array.from(expectedGroupsByKey.values()).sort((a, b) =>
      a.localeCompare(b)
    ),
    measuredGroups: slices.map((slice) => slice.group).sort((a, b) =>
      a.localeCompare(b)
    ),
    unmeasuredGroups,
    shouldFail: unmeasuredGroups.length > 0,
  };
}

function buildForecastAccuracyHarnessReport({
  options,
  scope,
  beaches,
  scopedBeachIds,
  buoyRows,
  sessionRows,
  observationRows,
  applied,
  metrics,
  gateMetrics,
  gateSlices,
  proposedJsonSha256,
}: {
  options: CliOptions;
  scope: BeachScope;
  beaches: BeachRow[];
  scopedBeachIds: string[];
  buoyRows: PredictionRow[];
  sessionRows: PredictionRow[];
  observationRows: PredictionRow[];
  applied: ProposedApplicationResult;
  metrics: ForecastAccuracyMetric[];
  gateMetrics: ForecastAccuracyGateMetric[];
  gateSlices: ProposedGateSlice[];
  proposedJsonSha256: string | null;
}): ForecastAccuracyHarnessReport {
  const proposedDeltas = computeForecastAccuracyPairedDeltas(applied.rows, {
    includeProposed: options.proposedJsonPath != null,
  }).filter(
    (delta) => delta.baseline === "proposed_display"
  );
  const proposedGateVerdict = getProposedGateVerdictFromDeltas(
    computeForecastAccuracyPairedGateDeltas(applied.rows, {
      includeProposed: options.proposedJsonPath != null,
    }),
    {
      minSampleCount: options.minGateSamples,
    }
  );
  const sliceVerdict =
    options.groupBy && gateSlices.length > 0
      ? getProposedGateSliceVerdict(gateSlices, {
          minSampleCount: options.minSliceSamples,
        })
      : null;
  const sliceCoverage =
    options.groupBy && options.proposedJsonPath
      ? getProposedGateSliceCoverage(beaches, gateSlices, options.groupBy)
      : null;
  const shortHorizonRows = observationRows.filter(isShortHorizonPrediction);
  const shortHorizonRowsWithHorizonBucketProvenance = shortHorizonRows.filter(
    hasHorizonBucketProvenance
  ).length;
  const shortHorizonRowsWithReplayProvenance = shortHorizonRows.filter(
    hasDisplayReplayProvenance
  ).length;

  return {
    report_schema_version: FORECAST_ACCURACY_HARNESS_REPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    range: {
      start: options.start,
      end: options.end,
    },
    truth_source: options.truthSource,
    truth_contract: {
      observed_field: "observed_m",
      truth_quantity: "breaking_face_height_m",
      metric: "mae_m",
      session_truth_requires_canonical_display_source: true,
      canonical_display_source: CANONICAL_DISPLAY_SOURCE,
    },
    measurement_contract: {
      proposed_delta_method: "row-paired",
      comparison_baseline: "current_display",
      candidate_baseline: "proposed_display",
      gate_horizon: "0-72h",
    },
    proposed_json_path: options.proposedJsonPath,
    proposed_json_sha256: proposedJsonSha256,
    approval_gates: {
      fail_on_regression: options.failOnRegression,
      fail_on_slice_regression: options.failOnSliceRegression,
      fail_on_unmeasured_slices: options.failOnUnmeasuredSlices,
      min_gate_samples: options.minGateSamples,
      min_slice_samples: options.minSliceSamples,
    },
    scope: {
      source: scope.source,
      beach_count: scope.source === "all" ? "all" : scopedBeachIds.length,
      beach_ids: scopedBeachIds,
      beach_slugs: scope.beachSlugs,
      beaches: beaches.map((beach) => ({
        id: beach.id,
        slug: beach.slug,
        name: beach.name,
        region: beach.region,
      })),
    },
    row_counts: {
      buoy_observation_rows: buoyRows.length,
      session_observation_rows: sessionRows.length,
      matched_prediction_rows: observationRows.length,
      matched_0_72h_rows: shortHorizonRows.length,
      matched_0_72h_rows_with_horizon_bucket_provenance:
        shortHorizonRowsWithHorizonBucketProvenance,
      matched_0_72h_rows_without_horizon_bucket_provenance:
        shortHorizonRows.length - shortHorizonRowsWithHorizonBucketProvenance,
      matched_0_72h_rows_with_replay_provenance:
        shortHorizonRowsWithReplayProvenance,
      matched_0_72h_rows_without_replay_provenance:
        shortHorizonRows.length - shortHorizonRowsWithReplayProvenance,
      proposed_rows_compared: applied.proposedCount,
      rows_without_proposed_value: applied.missingCount,
    },
    metrics,
    proposed_deltas: proposedDeltas,
    gate_metrics: gateMetrics,
    proposed_gate_verdict: proposedGateVerdict,
    gate_slices: {
      group_by: options.groupBy,
      items: gateSlices,
      verdict: sliceVerdict,
      coverage: sliceCoverage,
    },
  };
}

function writeForecastAccuracyHarnessReport(
  outputJsonPath: string,
  report: ForecastAccuracyHarnessReport
): string {
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`);
  return resolvedPath;
}

function getSliceGroup(
  beach: BeachRow,
  groupBy: SliceGroupBy
): { key: string; label: string } {
  if (groupBy === "region") {
    return { key: beach.region ?? "Unknown", label: beach.region ?? "Unknown" };
  }

  return { key: beach.id, label: getBeachSliceLabel(beach) };
}

function getBeachSliceLabel(beach: BeachRow | undefined): string {
  if (!beach) {
    return "Unknown beach";
  }

  return `${beach.name} (${beach.id})`;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertNoDuplicateScopeValues(values: string[], flagName: string): void {
  const duplicates = findDuplicateStrings(values);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${flagName} value(s): ${duplicates.join(", ")}.`);
  }
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

function predictionKey(
  beachId: string,
  predictedAt: string,
  horizonBucket?: ForecastAccuracyHorizonBucket | null
): string {
  const baseKey = `${beachId}:${new Date(predictedAt).toISOString()}`;
  return horizonBucket ? `${baseKey}:${horizonBucket}` : baseKey;
}

function firstNonnegativeFinite(values: Array<number | null>): number | null {
  return (
    values.find(
      (value) => value != null && Number.isFinite(value) && value >= 0
    ) ?? null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function fmt(value: number): string {
  return value.toFixed(3);
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/forecast-accuracy-harness.ts [--days 30]
  yarn tsx scripts/forecast-accuracy-harness.ts --start 2026-06-01 --end 2026-06-18
  yarn tsx scripts/forecast-accuracy-harness.ts --beach-slugs blacks,lower-trestles
  yarn tsx scripts/forecast-accuracy-harness.ts --truth-source session
  yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed.json
  yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed.json --group-by region
  yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed.json --fail-on-regression
  yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed.json --group-by beach --fail-on-slice-regression
  yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed.json --group-by beach --fail-on-unmeasured-slices
  yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed.json --group-by beach --min-gate-samples 25 --min-slice-samples 25
  yarn tsx scripts/forecast-accuracy-harness.ts --proposed-json /tmp/proposed.json --output-json /tmp/harness-report.json`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const proposedInput = loadProposedInput(options.proposedJsonPath);
  const proposedJsonSha256 = sha256File(options.proposedJsonPath);
  const supabase = createAdminClient();
  const scope = resolveBeachScope(options, proposedInput);
  const beaches = await fetchBeachRows(supabase, scope);
  const scopedBeachIds =
    scope.source === "all" ? [] : beaches.map((beach) => beach.id);
  const buoyRows =
    options.truthSource === "buoy" || options.truthSource === "both"
      ? await fetchPredictionRows(supabase, options, scopedBeachIds)
      : [];
  const sessionRows =
    options.truthSource === "session" || options.truthSource === "both"
      ? await fetchSessionObservationRows(supabase, options, scopedBeachIds)
      : [];
  const observationRows = [...buoyRows, ...sessionRows];
  const applied = applyProposedInput(observationRows, beaches, proposedInput);
  const metrics = computeForecastAccuracyMetrics(applied.rows, {
    includeProposed: proposedInput != null,
  });
  const gateMetrics = computeForecastAccuracyGateMetrics(applied.rows, {
    includeProposed: proposedInput != null,
  });
  const pairedDeltas = computeForecastAccuracyPairedDeltas(applied.rows, {
    includeProposed: proposedInput != null,
  });
  const pairedGateDeltas = computeForecastAccuracyPairedGateDeltas(applied.rows, {
    includeProposed: proposedInput != null,
  });

  console.log("# Forecast Accuracy Harness");
  console.log("");
  console.log(`- Range: ${options.start} to ${options.end}`);
  console.log(
    `- Beaches scoped: ${scopedBeachIds.length || "all"} (${scope.source})`
  );
  console.log(`- Truth source: ${options.truthSource}`);
  console.log(`- Buoy observation rows: ${buoyRows.length}`);
  console.log(`- Session observation rows: ${sessionRows.length}`);
  console.log(`- Matched prediction rows: ${observationRows.length}`);
  if (proposedInput) {
    console.log(`- Proposed rows compared: ${applied.proposedCount}`);
    console.log(`- Rows without proposed value: ${applied.missingCount}`);
  }
  console.log("");
  printMetricTable(metrics);
  printDeltaTable(pairedDeltas);
  printGateDeltaTable(pairedGateDeltas, options.minGateSamples);

  const gateSlices =
    proposedInput && options.groupBy
      ? computeProposedGateSlices(applied.rows, beaches, options.groupBy)
      : [];
  if (options.groupBy) {
    printProposedGateSlices({
      slices: gateSlices,
      groupBy: options.groupBy,
      minSampleCount: options.minSliceSamples,
    });
  }

  const report = buildForecastAccuracyHarnessReport({
    options,
    scope,
    beaches,
    scopedBeachIds,
    buoyRows,
    sessionRows,
    observationRows,
    applied,
    metrics,
    gateMetrics,
    gateSlices,
    proposedJsonSha256,
  });

  if (options.outputJsonPath) {
    const reportPath = writeForecastAccuracyHarnessReport(
      options.outputJsonPath,
      report
    );
    console.log("");
    console.log(`Wrote harness report JSON: ${reportPath}`);
  }

  if (options.failOnRegression || options.minGateSamples != null) {
    const gateVerdict = getProposedGateVerdictFromDeltas(pairedGateDeltas, {
      minSampleCount: options.minGateSamples,
    });
    if (!gateVerdict) {
      console.error(
        "No proposed 0-72h gate delta was available; refusing to pass approval gate."
      );
      process.exitCode = 2;
      return;
    }

    if (options.failOnRegression && gateVerdict.verdict === "regressed") {
      console.error(
        `Proposed 0-72h gate regressed by ${fmt(gateVerdict.delta.delta_mae_m)}m MAE; refusing to pass --fail-on-regression.`
      );
      process.exitCode = 2;
    }

    if (gateVerdict.sampleFloor?.shouldFail) {
      console.error(
        `Proposed 0-72h gate did not meet --min-gate-samples ${gateVerdict.sampleFloor.minSampleCount}; insufficient baselines: ${gateVerdict.sampleFloor.insufficientGroups.join(", ")}.`
      );
      process.exitCode = 2;
    }
  }

  if (options.failOnSliceRegression || options.minSliceSamples != null) {
    if (!options.groupBy) {
      console.error(
        "Slice approval gates require --group-by region or --group-by beach."
      );
      process.exitCode = 2;
      return;
    }

    if (gateSlices.length === 0) {
      console.error(
        "No proposed 0-72h gate slices were available; refusing to pass slice approval gate."
      );
      process.exitCode = 2;
      return;
    }

    const sliceVerdict = getProposedGateSliceVerdict(gateSlices, {
      minSampleCount: options.minSliceSamples,
    });
    if (options.failOnSliceRegression && sliceVerdict.regressedSlices.length > 0) {
      const worstSlice = sliceVerdict.regressedSlices.reduce(
        (worst, slice) =>
          slice.deltaMaeM > worst.deltaMaeM ? slice : worst,
        sliceVerdict.regressedSlices[0]
      );
      console.error(
        `${sliceVerdict.regressedSlices.length} proposed 0-72h ${options.groupBy} slice(s) regressed; worst was ${worstSlice.group} by ${fmt(worstSlice.deltaMaeM)}m MAE.`
      );
      process.exitCode = 2;
    }

    if (sliceVerdict.sampleFloor?.shouldFail) {
      const sample = sliceVerdict.sampleFloor.insufficientGroups
        .slice(0, 5)
        .join(", ");
      const suffix =
        sliceVerdict.sampleFloor.insufficientGroups.length > 5
          ? `, +${sliceVerdict.sampleFloor.insufficientGroups.length - 5} more`
          : "";
      console.error(
        `${sliceVerdict.sampleFloor.insufficientGroups.length} proposed 0-72h ${options.groupBy} sample bucket(s) did not meet --min-slice-samples ${sliceVerdict.sampleFloor.minSampleCount}: ${sample}${suffix}.`
      );
      process.exitCode = 2;
    }
  }

  if (options.failOnUnmeasuredSlices) {
    if (!options.groupBy) {
      console.error(
        "--fail-on-unmeasured-slices requires --group-by region or --group-by beach."
      );
      process.exitCode = 2;
      return;
    }

    if (!proposedInput) {
      console.error(
        "--fail-on-unmeasured-slices requires --proposed-json so the measured scope is explicit."
      );
      process.exitCode = 2;
      return;
    }

    const sliceCoverage = getProposedGateSliceCoverage(
      beaches,
      gateSlices,
      options.groupBy
    );
    if (sliceCoverage.shouldFail) {
      const sample = sliceCoverage.unmeasuredGroups.slice(0, 5).join(", ");
      const suffix =
        sliceCoverage.unmeasuredGroups.length > 5
          ? `, +${sliceCoverage.unmeasuredGroups.length - 5} more`
          : "";
      console.error(
        `${sliceCoverage.unmeasuredGroups.length} proposed 0-72h ${options.groupBy} slice(s) had no measured gate rows: ${sample}${suffix}.`
      );
      process.exitCode = 2;
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  applyProposedInput,
  buildForecastAccuracyHarnessReport,
  buildSessionTruthPredictionRows,
  computeProposedGateSlices,
  computeProposedDisplayHeightM,
  getProposedGateSliceCoverage,
  getProposedGateSliceVerdict,
  getProposedGateVerdictFromDeltas,
  getProposedBeachScope,
  isMissingOptionalPredictionColumnError,
  parseCliArgs,
  predictionSelectColumns,
  resolveBeachScope,
  writeForecastAccuracyHarnessReport,
};
