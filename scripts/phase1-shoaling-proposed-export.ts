#!/usr/bin/env tsx
import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const DEFAULT_MIGRATION_PATH =
  "supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql";
const DEFAULT_VALIDATED_JSON_PATH =
  "../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json";
const VALIDATED_TOTAL_COUNT = 117;
const CURRENT_CALIBRATED_COUNT = 87;
const MIN_GATE_SAMPLES = 75;
const MIN_SLICE_SAMPLES = 25;
const MAX_REPORT_AGE_HOURS = 24;
const PHASE1_SHOALING_PROPOSED_SCHEMA_VERSION = 1;
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;

interface CliOptions {
  migrationPath: string;
  validatedJsonPath: string;
  outputJsonPath: string;
  validateOutputJsonPath: string | null;
  maxArtifactAgeHours: number | null;
  expectedCount: number;
}

interface ShoalingGapRow {
  id: string;
  name: string;
  slug: string;
  region: string;
  shoaling_factors: unknown;
}

interface PeriodLookupBucket {
  tp_min_s: number;
  tp_max_s: number;
  factor: number;
}

interface ValidatedSourceBucket {
  tp_min_s: number;
  tp_max_s: number;
  factor: number;
}

interface ValidatedSourceCalibration {
  method?: string;
  samples_total?: number;
  date_range?: unknown;
  reference_buoy?: string;
}

interface ValidatedSourceRow {
  beach_id: string;
  cdip_station?: string;
  buckets?: ValidatedSourceBucket[];
  calibration?: ValidatedSourceCalibration;
}

interface Phase1ShoalingProposedExport {
  artifact_schema_version: typeof PHASE1_SHOALING_PROPOSED_SCHEMA_VERSION;
  generated_at: string;
  source_migration: string;
  source_migration_sha256: string;
  source_validated_json: string;
  source_validated_json_sha256: string;
  approval_policy: {
    status: "phase0_required";
    production_write_allowed: false;
    requires_phase0_approval: true;
    required_gate: "0-72h";
    required_metric: "face_height_mae";
    required_validator: "forecast-accuracy-report-validate --approval";
    min_gate_samples: number;
    min_slice_samples: number;
    max_report_age_hours: number;
  };
  summary: {
    validated_total_count: number;
    source_validated_count: number;
    source_validated_rows_matched: number;
    current_calibrated_count: number;
    beach_count: number;
    expected_active_coverage_after_apply: number;
  };
  beaches: ShoalingGapRow[];
}

interface Phase1ShoalingProposedExportValidationResult {
  ok: boolean;
  findings: string[];
}

function parseCliArgs(argv: string[]): CliOptions {
  let migrationPath = DEFAULT_MIGRATION_PATH;
  let validatedJsonPath = DEFAULT_VALIDATED_JSON_PATH;
  let outputJsonPath = "";
  let validateOutputJsonPath: string | null = null;
  let maxArtifactAgeHours: number | null = null;
  let expectedCount = 30;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--migration") {
      migrationPath = readFlagValue(next, "--migration");
      i++;
      continue;
    }
    if (arg.startsWith("--migration=")) {
      migrationPath = readFlagValue(arg.split("=")[1], "--migration");
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
    if (arg === "--validated-json") {
      validatedJsonPath = readFlagValue(next, "--validated-json");
      i++;
      continue;
    }
    if (arg.startsWith("--validated-json=")) {
      validatedJsonPath = readFlagValue(
        arg.split("=")[1],
        "--validated-json"
      );
      continue;
    }
    if (arg === "--max-artifact-age-hours") {
      maxArtifactAgeHours = readPositiveIntegerFlag(
        next,
        "--max-artifact-age-hours"
      );
      i++;
      continue;
    }
    if (arg.startsWith("--max-artifact-age-hours=")) {
      maxArtifactAgeHours = readPositiveIntegerFlag(
        arg.split("=")[1],
        "--max-artifact-age-hours"
      );
      continue;
    }
    if (arg === "--expected-count") {
      expectedCount = readPositiveIntegerFlag(next, "--expected-count");
      i++;
      continue;
    }
    if (arg.startsWith("--expected-count=")) {
      expectedCount = readPositiveIntegerFlag(
        arg.split("=")[1],
        "--expected-count"
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
    migrationPath,
    validatedJsonPath,
    outputJsonPath,
    validateOutputJsonPath,
    maxArtifactAgeHours,
    expectedCount,
  };
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function readPositiveIntegerFlag(
  value: string | undefined,
  flagName: string
): number {
  const flagValue = readFlagValue(value, flagName);
  const parsed = Number(flagValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return parsed;
}

function extractShoalingGapRows(sql: string): ShoalingGapRow[] {
  const rowPattern =
    /\('([0-9a-f-]+)'::uuid,\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([\s\S]*?)'::jsonb\)/g;
  const rows: ShoalingGapRow[] = [];
  let match: RegExpExecArray | null = rowPattern.exec(sql);

  while (match != null) {
    rows.push({
      id: match[1],
      name: match[2],
      slug: match[3],
      region: match[4],
      shoaling_factors: JSON.parse(match[5]),
    });
    match = rowPattern.exec(sql);
  }

  return rows;
}

function validateShoalingGapRows(
  rows: ShoalingGapRow[],
  expectedCount = 30
): void {
  const findings: string[] = [];
  const ids = new Set<string>();

  if (rows.length !== expectedCount) {
    findings.push(
      `Expected ${expectedCount} Phase 1 shoaling gap rows; ` +
        `found ${rows.length}.`
    );
  }

  for (const row of rows) {
    if (ids.has(row.id)) {
      findings.push(`Duplicate beach id in Phase 1 shoaling rows: ${row.id}.`);
    }
    ids.add(row.id);

    if (!row.name.trim()) {
      findings.push(`Beach ${row.id} is missing a name.`);
    }
    if (!row.slug.trim()) {
      findings.push(`Beach ${row.id} is missing a slug.`);
    }
    if (!row.region.trim()) {
      findings.push(`Beach ${row.id} is missing a region.`);
    }

    validateShoalingFactors(row, findings);
  }

  if (findings.length > 0) {
    throw new Error(findings.join("\n"));
  }
}

function loadValidatedSourceRows(path: string): ValidatedSourceRow[] {
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Validated factors source must be an array: ${path}`);
  }
  return parsed.map((row, index) => {
    if (!isRecord(row) || typeof row.beach_id !== "string") {
      throw new Error(`Validated factors row ${index} is missing beach_id.`);
    }
    return row as unknown as ValidatedSourceRow;
  });
}

function validateShoalingGapRowsAgainstValidatedSource(
  rows: ShoalingGapRow[],
  sourceRows: ValidatedSourceRow[]
): void {
  const findings: string[] = [];
  const sourceById = new Map(
    sourceRows.map((sourceRow) => [sourceRow.beach_id, sourceRow])
  );

  for (const row of rows) {
    const sourceRow = sourceById.get(row.id);
    if (!sourceRow) {
      findings.push(`Beach ${row.id} is missing from validated factors source.`);
      continue;
    }
    validateShoalingFactorsMatchSource(row, sourceRow, findings);
  }

  if (findings.length > 0) {
    throw new Error(findings.join("\n"));
  }
}

function validateShoalingFactorsMatchSource(
  row: ShoalingGapRow,
  sourceRow: ValidatedSourceRow,
  findings: string[]
): void {
  if (!isRecord(row.shoaling_factors)) {
    findings.push(`Beach ${row.id} has non-object shoaling_factors.`);
    return;
  }
  const buckets = row.shoaling_factors.buckets;
  const sourceBuckets = sourceRow.buckets ?? [];
  if (!Array.isArray(buckets) || sourceBuckets.length !== buckets.length) {
    findings.push(`Beach ${row.id} source bucket count does not match SQL.`);
    return;
  }

  const parsedBuckets = buckets.filter(isPeriodLookupBucket);
  if (parsedBuckets.length !== buckets.length) {
    findings.push(`Beach ${row.id} has malformed period lookup buckets.`);
    return;
  }

  for (const [index, bucket] of parsedBuckets.entries()) {
    const sourceBucket = sourceBuckets[index];
    if (
      Number(sourceBucket.tp_min_s) !== bucket.tp_min_s ||
      Number(sourceBucket.tp_max_s) !== bucket.tp_max_s
    ) {
      findings.push(`Beach ${row.id} bucket ${index} range differs from source.`);
    }
    const expectedFactor = roundFactorForMigration(sourceBucket.factor);
    if (bucket.factor !== expectedFactor) {
      findings.push(
        `Beach ${row.id} bucket ${index} factor ${bucket.factor} differs ` +
          `from validated source rounded factor ${expectedFactor}.`
      );
    }
  }

  const calibration = row.shoaling_factors.calibration;
  if (!isRecord(calibration)) {
    findings.push(`Beach ${row.id} is missing calibration metadata.`);
    return;
  }

  const sourceCalibration = sourceRow.calibration ?? {};
  if (calibration.method !== sourceCalibration.method) {
    findings.push(`Beach ${row.id} calibration method differs from source.`);
  }
  if (calibration.samples !== sourceCalibration.samples_total) {
    findings.push(`Beach ${row.id} calibration samples differ from source.`);
  }
  if (calibration.date_range !== sourceDateRange(sourceCalibration.date_range)) {
    findings.push(`Beach ${row.id} calibration date range differs from source.`);
  }
  const sourceReferenceBuoy =
    sourceCalibration.reference_buoy ??
    (sourceRow.cdip_station ? `CDIP ${sourceRow.cdip_station}` : null);
  if (calibration.reference_buoy !== sourceReferenceBuoy) {
    findings.push(`Beach ${row.id} calibration reference buoy differs from source.`);
  }
}

function sourceDateRange(value: unknown): string | null {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string"
  ) {
    return `${value[0]} to ${value[1]}`;
  }
  return typeof value === "string" && value ? value : null;
}

function roundFactorForMigration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Number.NaN;
  }
  return Number(value.toFixed(2));
}

function validateShoalingFactors(row: ShoalingGapRow, findings: string[]): void {
  const factors = row.shoaling_factors;
  if (!isRecord(factors)) {
    findings.push(`Beach ${row.id} has non-object shoaling_factors.`);
    return;
  }

  if (factors.version !== 1) {
    findings.push(`Beach ${row.id} shoaling_factors.version must be 1.`);
  }
  if (factors.type !== "period_lookup") {
    findings.push(
      `Beach ${row.id} shoaling_factors.type must be period_lookup.`
    );
  }

  const buckets = factors.buckets;
  if (!Array.isArray(buckets)) {
    findings.push(`Beach ${row.id} shoaling_factors.buckets must be an array.`);
    return;
  }

  const parsedBuckets = buckets.filter(isPeriodLookupBucket);
  if (parsedBuckets.length !== buckets.length) {
    findings.push(`Beach ${row.id} has malformed period lookup buckets.`);
    return;
  }

  const expectedBuckets = [
    { tp_min_s: 0, tp_max_s: 8 },
    { tp_min_s: 8, tp_max_s: 12 },
    { tp_min_s: 12, tp_max_s: 16 },
    { tp_min_s: 16, tp_max_s: 999 },
  ];
  if (parsedBuckets.length !== expectedBuckets.length) {
    findings.push(`Beach ${row.id} must have exactly 4 period lookup buckets.`);
    return;
  }

  for (const [index, expectedBucket] of expectedBuckets.entries()) {
    const bucket = parsedBuckets[index];
    if (
      bucket.tp_min_s !== expectedBucket.tp_min_s ||
      bucket.tp_max_s !== expectedBucket.tp_max_s
    ) {
      const expectedRange =
        `${expectedBucket.tp_min_s}-${expectedBucket.tp_max_s}s`;
      findings.push(
        `Beach ${row.id} bucket ${index} must be ${expectedRange}.`
      );
    }
    if (!Number.isFinite(bucket.factor) || bucket.factor <= 0) {
      findings.push(`Beach ${row.id} bucket ${index} has invalid factor.`);
    }
  }

  const calibration = factors.calibration;
  if (!isRecord(calibration)) {
    findings.push(`Beach ${row.id} is missing calibration metadata.`);
    return;
  }
  if (calibration.method !== "surfline_lotus_vs_cdip_historical") {
    findings.push(`Beach ${row.id} has unexpected calibration method.`);
  }
  if (!isPositiveNumber(calibration.samples)) {
    findings.push(`Beach ${row.id} has invalid calibration sample count.`);
  }
  if (typeof calibration.date_range !== "string" || !calibration.date_range) {
    findings.push(`Beach ${row.id} is missing calibration date range.`);
  }
  if (
    typeof calibration.reference_buoy !== "string" ||
    !/^CDIP \d+$/.test(calibration.reference_buoy)
  ) {
    findings.push(`Beach ${row.id} has invalid calibration reference buoy.`);
  }
  if (typeof calibration.notes !== "string" || !calibration.notes) {
    findings.push(`Beach ${row.id} is missing calibration notes.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPeriodLookupBucket(value: unknown): value is PeriodLookupBucket {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.tp_min_s === "number" &&
    typeof value.tp_max_s === "number" &&
    typeof value.factor === "number"
  );
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function buildPhase1ShoalingProposedExport({
  rows,
  migrationPath,
  sourceMigrationSha256,
  validatedJsonPath,
  sourceValidatedJsonSha256,
  sourceValidatedCount,
  generatedAt = new Date(),
}: {
  rows: ShoalingGapRow[];
  migrationPath: string;
  sourceMigrationSha256: string;
  validatedJsonPath: string;
  sourceValidatedJsonSha256: string;
  sourceValidatedCount: number;
  generatedAt?: Date;
}): Phase1ShoalingProposedExport {
  return {
    artifact_schema_version: PHASE1_SHOALING_PROPOSED_SCHEMA_VERSION,
    generated_at: generatedAt.toISOString(),
    source_migration: migrationPath,
    source_migration_sha256: sourceMigrationSha256,
    source_validated_json: validatedJsonPath,
    source_validated_json_sha256: sourceValidatedJsonSha256,
    approval_policy: {
      status: "phase0_required",
      production_write_allowed: false,
      requires_phase0_approval: true,
      required_gate: "0-72h",
      required_metric: "face_height_mae",
      required_validator: "forecast-accuracy-report-validate --approval",
      min_gate_samples: MIN_GATE_SAMPLES,
      min_slice_samples: MIN_SLICE_SAMPLES,
      max_report_age_hours: MAX_REPORT_AGE_HOURS,
    },
    summary: {
      validated_total_count: VALIDATED_TOTAL_COUNT,
      source_validated_count: sourceValidatedCount,
      source_validated_rows_matched: rows.length,
      current_calibrated_count: CURRENT_CALIBRATED_COUNT,
      beach_count: rows.length,
      expected_active_coverage_after_apply:
        CURRENT_CALIBRATED_COUNT + rows.length,
    },
    beaches: rows,
  };
}

function writePhase1ShoalingProposedExport(
  outputJsonPath: string,
  proposedExport: Phase1ShoalingProposedExport
): string {
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(proposedExport, null, 2)}\n`);
  return resolvedPath;
}

function validatePhase1ShoalingProposedExportArtifact(
  proposedExport: Phase1ShoalingProposedExport,
  {
    now = new Date(),
    maxArtifactAgeHours = null,
  }: {
    now?: Date;
    maxArtifactAgeHours?: number | null;
  } = {}
): Phase1ShoalingProposedExportValidationResult {
  const findings: string[] = [];

  if (
    proposedExport.artifact_schema_version !==
    PHASE1_SHOALING_PROPOSED_SCHEMA_VERSION
  ) {
    findings.push(
      `Phase 1 proposed artifact must declare artifact_schema_version ${PHASE1_SHOALING_PROPOSED_SCHEMA_VERSION}.`
    );
  }

  validateGeneratedAt(
    proposedExport.generated_at,
    now,
    maxArtifactAgeHours,
    findings
  );
  validateApprovalPolicy(proposedExport, findings);
  validateSourceHashes(proposedExport, findings);
  validateSourceMigrationGuards(proposedExport.source_migration, findings);
  validateSummaryCounts(proposedExport, findings);

  if (!Array.isArray(proposedExport.beaches)) {
    findings.push("Phase 1 proposed artifact beaches must be an array.");
  } else {
    try {
      validateShoalingGapRows(
        proposedExport.beaches,
        proposedExport.summary?.beach_count ?? proposedExport.beaches.length
      );
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
    try {
      validateShoalingGapRowsAgainstValidatedSource(
        proposedExport.beaches,
        loadValidatedSourceRows(proposedExport.source_validated_json)
      );
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
  }

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
    findings.push("Phase 1 proposed artifact has missing generated_at.");
    return;
  }

  const generatedAt = new Date(generatedAtValue);
  if (Number.isNaN(generatedAt.getTime())) {
    findings.push("Phase 1 proposed artifact has invalid generated_at.");
    return;
  }

  const ageMs = now.getTime() - generatedAt.getTime();
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    findings.push("Phase 1 proposed artifact generated_at is in the future.");
    return;
  }

  if (
    maxArtifactAgeHours != null &&
    ageMs > maxArtifactAgeHours * 60 * 60 * 1000
  ) {
    findings.push(
      `Phase 1 proposed artifact age ${formatHours(ageMs)}h exceeds ${maxArtifactAgeHours}h.`
    );
  }
}

function validateApprovalPolicy(
  proposedExport: Phase1ShoalingProposedExport,
  findings: string[]
): void {
  const policyValue: unknown = proposedExport.approval_policy;
  if (!isRecord(policyValue)) {
    findings.push("Phase 1 proposed artifact must include approval_policy.");
    return;
  }
  const policy = policyValue;

  const expected = {
    status: "phase0_required",
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
    if (policy[key] !== expectedValue) {
      findings.push(
        `Phase 1 proposed artifact approval_policy.${key} must be ${String(expectedValue)}.`
      );
    }
  }
}

function validateSourceHashes(
  proposedExport: Phase1ShoalingProposedExport,
  findings: string[]
): void {
  validateSourceHash({
    path: proposedExport.source_migration,
    recordedHash: proposedExport.source_migration_sha256,
    label: "source_migration",
    findings,
  });
  validateSourceHash({
    path: proposedExport.source_validated_json,
    recordedHash: proposedExport.source_validated_json_sha256,
    label: "source_validated_json",
    findings,
  });
}

function validateSourceHash({
  path,
  recordedHash,
  label,
  findings,
}: {
  path: unknown;
  recordedHash: unknown;
  label: string;
  findings: string[];
}): void {
  if (typeof path !== "string" || !path) {
    findings.push(`Phase 1 proposed artifact is missing ${label}.`);
    return;
  }
  if (typeof recordedHash !== "string" || !recordedHash) {
    findings.push(`Phase 1 proposed artifact is missing ${label}_sha256.`);
    return;
  }

  let currentHash = "";
  try {
    currentHash = sha256File(path);
  } catch (error) {
    findings.push(
      `Cannot hash Phase 1 proposed artifact ${label}: ${error instanceof Error ? error.message : String(error)}.`
    );
    return;
  }

  if (currentHash !== recordedHash) {
    findings.push(
      `Phase 1 proposed artifact ${label}_sha256 ${recordedHash} does not match current ${currentHash}.`
    );
  }
}

function validateSourceMigrationGuards(
  sourceMigrationPath: unknown,
  findings: string[]
): void {
  if (typeof sourceMigrationPath !== "string" || !sourceMigrationPath) {
    return;
  }

  let sql = "";
  try {
    sql = readFileSync(resolve(sourceMigrationPath), "utf8");
  } catch (error) {
    findings.push(
      `Cannot read Phase 1 source_migration guards: ${error instanceof Error ? error.message : String(error)}.`
    );
    return;
  }

  const compactSql = sql.replace(/\s+/g, " ");
  const requiredSnippets = [
    {
      snippet: "SUPERSEDED 2026-06-20",
      finding:
        "Phase 1 source_migration must document that the old Phase 0 approval gate was superseded.",
    },
    {
      snippet: "UPDATE public.beaches AS b",
      finding:
        "Phase 1 source_migration must update public.beaches explicitly.",
    },
    {
      snippet: "SET shoaling_factors = v.shoaling_factors",
      finding:
        "Phase 1 source_migration must only write shoaling_factors from validated gap rows.",
    },
    {
      snippet: "AND b.deleted_at IS NULL AND b.shoaling_factors IS NULL;",
      finding:
        "Phase 1 source_migration must only fill active beaches with NULL shoaling_factors.",
    },
  ];

  for (const { snippet, finding } of requiredSnippets) {
    if (!compactSql.includes(snippet)) {
      findings.push(finding);
    }
  }

  if (
    !/UPDATE\s+public\.beaches\s+AS\s+b\s+SET\s+shoaling_factors\s*=\s*v\.shoaling_factors\s+FROM\s+phase1_validated_gap_factors\s+AS\s+v\s+WHERE\s+b\.id\s*=\s*v\.beach_id\s+AND\s+b\.deleted_at\s+IS\s+NULL\s+AND\s+b\.shoaling_factors\s+IS\s+NULL\s*;/i.test(
      sql
    )
  ) {
    findings.push(
      "Phase 1 source_migration must use a null-only active-beach UPDATE statement."
    );
  }
  if (/\bDELETE\b/i.test(sql) || /\bTRUNCATE\b/i.test(sql)) {
    findings.push("Phase 1 source_migration must not contain DELETE or TRUNCATE.");
  }
  if (/ALTER\s+TABLE/i.test(sql)) {
    findings.push("Phase 1 source_migration must not alter table shape.");
  }
}

function validateSummaryCounts(
  proposedExport: Phase1ShoalingProposedExport,
  findings: string[]
): void {
  const summary = proposedExport.summary;
  if (!isRecord(summary)) {
    findings.push("Phase 1 proposed artifact must include summary.");
    return;
  }

  const beachCount = Array.isArray(proposedExport.beaches)
    ? proposedExport.beaches.length
    : 0;
  if (summary.validated_total_count !== VALIDATED_TOTAL_COUNT) {
    findings.push(
      `Phase 1 proposed artifact summary.validated_total_count must be ${VALIDATED_TOTAL_COUNT}.`
    );
  }
  if (summary.current_calibrated_count !== CURRENT_CALIBRATED_COUNT) {
    findings.push(
      `Phase 1 proposed artifact summary.current_calibrated_count must be ${CURRENT_CALIBRATED_COUNT}.`
    );
  }
  if (summary.source_validated_rows_matched !== beachCount) {
    findings.push(
      "Phase 1 proposed artifact summary.source_validated_rows_matched must match beaches.length."
    );
  }
  if (summary.beach_count !== beachCount) {
    findings.push(
      "Phase 1 proposed artifact summary.beach_count must match beaches.length."
    );
  }
  if (
    summary.expected_active_coverage_after_apply !==
    CURRENT_CALIBRATED_COUNT + beachCount
  ) {
    findings.push(
      "Phase 1 proposed artifact summary.expected_active_coverage_after_apply must equal current_calibrated_count + beaches.length."
    );
  }

  try {
    const sourceRows = loadValidatedSourceRows(proposedExport.source_validated_json);
    if (summary.source_validated_count !== sourceRows.length) {
      findings.push(
        "Phase 1 proposed artifact summary.source_validated_count must match source_validated_json row count."
      );
    }
  } catch {
    // Source loading errors are reported by source hash / row validation checks.
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
}

function formatHours(ageMs: number): string {
  return (ageMs / (60 * 60 * 1000)).toFixed(3);
}

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/phase1-shoaling-proposed-export.ts \\
    --output-json /tmp/quiver-phase1-shoaling-gap-proposed.json
  yarn tsx scripts/phase1-shoaling-proposed-export.ts \\
    --validate-output-json /tmp/quiver-phase1-shoaling-gap-proposed.json \\
    --max-artifact-age-hours 24
  yarn tsx scripts/phase1-shoaling-proposed-export.ts \\
    --migration ${DEFAULT_MIGRATION_PATH} \\
    --validated-json ${DEFAULT_VALIDATED_JSON_PATH} \\
    --expected-count 30 \\
    --output-json /tmp/quiver-phase1-shoaling-gap-proposed.json`);
}

function main(): void {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.validateOutputJsonPath) {
    const proposedExport = JSON.parse(
      readFileSync(resolve(options.validateOutputJsonPath), "utf8")
    ) as Phase1ShoalingProposedExport;
    const result = validatePhase1ShoalingProposedExportArtifact(proposedExport, {
      maxArtifactAgeHours: options.maxArtifactAgeHours,
    });
    if (!result.ok) {
      throw new Error(result.findings.join("\n"));
    }
    console.log(
      `Phase 1 proposed artifact is valid: ${options.validateOutputJsonPath}`
    );
    return;
  }

  const migrationPath = resolve(options.migrationPath);
  const validatedJsonPath = resolve(options.validatedJsonPath);
  const sql = readFileSync(migrationPath, "utf8");
  const migrationSha256 = sha256File(migrationPath);
  const validatedJsonSha256 = sha256File(validatedJsonPath);
  const sourceRows = loadValidatedSourceRows(validatedJsonPath);
  const rows = extractShoalingGapRows(sql);

  if (rows.length === 0) {
    throw new Error(`No shoaling gap rows found in ${migrationPath}`);
  }
  validateShoalingGapRows(rows, options.expectedCount);
  validateShoalingGapRowsAgainstValidatedSource(rows, sourceRows);

  const proposedExport = buildPhase1ShoalingProposedExport({
    rows,
    migrationPath: options.migrationPath,
    sourceMigrationSha256: migrationSha256,
    validatedJsonPath: options.validatedJsonPath,
    sourceValidatedJsonSha256: validatedJsonSha256,
    sourceValidatedCount: sourceRows.length,
  });
  const outputPath = writePhase1ShoalingProposedExport(
    options.outputJsonPath,
    proposedExport
  );

  const exportCount = proposedExport.beaches.length;
  console.log(
    `Wrote ${exportCount} Phase 1 shoaling proposed beach config(s) ` +
      `to ${outputPath}`
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
  buildPhase1ShoalingProposedExport,
  extractShoalingGapRows,
  loadValidatedSourceRows,
  parseCliArgs,
  sha256File,
  validatePhase1ShoalingProposedExportArtifact,
  validateShoalingGapRows,
  validateShoalingGapRowsAgainstValidatedSource,
  writePhase1ShoalingProposedExport,
};
