#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getForecastAccuracyHorizonBucket,
  type ForecastAccuracyHorizonBucket,
} from "../lib/services/forecast/accuracy-metrics";
import {
  WAVE_HEIGHT_SOURCE_TAG_SET,
  type WaveHeightSourceTag,
} from "../lib/utils/wave-height-source";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const PAGE_SIZE = 1000;
const DEFAULT_FRESH_SNAPSHOT_HOURS = 24;
const CANONICAL_DISPLAY_SOURCE = "face-Hs-transformer-v1";
const FORECAST_ACCURACY_READINESS_REPORT_SCHEMA_VERSION = 1;
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const SENSITIVE_ID_KEY_PATTERN =
  /(?:^|[_.])(?:user|session|profile)(?:[_.])?id(?:s)?$/i;

type TruthSource = "buoy" | "session" | "both";
type ObservationSource = "buoy" | "session";
type BeachReadinessStatus = "ready" | "insufficient" | "unmeasured";
type ReadinessBlockerCode =
  | "gate_sample_floor"
  | "no_resolved_beaches"
  | "beach_sample_floor"
  | "fresh_snapshot_missing_bucket"
  | "observed_horizon_bucket_provenance_missing"
  | "observed_replay_provenance_missing"
  | "fresh_horizon_bucket_provenance_missing"
  | "fresh_replay_provenance_missing"
  | "missing_proposed_beach_ids"
  | "missing_proposed_beach_slugs"
  | "duplicate_proposed_beach_config_ids"
  | "duplicate_proposed_beach_config_slugs"
  | "unresolved_top_level_config_keys";

interface CliOptions {
  proposedJsonPath: string;
  outputJsonPath: string;
  validateOutputJsonPath: string | null;
  expectedProposedJsonPath: string | null;
  maxReportAgeHours: number | null;
  start: string;
  end: string;
  truthSource: TruthSource;
  minGateSamples: number;
  minBeachSamples: number;
  freshSnapshotHours: number;
  failOnNotReady: boolean;
}

interface ProposedBeachScope {
  beachIds: string[];
  beachSlugs: string[];
  duplicateBeachConfigIds: string[];
  duplicateBeachConfigSlugs: string[];
  unresolvedTopLevelConfigKeys: string[];
}

interface ProposedInput {
  predictions?: Array<{ beach_id?: string | null }>;
  beaches?: Array<{ id?: string | null; slug?: string | null }>;
  [key: string]: unknown;
}

interface BeachRow {
  id: string;
  slug: string | null;
  name: string;
  region: string | null;
}

interface ObservationRow {
  beach_id: string;
  forecast_horizon_hours: number | null;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
  source: ObservationSource;
  has_horizon_bucket_provenance: boolean;
  has_replay_provenance: boolean;
}

interface FreshSnapshotRow {
  beach_id: string;
  forecast_horizon_hours: number | null;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
  has_horizon_bucket_provenance: boolean;
  has_replay_provenance: boolean;
}

interface HorizonCounts {
  "0-24h": number;
  "25-72h": number;
  "0-72h": number;
  "73h+": number;
  unknown: number;
  total: number;
}

interface BeachReadinessItem {
  id: string;
  slug: string | null;
  name: string;
  region: string | null;
  counts: HorizonCounts;
  source_counts: Record<ObservationSource, HorizonCounts>;
  horizon_bucket_provenance_counts: HorizonCounts;
  replayable_counts: HorizonCounts;
  approval_counts: HorizonCounts;
  replayable_source_counts: Record<ObservationSource, HorizonCounts>;
  fresh_snapshot_counts: HorizonCounts;
  fresh_snapshot_horizon_bucket_provenance_counts: HorizonCounts;
  fresh_snapshot_replayable_counts: HorizonCounts;
  fresh_snapshot_approval_counts: HorizonCounts;
  status: BeachReadinessStatus;
  ready: boolean;
  needed_0_72h: number;
  short_horizon_without_horizon_bucket_provenance: number;
  short_horizon_without_replay_provenance: number;
  fresh_snapshot_ready: boolean;
  fresh_snapshot_missing_buckets: Array<"0-24h" | "25-72h">;
  fresh_short_horizon_without_horizon_bucket_provenance: number;
  fresh_short_horizon_without_replay_provenance: number;
}

interface ReadinessBlocker {
  code: ReadinessBlockerCode;
  message: string;
}

interface ForecastAccuracyReadinessReport {
  report_schema_version: 1;
  generated_at: string;
  range: {
    start: string;
    end: string;
  };
  truth_source: TruthSource;
  proposed_json_path: string;
  proposed_json_sha256: string;
  fresh_snapshot_window: {
    start: string;
    end: string;
    hours: number;
  };
  thresholds: {
    min_gate_samples: number;
    min_beach_samples: number;
  };
  scope: {
    proposed_beach_ids: string[];
    proposed_beach_slugs: string[];
    duplicate_proposed_beach_config_ids: string[];
    duplicate_proposed_beach_config_slugs: string[];
    unresolved_top_level_config_keys: string[];
    resolved_beach_count: number;
    missing_proposed_beach_ids: string[];
    missing_proposed_beach_slugs: string[];
  };
  summary: {
    gate_ready: boolean;
    all_beaches_ready: boolean;
    fresh_snapshot_ready: boolean;
    approval_readiness: boolean;
    readiness_blockers: string[];
    readiness_blocker_codes: ReadinessBlockerCode[];
    gate_0_72h_count: number;
    gate_0_72h_horizon_bucket_provenance_count: number;
    gate_0_72h_replayable_count: number;
    gate_0_72h_approval_count: number;
    short_horizon_without_horizon_bucket_provenance_count: number;
    short_horizon_without_replay_provenance_count: number;
    fresh_snapshot_0_72h_count: number;
    fresh_snapshot_0_72h_horizon_bucket_provenance_count: number;
    fresh_snapshot_0_72h_replayable_count: number;
    fresh_snapshot_0_72h_approval_count: number;
    fresh_short_horizon_without_horizon_bucket_provenance_count: number;
    fresh_short_horizon_without_replay_provenance_count: number;
    fresh_snapshot_missing_beach_count: number;
    ready_beach_count: number;
    insufficient_beach_count: number;
    unmeasured_beach_count: number;
    counts: Record<"total" | ObservationSource, HorizonCounts>;
    horizon_bucket_provenance_counts: HorizonCounts;
    replayable_counts: Record<"total" | ObservationSource, HorizonCounts>;
    approval_counts: HorizonCounts;
  };
  beaches: BeachReadinessItem[];
}

interface ForecastAccuracyReadinessReportValidationResult {
  ok: boolean;
  blockers: string[];
}

interface BuildReadinessReportOptions {
  proposedJsonPath: string;
  proposedJsonSha256: string;
  proposedScope: ProposedBeachScope;
  beaches: BeachRow[];
  observations: ObservationRow[];
  freshSnapshotRows: FreshSnapshotRow[];
  start: string;
  end: string;
  freshSnapshotStart: string;
  freshSnapshotEnd: string;
  freshSnapshotHours: number;
  truthSource: TruthSource;
  minGateSamples: number;
  minBeachSamples: number;
  generatedAt?: Date;
}

interface SessionObservationCandidateRow {
  beach_id: string;
  forecast_horizon_hours: number | null;
  ml_prediction_id: string | null;
  snapshot_display_source?: string | null;
}

interface PredictionHorizonRow {
  id: string;
  display_source?: string | null;
  forecast_horizon_hours: number | null;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
  display_wave_source?: string | null;
  display_raw_input_height_m?: number | null;
}

interface PredictionReplayReadiness {
  forecast_horizon_hours: number | null;
  display_source: string | null;
  forecast_horizon_bucket: ForecastAccuracyHorizonBucket | null;
  has_horizon_bucket_provenance: boolean;
  has_replay_provenance: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  const now = new Date();
  let proposedJsonPath = "";
  let outputJsonPath = "";
  let start: string | null = null;
  let end = now.toISOString();
  let days = 30;
  let truthSource: TruthSource = "both";
  let minGateSamples = 75;
  let minBeachSamples = 25;
  let freshSnapshotHours = DEFAULT_FRESH_SNAPSHOT_HOURS;
  let failOnNotReady = false;
  let validateOutputJsonPath: string | null = null;
  let expectedProposedJsonPath: string | null = null;
  let maxReportAgeHours: number | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--proposed-json") {
      proposedJsonPath = readFlagValue(next, "--proposed-json");
      i++;
      continue;
    }
    if (arg.startsWith("--proposed-json=")) {
      proposedJsonPath = readFlagValue(
        arg.split("=")[1],
        "--proposed-json"
      );
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
    if (arg === "--min-beach-samples") {
      minBeachSamples = parsePositiveInteger(
        readFlagValue(next, "--min-beach-samples"),
        "--min-beach-samples"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--min-beach-samples=")) {
      minBeachSamples = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-beach-samples"),
        "--min-beach-samples"
      );
      continue;
    }
    if (arg === "--fresh-snapshot-hours") {
      freshSnapshotHours = parsePositiveInteger(
        readFlagValue(next, "--fresh-snapshot-hours"),
        "--fresh-snapshot-hours"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--fresh-snapshot-hours=")) {
      freshSnapshotHours = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--fresh-snapshot-hours"),
        "--fresh-snapshot-hours"
      );
      continue;
    }
    if (arg === "--fail-on-not-ready") {
      failOnNotReady = true;
      continue;
    }
    if (arg === "--validate-output-json") {
      validateOutputJsonPath = readFlagValue(next, "--validate-output-json");
      i++;
      continue;
    }
    if (arg === "--expect-proposed-json") {
      expectedProposedJsonPath = readFlagValue(next, "--expect-proposed-json");
      i++;
      continue;
    }
    if (arg.startsWith("--expect-proposed-json=")) {
      expectedProposedJsonPath = readFlagValue(
        arg.split("=")[1],
        "--expect-proposed-json"
      );
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
      maxReportAgeHours = parsePositiveInteger(
        readFlagValue(next, "--max-report-age-hours"),
        "--max-report-age-hours"
      );
      i++;
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

  if (validateOutputJsonPath && (proposedJsonPath || outputJsonPath)) {
    throw new Error(
      "--validate-output-json cannot be combined with --proposed-json or --output-json."
    );
  }
  if (!validateOutputJsonPath && maxReportAgeHours !== null) {
    throw new Error("--max-report-age-hours requires --validate-output-json.");
  }
  if (!validateOutputJsonPath && expectedProposedJsonPath !== null) {
    throw new Error("--expect-proposed-json requires --validate-output-json.");
  }
  if (!validateOutputJsonPath && !proposedJsonPath) {
    throw new Error("Missing --proposed-json");
  }
  if (!validateOutputJsonPath && !outputJsonPath) {
    throw new Error("Missing --output-json");
  }

  if (!start) {
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - days);
    start = startDate.toISOString();
  }
  validateDateRange(start, end);

  return {
    proposedJsonPath,
    outputJsonPath,
    validateOutputJsonPath,
    expectedProposedJsonPath,
    maxReportAgeHours,
    start,
    end,
    truthSource,
    minGateSamples,
    minBeachSamples,
    freshSnapshotHours,
    failOnNotReady,
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

function loadProposedInput(path: string): ProposedInput {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as ProposedInput;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
}

function getProposedBeachScope(
  proposedInput: ProposedInput
): ProposedBeachScope {
  const beachIds: string[] = [];
  const beachSlugs: string[] = [];
  const beachConfigIds: string[] = [];
  const beachConfigSlugs: string[] = [];
  const embeddedBeachConfigIds: string[] = [];
  const embeddedBeachConfigSlugs: string[] = [];
  const unresolvedTopLevelConfigKeys: string[] = [];

  if (Array.isArray(proposedInput.predictions)) {
    for (const prediction of proposedInput.predictions) {
      if (prediction.beach_id) {
        beachIds.push(prediction.beach_id);
      }
    }
  }

  if (Array.isArray(proposedInput.beaches)) {
    for (const beach of proposedInput.beaches) {
      if (beach.id) {
        beachIds.push(beach.id);
        beachConfigIds.push(beach.id);
        embeddedBeachConfigIds.push(beach.id);
      }
      if (beach.slug) {
        beachSlugs.push(beach.slug);
        beachConfigSlugs.push(beach.slug);
        embeddedBeachConfigSlugs.push(beach.slug);
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
    const keyIsBeachId = isUuidLike(key);
    if (keyIsBeachId) {
      beachIds.push(key);
      beachConfigIds.push(key);
    } else {
      beachSlugs.push(key);
      beachConfigSlugs.push(key);
      unresolvedTopLevelConfigKeys.push(key);
    }
    if (typeof value.id === "string" && value.id) {
      embeddedBeachConfigIds.push(value.id);
    } else if (keyIsBeachId) {
      embeddedBeachConfigIds.push(key);
    }
    if (typeof value.slug === "string" && value.slug) {
      embeddedBeachConfigSlugs.push(value.slug);
    } else if (!keyIsBeachId) {
      embeddedBeachConfigSlugs.push(key);
    }
  }

  return {
    beachIds: normalizeUniqueStrings(beachIds),
    beachSlugs: normalizeUniqueStrings(beachSlugs),
    duplicateBeachConfigIds: normalizeUniqueStrings([
      ...findDuplicateStrings(beachConfigIds),
      ...findDuplicateStrings(embeddedBeachConfigIds),
    ]),
    duplicateBeachConfigSlugs: normalizeUniqueStrings([
      ...findDuplicateStrings(beachConfigSlugs),
      ...findDuplicateStrings(embeddedBeachConfigSlugs),
    ]),
    unresolvedTopLevelConfigKeys: normalizeUniqueStrings(
      unresolvedTopLevelConfigKeys
    ),
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

async function fetchBeachRows(
  supabase: SupabaseClient,
  scope: ProposedBeachScope
): Promise<BeachRow[]> {
  const byId = new Map<string, BeachRow>();

  for (const ids of chunks(scope.beachIds, PAGE_SIZE)) {
    const { data, error } = await supabase
      .from("beaches")
      .select("id, slug, name, region")
      .is("deleted_at", null)
      .in("id", ids);

    if (error) {
      throw new Error(`Beach lookup by id failed: ${error.message}`);
    }
    for (const row of (data ?? []) as BeachRow[]) {
      byId.set(row.id, row);
    }
  }

  for (const slugs of chunks(scope.beachSlugs, PAGE_SIZE)) {
    const { data, error } = await supabase
      .from("beaches")
      .select("id, slug, name, region")
      .is("deleted_at", null)
      .in("slug", slugs);

    if (error) {
      throw new Error(`Beach lookup by slug failed: ${error.message}`);
    }
    for (const row of (data ?? []) as BeachRow[]) {
      byId.set(row.id, row);
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

async function fetchObservationRows({
  supabase,
  beachIds,
  start,
  end,
  truthSource,
}: {
  supabase: SupabaseClient;
  beachIds: string[];
  start: string;
  end: string;
  truthSource: TruthSource;
}): Promise<ObservationRow[]> {
  const rows: ObservationRow[] = [];

  if (truthSource === "buoy" || truthSource === "both") {
    rows.push(...(await fetchBuoyObservationRows(supabase, beachIds, start, end)));
  }

  if (truthSource === "session" || truthSource === "both") {
    rows.push(
      ...(await fetchSessionObservationRows(supabase, beachIds, start, end))
    );
  }

  return rows;
}

async function fetchFreshSnapshotRows(
  supabase: SupabaseClient,
  beachIds: string[],
  start: string,
  end: string
): Promise<FreshSnapshotRow[]> {
  return fetchFreshSnapshotRowsWithOptionalColumns(
    supabase,
    beachIds,
    start,
    end,
    {
      includeHorizonBucketColumn: true,
      includeReplayColumns: true,
    }
  );
}

async function fetchFreshSnapshotRowsWithOptionalColumns(
  supabase: SupabaseClient,
  beachIds: string[],
  start: string,
  end: string,
  columns: {
    includeHorizonBucketColumn: boolean;
    includeReplayColumns: boolean;
  }
): Promise<FreshSnapshotRow[]> {
  const rows: FreshSnapshotRow[] = [];

  for (const ids of chunks(beachIds, PAGE_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("ml_predictions_log")
        .select(freshSnapshotSelectColumns(columns))
        .eq("display_source", "face-Hs-transformer-v1")
        .gte("created_at", start)
        .lt("created_at", end)
        .in("beach_id", ids)
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        const missingOptionalColumn =
          isMissingOptionalFreshSnapshotColumnError(error);
        if (
          columns.includeHorizonBucketColumn &&
          missingOptionalColumn === "horizon-bucket"
        ) {
          return fetchFreshSnapshotRowsWithOptionalColumns(
            supabase,
            beachIds,
            start,
            end,
            {
              ...columns,
              includeHorizonBucketColumn: false,
            }
          );
        }
        if (columns.includeReplayColumns && missingOptionalColumn === "replay") {
          return fetchFreshSnapshotRowsWithOptionalColumns(
            supabase,
            beachIds,
            start,
            end,
            {
              ...columns,
              includeReplayColumns: false,
            }
          );
        }
        throw new Error(`Fresh snapshot lookup failed: ${error.message}`);
      }

      const page = (data ?? []) as unknown as Array<{
        beach_id: string;
        forecast_horizon_hours: number | null;
        forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
        display_wave_source?: string | null;
        display_raw_input_height_m?: number | null;
      }>;
      rows.push(
        ...page.map((row) => ({
          beach_id: row.beach_id,
          forecast_horizon_hours: row.forecast_horizon_hours,
          forecast_horizon_bucket: row.forecast_horizon_bucket ?? null,
          has_horizon_bucket_provenance:
            columns.includeHorizonBucketColumn &&
            isForecastAccuracyHorizonBucket(row.forecast_horizon_bucket),
          has_replay_provenance: hasValidReplayProvenance(row),
        }))
      );

      if (page.length < PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

function freshSnapshotSelectColumns({
  includeHorizonBucketColumn,
  includeReplayColumns,
}: {
  includeHorizonBucketColumn: boolean;
  includeReplayColumns: boolean;
}): string {
  return [
    "beach_id",
    "forecast_horizon_hours",
    ...(includeHorizonBucketColumn ? ["forecast_horizon_bucket"] : []),
    ...(includeReplayColumns
      ? ["display_wave_source", "display_raw_input_height_m"]
      : []),
  ].join(",");
}

function isMissingOptionalFreshSnapshotColumnError(error: {
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

async function fetchBuoyObservationRows(
  supabase: SupabaseClient,
  beachIds: string[],
  start: string,
  end: string
): Promise<ObservationRow[]> {
  return fetchBuoyObservationRowsWithOptionalColumns(supabase, beachIds, start, end, {
    includeHorizonBucketColumn: true,
    includeReplayColumns: true,
  });
}

async function fetchBuoyObservationRowsWithOptionalColumns(
  supabase: SupabaseClient,
  beachIds: string[],
  start: string,
  end: string,
  columns: {
    includeHorizonBucketColumn: boolean;
    includeReplayColumns: boolean;
  }
): Promise<ObservationRow[]> {
  const rows: ObservationRow[] = [];
  const selectColumns = [
    "beach_id",
    "forecast_horizon_hours",
    ...(columns.includeHorizonBucketColumn ? ["forecast_horizon_bucket"] : []),
    ...(columns.includeReplayColumns
      ? ["display_wave_source", "display_raw_input_height_m"]
      : []),
  ].join(",");

  for (const ids of chunks(beachIds, PAGE_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("ml_predictions_log")
        .select(selectColumns)
        .gt("observed_m", 0)
        .eq("display_source", "face-Hs-transformer-v1")
        .gte("predicted_at", start)
        .lt("predicted_at", end)
        .in("beach_id", ids)
        .order("predicted_at", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        const missingOptionalColumn =
          isMissingOptionalFreshSnapshotColumnError(error);
        if (
          columns.includeHorizonBucketColumn &&
          missingOptionalColumn === "horizon-bucket"
        ) {
          return fetchBuoyObservationRowsWithOptionalColumns(
            supabase,
            beachIds,
            start,
            end,
            {
              ...columns,
              includeHorizonBucketColumn: false,
            }
          );
        }
        if (
          columns.includeReplayColumns &&
          missingOptionalColumn === "replay"
        ) {
          return fetchBuoyObservationRowsWithOptionalColumns(
            supabase,
            beachIds,
            start,
            end,
            {
              ...columns,
              includeReplayColumns: false,
            }
          );
        }
        throw new Error(`Buoy observation lookup failed: ${error.message}`);
      }

      const page = (data ?? []) as unknown as Array<{
        beach_id: string;
        forecast_horizon_hours: number | null;
        forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
        display_wave_source?: string | null;
        display_raw_input_height_m?: number | null;
      }>;
      rows.push(
        ...page.map((row) => ({
          beach_id: row.beach_id,
          forecast_horizon_hours: row.forecast_horizon_hours,
          forecast_horizon_bucket: row.forecast_horizon_bucket ?? null,
          source: "buoy" as const,
          has_horizon_bucket_provenance:
            columns.includeHorizonBucketColumn &&
            isForecastAccuracyHorizonBucket(row.forecast_horizon_bucket),
          has_replay_provenance: hasValidReplayProvenance(row),
        }))
      );

      if (page.length < PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

async function fetchSessionObservationRows(
  supabase: SupabaseClient,
  beachIds: string[],
  start: string,
  end: string
): Promise<ObservationRow[]> {
  const candidates: SessionObservationCandidateRow[] = [];

  for (const ids of chunks(beachIds, PAGE_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("session_wave_observation_candidates")
        .select(
          "beach_id, forecast_horizon_hours, ml_prediction_id, snapshot_display_source"
        )
        .gt("observed_m", 0)
        .neq("quality_state", "rejected")
        .not("ml_prediction_id", "is", null)
        .gte("observed_at", start)
        .lt("observed_at", end)
        .in("beach_id", ids)
        .order("observed_at", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Session observation lookup failed: ${error.message}`);
      }

      const page = (data ?? []) as SessionObservationCandidateRow[];
      candidates.push(...page);
      if (page.length < PAGE_SIZE) {
        break;
      }
    }
  }

  const predictionsById = await fetchPredictionReplayById(
    supabase,
    candidates
      .map((candidate) => candidate.ml_prediction_id)
      .filter((id): id is string => Boolean(id))
  );

  return buildSessionObservationRows(candidates, predictionsById);
}

async function fetchPredictionReplayById(
  supabase: SupabaseClient,
  predictionIds: string[]
): Promise<
  Map<string, PredictionReplayReadiness>
> {
  return fetchPredictionReplayByIdWithOptionalColumns(supabase, predictionIds, {
    includeHorizonBucketColumn: true,
    includeReplayColumns: true,
  });
}

function buildSessionObservationRows(
  candidates: SessionObservationCandidateRow[],
  predictionsById: Map<string, PredictionReplayReadiness>
): ObservationRow[] {
  return candidates.flatMap((candidate) => {
    if (
      !candidate.ml_prediction_id ||
      candidate.snapshot_display_source !== CANONICAL_DISPLAY_SOURCE
    ) {
      return [];
    }

    const prediction = predictionsById.get(candidate.ml_prediction_id);
    if (!prediction || prediction.display_source !== CANONICAL_DISPLAY_SOURCE) {
      return [];
    }

    return [
      {
        beach_id: candidate.beach_id,
        forecast_horizon_hours:
          candidate.forecast_horizon_hours ??
          prediction.forecast_horizon_hours ??
          null,
        forecast_horizon_bucket: prediction.forecast_horizon_bucket ?? null,
        source: "session",
        has_horizon_bucket_provenance:
          prediction.has_horizon_bucket_provenance,
        has_replay_provenance: prediction.has_replay_provenance,
      },
    ];
  });
}

async function fetchPredictionReplayByIdWithOptionalColumns(
  supabase: SupabaseClient,
  predictionIds: string[],
  columns: {
    includeHorizonBucketColumn: boolean;
    includeReplayColumns: boolean;
  }
): Promise<
  Map<string, PredictionReplayReadiness>
> {
  const byId = new Map<string, PredictionReplayReadiness>();
  const uniqueIds = Array.from(new Set(predictionIds.filter(Boolean)));
  const selectColumns = [
    "id",
    "display_source",
    "forecast_horizon_hours",
    ...(columns.includeHorizonBucketColumn ? ["forecast_horizon_bucket"] : []),
    ...(columns.includeReplayColumns
      ? ["display_wave_source", "display_raw_input_height_m"]
      : []),
  ].join(",");

  for (const ids of chunks(uniqueIds, PAGE_SIZE)) {
    const { data, error } = await supabase
      .from("ml_predictions_log")
      .select(selectColumns)
      .in("id", ids);

    if (error) {
      const missingOptionalColumn =
        isMissingOptionalFreshSnapshotColumnError(error);
      if (
        columns.includeHorizonBucketColumn &&
        missingOptionalColumn === "horizon-bucket"
      ) {
        return fetchPredictionReplayByIdWithOptionalColumns(
          supabase,
          predictionIds,
          {
            ...columns,
            includeHorizonBucketColumn: false,
          }
        );
      }
      if (columns.includeReplayColumns && missingOptionalColumn === "replay") {
        return fetchPredictionReplayByIdWithOptionalColumns(
          supabase,
          predictionIds,
          {
            ...columns,
            includeReplayColumns: false,
          }
        );
      }
      throw new Error(`Prediction horizon lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as unknown as PredictionHorizonRow[]) {
      byId.set(row.id, {
        forecast_horizon_hours: row.forecast_horizon_hours,
        display_source: row.display_source ?? null,
        forecast_horizon_bucket: row.forecast_horizon_bucket ?? null,
        has_horizon_bucket_provenance:
          columns.includeHorizonBucketColumn &&
          isForecastAccuracyHorizonBucket(row.forecast_horizon_bucket),
        has_replay_provenance: hasValidReplayProvenance(row),
      });
    }
  }

  return byId;
}

function buildForecastAccuracyReadinessReport({
  proposedJsonPath,
  proposedJsonSha256,
  proposedScope,
  beaches,
  observations,
  freshSnapshotRows,
  start,
  end,
  freshSnapshotStart,
  freshSnapshotEnd,
  freshSnapshotHours,
  truthSource,
  minGateSamples,
  minBeachSamples,
  generatedAt = new Date(),
}: BuildReadinessReportOptions): ForecastAccuracyReadinessReport {
  const beachIds = new Set(beaches.map((beach) => beach.id));
  const beachSlugs = new Set(beaches.flatMap((beach) => beach.slug ?? []));
  const rowsByBeachId = new Map<string, ObservationRow[]>();
  const freshRowsByBeachId = new Map<string, FreshSnapshotRow[]>();

  for (const observation of observations) {
    if (!beachIds.has(observation.beach_id)) {
      continue;
    }
    const existing = rowsByBeachId.get(observation.beach_id) ?? [];
    existing.push(observation);
    rowsByBeachId.set(observation.beach_id, existing);
  }

  for (const row of freshSnapshotRows) {
    if (!beachIds.has(row.beach_id)) {
      continue;
    }
    const existing = freshRowsByBeachId.get(row.beach_id) ?? [];
    existing.push(row);
    freshRowsByBeachId.set(row.beach_id, existing);
  }

  const beachItems = beaches
    .map((beach) =>
      buildBeachReadinessItem(
        beach,
        rowsByBeachId.get(beach.id) ?? [],
        freshRowsByBeachId.get(beach.id) ?? [],
        minBeachSamples
      )
    )
    .sort((a, b) => {
      if (a.status !== b.status) {
        return statusRank(a.status) - statusRank(b.status);
      }
      if (a.counts["0-72h"] !== b.counts["0-72h"]) {
        return a.counts["0-72h"] - b.counts["0-72h"];
      }
      return a.name.localeCompare(b.name);
    });
  const summaryCounts = sumBeachCounts(beachItems);
  const summaryHorizonBucketProvenanceCounts = sumCounts(
    beachItems.map((beach) => beach.horizon_bucket_provenance_counts)
  );
  const summaryReplayableCounts = sumBeachReplayableCounts(beachItems);
  const summaryApprovalCounts = sumCounts(
    beachItems.map((beach) => beach.approval_counts)
  );
  const summaryFreshSnapshotCounts = sumCounts(
    beachItems.map((beach) => beach.fresh_snapshot_counts)
  );
  const summaryFreshSnapshotHorizonBucketProvenanceCounts = sumCounts(
    beachItems.map((beach) => beach.fresh_snapshot_horizon_bucket_provenance_counts)
  );
  const summaryFreshSnapshotReplayableCounts = sumCounts(
    beachItems.map((beach) => beach.fresh_snapshot_replayable_counts)
  );
  const summaryFreshSnapshotApprovalCounts = sumCounts(
    beachItems.map((beach) => beach.fresh_snapshot_approval_counts)
  );
  const shortHorizonWithoutHorizonBucketProvenanceCount =
    summaryCounts.total["0-72h"] -
    summaryHorizonBucketProvenanceCounts["0-72h"];
  const shortHorizonWithoutReplayProvenanceCount =
    summaryCounts.total["0-72h"] - summaryReplayableCounts.total["0-72h"];
  const freshShortHorizonWithoutHorizonBucketProvenanceCount =
    summaryFreshSnapshotCounts["0-72h"] -
    summaryFreshSnapshotHorizonBucketProvenanceCounts["0-72h"];
  const freshShortHorizonWithoutReplayProvenanceCount =
    summaryFreshSnapshotCounts["0-72h"] -
    summaryFreshSnapshotReplayableCounts["0-72h"];
  const readyBeachCount = beachItems.filter((beach) => beach.ready).length;
  const freshSnapshotMissingBeachCount = beachItems.filter(
    (beach) => !beach.fresh_snapshot_ready
  ).length;
  const insufficientBeachCount = beachItems.filter(
    (beach) => beach.status === "insufficient"
  ).length;
  const unmeasuredBeachCount = beachItems.filter(
    (beach) => beach.status === "unmeasured"
  ).length;
  const missingProposedBeachIds = proposedScope.beachIds.filter(
    (id) => !beachIds.has(id)
  );
  const missingProposedBeachSlugs = proposedScope.beachSlugs.filter(
    (slug) => !beachSlugs.has(slug)
  );
  const gateReady = summaryApprovalCounts["0-72h"] >= minGateSamples;
  const allBeachesReady =
    beachItems.length > 0 && readyBeachCount === beachItems.length;
  const freshSnapshotReady =
    beachItems.length > 0 && freshSnapshotMissingBeachCount === 0;
  const duplicateBeachConfigIds = proposedScope.duplicateBeachConfigIds ?? [];
  const duplicateBeachConfigSlugs =
    proposedScope.duplicateBeachConfigSlugs ?? [];
  const unresolvedTopLevelConfigKeys =
    proposedScope.unresolvedTopLevelConfigKeys ?? [];
  const proposedScopeShapeReady =
    duplicateBeachConfigIds.length === 0 &&
    duplicateBeachConfigSlugs.length === 0 &&
    unresolvedTopLevelConfigKeys.length === 0;
  const readinessBlockers = buildReadinessBlockers({
    gateReady,
    allBeachesReady,
    freshSnapshotReady,
    shortHorizonWithoutHorizonBucketProvenanceCount,
    shortHorizonWithoutReplayProvenanceCount,
    freshShortHorizonWithoutHorizonBucketProvenanceCount,
    freshShortHorizonWithoutReplayProvenanceCount,
    missingProposedBeachIds,
    missingProposedBeachSlugs,
    duplicateBeachConfigIds,
    duplicateBeachConfigSlugs,
    unresolvedTopLevelConfigKeys,
    summaryApprovalCounts,
    minGateSamples,
    readyBeachCount,
    beachItems,
    freshSnapshotMissingBeachCount,
  });
  const approvalReadiness = readinessBlockers.length === 0;
  const readinessBlockerMessages = readinessBlockers.map(
    (blocker) => blocker.message
  );
  const readinessBlockerCodes = readinessBlockers.map(
    (blocker) => blocker.code
  );

  return {
    report_schema_version: FORECAST_ACCURACY_READINESS_REPORT_SCHEMA_VERSION,
    generated_at: generatedAt.toISOString(),
    range: {
      start,
      end,
    },
    truth_source: truthSource,
    proposed_json_path: proposedJsonPath,
    proposed_json_sha256: proposedJsonSha256,
    fresh_snapshot_window: {
      start: freshSnapshotStart,
      end: freshSnapshotEnd,
      hours: freshSnapshotHours,
    },
    thresholds: {
      min_gate_samples: minGateSamples,
      min_beach_samples: minBeachSamples,
    },
    scope: {
      proposed_beach_ids: proposedScope.beachIds,
      proposed_beach_slugs: proposedScope.beachSlugs,
      duplicate_proposed_beach_config_ids: duplicateBeachConfigIds,
      duplicate_proposed_beach_config_slugs:
        duplicateBeachConfigSlugs,
      unresolved_top_level_config_keys: unresolvedTopLevelConfigKeys,
      resolved_beach_count: beachItems.length,
      missing_proposed_beach_ids: missingProposedBeachIds,
      missing_proposed_beach_slugs: missingProposedBeachSlugs,
    },
    summary: {
      gate_ready: gateReady,
      all_beaches_ready: allBeachesReady,
      fresh_snapshot_ready: freshSnapshotReady,
      approval_readiness: approvalReadiness,
      readiness_blockers: readinessBlockerMessages,
      readiness_blocker_codes: readinessBlockerCodes,
      gate_0_72h_count: summaryCounts.total["0-72h"],
      gate_0_72h_horizon_bucket_provenance_count:
        summaryHorizonBucketProvenanceCounts["0-72h"],
      gate_0_72h_replayable_count: summaryReplayableCounts.total["0-72h"],
      gate_0_72h_approval_count: summaryApprovalCounts["0-72h"],
      short_horizon_without_horizon_bucket_provenance_count:
        shortHorizonWithoutHorizonBucketProvenanceCount,
      short_horizon_without_replay_provenance_count:
        shortHorizonWithoutReplayProvenanceCount,
      fresh_snapshot_0_72h_count: summaryFreshSnapshotCounts["0-72h"],
      fresh_snapshot_0_72h_horizon_bucket_provenance_count:
        summaryFreshSnapshotHorizonBucketProvenanceCounts["0-72h"],
      fresh_snapshot_0_72h_replayable_count:
        summaryFreshSnapshotReplayableCounts["0-72h"],
      fresh_snapshot_0_72h_approval_count:
        summaryFreshSnapshotApprovalCounts["0-72h"],
      fresh_short_horizon_without_horizon_bucket_provenance_count:
        freshShortHorizonWithoutHorizonBucketProvenanceCount,
      fresh_short_horizon_without_replay_provenance_count:
        freshShortHorizonWithoutReplayProvenanceCount,
      fresh_snapshot_missing_beach_count: freshSnapshotMissingBeachCount,
      ready_beach_count: readyBeachCount,
      insufficient_beach_count: insufficientBeachCount,
      unmeasured_beach_count: unmeasuredBeachCount,
      counts: summaryCounts,
      horizon_bucket_provenance_counts:
        summaryHorizonBucketProvenanceCounts,
      replayable_counts: summaryReplayableCounts,
      approval_counts: summaryApprovalCounts,
    },
    beaches: beachItems,
  };
}

function buildReadinessBlockers({
  gateReady,
  allBeachesReady,
  freshSnapshotReady,
  shortHorizonWithoutHorizonBucketProvenanceCount,
  shortHorizonWithoutReplayProvenanceCount,
  freshShortHorizonWithoutHorizonBucketProvenanceCount,
  freshShortHorizonWithoutReplayProvenanceCount,
  missingProposedBeachIds,
  missingProposedBeachSlugs,
  duplicateBeachConfigIds,
  duplicateBeachConfigSlugs,
  unresolvedTopLevelConfigKeys,
  summaryApprovalCounts,
  minGateSamples,
  readyBeachCount,
  beachItems,
  freshSnapshotMissingBeachCount,
}: {
  gateReady: boolean;
  allBeachesReady: boolean;
  freshSnapshotReady: boolean;
  shortHorizonWithoutHorizonBucketProvenanceCount: number;
  shortHorizonWithoutReplayProvenanceCount: number;
  freshShortHorizonWithoutHorizonBucketProvenanceCount: number;
  freshShortHorizonWithoutReplayProvenanceCount: number;
  missingProposedBeachIds: string[];
  missingProposedBeachSlugs: string[];
  duplicateBeachConfigIds: string[];
  duplicateBeachConfigSlugs: string[];
  unresolvedTopLevelConfigKeys: string[];
  summaryApprovalCounts: HorizonCounts;
  minGateSamples: number;
  readyBeachCount: number;
  beachItems: BeachReadinessItem[];
  freshSnapshotMissingBeachCount: number;
}): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  if (!gateReady) {
    blockers.push({
      code: "gate_sample_floor",
      message: `Approval-provenanced 0-72h rows ${summaryApprovalCounts["0-72h"]} below gate floor ${minGateSamples}.`,
    });
  }
  if (beachItems.length === 0) {
    blockers.push({
      code: "no_resolved_beaches",
      message: "No proposed beaches resolved.",
    });
  } else if (!allBeachesReady) {
    blockers.push({
      code: "beach_sample_floor",
      message: `Ready beaches ${readyBeachCount} below resolved beach count ${beachItems.length}.`,
    });
  }
  if (beachItems.length > 0 && !freshSnapshotReady) {
    blockers.push({
      code: "fresh_snapshot_missing_bucket",
      message: `Fresh scoped snapshots missing required buckets for ${formatBeachCount(
        freshSnapshotMissingBeachCount
      )}.`,
    });
  }
  if (shortHorizonWithoutHorizonBucketProvenanceCount > 0) {
    blockers.push({
      code: "observed_horizon_bucket_provenance_missing",
      message: `Observed 0-72h rows missing stored horizon-bucket provenance: ${shortHorizonWithoutHorizonBucketProvenanceCount}.`,
    });
  }
  if (shortHorizonWithoutReplayProvenanceCount > 0) {
    blockers.push({
      code: "observed_replay_provenance_missing",
      message: `Observed 0-72h rows missing display-replay provenance: ${shortHorizonWithoutReplayProvenanceCount}.`,
    });
  }
  if (freshShortHorizonWithoutHorizonBucketProvenanceCount > 0) {
    blockers.push({
      code: "fresh_horizon_bucket_provenance_missing",
      message: `Fresh 0-72h snapshot rows missing stored horizon-bucket provenance: ${freshShortHorizonWithoutHorizonBucketProvenanceCount}.`,
    });
  }
  if (freshShortHorizonWithoutReplayProvenanceCount > 0) {
    blockers.push({
      code: "fresh_replay_provenance_missing",
      message: `Fresh 0-72h snapshot rows missing display-replay provenance: ${freshShortHorizonWithoutReplayProvenanceCount}.`,
    });
  }
  if (missingProposedBeachIds.length > 0) {
    blockers.push({
      code: "missing_proposed_beach_ids",
      message: `Missing proposed beach ids: ${missingProposedBeachIds.join(", ")}.`,
    });
  }
  if (missingProposedBeachSlugs.length > 0) {
    blockers.push({
      code: "missing_proposed_beach_slugs",
      message: `Missing proposed beach slugs: ${missingProposedBeachSlugs.join(", ")}.`,
    });
  }
  if (duplicateBeachConfigIds.length > 0) {
    blockers.push({
      code: "duplicate_proposed_beach_config_ids",
      message: `Duplicate proposed beach config ids: ${duplicateBeachConfigIds.join(", ")}.`,
    });
  }
  if (duplicateBeachConfigSlugs.length > 0) {
    blockers.push({
      code: "duplicate_proposed_beach_config_slugs",
      message: `Duplicate proposed beach config slugs: ${duplicateBeachConfigSlugs.join(", ")}.`,
    });
  }
  if (unresolvedTopLevelConfigKeys.length > 0) {
    blockers.push({
      code: "unresolved_top_level_config_keys",
      message: `Unresolved top-level proposed config keys: ${unresolvedTopLevelConfigKeys.join(", ")}.`,
    });
  }
  return blockers;
}

function formatBeachCount(count: number): string {
  return count === 1 ? "1 beach" : `${count} beaches`;
}

function buildBeachReadinessItem(
  beach: BeachRow,
  observations: ObservationRow[],
  freshSnapshotRows: FreshSnapshotRow[],
  minBeachSamples: number
): BeachReadinessItem {
  const sourceCounts: Record<ObservationSource, HorizonCounts> = {
    buoy: emptyCounts(),
    session: emptyCounts(),
  };
  const horizonBucketProvenanceCounts = emptyCounts();
  const replayableSourceCounts: Record<ObservationSource, HorizonCounts> = {
    buoy: emptyCounts(),
    session: emptyCounts(),
  };
  const approvalCounts = emptyCounts();
  const freshSnapshotCounts = emptyCounts();
  const freshSnapshotHorizonBucketProvenanceCounts = emptyCounts();
  const freshSnapshotReplayableCounts = emptyCounts();
  const freshSnapshotApprovalCounts = emptyCounts();

  for (const observation of observations) {
    addObservation(sourceCounts[observation.source], observation);
    if (observation.has_horizon_bucket_provenance) {
      addObservation(horizonBucketProvenanceCounts, observation);
    }
    if (observation.has_replay_provenance) {
      addObservation(replayableSourceCounts[observation.source], observation);
    }
    if (
      observation.has_horizon_bucket_provenance &&
      observation.has_replay_provenance
    ) {
      addObservation(approvalCounts, observation);
    }
  }

  for (const row of freshSnapshotRows) {
    addForecastHorizon(freshSnapshotCounts, row);
    if (row.has_horizon_bucket_provenance) {
      addForecastHorizon(freshSnapshotHorizonBucketProvenanceCounts, row);
    }
    if (row.has_replay_provenance) {
      addForecastHorizon(freshSnapshotReplayableCounts, row);
    }
    if (row.has_horizon_bucket_provenance && row.has_replay_provenance) {
      addForecastHorizon(freshSnapshotApprovalCounts, row);
    }
  }

  const counts = sumCounts([sourceCounts.buoy, sourceCounts.session]);
  const replayableCounts = sumCounts([
    replayableSourceCounts.buoy,
    replayableSourceCounts.session,
  ]);
  const shortHorizonWithoutHorizonBucketProvenance =
    counts["0-72h"] - horizonBucketProvenanceCounts["0-72h"];
  const shortHorizonWithoutReplayProvenance =
    counts["0-72h"] - replayableCounts["0-72h"];
  const freshShortHorizonWithoutHorizonBucketProvenance =
    freshSnapshotCounts["0-72h"] -
    freshSnapshotHorizonBucketProvenanceCounts["0-72h"];
  const freshShortHorizonWithoutReplayProvenance =
    freshSnapshotCounts["0-72h"] - freshSnapshotReplayableCounts["0-72h"];
  const freshSnapshotMissingBuckets: Array<"0-24h" | "25-72h"> = [];
  if (freshSnapshotApprovalCounts["0-24h"] === 0) {
    freshSnapshotMissingBuckets.push("0-24h");
  }
  if (freshSnapshotApprovalCounts["25-72h"] === 0) {
    freshSnapshotMissingBuckets.push("25-72h");
  }
  const freshSnapshotReady =
    freshSnapshotMissingBuckets.length === 0 &&
    freshShortHorizonWithoutHorizonBucketProvenance === 0 &&
    freshShortHorizonWithoutReplayProvenance === 0;
  const needed = Math.max(0, minBeachSamples - approvalCounts["0-72h"]);
  const status: BeachReadinessStatus =
    approvalCounts["0-72h"] >= minBeachSamples
      ? "ready"
      : counts["0-72h"] === 0
        ? "unmeasured"
        : "insufficient";

  return {
    ...beach,
    counts,
    source_counts: sourceCounts,
    horizon_bucket_provenance_counts: horizonBucketProvenanceCounts,
    replayable_counts: replayableCounts,
    approval_counts: approvalCounts,
    replayable_source_counts: replayableSourceCounts,
    fresh_snapshot_counts: freshSnapshotCounts,
    fresh_snapshot_horizon_bucket_provenance_counts:
      freshSnapshotHorizonBucketProvenanceCounts,
    fresh_snapshot_replayable_counts: freshSnapshotReplayableCounts,
    fresh_snapshot_approval_counts: freshSnapshotApprovalCounts,
    status,
    ready: status === "ready",
    needed_0_72h: needed,
    short_horizon_without_horizon_bucket_provenance:
      shortHorizonWithoutHorizonBucketProvenance,
    short_horizon_without_replay_provenance:
      shortHorizonWithoutReplayProvenance,
    fresh_snapshot_ready: freshSnapshotReady,
    fresh_snapshot_missing_buckets: freshSnapshotMissingBuckets,
    fresh_short_horizon_without_horizon_bucket_provenance:
      freshShortHorizonWithoutHorizonBucketProvenance,
    fresh_short_horizon_without_replay_provenance:
      freshShortHorizonWithoutReplayProvenance,
  };
}

function addObservation(counts: HorizonCounts, observation: ObservationRow): void {
  addForecastHorizon(counts, observation);
}

function addForecastHorizon(
  counts: HorizonCounts,
  row: {
    forecast_horizon_hours: number | null;
    forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
  }
): void {
  const bucket = getRowForecastHorizonBucket(row);

  counts.total++;
  if (!bucket) {
    counts.unknown++;
    return;
  }

  counts[bucket]++;
  if (bucket === "0-24h" || bucket === "25-72h") {
    counts["0-72h"]++;
  }
}

function getRowForecastHorizonBucket(row: {
  forecast_horizon_hours: number | null;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
}): ForecastAccuracyHorizonBucket | null {
  if (isForecastAccuracyHorizonBucket(row.forecast_horizon_bucket)) {
    return row.forecast_horizon_bucket;
  }

  return getForecastAccuracyHorizonBucket(row.forecast_horizon_hours);
}

function isForecastAccuracyHorizonBucket(
  value: unknown
): value is ForecastAccuracyHorizonBucket {
  return value === "0-24h" || value === "25-72h" || value === "73h+";
}

function hasValidReplayProvenance(row: {
  display_wave_source?: string | null;
  display_raw_input_height_m?: number | null;
}): boolean {
  return (
    row.display_wave_source != null &&
    WAVE_HEIGHT_SOURCE_TAG_SET.has(
      row.display_wave_source as WaveHeightSourceTag
    ) &&
    typeof row.display_raw_input_height_m === "number" &&
    Number.isFinite(row.display_raw_input_height_m) &&
    row.display_raw_input_height_m >= 0
  );
}

function sumBeachCounts(
  beaches: BeachReadinessItem[]
): Record<"total" | ObservationSource, HorizonCounts> {
  return {
    total: sumCounts(beaches.map((beach) => beach.counts)),
    buoy: sumCounts(beaches.map((beach) => beach.source_counts.buoy)),
    session: sumCounts(beaches.map((beach) => beach.source_counts.session)),
  };
}

function sumBeachReplayableCounts(
  beaches: BeachReadinessItem[]
): Record<"total" | ObservationSource, HorizonCounts> {
  return {
    total: sumCounts(beaches.map((beach) => beach.replayable_counts)),
    buoy: sumCounts(
      beaches.map((beach) => beach.replayable_source_counts.buoy)
    ),
    session: sumCounts(
      beaches.map((beach) => beach.replayable_source_counts.session)
    ),
  };
}

function sumCounts(countsList: HorizonCounts[]): HorizonCounts {
  const output = emptyCounts();
  for (const counts of countsList) {
    output["0-24h"] += counts["0-24h"];
    output["25-72h"] += counts["25-72h"];
    output["0-72h"] += counts["0-72h"];
    output["73h+"] += counts["73h+"];
    output.unknown += counts.unknown;
    output.total += counts.total;
  }
  return output;
}

function emptyCounts(): HorizonCounts {
  return {
    "0-24h": 0,
    "25-72h": 0,
    "0-72h": 0,
    "73h+": 0,
    unknown: 0,
    total: 0,
  };
}

function statusRank(status: BeachReadinessStatus): number {
  if (status === "unmeasured") return 0;
  if (status === "insufficient") return 1;
  return 2;
}

function writeForecastAccuracyReadinessReport(
  outputJsonPath: string,
  report: ForecastAccuracyReadinessReport
): string {
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`);
  return resolvedPath;
}

function validateForecastAccuracyReadinessReport(
  report: unknown,
  options: {
    expectedProposedJsonPath?: string | null;
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): ForecastAccuracyReadinessReportValidationResult {
  const blockers: string[] = [];
  if (containsSensitiveUuid(report)) {
    blockers.push("report_contains_sensitive_uuid");
  }

  if (!isRecord(report)) {
    return {
      ok: false,
      blockers: [...blockers, "report_not_object"],
    };
  }

  if (
    report.report_schema_version !==
    FORECAST_ACCURACY_READINESS_REPORT_SCHEMA_VERSION
  ) {
    blockers.push("report_schema_version_invalid");
  }
  validateUtcTimestampField(report.generated_at, "generated_at_invalid", blockers);
  validateReportFreshness(report, options, blockers);
  validateRange(report.range, blockers);
  if (
    report.truth_source !== "buoy" &&
    report.truth_source !== "session" &&
    report.truth_source !== "both"
  ) {
    blockers.push("truth_source_invalid");
  }
  if (typeof report.proposed_json_path !== "string" || !report.proposed_json_path) {
    blockers.push("proposed_json_path_invalid");
  }
  validateProposedJsonBinding(report, options, blockers);
  validateFreshSnapshotWindow(report.fresh_snapshot_window, blockers);
  validateThresholds(report.thresholds, blockers);
  validateScope(report.scope, blockers);
  validateSummary(report.summary, blockers);
  validateBeachReadinessItems(report.beaches, blockers);
  validateReadinessReportConsistency(report, blockers);

  return {
    ok: blockers.length === 0,
    blockers,
  };
}

function validateForecastAccuracyReadinessReportFile(
  inputJsonPath: string,
  options: {
    expectedProposedJsonPath?: string | null;
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): ForecastAccuracyReadinessReportValidationResult {
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

  return validateForecastAccuracyReadinessReport(parsed, options);
}

function validateProposedJsonBinding(
  report: Record<string, unknown>,
  options: {
    expectedProposedJsonPath?: string | null;
  },
  blockers: string[]
): void {
  if (
    typeof report.proposed_json_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(report.proposed_json_sha256)
  ) {
    blockers.push("proposed_json_sha256_invalid");
    return;
  }

  const expectedPath = options.expectedProposedJsonPath ?? null;
  if (!expectedPath) {
    return;
  }

  if (
    options.expectedProposedJsonPath &&
    typeof report.proposed_json_path === "string" &&
    resolve(report.proposed_json_path) !== resolve(options.expectedProposedJsonPath)
  ) {
    blockers.push("proposed_json_path_mismatch");
  }

  let actualSha256: string;
  try {
    actualSha256 = sha256File(expectedPath);
  } catch (error) {
    blockers.push(
      `proposed_json_unreadable:${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return;
  }

  if (actualSha256 !== report.proposed_json_sha256) {
    blockers.push("proposed_json_sha256_mismatch");
  }
}

function validateReportFreshness(
  report: Record<string, unknown>,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(report.generated_at)) {
    return;
  }

  const now = options.now ?? new Date();
  const generatedAtMs = Date.parse(report.generated_at);
  const ageMs = now.getTime() - generatedAtMs;
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    blockers.push("generated_at_in_future");
  }
  if (
    typeof options.maxReportAgeHours === "number" &&
    ageMs > options.maxReportAgeHours * 60 * 60 * 1000
  ) {
    blockers.push("generated_at_too_old");
  }

  const maxAgeMs =
    typeof options.maxReportAgeHours === "number"
      ? options.maxReportAgeHours * 60 * 60 * 1000
      : null;
  const range = isRecord(report.range) ? report.range : null;
  if (range && isUtcTimestamp(range.end)) {
    const rangeEndAgeMs = generatedAtMs - Date.parse(range.end);
    if (rangeEndAgeMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
      blockers.push("range_end_after_generated_at");
    }
    if (maxAgeMs !== null && rangeEndAgeMs > maxAgeMs) {
      blockers.push("range_end_too_old");
    }
  }

  const freshWindow = isRecord(report.fresh_snapshot_window)
    ? report.fresh_snapshot_window
    : null;
  if (freshWindow && isUtcTimestamp(freshWindow.end)) {
    const freshEndAgeMs = generatedAtMs - Date.parse(freshWindow.end);
    if (freshEndAgeMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
      blockers.push("fresh_snapshot_end_after_generated_at");
    }
    if (maxAgeMs !== null && freshEndAgeMs > maxAgeMs) {
      blockers.push("fresh_snapshot_end_too_old");
    }
  }
}

function validateRange(range: unknown, blockers: string[]): void {
  if (!isRecord(range)) {
    blockers.push("range_invalid");
    return;
  }
  const startValid = validateUtcTimestampField(
    range.start,
    "range_start_invalid",
    blockers
  );
  const endValid = validateUtcTimestampField(
    range.end,
    "range_end_invalid",
    blockers
  );
  const start = typeof range.start === "string" ? range.start : "";
  const end = typeof range.end === "string" ? range.end : "";
  if (startValid && endValid && Date.parse(start) >= Date.parse(end)) {
    blockers.push("range_invalid");
  }
}

function validateFreshSnapshotWindow(
  window: unknown,
  blockers: string[]
): void {
  if (!isRecord(window)) {
    blockers.push("fresh_snapshot_window_invalid");
    return;
  }
  const startValid = validateUtcTimestampField(
    window.start,
    "fresh_snapshot_window_start_invalid",
    blockers
  );
  const endValid = validateUtcTimestampField(
    window.end,
    "fresh_snapshot_window_end_invalid",
    blockers
  );
  validatePositiveIntegerField(
    window.hours,
    "fresh_snapshot_window_hours_invalid",
    blockers
  );
  const start = typeof window.start === "string" ? window.start : "";
  const end = typeof window.end === "string" ? window.end : "";
  if (startValid && endValid && Date.parse(start) >= Date.parse(end)) {
    blockers.push("fresh_snapshot_window_invalid");
  }
  if (
    startValid &&
    endValid &&
    isPositiveIntegerValue(window.hours) &&
    Math.round((Date.parse(end) - Date.parse(start)) / 3_600_000) !== window.hours
  ) {
    blockers.push("fresh_snapshot_window_hours_mismatch");
  }
}

function validateThresholds(thresholds: unknown, blockers: string[]): void {
  if (!isRecord(thresholds)) {
    blockers.push("thresholds_invalid");
    return;
  }
  validatePositiveIntegerField(
    thresholds.min_gate_samples,
    "thresholds_min_gate_samples_invalid",
    blockers
  );
  validatePositiveIntegerField(
    thresholds.min_beach_samples,
    "thresholds_min_beach_samples_invalid",
    blockers
  );
}

function validateScope(scope: unknown, blockers: string[]): void {
  if (!isRecord(scope)) {
    blockers.push("scope_invalid");
    return;
  }
  for (const field of [
    "proposed_beach_ids",
    "proposed_beach_slugs",
    "duplicate_proposed_beach_config_ids",
    "duplicate_proposed_beach_config_slugs",
    "unresolved_top_level_config_keys",
    "missing_proposed_beach_ids",
    "missing_proposed_beach_slugs",
  ] as const) {
    validateStringArray(scope[field], `scope_${field}_invalid`, blockers);
  }
  validateNonNegativeIntegerField(
    scope.resolved_beach_count,
    "scope_resolved_beach_count_invalid",
    blockers
  );
}

function validateSummary(summary: unknown, blockers: string[]): void {
  if (!isRecord(summary)) {
    blockers.push("summary_invalid");
    return;
  }
  for (const field of [
    "gate_ready",
    "all_beaches_ready",
    "fresh_snapshot_ready",
    "approval_readiness",
  ] as const) {
    if (typeof summary[field] !== "boolean") {
      blockers.push(`summary_${field}_invalid`);
    }
  }
  validateStringArray(
    summary.readiness_blockers,
    "summary_readiness_blockers_invalid",
    blockers
  );
  validateFindingCodeArray(
    summary.readiness_blocker_codes,
    "summary_readiness_blocker_codes_invalid",
    blockers
  );
  for (const field of [
    "gate_0_72h_count",
    "gate_0_72h_horizon_bucket_provenance_count",
    "gate_0_72h_replayable_count",
    "gate_0_72h_approval_count",
    "short_horizon_without_horizon_bucket_provenance_count",
    "short_horizon_without_replay_provenance_count",
    "fresh_snapshot_0_72h_count",
    "fresh_snapshot_0_72h_horizon_bucket_provenance_count",
    "fresh_snapshot_0_72h_replayable_count",
    "fresh_snapshot_0_72h_approval_count",
    "fresh_short_horizon_without_horizon_bucket_provenance_count",
    "fresh_short_horizon_without_replay_provenance_count",
    "fresh_snapshot_missing_beach_count",
    "ready_beach_count",
    "insufficient_beach_count",
    "unmeasured_beach_count",
  ] as const) {
    validateNonNegativeIntegerField(summary[field], `summary_${field}_invalid`, blockers);
  }
  validateSourceHorizonCounts(summary.counts, "summary_counts_invalid", blockers);
  validateHorizonCounts(
    summary.horizon_bucket_provenance_counts,
    "summary_horizon_bucket_provenance_counts_invalid",
    blockers
  );
  validateSourceHorizonCounts(
    summary.replayable_counts,
    "summary_replayable_counts_invalid",
    blockers
  );
  validateHorizonCounts(
    summary.approval_counts,
    "summary_approval_counts_invalid",
    blockers
  );
}

function validateBeachReadinessItems(
  beaches: unknown,
  blockers: string[]
): void {
  if (!Array.isArray(beaches)) {
    blockers.push("beaches_invalid");
    return;
  }
  for (const beach of beaches) {
    if (!isRecord(beach)) {
      blockers.push("beaches_invalid");
      return;
    }
    if (
      typeof beach.id !== "string" ||
      (beach.slug !== null && typeof beach.slug !== "string") ||
      typeof beach.name !== "string" ||
      (beach.region !== null && typeof beach.region !== "string")
    ) {
      blockers.push("beach_identity_invalid");
      return;
    }
    validateHorizonCounts(beach.counts, "beach_counts_invalid", blockers);
    validateObservationSourceHorizonCounts(
      beach.source_counts,
      "beach_source_counts_invalid",
      blockers
    );
    validateHorizonCounts(
      beach.horizon_bucket_provenance_counts,
      "beach_horizon_bucket_provenance_counts_invalid",
      blockers
    );
    validateHorizonCounts(
      beach.replayable_counts,
      "beach_replayable_counts_invalid",
      blockers
    );
    validateHorizonCounts(
      beach.approval_counts,
      "beach_approval_counts_invalid",
      blockers
    );
    validateObservationSourceHorizonCounts(
      beach.replayable_source_counts,
      "beach_replayable_source_counts_invalid",
      blockers
    );
    validateHorizonCounts(
      beach.fresh_snapshot_counts,
      "beach_fresh_snapshot_counts_invalid",
      blockers
    );
    validateHorizonCounts(
      beach.fresh_snapshot_horizon_bucket_provenance_counts,
      "beach_fresh_snapshot_horizon_bucket_provenance_counts_invalid",
      blockers
    );
    validateHorizonCounts(
      beach.fresh_snapshot_replayable_counts,
      "beach_fresh_snapshot_replayable_counts_invalid",
      blockers
    );
    validateHorizonCounts(
      beach.fresh_snapshot_approval_counts,
      "beach_fresh_snapshot_approval_counts_invalid",
      blockers
    );
    if (beach.status !== "ready" && beach.status !== "insufficient" && beach.status !== "unmeasured") {
      blockers.push("beach_status_invalid");
    }
    for (const field of ["ready", "fresh_snapshot_ready"] as const) {
      if (typeof beach[field] !== "boolean") {
        blockers.push(`beach_${field}_invalid`);
      }
    }
    for (const field of [
      "needed_0_72h",
      "short_horizon_without_horizon_bucket_provenance",
      "short_horizon_without_replay_provenance",
      "fresh_short_horizon_without_horizon_bucket_provenance",
      "fresh_short_horizon_without_replay_provenance",
    ] as const) {
      validateNonNegativeIntegerField(beach[field], `beach_${field}_invalid`, blockers);
    }
    validateFreshMissingBuckets(beach.fresh_snapshot_missing_buckets, blockers);
  }
}

function validateReadinessReportConsistency(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  if (
    !isRecord(report.summary) ||
    !isRecord(report.scope) ||
    !isRecord(report.thresholds) ||
    !Array.isArray(report.beaches) ||
    !report.beaches.every(isRecord)
  ) {
    return;
  }

  const beachItems = report.beaches as unknown as BeachReadinessItem[];
  const minGateSamples = readPositiveInteger(report.thresholds.min_gate_samples);
  const minBeachSamples = readPositiveInteger(report.thresholds.min_beach_samples);
  if (minGateSamples === null || minBeachSamples === null) {
    return;
  }

  const summaryCounts = sumBeachCounts(beachItems);
  const summaryHorizonBucketProvenanceCounts = sumCounts(
    beachItems.map((beach) => beach.horizon_bucket_provenance_counts)
  );
  const summaryReplayableCounts = sumBeachReplayableCounts(beachItems);
  const summaryApprovalCounts = sumCounts(
    beachItems.map((beach) => beach.approval_counts)
  );
  const summaryFreshSnapshotCounts = sumCounts(
    beachItems.map((beach) => beach.fresh_snapshot_counts)
  );
  const summaryFreshSnapshotHorizonBucketProvenanceCounts = sumCounts(
    beachItems.map(
      (beach) => beach.fresh_snapshot_horizon_bucket_provenance_counts
    )
  );
  const summaryFreshSnapshotReplayableCounts = sumCounts(
    beachItems.map((beach) => beach.fresh_snapshot_replayable_counts)
  );
  const summaryFreshSnapshotApprovalCounts = sumCounts(
    beachItems.map((beach) => beach.fresh_snapshot_approval_counts)
  );
  const readyBeachCount = beachItems.filter((beach) => beach.ready).length;
  const freshSnapshotMissingBeachCount = beachItems.filter(
    (beach) => !beach.fresh_snapshot_ready
  ).length;
  const insufficientBeachCount = beachItems.filter(
    (beach) => beach.status === "insufficient"
  ).length;
  const unmeasuredBeachCount = beachItems.filter(
    (beach) => beach.status === "unmeasured"
  ).length;

  if (!sourceHorizonCountsMatch(report.summary.counts, summaryCounts)) {
    blockers.push("summary_counts_mismatch");
  }
  if (
    !horizonCountsMatch(
      report.summary.horizon_bucket_provenance_counts,
      summaryHorizonBucketProvenanceCounts
    )
  ) {
    blockers.push("summary_horizon_bucket_provenance_counts_mismatch");
  }
  if (
    !sourceHorizonCountsMatch(
      report.summary.replayable_counts,
      summaryReplayableCounts
    )
  ) {
    blockers.push("summary_replayable_counts_mismatch");
  }
  if (!horizonCountsMatch(report.summary.approval_counts, summaryApprovalCounts)) {
    blockers.push("summary_approval_counts_mismatch");
  }

  const expectedSummaryValues: Array<[string, number | boolean]> = [
    ["gate_ready", summaryApprovalCounts["0-72h"] >= minGateSamples],
    [
      "all_beaches_ready",
      beachItems.length > 0 && readyBeachCount === beachItems.length,
    ],
    [
      "fresh_snapshot_ready",
      beachItems.length > 0 && freshSnapshotMissingBeachCount === 0,
    ],
    ["gate_0_72h_count", summaryCounts.total["0-72h"]],
    [
      "gate_0_72h_horizon_bucket_provenance_count",
      summaryHorizonBucketProvenanceCounts["0-72h"],
    ],
    ["gate_0_72h_replayable_count", summaryReplayableCounts.total["0-72h"]],
    ["gate_0_72h_approval_count", summaryApprovalCounts["0-72h"]],
    [
      "short_horizon_without_horizon_bucket_provenance_count",
      summaryCounts.total["0-72h"] -
        summaryHorizonBucketProvenanceCounts["0-72h"],
    ],
    [
      "short_horizon_without_replay_provenance_count",
      summaryCounts.total["0-72h"] - summaryReplayableCounts.total["0-72h"],
    ],
    ["fresh_snapshot_0_72h_count", summaryFreshSnapshotCounts["0-72h"]],
    [
      "fresh_snapshot_0_72h_horizon_bucket_provenance_count",
      summaryFreshSnapshotHorizonBucketProvenanceCounts["0-72h"],
    ],
    [
      "fresh_snapshot_0_72h_replayable_count",
      summaryFreshSnapshotReplayableCounts["0-72h"],
    ],
    [
      "fresh_snapshot_0_72h_approval_count",
      summaryFreshSnapshotApprovalCounts["0-72h"],
    ],
    [
      "fresh_short_horizon_without_horizon_bucket_provenance_count",
      summaryFreshSnapshotCounts["0-72h"] -
        summaryFreshSnapshotHorizonBucketProvenanceCounts["0-72h"],
    ],
    [
      "fresh_short_horizon_without_replay_provenance_count",
      summaryFreshSnapshotCounts["0-72h"] -
        summaryFreshSnapshotReplayableCounts["0-72h"],
    ],
    ["fresh_snapshot_missing_beach_count", freshSnapshotMissingBeachCount],
    ["ready_beach_count", readyBeachCount],
    ["insufficient_beach_count", insufficientBeachCount],
    ["unmeasured_beach_count", unmeasuredBeachCount],
  ];
  for (const [field, expected] of expectedSummaryValues) {
    if (report.summary[field] !== expected) {
      blockers.push("summary_observed_mismatch");
      break;
    }
  }

  const beachIds = new Set(beachItems.map((beach) => beach.id));
  const beachSlugs = new Set(beachItems.flatMap((beach) => beach.slug ?? []));
  const proposedBeachIds = readStringArray(report.scope.proposed_beach_ids);
  const proposedBeachSlugs = readStringArray(report.scope.proposed_beach_slugs);
  const missingProposedBeachIds =
    proposedBeachIds?.filter((id) => !beachIds.has(id)) ?? null;
  const missingProposedBeachSlugs =
    proposedBeachSlugs?.filter((slug) => !beachSlugs.has(slug)) ?? null;
  if (
    report.scope.resolved_beach_count !== beachItems.length ||
    (missingProposedBeachIds &&
      !stringArraysMatch(
        readStringArray(report.scope.missing_proposed_beach_ids),
        missingProposedBeachIds
      )) ||
    (missingProposedBeachSlugs &&
      !stringArraysMatch(
        readStringArray(report.scope.missing_proposed_beach_slugs),
        missingProposedBeachSlugs
      ))
  ) {
    blockers.push("scope_observed_mismatch");
  }

  for (const beach of beachItems) {
    const expectedReady = beach.approval_counts["0-72h"] >= minBeachSamples;
    const expectedStatus: BeachReadinessStatus = expectedReady
      ? "ready"
      : beach.counts["0-72h"] === 0
        ? "unmeasured"
        : "insufficient";
    const expectedNeeded = Math.max(
      0,
      minBeachSamples - beach.approval_counts["0-72h"]
    );
    const expectedFreshSnapshotReady =
      beach.fresh_snapshot_missing_buckets.length === 0 &&
      beach.fresh_short_horizon_without_horizon_bucket_provenance === 0 &&
      beach.fresh_short_horizon_without_replay_provenance === 0;
    if (
      beach.ready !== expectedReady ||
      beach.status !== expectedStatus ||
      beach.needed_0_72h !== expectedNeeded ||
      beach.short_horizon_without_horizon_bucket_provenance !==
        beach.counts["0-72h"] -
          beach.horizon_bucket_provenance_counts["0-72h"] ||
      beach.short_horizon_without_replay_provenance !==
        beach.counts["0-72h"] - beach.replayable_counts["0-72h"] ||
      beach.fresh_short_horizon_without_horizon_bucket_provenance !==
        beach.fresh_snapshot_counts["0-72h"] -
          beach.fresh_snapshot_horizon_bucket_provenance_counts["0-72h"] ||
      beach.fresh_short_horizon_without_replay_provenance !==
        beach.fresh_snapshot_counts["0-72h"] -
          beach.fresh_snapshot_replayable_counts["0-72h"] ||
      beach.fresh_snapshot_ready !== expectedFreshSnapshotReady
    ) {
      blockers.push("beach_observed_mismatch");
      break;
    }
  }

  const duplicateBeachConfigIds = readStringArray(
    report.scope.duplicate_proposed_beach_config_ids
  );
  const duplicateBeachConfigSlugs = readStringArray(
    report.scope.duplicate_proposed_beach_config_slugs
  );
  const unresolvedTopLevelConfigKeys = readStringArray(
    report.scope.unresolved_top_level_config_keys
  );
  if (
    !missingProposedBeachIds ||
    !missingProposedBeachSlugs ||
    !duplicateBeachConfigIds ||
    !duplicateBeachConfigSlugs ||
    !unresolvedTopLevelConfigKeys
  ) {
    return;
  }
  const expectedBlockers = buildReadinessBlockers({
    gateReady: summaryApprovalCounts["0-72h"] >= minGateSamples,
    allBeachesReady:
      beachItems.length > 0 && readyBeachCount === beachItems.length,
    freshSnapshotReady:
      beachItems.length > 0 && freshSnapshotMissingBeachCount === 0,
    shortHorizonWithoutHorizonBucketProvenanceCount:
      summaryCounts.total["0-72h"] -
      summaryHorizonBucketProvenanceCounts["0-72h"],
    shortHorizonWithoutReplayProvenanceCount:
      summaryCounts.total["0-72h"] - summaryReplayableCounts.total["0-72h"],
    freshShortHorizonWithoutHorizonBucketProvenanceCount:
      summaryFreshSnapshotCounts["0-72h"] -
      summaryFreshSnapshotHorizonBucketProvenanceCounts["0-72h"],
    freshShortHorizonWithoutReplayProvenanceCount:
      summaryFreshSnapshotCounts["0-72h"] -
      summaryFreshSnapshotReplayableCounts["0-72h"],
    missingProposedBeachIds,
    missingProposedBeachSlugs,
    duplicateBeachConfigIds,
    duplicateBeachConfigSlugs,
    unresolvedTopLevelConfigKeys,
    summaryApprovalCounts,
    minGateSamples,
    readyBeachCount,
    beachItems,
    freshSnapshotMissingBeachCount,
  });
  const expectedMessages = expectedBlockers.map((blocker) => blocker.message);
  const expectedCodes = expectedBlockers.map((blocker) => blocker.code);
  if (
    !stringArraysMatch(
      readStringArray(report.summary.readiness_blockers),
      expectedMessages
    )
  ) {
    blockers.push("summary_readiness_blockers_mismatch");
  }
  if (
    !stringArraysMatch(
      readStringArray(report.summary.readiness_blocker_codes),
      expectedCodes
    )
  ) {
    blockers.push("summary_readiness_blocker_codes_mismatch");
  }
  if (report.summary.approval_readiness !== (expectedBlockers.length === 0)) {
    blockers.push("summary_approval_readiness_mismatch");
  }
}

function printForecastAccuracyReadinessReport(
  report: ForecastAccuracyReadinessReport
): void {
  console.log("# Forecast Accuracy Readiness Report");
  console.log("");
  console.log(`- Range: ${report.range.start} to ${report.range.end}`);
  console.log(`- Truth source: ${report.truth_source}`);
  console.log(`- Proposed JSON: ${report.proposed_json_path}`);
  console.log(
    `- Resolved beaches: ${report.scope.resolved_beach_count}; missing ids: ${report.scope.missing_proposed_beach_ids.length}; missing slugs: ${report.scope.missing_proposed_beach_slugs.length}`
  );
  console.log(
    `- Proposed scope issues: ${report.scope.duplicate_proposed_beach_config_ids.length} duplicate config ids, ${report.scope.duplicate_proposed_beach_config_slugs.length} duplicate config slugs, ${report.scope.unresolved_top_level_config_keys.length} unresolved top-level config keys`
  );
  console.log(
    `- Gate approval-provenanced 0-72h rows: ${report.summary.gate_0_72h_approval_count} / ${report.thresholds.min_gate_samples} (${report.summary.gate_0_72h_count} total, ${report.summary.short_horizon_without_horizon_bucket_provenance_count} missing horizon-bucket provenance, ${report.summary.short_horizon_without_replay_provenance_count} missing replay provenance)`
  );
  console.log(
    `- Fresh scoped snapshots: ${report.summary.fresh_snapshot_0_72h_approval_count} approval-provenanced 0-72h rows in the last ${report.fresh_snapshot_window.hours}h (${report.summary.fresh_snapshot_missing_beach_count} beaches missing required buckets, ${report.summary.fresh_short_horizon_without_horizon_bucket_provenance_count} missing horizon-bucket provenance, ${report.summary.fresh_short_horizon_without_replay_provenance_count} missing replay provenance)`
  );
  console.log(
    `- Beach readiness: ${report.summary.ready_beach_count} ready, ${report.summary.insufficient_beach_count} insufficient, ${report.summary.unmeasured_beach_count} unmeasured`
  );
  console.log(
    `- Approval readiness: ${report.summary.approval_readiness ? "ready" : "not ready"}`
  );
  for (const blocker of report.summary.readiness_blockers) {
    console.log(`- ${blocker}`);
  }

  const blocked = report.beaches
    .filter((beach) => !beach.ready || !beach.fresh_snapshot_ready)
    .slice(0, 20);
  if (blocked.length === 0) {
    return;
  }

  console.log("");
  console.log("## First Blocked Beaches");
  console.log("");
  console.log("| Beach | Region | Approval 0-72h | Total 0-72h | Missing bucket | Missing replay | Fresh missing buckets | Needed | Status |");
  console.log("|-------|--------|---------------:|-----------:|---------------:|---------------:|-----------------------|-------:|--------|");
  for (const beach of blocked) {
    console.log(
      `| ${escapeMarkdownCell(beach.name)} | ${escapeMarkdownCell(beach.region ?? "")} | ${beach.approval_counts["0-72h"]} | ${beach.counts["0-72h"]} | ${beach.short_horizon_without_horizon_bucket_provenance} | ${beach.short_horizon_without_replay_provenance} | ${beach.fresh_snapshot_missing_buckets.join(", ") || "none"} | ${beach.needed_0_72h} | ${beach.status} |`
    );
  }
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function containsSensitiveUuid(value: unknown, keyPath = ""): boolean {
  if (typeof value === "string") {
    return SENSITIVE_ID_KEY_PATTERN.test(keyPath) && UUID_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveUuid(item, keyPath));
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(([entryKey, entryValue]) =>
    containsSensitiveUuid(
      entryValue,
      keyPath ? `${keyPath}.${entryKey}` : entryKey
    )
  );
}

function validateUtcTimestampField(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): value is string {
  if (!isUtcTimestamp(value)) {
    blockers.push(blockerCode);
    return false;
  }
  return true;
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validatePositiveIntegerField(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isPositiveIntegerValue(value)) {
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

function isPositiveIntegerValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeIntegerValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
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

function validateFindingCodeArray(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (
    !Array.isArray(value) ||
    value.some((item) => !isReadinessBlockerCode(item))
  ) {
    blockers.push(blockerCode);
  }
}

function isReadinessBlockerCode(value: unknown): value is ReadinessBlockerCode {
  return (
    value === "gate_sample_floor" ||
    value === "no_resolved_beaches" ||
    value === "beach_sample_floor" ||
    value === "fresh_snapshot_missing_bucket" ||
    value === "observed_horizon_bucket_provenance_missing" ||
    value === "observed_replay_provenance_missing" ||
    value === "fresh_horizon_bucket_provenance_missing" ||
    value === "fresh_replay_provenance_missing" ||
    value === "missing_proposed_beach_ids" ||
    value === "missing_proposed_beach_slugs" ||
    value === "duplicate_proposed_beach_config_ids" ||
    value === "duplicate_proposed_beach_config_slugs" ||
    value === "unresolved_top_level_config_keys"
  );
}

function validateFreshMissingBuckets(
  value: unknown,
  blockers: string[]
): void {
  if (
    !Array.isArray(value) ||
    value.some((item) => item !== "0-24h" && item !== "25-72h")
  ) {
    blockers.push("beach_fresh_snapshot_missing_buckets_invalid");
  }
}

function validateHorizonCounts(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  const counts = readHorizonCounts(value);
  if (!counts) {
    blockers.push(blockerCode);
    return;
  }
  if (
    counts["0-72h"] !== counts["0-24h"] + counts["25-72h"] ||
    counts.total !==
      counts["0-24h"] + counts["25-72h"] + counts["73h+"] + counts.unknown
  ) {
    blockers.push(`${blockerCode}_mismatch`);
  }
}

function validateSourceHorizonCounts(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push(blockerCode);
    return;
  }
  validateHorizonCounts(value.total, `${blockerCode}_total`, blockers);
  validateHorizonCounts(value.buoy, `${blockerCode}_buoy`, blockers);
  validateHorizonCounts(value.session, `${blockerCode}_session`, blockers);
  const total = readHorizonCounts(value.total);
  const buoy = readHorizonCounts(value.buoy);
  const session = readHorizonCounts(value.session);
  if (total && buoy && session && !horizonCountsMatch(total, sumCounts([buoy, session]))) {
    blockers.push(`${blockerCode}_mismatch`);
  }
}

function validateObservationSourceHorizonCounts(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push(blockerCode);
    return;
  }
  validateHorizonCounts(value.buoy, `${blockerCode}_buoy`, blockers);
  validateHorizonCounts(value.session, `${blockerCode}_session`, blockers);
}

function readHorizonCounts(value: unknown): HorizonCounts | null {
  if (!isRecord(value)) {
    return null;
  }
  for (const field of [
    "0-24h",
    "25-72h",
    "0-72h",
    "73h+",
    "unknown",
    "total",
  ] as const) {
    if (!isNonNegativeIntegerValue(value[field])) {
      return null;
    }
  }
  return value as unknown as HorizonCounts;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return value;
}

function readPositiveInteger(value: unknown): number | null {
  return isPositiveIntegerValue(value) ? value : null;
}

function horizonCountsMatch(
  left: unknown,
  right: HorizonCounts
): boolean {
  const counts = readHorizonCounts(left);
  return (
    counts !== null &&
    counts["0-24h"] === right["0-24h"] &&
    counts["25-72h"] === right["25-72h"] &&
    counts["0-72h"] === right["0-72h"] &&
    counts["73h+"] === right["73h+"] &&
    counts.unknown === right.unknown &&
    counts.total === right.total
  );
}

function sourceHorizonCountsMatch(
  left: unknown,
  right: Record<"total" | ObservationSource, HorizonCounts>
): boolean {
  return (
    isRecord(left) &&
    horizonCountsMatch(left.total, right.total) &&
    horizonCountsMatch(left.buoy, right.buoy) &&
    horizonCountsMatch(left.session, right.session)
  );
}

function stringArraysMatch(left: string[] | null, right: string[]): boolean {
  return (
    left !== null &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    output.push(values.slice(i, i + size));
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
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

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/forecast-accuracy-readiness-report.ts --proposed-json /tmp/proposed.json --output-json /tmp/readiness.json
  yarn tsx scripts/forecast-accuracy-readiness-report.ts --proposed-json /tmp/proposed.json --output-json /tmp/readiness.json --truth-source both --min-gate-samples 75 --min-beach-samples 25 --fresh-snapshot-hours 24 --fail-on-not-ready
  yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json /tmp/readiness.json --expect-proposed-json /tmp/proposed.json --max-report-age-hours 24`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.validateOutputJsonPath) {
    const result = validateForecastAccuracyReadinessReportFile(
      options.validateOutputJsonPath,
      {
        expectedProposedJsonPath: options.expectedProposedJsonPath,
        maxReportAgeHours: options.maxReportAgeHours,
      }
    );
    if (!result.ok) {
      throw new Error(
        `Forecast accuracy readiness JSON failed validation:\n- ${result.blockers.join(
          "\n- "
        )}`
      );
    }
    console.log(
      `Forecast accuracy readiness JSON is valid: ${options.validateOutputJsonPath}`
    );
    return;
  }

  const proposedJsonSha256 = sha256File(options.proposedJsonPath);
  const proposedInput = loadProposedInput(options.proposedJsonPath);
  const proposedScope = getProposedBeachScope(proposedInput);

  if (
    proposedScope.beachIds.length === 0 &&
    proposedScope.beachSlugs.length === 0
  ) {
    throw new Error("No beach IDs or slugs found in proposed JSON.");
  }

  const supabase = createAdminClient();
  const beaches = await fetchBeachRows(supabase, proposedScope);
  const freshSnapshotEnd = new Date();
  const freshSnapshotStart = new Date(
    freshSnapshotEnd.getTime() - options.freshSnapshotHours * 60 * 60 * 1000
  );
  const observations = await fetchObservationRows({
    supabase,
    beachIds: beaches.map((beach) => beach.id),
    start: options.start,
    end: options.end,
    truthSource: options.truthSource,
  });
  const freshSnapshotRows = await fetchFreshSnapshotRows(
    supabase,
    beaches.map((beach) => beach.id),
    freshSnapshotStart.toISOString(),
    freshSnapshotEnd.toISOString()
  );
  const report = buildForecastAccuracyReadinessReport({
    proposedJsonPath: options.proposedJsonPath,
    proposedJsonSha256,
    proposedScope,
    beaches,
    observations,
    freshSnapshotRows,
    start: options.start,
    end: options.end,
    freshSnapshotStart: freshSnapshotStart.toISOString(),
    freshSnapshotEnd: freshSnapshotEnd.toISOString(),
    freshSnapshotHours: options.freshSnapshotHours,
    truthSource: options.truthSource,
    minGateSamples: options.minGateSamples,
    minBeachSamples: options.minBeachSamples,
  });
  const outputPath = writeForecastAccuracyReadinessReport(
    options.outputJsonPath,
    report
  );

  printForecastAccuracyReadinessReport(report);
  console.log("");
  console.log(`Wrote readiness report JSON: ${outputPath}`);
  if (options.failOnNotReady && !report.summary.approval_readiness) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  buildSessionObservationRows,
  buildForecastAccuracyReadinessReport,
  freshSnapshotSelectColumns,
  getProposedBeachScope,
  hasValidReplayProvenance,
  isMissingOptionalFreshSnapshotColumnError,
  parseCliArgs,
  validateForecastAccuracyReadinessReport,
  validateForecastAccuracyReadinessReportFile,
  writeForecastAccuracyReadinessReport,
};
