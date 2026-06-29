#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const ANALOG_SHOALING_PROPOSED_SCHEMA_VERSION = 1;
const MIN_GATE_SAMPLES = 75;
const MIN_SLICE_SAMPLES = 25;
const MAX_REPORT_AGE_HOURS = 24;
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;

type ConfidenceTier = "high" | "medium" | "low";
type BreakClass =
  | "beach"
  | "point"
  | "reef"
  | "jetty"
  | "shorebreak"
  | "river"
  | "other";

interface CliOptions {
  outputJsonPath: string;
  validateOutputJsonPath: string | null;
  maxDistanceKm: number;
  minConfidence: ConfidenceTier;
  limit: number | null;
  maxArtifactAgeHours: number | null;
}

interface BeachShoalingRow {
  id: string;
  name: string;
  slug: string | null;
  region: string | null;
  state: string | null;
  lat: number | null;
  lon: number | null;
  break_type: string | null;
  shoaling_factors: unknown | null;
  swell_window_center_deg: number | null;
  deepwater_decay_factor: number | null;
}

interface ScoredDonor {
  donor: BeachShoalingRow;
  distanceKm: number;
  score: number;
  confidence: ConfidenceTier;
  breakClass: BreakClass;
  donorBreakClass: BreakClass;
  sameRegion: boolean;
  sameState: boolean;
  exposureDeltaDeg: number | null;
}

interface AnalogTransferBeach {
  id: string;
  slug: string | null;
  name: string;
  region: string | null;
  state: string | null;
  break_type: string | null;
  shoaling_factors: unknown;
  analog_transfer: {
    method: "nearest_calibrated_break_type_v1";
    approval_status: "harness_only";
    source_quality: "analog_transfer_unvalidated";
    confidence: ConfidenceTier;
    donor_beach_id: string;
    donor_beach_name: string;
    donor_slug: string | null;
    donor_region: string | null;
    donor_state: string | null;
    donor_break_type: string | null;
    distance_km: number;
    score: number;
    same_region: boolean;
    same_state: boolean;
    target_break_class: BreakClass;
    donor_break_class: BreakClass;
    exposure_delta_deg: number | null;
  };
}

interface AnalogTransferSkip {
  id: string;
  name: string;
  slug: string | null;
  region: string | null;
  state: string | null;
  break_type: string | null;
  reason: string;
}

interface AnalogShoalingProposedExport {
  artifact_schema_version: typeof ANALOG_SHOALING_PROPOSED_SCHEMA_VERSION;
  generated_at: string;
  method: "nearest_calibrated_break_type_v1";
  approval_policy: {
    status: "harness_only";
    production_write_allowed: false;
    requires_phase0_approval: true;
    required_gate: "0-72h";
    required_metric: "face_height_mae";
    required_validator: "forecast-accuracy-report-validate --approval";
    min_gate_samples: 75;
    min_slice_samples: 25;
    max_report_age_hours: 24;
  };
  filters: {
    max_distance_km: number;
    min_confidence: ConfidenceTier;
    limit: number | null;
  };
  summary: {
    active_beaches: number;
    calibrated_donors: number;
    uncalibrated_targets: number;
    proposed_count: number;
    skipped_count: number;
    confidence_counts: Record<ConfidenceTier, number>;
  };
  beaches: AnalogTransferBeach[];
  skipped: AnalogTransferSkip[];
}

interface AnalogShoalingProposedExportValidationResult {
  ok: boolean;
  findings: string[];
}

const CONFIDENCE_RANK: Record<ConfidenceTier, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function parseCliArgs(argv: string[]): CliOptions {
  let outputJsonPath = "";
  let validateOutputJsonPath: string | null = null;
  let maxDistanceKm = 100;
  let minConfidence: ConfidenceTier = "medium";
  let limit: number | null = null;
  let maxArtifactAgeHours: number | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--output-json") {
      outputJsonPath = readFlagValue(next, "--output-json");
      i++;
      continue;
    }
    if (arg.startsWith("--output-json=")) {
      outputJsonPath = readFlagValue(arg.split("=")[1], "--output-json");
      continue;
    }
    if (arg === "--validate-output-json") {
      validateOutputJsonPath = readFlagValue(next, "--validate-output-json");
      i++;
      continue;
    }
    if (arg.startsWith("--validate-output-json=")) {
      validateOutputJsonPath = readFlagValue(
        arg.split("=")[1],
        "--validate-output-json"
      );
      continue;
    }
    if (arg === "--max-distance-km") {
      maxDistanceKm = parsePositiveNumber(
        readFlagValue(next, "--max-distance-km"),
        "--max-distance-km"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--max-distance-km=")) {
      maxDistanceKm = parsePositiveNumber(
        readFlagValue(arg.split("=")[1], "--max-distance-km"),
        "--max-distance-km"
      );
      continue;
    }
    if (arg === "--min-confidence") {
      minConfidence = parseConfidence(
        readFlagValue(next, "--min-confidence")
      );
      i++;
      continue;
    }
    if (arg.startsWith("--min-confidence=")) {
      minConfidence = parseConfidence(
        readFlagValue(arg.split("=")[1], "--min-confidence")
      );
      continue;
    }
    if (arg === "--limit") {
      limit = parsePositiveInteger(
        readFlagValue(next, "--limit"),
        "--limit"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      limit = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--limit"),
        "--limit"
      );
      continue;
    }
    if (arg === "--max-artifact-age-hours") {
      maxArtifactAgeHours = parsePositiveInteger(
        readFlagValue(next, "--max-artifact-age-hours"),
        "--max-artifact-age-hours"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--max-artifact-age-hours=")) {
      maxArtifactAgeHours = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--max-artifact-age-hours"),
        "--max-artifact-age-hours"
      );
      continue;
    }
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (!outputJsonPath && !validateOutputJsonPath) {
    throw new Error("Missing --output-json");
  }

  return {
    outputJsonPath,
    validateOutputJsonPath,
    maxDistanceKm,
    minConfidence,
    limit,
    maxArtifactAgeHours,
  };
}

function parsePositiveNumber(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive number.`);
  }
  return parsed;
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
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

function parseConfidence(value: string): ConfidenceTier {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  throw new Error("--min-confidence must be high, medium, or low.");
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

async function loadBeachShoalingRows(
  supabase: SupabaseClient
): Promise<BeachShoalingRow[]> {
  const { data, error } = await supabase
    .from("beaches")
    .select(
      [
        "id",
        "name",
        "slug",
        "region",
        "state",
        "lat",
        "lon",
        "break_type",
        "shoaling_factors",
        "swell_window_center_deg",
        "deepwater_decay_factor",
      ].join(",")
    )
    .is("deleted_at", null)
    .eq("is_private", false)
    .order("name");

  if (error) {
    throw new Error(`Failed to load beaches: ${error.message}`);
  }

  return (data ?? []) as unknown as BeachShoalingRow[];
}

function buildAnalogShoalingProposedExport({
  rows,
  maxDistanceKm,
  minConfidence,
  limit,
  generatedAt = new Date(),
}: {
  rows: BeachShoalingRow[];
  maxDistanceKm: number;
  minConfidence: ConfidenceTier;
  limit: number | null;
  generatedAt?: Date;
}): AnalogShoalingProposedExport {
  const donors = rows.filter(
    (row) => hasCoordinates(row) && hasValidShoalingFactors(row.shoaling_factors)
  );
  const targets = rows.filter(
    (row) => !hasValidShoalingFactors(row.shoaling_factors)
  );
  const beaches: AnalogTransferBeach[] = [];
  const skipped: AnalogTransferSkip[] = [];

  for (const target of targets) {
    if (!hasCoordinates(target)) {
      skipped.push(buildSkip(target, "missing coordinates"));
      continue;
    }

    if (limit != null && beaches.length >= limit) {
      skipped.push(buildSkip(target, "limit reached"));
      continue;
    }

    const selected = selectBestAnalogDonor({
      target,
      donors,
      maxDistanceKm,
      minConfidence,
    });

    if (!selected) {
      skipped.push(
        buildSkip(target, "no donor met distance and confidence gates")
      );
      continue;
    }

    beaches.push(buildAnalogTransferBeach(target, selected, generatedAt));
  }

  const confidenceCounts: Record<ConfidenceTier, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const beach of beaches) {
    confidenceCounts[beach.analog_transfer.confidence]++;
  }

  return {
    artifact_schema_version: ANALOG_SHOALING_PROPOSED_SCHEMA_VERSION,
    generated_at: generatedAt.toISOString(),
    method: "nearest_calibrated_break_type_v1",
    approval_policy: {
      status: "harness_only",
      production_write_allowed: false,
      requires_phase0_approval: true,
      required_gate: "0-72h",
      required_metric: "face_height_mae",
      required_validator: "forecast-accuracy-report-validate --approval",
      min_gate_samples: MIN_GATE_SAMPLES,
      min_slice_samples: MIN_SLICE_SAMPLES,
      max_report_age_hours: MAX_REPORT_AGE_HOURS,
    },
    filters: {
      max_distance_km: maxDistanceKm,
      min_confidence: minConfidence,
      limit,
    },
    summary: {
      active_beaches: rows.length,
      calibrated_donors: donors.length,
      uncalibrated_targets: targets.length,
      proposed_count: beaches.length,
      skipped_count: skipped.length,
      confidence_counts: confidenceCounts,
    },
    beaches,
    skipped,
  };
}

function selectBestAnalogDonor({
  target,
  donors,
  maxDistanceKm,
  minConfidence,
}: {
  target: BeachShoalingRow;
  donors: BeachShoalingRow[];
  maxDistanceKm: number;
  minConfidence: ConfidenceTier;
}): ScoredDonor | null {
  const candidates = donors
    .filter((donor) => donor.id !== target.id && hasCoordinates(donor))
    .map((donor) => scoreDonor(target, donor))
    .filter(
      (candidate) =>
        candidate.distanceKm <= maxDistanceKm &&
        CONFIDENCE_RANK[candidate.confidence] >= CONFIDENCE_RANK[minConfidence]
    )
    .sort((a, b) => {
      const confidenceDelta =
        CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
      if (confidenceDelta !== 0) return confidenceDelta;
      return a.score - b.score;
    });

  return candidates[0] ?? null;
}

function scoreDonor(target: BeachShoalingRow, donor: BeachShoalingRow): ScoredDonor {
  if (!hasCoordinates(target) || !hasCoordinates(donor)) {
    throw new Error("Cannot score analog donor without coordinates.");
  }

  const distanceKm = haversineKm(target.lat, target.lon, donor.lat, donor.lon);
  const breakClass = classifyBreakType(target.break_type);
  const donorBreakClass = classifyBreakType(donor.break_type);
  const sameRegion = sameText(target.region, donor.region);
  const sameState = sameText(target.state, donor.state);
  const exposureDeltaDeg = angularDelta(
    target.swell_window_center_deg,
    donor.swell_window_center_deg
  );
  const decayDelta =
    target.deepwater_decay_factor != null && donor.deepwater_decay_factor != null
      ? Math.abs(target.deepwater_decay_factor - donor.deepwater_decay_factor)
      : 0;
  const breakPenalty = breakClass === donorBreakClass ? 0 : 80;
  const regionPenalty = sameRegion ? 0 : 25;
  const statePenalty = sameState ? 0 : 10;
  const exposurePenalty =
    exposureDeltaDeg == null ? 8 : Math.min(30, (exposureDeltaDeg / 180) * 30);
  const score = round(
    distanceKm +
      breakPenalty +
      regionPenalty +
      statePenalty +
      exposurePenalty +
      decayDelta * 20
  );
  const confidence = confidenceFor({
    distanceKm,
    breakClass,
    donorBreakClass,
    sameRegion,
    sameState,
    exposureDeltaDeg,
  });

  return {
    donor,
    distanceKm: round(distanceKm),
    score,
    confidence,
    breakClass,
    donorBreakClass,
    sameRegion,
    sameState,
    exposureDeltaDeg,
  };
}

function confidenceFor({
  distanceKm,
  breakClass,
  donorBreakClass,
  sameRegion,
  sameState,
  exposureDeltaDeg,
}: {
  distanceKm: number;
  breakClass: BreakClass;
  donorBreakClass: BreakClass;
  sameRegion: boolean;
  sameState: boolean;
  exposureDeltaDeg: number | null;
}): ConfidenceTier {
  if (breakClass !== donorBreakClass || breakClass === "other") {
    return "low";
  }

  const exposureOk = exposureDeltaDeg == null || exposureDeltaDeg <= 45;
  if (distanceKm <= 25 && exposureOk && (sameRegion || sameState)) {
    return "high";
  }

  if (distanceKm <= 100 && exposureOk && sameState) {
    return "medium";
  }

  return "low";
}

function buildAnalogTransferBeach(
  target: BeachShoalingRow,
  selected: ScoredDonor,
  generatedAt: Date
): AnalogTransferBeach {
  return {
    id: target.id,
    slug: target.slug,
    name: target.name,
    region: target.region,
    state: target.state,
    break_type: target.break_type,
    shoaling_factors: buildAnalogShoalingFactors(
      selected.donor.shoaling_factors,
      target,
      selected,
      generatedAt
    ),
    analog_transfer: {
      method: "nearest_calibrated_break_type_v1",
      approval_status: "harness_only",
      source_quality: "analog_transfer_unvalidated",
      confidence: selected.confidence,
      donor_beach_id: selected.donor.id,
      donor_beach_name: selected.donor.name,
      donor_slug: selected.donor.slug,
      donor_region: selected.donor.region,
      donor_state: selected.donor.state,
      donor_break_type: selected.donor.break_type,
      distance_km: selected.distanceKm,
      score: selected.score,
      same_region: selected.sameRegion,
      same_state: selected.sameState,
      target_break_class: selected.breakClass,
      donor_break_class: selected.donorBreakClass,
      exposure_delta_deg: selected.exposureDeltaDeg,
    },
  };
}

function buildAnalogShoalingFactors(
  donorFactors: unknown,
  target: BeachShoalingRow,
  selected: ScoredDonor,
  generatedAt: Date
): unknown {
  if (!isRecord(donorFactors)) {
    return donorFactors;
  }

  const calibration = isRecord(donorFactors.calibration)
    ? donorFactors.calibration
    : {};
  const donorCalibrationSource =
    typeof calibration.source === "string" ? calibration.source : null;

  return {
    ...donorFactors,
    calibration: {
      ...calibration,
      source: "analog_transfer_unvalidated",
      analog_transfer: {
        method: "nearest_calibrated_break_type_v1",
        approval_status: "harness_only",
        source_quality: "analog_transfer_unvalidated",
        generated_at: generatedAt.toISOString(),
        target_beach_id: target.id,
        target_beach_name: target.name,
        donor_beach_id: selected.donor.id,
        donor_beach_name: selected.donor.name,
        donor_calibration_source: donorCalibrationSource,
        confidence: selected.confidence,
        distance_km: selected.distanceKm,
        score: selected.score,
      },
    },
  };
}

function buildSkip(target: BeachShoalingRow, reason: string): AnalogTransferSkip {
  return {
    id: target.id,
    name: target.name,
    slug: target.slug,
    region: target.region,
    state: target.state,
    break_type: target.break_type,
    reason,
  };
}

function hasCoordinates(
  row: BeachShoalingRow
): row is BeachShoalingRow & { lat: number; lon: number } {
  return (
    typeof row.lat === "number" &&
    Number.isFinite(row.lat) &&
    typeof row.lon === "number" &&
    Number.isFinite(row.lon)
  );
}

function hasValidShoalingFactors(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    value.type === "period_lookup" &&
    Array.isArray(value.buckets) &&
    value.buckets.length > 0
  );
}

function classifyBreakType(value: string | null): BreakClass {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("shorebreak")) return "shorebreak";
  if (normalized.includes("jetty")) return "jetty";
  if (normalized.includes("river")) return "river";
  if (normalized.includes("reef")) return "reef";
  if (normalized.includes("point")) return "point";
  if (normalized.includes("beach") || normalized.includes("sand")) {
    return "beach";
  }
  return "other";
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function angularDelta(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  const delta = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return round(delta);
}

function sameText(a: string | null, b: string | null): boolean {
  const normalizedA = (a ?? "").trim().toLowerCase();
  const normalizedB = (b ?? "").trim().toLowerCase();
  return normalizedA !== "" && normalizedA === normalizedB;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function writeAnalogShoalingProposedExport(
  outputJsonPath: string,
  proposedExport: AnalogShoalingProposedExport
): string {
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(proposedExport, null, 2)}\n`);
  return resolvedPath;
}

function validateAnalogShoalingProposedExportArtifact(
  proposedExport: AnalogShoalingProposedExport,
  {
    now = new Date(),
    maxArtifactAgeHours = null,
  }: {
    now?: Date;
    maxArtifactAgeHours?: number | null;
  } = {}
): AnalogShoalingProposedExportValidationResult {
  const findings: string[] = [];

  if (
    proposedExport.artifact_schema_version !==
    ANALOG_SHOALING_PROPOSED_SCHEMA_VERSION
  ) {
    findings.push(
      `Analog proposed artifact must declare artifact_schema_version ${ANALOG_SHOALING_PROPOSED_SCHEMA_VERSION}.`
    );
  }
  if (proposedExport.method !== "nearest_calibrated_break_type_v1") {
    findings.push(
      "Analog proposed artifact method must be nearest_calibrated_break_type_v1."
    );
  }

  validateGeneratedAt(
    proposedExport.generated_at,
    now,
    maxArtifactAgeHours,
    findings
  );
  validateApprovalPolicy(proposedExport, findings);
  validateFilters(proposedExport, findings);
  validateSummaryCounts(proposedExport, findings);
  validateProposedBeachRows(proposedExport, findings);
  validateSkippedRows(proposedExport, findings);

  return {
    ok: findings.length === 0,
    findings,
  };
}

function validateGeneratedAt(
  generatedAtValue: unknown,
  now: Date,
  maxArtifactAgeHours: number | null,
  findings: string[]
): void {
  if (typeof generatedAtValue !== "string") {
    findings.push("Analog proposed artifact has missing generated_at.");
    return;
  }

  const generatedAt = new Date(generatedAtValue);
  if (Number.isNaN(generatedAt.getTime())) {
    findings.push("Analog proposed artifact has invalid generated_at.");
    return;
  }

  const ageMs = now.getTime() - generatedAt.getTime();
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    findings.push("Analog proposed artifact generated_at is in the future.");
    return;
  }

  if (
    maxArtifactAgeHours != null &&
    ageMs > maxArtifactAgeHours * 60 * 60 * 1000
  ) {
    findings.push(
      `Analog proposed artifact age ${formatHours(ageMs)}h exceeds ${maxArtifactAgeHours}h.`
    );
  }
}

function validateApprovalPolicy(
  proposedExport: AnalogShoalingProposedExport,
  findings: string[]
): void {
  const policyValue: unknown = proposedExport.approval_policy;
  if (!isRecord(policyValue)) {
    findings.push("Analog proposed artifact must include approval_policy.");
    return;
  }

  const expected = {
    status: "harness_only",
    production_write_allowed: false,
    requires_phase0_approval: true,
    required_gate: "0-72h",
    required_metric: "face_height_mae",
    required_validator: "forecast-accuracy-report-validate --approval",
    min_gate_samples: MIN_GATE_SAMPLES,
    min_slice_samples: MIN_SLICE_SAMPLES,
    max_report_age_hours: MAX_REPORT_AGE_HOURS,
  } as const;

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (policyValue[key] !== expectedValue) {
      findings.push(
        `Analog proposed artifact approval_policy.${key} must be ${String(expectedValue)}.`
      );
    }
  }
}

function validateFilters(
  proposedExport: AnalogShoalingProposedExport,
  findings: string[]
): void {
  const filters = proposedExport.filters;
  if (!isRecord(filters)) {
    findings.push("Analog proposed artifact must include filters.");
    return;
  }
  if (!isPositiveNumber(filters.max_distance_km)) {
    findings.push(
      "Analog proposed artifact filters.max_distance_km must be positive."
    );
  }
  if (!isConfidenceTier(filters.min_confidence)) {
    findings.push(
      "Analog proposed artifact filters.min_confidence must be high, medium, or low."
    );
  }
  if (
    filters.limit !== null &&
    (!Number.isInteger(filters.limit) || Number(filters.limit) <= 0)
  ) {
    findings.push(
      "Analog proposed artifact filters.limit must be null or a positive integer."
    );
  }
}

function validateSummaryCounts(
  proposedExport: AnalogShoalingProposedExport,
  findings: string[]
): void {
  const summary = proposedExport.summary;
  if (!isRecord(summary)) {
    findings.push("Analog proposed artifact must include summary.");
    return;
  }

  const beaches = Array.isArray(proposedExport.beaches)
    ? proposedExport.beaches
    : [];
  const skipped = Array.isArray(proposedExport.skipped)
    ? proposedExport.skipped
    : [];

  const integerFields = [
    "active_beaches",
    "calibrated_donors",
    "uncalibrated_targets",
    "proposed_count",
    "skipped_count",
  ] as const;
  for (const field of integerFields) {
    if (!isNonNegativeInteger(summary[field])) {
      findings.push(
        `Analog proposed artifact summary.${field} must be a nonnegative integer.`
      );
    }
  }

  if (summary.proposed_count !== beaches.length) {
    findings.push(
      "Analog proposed artifact summary.proposed_count must match beaches.length."
    );
  }
  if (summary.skipped_count !== skipped.length) {
    findings.push(
      "Analog proposed artifact summary.skipped_count must match skipped.length."
    );
  }
  if (summary.uncalibrated_targets !== beaches.length + skipped.length) {
    findings.push(
      "Analog proposed artifact summary.uncalibrated_targets must match beaches.length + skipped.length."
    );
  }
  if (
    typeof summary.active_beaches === "number" &&
    typeof summary.calibrated_donors === "number" &&
    typeof summary.uncalibrated_targets === "number" &&
    summary.active_beaches !==
      summary.calibrated_donors + summary.uncalibrated_targets
  ) {
    findings.push(
      "Analog proposed artifact summary.active_beaches must equal calibrated_donors + uncalibrated_targets."
    );
  }

  const confidenceCounts = summary.confidence_counts;
  if (!isRecord(confidenceCounts)) {
    findings.push(
      "Analog proposed artifact summary.confidence_counts must be an object."
    );
    return;
  }

  const observedConfidenceCounts: Record<ConfidenceTier, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const beach of beaches) {
    if (!isRecord(beach)) {
      continue;
    }
    const transfer = beach.analog_transfer;
    if (isRecord(transfer) && isConfidenceTier(transfer.confidence)) {
      observedConfidenceCounts[transfer.confidence]++;
    }
  }

  for (const confidence of Object.keys(CONFIDENCE_RANK) as ConfidenceTier[]) {
    if (confidenceCounts[confidence] !== observedConfidenceCounts[confidence]) {
      findings.push(
        `Analog proposed artifact summary.confidence_counts.${confidence} must match beach rows.`
      );
    }
  }
}

function validateProposedBeachRows(
  proposedExport: AnalogShoalingProposedExport,
  findings: string[]
): void {
  if (!Array.isArray(proposedExport.beaches)) {
    findings.push("Analog proposed artifact beaches must be an array.");
    return;
  }

  const ids = new Set<string>();
  for (const beach of proposedExport.beaches) {
    if (!isRecord(beach)) {
      findings.push("Analog proposed artifact beaches must contain objects.");
      continue;
    }
    const id = typeof beach.id === "string" ? beach.id : "";
    if (!id) {
      findings.push("Analog proposed beach is missing id.");
      continue;
    }
    if (ids.has(id)) {
      findings.push(`Duplicate analog proposed beach id: ${id}.`);
    }
    ids.add(id);

    if (typeof beach.name !== "string" || !beach.name.trim()) {
      findings.push(`Analog proposed beach ${id} is missing name.`);
    }
    if (!isStringOrNull(beach.slug)) {
      findings.push(`Analog proposed beach ${id} has invalid slug.`);
    }
    if (!isStringOrNull(beach.region)) {
      findings.push(`Analog proposed beach ${id} has invalid region.`);
    }
    if (!isStringOrNull(beach.state)) {
      findings.push(`Analog proposed beach ${id} has invalid state.`);
    }
    if (!isStringOrNull(beach.break_type)) {
      findings.push(`Analog proposed beach ${id} has invalid break_type.`);
    }

    validateAnalogTransfer(beach, proposedExport.generated_at, findings);
    validateAnalogShoalingFactors(beach, proposedExport.generated_at, findings);
  }
}

function validateAnalogTransfer(
  beach: Record<string, unknown>,
  generatedAt: string,
  findings: string[]
): void {
  const id = typeof beach.id === "string" ? beach.id : "unknown";
  const transfer = beach.analog_transfer;
  if (!isRecord(transfer)) {
    findings.push(`Analog proposed beach ${id} is missing analog_transfer.`);
    return;
  }

  const expected = {
    method: "nearest_calibrated_break_type_v1",
    approval_status: "harness_only",
    source_quality: "analog_transfer_unvalidated",
  } as const;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (transfer[key] !== expectedValue) {
      findings.push(
        `Analog proposed beach ${id} analog_transfer.${key} must be ${expectedValue}.`
      );
    }
  }

  if (!isConfidenceTier(transfer.confidence)) {
    findings.push(
      `Analog proposed beach ${id} analog_transfer.confidence is invalid.`
    );
  }
  if (
    typeof transfer.donor_beach_id !== "string" ||
    !transfer.donor_beach_id.trim()
  ) {
    findings.push(
      `Analog proposed beach ${id} analog_transfer.donor_beach_id is missing.`
    );
  }
  if (transfer.donor_beach_id === id) {
    findings.push(
      `Analog proposed beach ${id} analog_transfer.donor_beach_id must differ from target id.`
    );
  }
  if (
    typeof transfer.donor_beach_name !== "string" ||
    !transfer.donor_beach_name.trim()
  ) {
    findings.push(
      `Analog proposed beach ${id} analog_transfer.donor_beach_name is missing.`
    );
  }
  for (const key of [
    "donor_slug",
    "donor_region",
    "donor_state",
    "donor_break_type",
  ] as const) {
    if (!isStringOrNull(transfer[key])) {
      findings.push(`Analog proposed beach ${id} analog_transfer.${key} is invalid.`);
    }
  }
  for (const key of ["distance_km", "score"] as const) {
    if (!isNonNegativeFiniteNumber(transfer[key])) {
      findings.push(`Analog proposed beach ${id} analog_transfer.${key} is invalid.`);
    }
  }
  for (const key of ["same_region", "same_state"] as const) {
    if (typeof transfer[key] !== "boolean") {
      findings.push(`Analog proposed beach ${id} analog_transfer.${key} is invalid.`);
    }
  }
  for (const key of ["target_break_class", "donor_break_class"] as const) {
    if (!isBreakClass(transfer[key])) {
      findings.push(`Analog proposed beach ${id} analog_transfer.${key} is invalid.`);
    }
  }
  if (
    transfer.exposure_delta_deg !== null &&
    (!isNonNegativeFiniteNumber(transfer.exposure_delta_deg) ||
      Number(transfer.exposure_delta_deg) > 180)
  ) {
    findings.push(
      `Analog proposed beach ${id} analog_transfer.exposure_delta_deg is invalid.`
    );
  }

  const factors = beach.shoaling_factors;
  const calibration = isRecord(factors) ? factors.calibration : null;
  const factorTransfer = isRecord(calibration)
    ? calibration.analog_transfer
    : null;
  if (!isRecord(factorTransfer)) {
    return;
  }
  if (factorTransfer.generated_at !== generatedAt) {
    findings.push(
      `Analog proposed beach ${id} shoaling_factors calibration generated_at must match artifact generated_at.`
    );
  }
}

function validateAnalogShoalingFactors(
  beach: Record<string, unknown>,
  generatedAt: string,
  findings: string[]
): void {
  const id = typeof beach.id === "string" ? beach.id : "unknown";
  const factors = beach.shoaling_factors;
  if (!isRecord(factors)) {
    findings.push(`Analog proposed beach ${id} has non-object shoaling_factors.`);
    return;
  }
  if (factors.version !== 1) {
    findings.push(`Analog proposed beach ${id} shoaling_factors.version must be 1.`);
  }
  if (factors.type !== "period_lookup") {
    findings.push(
      `Analog proposed beach ${id} shoaling_factors.type must be period_lookup.`
    );
  }

  const buckets = factors.buckets;
  if (!Array.isArray(buckets) || buckets.length === 0) {
    findings.push(
      `Analog proposed beach ${id} shoaling_factors.buckets must be a nonempty array.`
    );
  } else {
    let previousMaxS: number | null = null;
    for (const [index, bucket] of buckets.entries()) {
      if (!isRecord(bucket)) {
        findings.push(`Analog proposed beach ${id} bucket ${index} is invalid.`);
        continue;
      }
      if (
        typeof bucket.tp_min_s !== "number" ||
        typeof bucket.tp_max_s !== "number" ||
        !Number.isFinite(bucket.tp_min_s) ||
        !Number.isFinite(bucket.tp_max_s) ||
        bucket.tp_min_s < 0 ||
        bucket.tp_max_s <= bucket.tp_min_s
      ) {
        findings.push(
          `Analog proposed beach ${id} bucket ${index} has invalid period range.`
        );
      }
      if (!isPositiveNumber(bucket.factor)) {
        findings.push(`Analog proposed beach ${id} bucket ${index} has invalid factor.`);
      }
      if (
        typeof bucket.tp_min_s === "number" &&
        typeof bucket.tp_max_s === "number" &&
        Number.isFinite(bucket.tp_min_s) &&
        Number.isFinite(bucket.tp_max_s) &&
        previousMaxS != null &&
        bucket.tp_min_s < previousMaxS
      ) {
        findings.push(
          `Analog proposed beach ${id} bucket ${index} overlaps or is out of order.`
        );
      }
      if (
        typeof bucket.tp_max_s === "number" &&
        Number.isFinite(bucket.tp_max_s)
      ) {
        previousMaxS = bucket.tp_max_s;
      }
    }
  }

  const calibration = factors.calibration;
  if (!isRecord(calibration)) {
    findings.push(`Analog proposed beach ${id} is missing calibration metadata.`);
    return;
  }
  if (calibration.source !== "analog_transfer_unvalidated") {
    findings.push(
      `Analog proposed beach ${id} calibration.source must be analog_transfer_unvalidated.`
    );
  }

  const factorTransfer = calibration.analog_transfer;
  const rowTransfer = beach.analog_transfer;
  if (!isRecord(factorTransfer)) {
    findings.push(
      `Analog proposed beach ${id} calibration.analog_transfer is missing.`
    );
    return;
  }
  if (!isRecord(rowTransfer)) {
    return;
  }

  const expected = {
    method: "nearest_calibrated_break_type_v1",
    approval_status: "harness_only",
    source_quality: "analog_transfer_unvalidated",
    generated_at: generatedAt,
    target_beach_id: id,
    donor_beach_id: rowTransfer.donor_beach_id,
    confidence: rowTransfer.confidence,
    distance_km: rowTransfer.distance_km,
    score: rowTransfer.score,
  } as const;

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (factorTransfer[key] !== expectedValue) {
      findings.push(
        `Analog proposed beach ${id} calibration.analog_transfer.${key} must match row metadata.`
      );
    }
  }
  if (
    typeof factorTransfer.target_beach_name !== "string" ||
    !factorTransfer.target_beach_name.trim()
  ) {
    findings.push(
      `Analog proposed beach ${id} calibration.analog_transfer.target_beach_name is missing.`
    );
  }
  if (
    typeof factorTransfer.donor_beach_name !== "string" ||
    !factorTransfer.donor_beach_name.trim()
  ) {
    findings.push(
      `Analog proposed beach ${id} calibration.analog_transfer.donor_beach_name is missing.`
    );
  }
  if (!isStringOrNull(factorTransfer.donor_calibration_source)) {
    findings.push(
      `Analog proposed beach ${id} calibration.analog_transfer.donor_calibration_source is invalid.`
    );
  }
}

function validateSkippedRows(
  proposedExport: AnalogShoalingProposedExport,
  findings: string[]
): void {
  if (!Array.isArray(proposedExport.skipped)) {
    findings.push("Analog proposed artifact skipped must be an array.");
    return;
  }

  const proposedIds = new Set(
    Array.isArray(proposedExport.beaches)
      ? proposedExport.beaches
          .filter((beach) => isRecord(beach) && typeof beach.id === "string")
          .map((beach) => beach.id)
      : []
  );
  const skippedIds = new Set<string>();
  for (const skipped of proposedExport.skipped) {
    if (!isRecord(skipped)) {
      findings.push("Analog proposed artifact skipped must contain objects.");
      continue;
    }
    const id = typeof skipped.id === "string" ? skipped.id : "";
    if (!id) {
      findings.push("Analog proposed skipped row is missing id.");
      continue;
    }
    if (skippedIds.has(id)) {
      findings.push(`Duplicate analog skipped beach id: ${id}.`);
    }
    skippedIds.add(id);
    if (proposedIds.has(id)) {
      findings.push(
        `Analog skipped beach id ${id} also appears in proposed beaches.`
      );
    }
    if (typeof skipped.name !== "string" || !skipped.name.trim()) {
      findings.push(`Analog skipped beach ${id} is missing name.`);
    }
    if (!isStringOrNull(skipped.slug)) {
      findings.push(`Analog skipped beach ${id} has invalid slug.`);
    }
    if (!isStringOrNull(skipped.region)) {
      findings.push(`Analog skipped beach ${id} has invalid region.`);
    }
    if (!isStringOrNull(skipped.state)) {
      findings.push(`Analog skipped beach ${id} has invalid state.`);
    }
    if (!isStringOrNull(skipped.break_type)) {
      findings.push(`Analog skipped beach ${id} has invalid break_type.`);
    }
    if (typeof skipped.reason !== "string" || !skipped.reason.trim()) {
      findings.push(`Analog skipped beach ${id} is missing reason.`);
    }
  }
}

function isConfidenceTier(value: unknown): value is ConfidenceTier {
  return value === "high" || value === "medium" || value === "low";
}

function isBreakClass(value: unknown): value is BreakClass {
  return (
    value === "beach" ||
    value === "point" ||
    value === "reef" ||
    value === "jetty" ||
    value === "shorebreak" ||
    value === "river" ||
    value === "other"
  );
}

function isStringOrNull(value: unknown): boolean {
  return typeof value === "string" || value === null;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}

function formatHours(ageMs: number): string {
  return (ageMs / (60 * 60 * 1000)).toFixed(3);
}

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/analog-shoaling-proposed-export.ts --output-json /tmp/quiver-analog-shoaling-proposed.json
  yarn tsx scripts/analog-shoaling-proposed-export.ts --validate-output-json /tmp/quiver-analog-shoaling-proposed.json --max-artifact-age-hours 24
  yarn tsx scripts/analog-shoaling-proposed-export.ts --max-distance-km 100 --min-confidence medium --output-json /tmp/quiver-analog-shoaling-proposed.json`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.validateOutputJsonPath) {
    const proposedExport = JSON.parse(
      readFileSync(resolve(options.validateOutputJsonPath), "utf8")
    ) as AnalogShoalingProposedExport;
    const result = validateAnalogShoalingProposedExportArtifact(proposedExport, {
      maxArtifactAgeHours: options.maxArtifactAgeHours,
    });
    if (!result.ok) {
      throw new Error(result.findings.join("\n"));
    }
    console.log(
      `Analog proposed artifact is valid: ${options.validateOutputJsonPath}`
    );
    return;
  }

  const supabase = createAdminClient();
  const rows = await loadBeachShoalingRows(supabase);
  const proposedExport = buildAnalogShoalingProposedExport({
    rows,
    maxDistanceKm: options.maxDistanceKm,
    minConfidence: options.minConfidence,
    limit: options.limit,
  });
  const outputPath = writeAnalogShoalingProposedExport(
    options.outputJsonPath,
    proposedExport
  );

  console.log(
    JSON.stringify(
      {
        output: outputPath,
        summary: proposedExport.summary,
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  buildAnalogShoalingProposedExport,
  classifyBreakType,
  confidenceFor,
  haversineKm,
  parseCliArgs,
  scoreDonor,
  selectBestAnalogDonor,
  validateAnalogShoalingProposedExportArtifact,
  writeAnalogShoalingProposedExport,
};
