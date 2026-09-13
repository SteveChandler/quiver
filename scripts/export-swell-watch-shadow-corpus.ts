import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const SCHEMA_VERSION = "swell-watch-shadow-corpus.v1";
const PROVIDERS = ["noaa", "open_meteo"] as const;
const DELIVERY_OUTCOMES = [
  "success",
  "retryable",
  "permanent_token",
  "auth_config",
  "rate_limit",
  "contradiction",
  "missing_partition",
] as const;
const PROHIBITED_FIELDS = new Set([
  "user_id",
  "device_id",
  "token",
  "push_token",
  "beach_id",
  "beach_mapping",
  "relationship",
  "raw_payload",
  "raw_error",
  "error",
  "salt",
  "secret",
]);
const ALLOWED_FIELDS = new Set([
  "schema_version",
  "dataset_hash",
  "window_start",
  "window_end",
  "observed_at",
  "forecast_region_id",
  "beach_pseudonym",
  "provider",
  "source_slot",
  "evaluation_id",
  "evaluation_reason",
  "issued_at",
  "issuance_reason",
  "forecast_at",
  "primary_height_ft",
  "primary_period_s",
  "primary_direction_deg",
  "secondary_height_ft",
  "secondary_period_s",
  "secondary_direction_deg",
  "seam_bucket",
  "outcome",
  "outcome_reason",
  "audience_evaluated",
  "audience_reason",
  "recipient_count",
  "projected_send_count",
  "delivery_outcome",
  "delivery_outcome_reason",
  "provenance",
]);

export type Provider = (typeof PROVIDERS)[number];
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];
export type Provenance = "retained" | "shadow" | "fixture" | "replay";

export interface CandidateCorpusRow {
  schema_version: typeof SCHEMA_VERSION;
  dataset_hash: string;
  window_start: string;
  window_end: string;
  observed_at: string;
  forecast_region_id: string;
  beach_pseudonym: string;
  provider: Provider;
  source_slot: "primary" | "secondary";
  evaluation_id: string | null;
  evaluation_reason: "available" | "immutable_evaluation_unavailable";
  issued_at: string | null;
  issuance_reason: "available" | "immutable_issuance_unavailable";
  forecast_at: string;
  primary_height_ft: number;
  primary_period_s: number;
  primary_direction_deg: number;
  secondary_height_ft: number | null;
  secondary_period_s: number | null;
  secondary_direction_deg: number | null;
  seam_bucket: "69h" | "72h" | "75h" | "outside";
  outcome: "candidate" | "regional_event" | "no_candidate" | null;
  outcome_reason: "available" | "outcome_unavailable";
  audience_evaluated: boolean | null;
  audience_reason: "available" | "audience_unavailable";
  recipient_count: number | null;
  projected_send_count: number | null;
  delivery_outcome: DeliveryOutcome | null;
  delivery_outcome_reason: "available" | "delivery_outcome_unavailable";
  provenance: Provenance;
}

export interface ManifestOptions {
  from: string;
  to: string;
  active_scope: ActiveScopeInventory;
}

export interface ActiveScopeInventory {
  inventory_id: string;
  inventory_hash: string;
  active_beach_pseudonyms: string[];
  active_region_ids: string[];
}

export interface ShadowCorpusManifest {
  schema_version: typeof SCHEMA_VERSION;
  status: "ready" | "blocked";
  corpus_hash: string;
  row_count: number;
  window_start: string;
  window_end: string;
  active_scope_inventory_id: string;
  active_scope_inventory_hash: string;
  active_region_ids: string[];
  active_beach_pseudonyms: string[];
  retained_days: number;
  active_region_count: number;
  covered_region_count: number;
  active_beach_count: number;
  covered_beach_count: number;
  distinct_evaluations_by_beach_provider: Record<string, number>;
  seam_69h_count: number;
  seam_72h_count: number;
  seam_75h_count: number;
  observed_candidates_by_region: Record<string, number>;
  observed_regional_events_by_region: Record<string, number>;
  audience_evaluated_candidate_count: number | null;
  candidate_count: number;
  recipient_count: number | null;
  projected_send_count: number | null;
  delivery_outcome_counts: Record<DeliveryOutcome, number> | null;
  unavailable_coverage: string[];
  pii_scan_passed: boolean;
  coverage: {
    fixture_rows_present: boolean;
    eligible_for_calibration: boolean;
    assertions: Record<string, boolean>;
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function corpusHash(rows: CandidateCorpusRow[]): string {
  return createHash("sha256").update(stableStringify(rows)).digest("hex");
}

function assertIsoDate(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
}

function assertFiniteNumber(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be finite`);
  }
}

function assertNonNegativeInteger(
  value: unknown,
  field: string,
): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
}

function assertTuple(
  height: unknown,
  period: unknown,
  direction: unknown,
  prefix: string,
): void {
  const values = [height, period, direction];
  const allNull = values.every((value) => value === null);
  const allFinite = values.every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );

  if (!allNull && !allFinite) {
    throw new Error(`${prefix} must be a complete tuple or all null`);
  }
}

function assertAllowedFields(row: Record<string, unknown>): void {
  for (const field of Object.keys(row)) {
    if (PROHIBITED_FIELDS.has(field)) {
      throw new Error(`unsupported field: ${field}`);
    }
    if (!ALLOWED_FIELDS.has(field)) {
      throw new Error(`unsupported field: ${field}`);
    }
  }
}

function asCorpusRow(value: unknown): CandidateCorpusRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("corpus row must be an object");
  }

  const row = value as Record<string, unknown>;
  assertAllowedFields(row);

  if (row.schema_version !== SCHEMA_VERSION) {
    throw new Error("unsupported schema version");
  }
  if (!PROVIDERS.includes(row.provider as Provider)) {
    throw new Error("unsupported provider");
  }
  if (
    !["retained", "shadow", "fixture", "replay"].includes(
      row.provenance as string,
    )
  ) {
    throw new Error("unsupported provenance");
  }
  if (row.source_slot !== "primary" && row.source_slot !== "secondary") {
    throw new Error("unsupported source_slot");
  }
  if (!["69h", "72h", "75h", "outside"].includes(row.seam_bucket as string)) {
    throw new Error("unsupported seam_bucket");
  }
  if (
    row.outcome !== null &&
    !["candidate", "regional_event", "no_candidate"].includes(
      row.outcome as string,
    )
  ) {
    throw new Error("unsupported outcome");
  }
  if (
    row.delivery_outcome !== null &&
    !DELIVERY_OUTCOMES.includes(row.delivery_outcome as DeliveryOutcome)
  ) {
    throw new Error("unsupported delivery_outcome");
  }

  for (const field of [
    "dataset_hash",
    "forecast_region_id",
    "beach_pseudonym",
  ]) {
    if (typeof row[field] !== "string" || row[field].length === 0) {
      throw new Error(`${field} must be a non-empty string`);
    }
  }
  for (const field of [
    "window_start",
    "window_end",
    "observed_at",
    "forecast_at",
  ]) {
    assertIsoDate(row[field], field);
  }
  if (
    row.evaluation_id !== null &&
    (typeof row.evaluation_id !== "string" || row.evaluation_id.length === 0)
  )
    throw new Error("evaluation_id must be a non-empty string or null");
  if (
    row.evaluation_id === null &&
    row.evaluation_reason !== "immutable_evaluation_unavailable"
  )
    throw new Error("evaluation_reason must describe unavailable identity");
  if (row.evaluation_id !== null && row.evaluation_reason !== "available")
    throw new Error("evaluation_reason must describe available identity");
  if (row.issued_at !== null) assertIsoDate(row.issued_at, "issued_at");
  if (
    row.issued_at === null &&
    row.issuance_reason !== "immutable_issuance_unavailable"
  )
    throw new Error("issuance_reason must describe unavailable identity");
  if (row.issued_at !== null && row.issuance_reason !== "available")
    throw new Error("issuance_reason must describe available identity");
  if (row.outcome === null && row.outcome_reason !== "outcome_unavailable")
    throw new Error("outcome_reason must describe unavailable outcome");
  if (row.outcome !== null && row.outcome_reason !== "available")
    throw new Error("outcome_reason must describe available outcome");
  if (
    row.audience_evaluated === null &&
    row.audience_reason !== "audience_unavailable"
  )
    throw new Error("audience_reason must describe unavailable audience");
  if (
    typeof row.audience_evaluated === "boolean" &&
    row.audience_reason !== "available"
  )
    throw new Error("audience_reason must describe available audience");
  if (
    row.audience_evaluated !== null &&
    typeof row.audience_evaluated !== "boolean"
  )
    throw new Error("audience_evaluated must be boolean or null");
  if (
    row.delivery_outcome === null &&
    row.delivery_outcome_reason !== "delivery_outcome_unavailable"
  )
    throw new Error(
      "delivery_outcome_reason must describe unavailable delivery outcome",
    );
  if (
    row.delivery_outcome !== null &&
    row.delivery_outcome_reason !== "available"
  )
    throw new Error(
      "delivery_outcome_reason must describe available delivery outcome",
    );
  for (const field of [
    "primary_height_ft",
    "primary_period_s",
    "primary_direction_deg",
  ]) {
    assertFiniteNumber(row[field], field);
  }
  assertTuple(
    row.primary_height_ft,
    row.primary_period_s,
    row.primary_direction_deg,
    "primary swell",
  );
  assertTuple(
    row.secondary_height_ft,
    row.secondary_period_s,
    row.secondary_direction_deg,
    "secondary swell",
  );
  if (row.recipient_count !== null)
    assertNonNegativeInteger(row.recipient_count, "recipient_count");
  if (row.projected_send_count !== null)
    assertNonNegativeInteger(row.projected_send_count, "projected_send_count");

  return row as unknown as CandidateCorpusRow;
}

export function sanitizeSwellWatchCorpusRows(
  input: unknown[],
): CandidateCorpusRow[] {
  const rows = input.map(asCorpusRow).sort((left, right) => {
    const leftKey = `${left.observed_at}:${left.evaluation_id}:${left.beach_pseudonym}`;
    const rightKey = `${right.observed_at}:${right.evaluation_id}:${right.beach_pseudonym}`;
    return leftKey.localeCompare(rightKey);
  });
  const recordIdentities = new Set<string>();
  const datasetHashes = new Set<string>();

  for (const row of rows) {
    const recordIdentity = [
      row.evaluation_id,
      row.forecast_at,
      row.beach_pseudonym,
      row.provider,
      row.source_slot,
    ].join(":");
    if (recordIdentities.has(recordIdentity)) {
      throw new Error("duplicate evaluation record");
    }
    recordIdentities.add(recordIdentity);
    datasetHashes.add(row.dataset_hash);
  }
  if (datasetHashes.size > 1) {
    throw new Error("corpus rows must share one dataset_hash");
  }

  return rows;
}

function countBy<T extends string>(
  values: T[],
  categories: readonly T[],
): Record<T, number> {
  return categories.reduce(
    (counts, category) => {
      counts[category] = values.filter((value) => value === category).length;
      return counts;
    },
    {} as Record<T, number>,
  );
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function buildCorpusManifest(
  input: CandidateCorpusRow[],
  options: ManifestOptions,
): ShadowCorpusManifest {
  const rows = sanitizeSwellWatchCorpusRows(input);
  if (
    !options.active_scope.inventory_id ||
    !options.active_scope.inventory_hash ||
    options.active_scope.active_beach_pseudonyms.length === 0 ||
    options.active_scope.active_region_ids.length === 0
  ) {
    throw new Error(
      "an independently declared active scope inventory is required",
    );
  }
  const windowStart = Date.parse(options.from);
  const windowEnd = Date.parse(options.to);
  if (
    Number.isNaN(windowStart) ||
    Number.isNaN(windowEnd) ||
    windowStart > windowEnd
  ) {
    throw new Error("observation window is invalid");
  }
  const observedRows = rows.filter(
    (row) => row.provenance !== "fixture" && row.provenance !== "replay",
  );
  for (const row of observedRows) {
    const observedAt = Date.parse(row.observed_at);
    if (observedAt < windowStart || observedAt > windowEnd) {
      throw new Error(
        "observed_at falls outside the declared observation window",
      );
    }
  }
  const retainedDays = new Set(
    observedRows.map((row) =>
      new Date(row.observed_at).toISOString().slice(0, 10),
    ),
  ).size;
  const activeBeaches = options.active_scope.active_beach_pseudonyms;
  const activeRegions = options.active_scope.active_region_ids;
  const observedRegions = new Set(
    observedRows.map((row) => row.forecast_region_id),
  );
  const observedBeaches = new Set(
    observedRows.map((row) => row.beach_pseudonym),
  );
  const evaluations = new Map<string, Set<string>>();
  const candidatesByRegion: Record<string, number> = {};
  const regionalEventsByRegion: Record<string, number> = {};

  for (const row of observedRows) {
    const providerKey = `${row.beach_pseudonym}:${row.provider}`;
    const ids = evaluations.get(providerKey) ?? new Set<string>();
    if (row.evaluation_id !== null) ids.add(row.evaluation_id);
    evaluations.set(providerKey, ids);
    if (row.outcome === "candidate")
      increment(candidatesByRegion, row.forecast_region_id);
    if (row.outcome === "regional_event")
      increment(regionalEventsByRegion, row.forecast_region_id);
  }

  const distinctEvaluations = Object.fromEntries(
    [...evaluations.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, ids]) => [key, ids.size]),
  );
  const deliveryCounts = rows.some((row) => row.delivery_outcome === null)
    ? null
    : countBy(
        rows.map((row) => row.delivery_outcome as DeliveryOutcome),
        DELIVERY_OUTCOMES,
      );
  const seamCounts = countBy(
    rows.map((row) => row.seam_bucket),
    ["69h", "72h", "75h", "outside"] as const,
  );
  const fixtureRowsPresent = rows.some(
    (row) => row.provenance === "fixture" || row.provenance === "replay",
  );
  const everyBeachProviderHasTwoEvaluations = activeBeaches.every((beach) =>
    PROVIDERS.every(
      (provider) => (distinctEvaluations[`${beach}:${provider}`] ?? 0) >= 2,
    ),
  );
  const everyRegionHasObservedEvents = activeRegions.every(
    (region) =>
      (candidatesByRegion[region] ?? 0) > 0 &&
      (regionalEventsByRegion[region] ?? 0) > 0,
  );
  const candidateRows = observedRows.filter(
    (row) => row.outcome === "candidate",
  );
  const candidateCount = candidateRows.length;
  const audienceEvaluatedCandidateCount = candidateRows.some(
    (row) => row.audience_evaluated === null,
  )
    ? null
    : candidateRows.filter((row) => row.audience_evaluated).length;
  const recipientCount = rows.some((row) => row.recipient_count === null)
    ? null
    : rows.reduce((total, row) => total + (row.recipient_count ?? 0), 0);
  const projectedSendCount = rows.some(
    (row) => row.projected_send_count === null,
  )
    ? null
    : rows.reduce((total, row) => total + (row.projected_send_count ?? 0), 0);
  const unavailableCoverage = [
    ...(observedRows.some((row) => row.evaluation_id === null)
      ? ["immutable evaluation identity unavailable"]
      : []),
    ...(observedRows.some((row) => row.issued_at === null)
      ? ["immutable issuance identity unavailable"]
      : []),
    ...(observedRows.some((row) => row.audience_evaluated === null)
      ? ["audience outcome unavailable"]
      : []),
    ...(rows.some((row) => row.delivery_outcome === null)
      ? ["delivery outcome unavailable"]
      : []),
    ...(rows.some((row) => row.recipient_count === null)
      ? ["recipient count unavailable"]
      : []),
    ...(rows.some((row) => row.projected_send_count === null)
      ? ["projected send count unavailable"]
      : []),
    ...(observedRows.some((row) => row.outcome === null)
      ? ["candidate or regional outcome unavailable"]
      : []),
  ];
  const assertions: Record<string, boolean> = {
    retained_days_at_least_30: retainedDays >= 30,
    all_active_regions_covered:
      observedRegions.size === activeRegions.length &&
      activeRegions.every((region) => observedRegions.has(region)),
    all_active_beaches_covered:
      observedBeaches.size === activeBeaches.length &&
      activeBeaches.every((beach) => observedBeaches.has(beach)),
    two_distinct_evaluations_per_beach_provider:
      everyBeachProviderHasTwoEvaluations,
    every_seam_bucket_observed:
      seamCounts["69h"] > 0 && seamCounts["72h"] > 0 && seamCounts["75h"] > 0,
    every_region_has_candidate_and_regional_event: everyRegionHasObservedEvents,
    audience_evaluated_candidates_match:
      audienceEvaluatedCandidateCount !== null &&
      audienceEvaluatedCandidateCount === candidateCount,
    immutable_issuance_identity_available: !observedRows.some(
      (row) => row.issued_at === null,
    ),
    immutable_evaluation_identity_available: !observedRows.some(
      (row) => row.evaluation_id === null,
    ),
    candidate_and_regional_outcomes_available: !observedRows.some(
      (row) => row.outcome === null,
    ),
    recipient_counts_available: recipientCount !== null,
    projected_send_counts_available: projectedSendCount !== null,
    no_fixture_or_replay_evidence: !fixtureRowsPresent,
  };
  const eligible = Object.values(assertions).every(Boolean);

  return {
    schema_version: SCHEMA_VERSION,
    status: eligible ? "ready" : "blocked",
    corpus_hash: corpusHash(rows),
    row_count: rows.length,
    window_start: options.from,
    window_end: options.to,
    active_scope_inventory_id: options.active_scope.inventory_id,
    active_scope_inventory_hash: options.active_scope.inventory_hash,
    active_region_ids: [...activeRegions].sort(),
    active_beach_pseudonyms: [...activeBeaches].sort(),
    retained_days: retainedDays,
    active_region_count: activeRegions.length,
    covered_region_count: observedRegions.size,
    active_beach_count: activeBeaches.length,
    covered_beach_count: observedBeaches.size,
    distinct_evaluations_by_beach_provider: distinctEvaluations,
    seam_69h_count: seamCounts["69h"],
    seam_72h_count: seamCounts["72h"],
    seam_75h_count: seamCounts["75h"],
    observed_candidates_by_region: candidatesByRegion,
    observed_regional_events_by_region: regionalEventsByRegion,
    audience_evaluated_candidate_count: audienceEvaluatedCandidateCount,
    candidate_count: candidateCount,
    recipient_count: recipientCount,
    projected_send_count: projectedSendCount,
    delivery_outcome_counts: deliveryCounts,
    unavailable_coverage: unavailableCoverage,
    pii_scan_passed: true,
    coverage: {
      fixture_rows_present: fixtureRowsPresent,
      eligible_for_calibration: eligible,
      assertions,
    },
  };
}

function requiredArgument(args: string[], name: string): string {
  const value = args[args.indexOf(name) + 1];
  if (!value || args.indexOf(name) === -1)
    throw new Error(`missing required argument ${name}`);
  return value;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = requiredArgument(args, "--mode");
  requiredArgument(args, "--from");
  requiredArgument(args, "--to");
  const out = requiredArgument(args, "--out");
  const manifestPath = requiredArgument(args, "--manifest");
  const scopePath = requiredArgument(args, "--scope");
  const inputPath = args[args.indexOf("--input") + 1];

  if (mode !== "replay-and-shadow")
    throw new Error("--mode must be replay-and-shadow");
  if (!inputPath || args.indexOf("--input") === -1) {
    throw new Error(
      "blocked: a local sanitized --input corpus is required; network and database acquisition are disabled",
    );
  }

  const rows = sanitizeSwellWatchCorpusRows(
    (await readFile(inputPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  );
  const manifest = buildCorpusManifest(rows, {
    from: requiredArgument(args, "--from"),
    to: requiredArgument(args, "--to"),
    active_scope: JSON.parse(
      await readFile(scopePath, "utf8"),
    ) as ActiveScopeInventory,
  });

  if (!manifest.coverage.eligible_for_calibration) {
    throw new Error(
      "blocked: supplied corpus does not satisfy calibration coverage",
    );
  }

  await writeFile(
    out,
    `${rows.map((row) => stableStringify(row)).join("\n")}\n`,
    "utf8",
  );
  await writeFile(manifestPath, `${stableStringify(manifest)}\n`, "utf8");
}

if (require.main === module) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
