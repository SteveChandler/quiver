/**
 * Versioned coverage, lineage, evidence, precedence, exposure, freshness and
 * tie-break policy for trusted external forecast issues (Phase 21, MFA-03).
 *
 * Pure and framework-free on purpose: no database access, no Next.js imports,
 * no DTO shaping. The engine in `trusted-forecast-adjustment.ts` is the only
 * consumer; everything here stays server-private.
 *
 * The input contract is Seaside's `_serialize_issue` output (snake_case), which
 * is also the column contract of `public.trusted_forecast_issues`. camelCase
 * mapping happens only after strict validation.
 */

export const TRUSTED_FORECAST_POLICY_VERSION = "trusted-forecast-policy-v1";

/** Matches `trusted_forecast_issues_*_hash_check` in migration 20260727231500. */
const SHA256_HEX = /^[0-9a-f]{64}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const TRUSTED_FORECAST_EVIDENCE_CLASSES = [
  "human_face_height_authority",
  "model_buoy_evidence",
  "evidence_only",
] as const;
export type TrustedForecastEvidenceClass =
  (typeof TRUSTED_FORECAST_EVIDENCE_CLASSES)[number];

export const TRUSTED_FORECAST_SCOPE_TYPES = ["spot", "regional"] as const;
export type TrustedForecastScopeType =
  (typeof TRUSTED_FORECAST_SCOPE_TYPES)[number];

export const TRUSTED_FORECAST_MEASUREMENT_BASES = [
  "breaking_face_ft",
  "unspecified",
] as const;
export type TrustedForecastMeasurementBasis =
  (typeof TRUSTED_FORECAST_MEASUREMENT_BASES)[number];

export const TRUSTED_FORECAST_DAY_PARTS = ["all_day", "day", "night"] as const;
export type TrustedForecastDayPart = (typeof TRUSTED_FORECAST_DAY_PARTS)[number];

export const TRUSTED_FORECAST_VALIDITY_BASES = [
  "stated",
  "derived_publication_day",
] as const;
export type TrustedForecastValidityBasis =
  (typeof TRUSTED_FORECAST_VALIDITY_BASES)[number];

/**
 * Exactly the 26 fields emitted by
 * `seaside/crons/fetch_trusted_forecasts.py::_serialize_issue`, in the same
 * snake_case names stored by `public.trusted_forecast_issues`.
 */
export const TRUSTED_FORECAST_ISSUE_INPUT_FIELDS = [
  "provider_lineage",
  "source_key",
  "issued_at",
  "valid_local_date",
  "valid_timezone",
  "valid_start_at",
  "valid_end_at",
  "validity_basis",
  "scope_type",
  "region_key",
  "beach_id",
  "exposure",
  "day_part",
  "measurement_basis",
  "min_face_ft",
  "max_face_ft",
  "direction_deg",
  "period_seconds",
  "parser_version",
  "source_hash",
  "issue_identity_key",
  "revision_hash",
  "supersedes_issue_id",
  "authority_eligible",
  "evidence_class",
  "ingest_run_id",
  "fetched_at",
] as const;
export type TrustedForecastIssueInputField =
  (typeof TRUSTED_FORECAST_ISSUE_INPUT_FIELDS)[number];

/** The wire/database row shape, before camelCase mapping. */
export type TrustedForecastIssueInput = {
  readonly provider_lineage: string;
  readonly source_key: string;
  readonly issued_at: string;
  readonly valid_local_date: string;
  readonly valid_timezone: string;
  readonly valid_start_at: string;
  readonly valid_end_at: string;
  readonly validity_basis: TrustedForecastValidityBasis;
  readonly scope_type: TrustedForecastScopeType;
  readonly region_key: string | null;
  readonly beach_id: string | null;
  readonly exposure: string;
  readonly day_part: TrustedForecastDayPart;
  readonly measurement_basis: TrustedForecastMeasurementBasis;
  readonly min_face_ft: number | null;
  readonly max_face_ft: number | null;
  readonly direction_deg: number | null;
  readonly period_seconds: number | null;
  readonly parser_version: string;
  readonly source_hash: string;
  readonly issue_identity_key: string;
  readonly revision_hash: string;
  readonly supersedes_issue_id: string | null;
  readonly authority_eligible: boolean;
  readonly evidence_class: TrustedForecastEvidenceClass;
  readonly ingest_run_id: string | null;
  readonly fetched_at: string;
  /** Assigned by the database on insert; absent on freshly serialized Seaside rows. */
  readonly issue_id?: string;
};

/** Validated, camelCase, server-private issue. */
export interface TrustedForecastIssue {
  readonly issueId: string | null;
  readonly providerLineage: string;
  readonly sourceKey: string;
  readonly issuedAt: Date;
  readonly validLocalDate: string;
  readonly validTimezone: string;
  readonly validStartAt: Date;
  readonly validEndAt: Date;
  readonly validityBasis: TrustedForecastValidityBasis;
  readonly scopeType: TrustedForecastScopeType;
  readonly regionKey: string | null;
  readonly beachId: string | null;
  readonly exposure: string;
  readonly dayPart: TrustedForecastDayPart;
  readonly measurementBasis: TrustedForecastMeasurementBasis;
  readonly minFaceFt: number | null;
  readonly maxFaceFt: number | null;
  readonly directionDeg: number | null;
  readonly periodSeconds: number | null;
  readonly parserVersion: string;
  readonly sourceHash: string;
  readonly issueIdentityKey: string;
  readonly revisionHash: string;
  readonly supersedesIssueId: string | null;
  readonly authorityEligible: boolean;
  readonly evidenceClass: TrustedForecastEvidenceClass;
  readonly ingestRunId: string | null;
  readonly fetchedAt: Date;
}

export class TrustedForecastIssueContractError extends Error {
  readonly field: string;

  constructor(field: string, reason: string) {
    super(`trusted forecast issue field "${field}" ${reason}`);
    this.name = "TrustedForecastIssueContractError";
    this.field = field;
  }
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TrustedForecastIssueContractError("<root>", "must be an object");
  }
  return value as Record<string, unknown>;
}

function requireString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new TrustedForecastIssueContractError(field, "must be a non-empty string");
  }
  return value;
}

function optionalString(
  row: Record<string, unknown>,
  field: string,
): string | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new TrustedForecastIssueContractError(field, "must be a string or null");
  }
  return value;
}

function requireBoolean(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value !== "boolean") {
    throw new TrustedForecastIssueContractError(field, "must be a boolean");
  }
  return value;
}

function optionalNumber(
  row: Record<string, unknown>,
  field: string,
): number | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TrustedForecastIssueContractError(
      field,
      "must be a finite number or null",
    );
  }
  return value;
}

function requireEnum<T extends string>(
  row: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T {
  const value = requireString(row, field);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new TrustedForecastIssueContractError(
      field,
      `must be one of ${allowed.join(", ")}`,
    );
  }
  return value as T;
}

function requireHash(row: Record<string, unknown>, field: string): string {
  const value = requireString(row, field);
  if (!SHA256_HEX.test(value)) {
    throw new TrustedForecastIssueContractError(
      field,
      "must be lowercase 64-character SHA-256 hex",
    );
  }
  return value;
}

/**
 * Seaside emits offset-bearing ISO-8601 instants (`+00:00`, `-10:00`,
 * `-07:00`), not only `Z`. A bare local timestamp has no instant and is
 * rejected rather than silently read as UTC.
 */
function requireInstant(row: Record<string, unknown>, field: string): Date {
  const raw = requireString(row, field);
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
    throw new TrustedForecastIssueContractError(
      field,
      "must carry an explicit UTC offset",
    );
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new TrustedForecastIssueContractError(field, "must be a valid instant");
  }
  return parsed;
}

function requireIanaTimezone(row: Record<string, unknown>, field: string): string {
  const value = requireString(row, field);
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
  } catch {
    throw new TrustedForecastIssueContractError(
      field,
      "must be a valid IANA timezone",
    );
  }
  return value;
}

/**
 * Strict parser for one normalized issue. Mirrors every CHECK constraint on
 * `public.trusted_forecast_issues` so a row that would be rejected by the
 * database is also rejected here, in the same terms.
 */
export function parseTrustedForecastIssue(value: unknown): TrustedForecastIssue {
  const row = requireRecord(value);

  for (const field of TRUSTED_FORECAST_ISSUE_INPUT_FIELDS) {
    if (!(field in row)) {
      throw new TrustedForecastIssueContractError(field, "is required");
    }
  }

  const validLocalDate = requireString(row, "valid_local_date");
  if (!LOCAL_DATE.test(validLocalDate)) {
    throw new TrustedForecastIssueContractError(
      "valid_local_date",
      "must be an ISO YYYY-MM-DD local calendar date",
    );
  }

  const validStartAt = requireInstant(row, "valid_start_at");
  const validEndAt = requireInstant(row, "valid_end_at");
  if (validEndAt.getTime() <= validStartAt.getTime()) {
    throw new TrustedForecastIssueContractError(
      "valid_end_at",
      "must be after valid_start_at",
    );
  }

  const minFaceFt = optionalNumber(row, "min_face_ft");
  const maxFaceFt = optionalNumber(row, "max_face_ft");
  if ((minFaceFt === null) !== (maxFaceFt === null)) {
    throw new TrustedForecastIssueContractError(
      "min_face_ft",
      "and max_face_ft must both be present or both be null",
    );
  }
  for (const [field, bound] of [
    ["min_face_ft", minFaceFt],
    ["max_face_ft", maxFaceFt],
  ] as const) {
    if (bound !== null && (bound < 0 || bound > 60)) {
      throw new TrustedForecastIssueContractError(field, "must be within 0..60 feet");
    }
  }
  if (minFaceFt !== null && maxFaceFt !== null && minFaceFt > maxFaceFt) {
    throw new TrustedForecastIssueContractError(
      "min_face_ft",
      "must not exceed max_face_ft",
    );
  }

  const directionDeg = optionalNumber(row, "direction_deg");
  if (directionDeg !== null && (directionDeg < 0 || directionDeg >= 360)) {
    throw new TrustedForecastIssueContractError(
      "direction_deg",
      "must be within 0..<360 degrees",
    );
  }

  const periodSeconds = optionalNumber(row, "period_seconds");
  if (periodSeconds !== null && (periodSeconds <= 0 || periodSeconds > 120)) {
    throw new TrustedForecastIssueContractError(
      "period_seconds",
      "must be within >0..120 seconds",
    );
  }

  const measurementBasis = requireEnum(
    row,
    "measurement_basis",
    TRUSTED_FORECAST_MEASUREMENT_BASES,
  );
  const evidenceClass = requireEnum(
    row,
    "evidence_class",
    TRUSTED_FORECAST_EVIDENCE_CLASSES,
  );
  const authorityEligible = requireBoolean(row, "authority_eligible");

  // Mirrors trusted_forecast_issues_authority_requires_measurement_check.
  if (
    authorityEligible &&
    (minFaceFt === null ||
      maxFaceFt === null ||
      measurementBasis !== "breaking_face_ft" ||
      evidenceClass !== "human_face_height_authority")
  ) {
    throw new TrustedForecastIssueContractError(
      "authority_eligible",
      "requires a measured breaking-face range on a human-authority row",
    );
  }

  const rawIssueId = row.issue_id;
  if (
    rawIssueId !== undefined &&
    rawIssueId !== null &&
    (typeof rawIssueId !== "string" || rawIssueId.length === 0)
  ) {
    throw new TrustedForecastIssueContractError(
      "issue_id",
      "must be a non-empty string when present",
    );
  }

  return {
    issueId: typeof rawIssueId === "string" ? rawIssueId : null,
    providerLineage: requireString(row, "provider_lineage"),
    sourceKey: requireString(row, "source_key"),
    issuedAt: requireInstant(row, "issued_at"),
    validLocalDate,
    validTimezone: requireIanaTimezone(row, "valid_timezone"),
    validStartAt,
    validEndAt,
    validityBasis: requireEnum(
      row,
      "validity_basis",
      TRUSTED_FORECAST_VALIDITY_BASES,
    ),
    scopeType: requireEnum(row, "scope_type", TRUSTED_FORECAST_SCOPE_TYPES),
    regionKey: optionalString(row, "region_key"),
    beachId: optionalString(row, "beach_id"),
    exposure: requireString(row, "exposure"),
    dayPart: requireEnum(row, "day_part", TRUSTED_FORECAST_DAY_PARTS),
    measurementBasis,
    minFaceFt,
    maxFaceFt,
    directionDeg,
    periodSeconds,
    parserVersion: requireString(row, "parser_version"),
    sourceHash: requireHash(row, "source_hash"),
    issueIdentityKey: requireHash(row, "issue_identity_key"),
    revisionHash: requireHash(row, "revision_hash"),
    supersedesIssueId: optionalString(row, "supersedes_issue_id"),
    authorityEligible,
    evidenceClass,
    ingestRunId: optionalString(row, "ingest_run_id"),
    fetchedAt: requireInstant(row, "fetched_at"),
  };
}

// ---------------------------------------------------------------------------
// Coverage policy
// ---------------------------------------------------------------------------

/**
 * How a single beach is allowed to be served by trusted sources.
 *
 * Seaside never resolves `beach_id` (every row in the live corpus carries
 * `beach_id: null`), so coverage is the only bridge from a source's
 * `scope_type`/`region_key`/`exposure` triple to a Quiver beach. It is an
 * explicit approved map, never inferred from display text.
 */
export interface TrustedForecastCoverageEntry {
  readonly beachId: string;
  /** IANA zone that defines the beach's local day (D-13). */
  readonly localTimezone: string;
  /** `region_key` values accepted at `scope_type = 'spot'` (WaveCast chart slugs). */
  readonly spotRegionKeys: readonly string[];
  /** `region_key` values accepted at `scope_type = 'regional'`. */
  readonly regionalRegionKeys: readonly string[];
  /**
   * Exposures this beach actually faces. Compared case-insensitively against
   * the free-text `exposure` field. D-12: an NNW-facing beach never sees SSW
   * rows, and the two are never unioned.
   */
  readonly compatibleExposures: readonly string[];
  /**
   * Approved non-WaveCast regional evidence lineages, most trusted first.
   * WaveCast has its own two higher tiers and must not be listed here.
   */
  readonly regionalAuthorityLineages: readonly string[];
}

export interface TrustedForecastCoveragePolicy {
  readonly version: string;
  readonly entries: readonly TrustedForecastCoverageEntry[];
}

/**
 * Coverage is opt-in: a beach with no approved entry is served baseline, never
 * a guess. Duplicate entries for one beach are a configuration error rather
 * than a silently-picked winner.
 */
export function coverageEntryForBeach(
  policy: TrustedForecastCoveragePolicy,
  beachId: string,
): TrustedForecastCoverageEntry | null {
  const matches = policy.entries.filter((entry) => entry.beachId === beachId);
  if (matches.length > 1) {
    throw new Error(
      `trusted forecast coverage policy ${policy.version} has ${matches.length} entries for one beach`,
    );
  }
  return matches[0] ?? null;
}

/** WaveCast owns precedence tiers 1 and 2 (D-09) and never appears in tier 3. */
export const WAVECAST_LINEAGE = "wavecast";

/**
 * Maximum issue age at the build anchor, in hours, keyed by Seaside
 * `source_key`. These mirror `seaside/trusted_forecasts/sources.py`
 * `freshness_max_age_hours` exactly, so a single justified cadence governs both
 * fetch-time rejection and serve-time staleness. Unknown keys fall back to the
 * strictest configured bound.
 */
export const TRUSTED_FORECAST_FRESHNESS_MAX_AGE_HOURS: Readonly<
  Record<string, number>
> = Object.freeze({
  socal: 96,
  hawaii: 36,
  new_england: 36,
  new_york: 36,
  new_jersey: 36,
  north_carolina: 36,
  florida_east_coast: 36,
  norcal: 36,
  central_california: 36,
  baja: 36,
  nws_hawaii_srf: 24,
  nws_akq_srf: 24,
  nws_box_srf: 24,
  nws_bro_srf: 24,
  nws_car_srf: 24,
  nws_chs_srf: 24,
  nws_crp_srf: 24,
  nws_eka_srf: 24,
  nws_gum_srf: 24,
  nws_gyx_srf: 24,
  nws_ilm_srf: 24,
  nws_jax_srf: 24,
  nws_lox_srf: 24,
  nws_mfl_srf: 24,
  nws_mhx_srf: 24,
  nws_mlb_srf: 24,
  nws_mob_srf: 24,
  nws_mtr_srf: 24,
  nws_okx_srf: 24,
  nws_phi_srf: 24,
  nws_pqr_srf: 24,
  nws_sgx_srf: 24,
  nws_sju_srf: 24,
  nws_tae_srf: 24,
  nws_tbw_srf: 24,
  surf_institute_pnw: 36,
  stormsurf_pnw_links: 72,
  stormsurf_pnw_buoy: 36,
  stormsurf_ny_shortcast: 336,
  nj_beach_cams_reports: 24,
  surfers_view_nj: 24,
});

const STRICTEST_FRESHNESS_MAX_AGE_HOURS = 24;

export function freshnessMaxAgeHoursForSource(sourceKey: string): number {
  return (
    TRUSTED_FORECAST_FRESHNESS_MAX_AGE_HOURS[sourceKey] ??
    STRICTEST_FRESHNESS_MAX_AGE_HOURS
  );
}

export type TrustedForecastExclusionReason =
  | "not_authority_eligible"
  | "regional_evidence_only"
  | "non_authority_evidence_class"
  | "unspecified_measurement_basis"
  | "missing_measured_range"
  | "superseded"
  | "uncovered_scope"
  | "incompatible_exposure"
  | "unapproved_lineage"
  | "stale"
  | "future_dated"
  | "wrong_local_date"
  | "unstored_issue"
  | "lineage_dedupe";

export interface TrustedForecastExcludedIssue {
  readonly issue: TrustedForecastIssue;
  readonly reason: TrustedForecastExclusionReason;
}

export type TrustedForecastPrecedenceTier =
  | "spot_wavecast"
  | "regional_wavecast"
  | "regional_authority";

export interface TrustedForecastAuthoritySelection {
  readonly primary: TrustedForecastIssue | null;
  readonly primaryTier: TrustedForecastPrecedenceTier | null;
  /** One row per other approved lineage, already deduped (D-05, D-06). */
  readonly corroborators: readonly TrustedForecastIssue[];
  readonly excluded: readonly TrustedForecastExcludedIssue[];
}

function normalizeExposure(value: string): string {
  return value.trim().toLowerCase();
}

/** D-12: exposure compatibility is mandatory and exact — never a prefix match. */
export function isExposureCompatible(
  entry: TrustedForecastCoverageEntry,
  exposure: string,
): boolean {
  const normalized = normalizeExposure(exposure);
  return entry.compatibleExposures.some(
    (allowed) => normalizeExposure(allowed) === normalized,
  );
}

function coversScope(
  entry: TrustedForecastCoverageEntry,
  issue: TrustedForecastIssue,
): boolean {
  if (issue.regionKey === null) return false;
  const keys =
    issue.scopeType === "spot" ? entry.spotRegionKeys : entry.regionalRegionKeys;
  return keys.includes(issue.regionKey);
}

export function issueAgeHours(issue: TrustedForecastIssue, anchor: Date): number {
  return (anchor.getTime() - issue.issuedAt.getTime()) / 3_600_000;
}

/** Five minutes absorbs normal source/host clock skew without admitting future evidence. */
const FRESHNESS_CLOCK_SKEW_TOLERANCE_HOURS = 5 / 60;

/**
 * D-09/D-10 precedence tier. `null` means the row cannot act as authority for
 * this beach at all. Regional tiers remain useful for ordering corroborating
 * evidence, but the selection path never allows them to become primary.
 */
function precedenceTier(
  entry: TrustedForecastCoverageEntry,
  issue: TrustedForecastIssue,
): TrustedForecastPrecedenceTier | null {
  if (issue.providerLineage === WAVECAST_LINEAGE) {
    return issue.scopeType === "spot" ? "spot_wavecast" : "regional_wavecast";
  }
  if (issue.scopeType !== "regional") return null;
  return entry.regionalAuthorityLineages.includes(issue.providerLineage)
    ? "regional_authority"
    : null;
}

const TIER_RANK: Readonly<Record<TrustedForecastPrecedenceTier, number>> =
  Object.freeze({
    spot_wavecast: 0,
    regional_wavecast: 1,
    regional_authority: 2,
  });

/**
 * `stated` outranks `derived_publication_day`.
 *
 * A derived window is the source's *publication day*, not a window the source
 * claimed to forecast. Preferring a newer derived row over an older stated row
 * would let an assumption about which day is covered outrank an explicit claim,
 * so basis is weighed ahead of recency rather than after it.
 */
const VALIDITY_BASIS_RANK: Readonly<
  Record<TrustedForecastValidityBasis, number>
> = Object.freeze({
  stated: 0,
  derived_publication_day: 1,
});

/** Broader stated coverage first, so a whole-day row beats a half-day row on ties. */
const DAY_PART_RANK: Readonly<Record<TrustedForecastDayPart, number>> =
  Object.freeze({
    all_day: 0,
    day: 1,
    night: 2,
  });

/**
 * D-11 only compares ranges that describe overlapping time. `day` and `night`
 * are the sole disjoint pair in the vocabulary: NWS's "Today 2-4 ft" and
 * "Tonight 8-12 ft" are two different windows of one local date, not an
 * 8-foot disagreement. `all_day` overlaps everything.
 */
export function dayPartsOverlap(
  left: TrustedForecastDayPart,
  right: TrustedForecastDayPart,
): boolean {
  if (left === "all_day" || right === "all_day") return true;
  return left === right;
}

function compareCandidates(
  entry: TrustedForecastCoverageEntry,
  left: TrustedForecastIssue,
  right: TrustedForecastIssue,
): number {
  const leftTier = precedenceTier(entry, left);
  const rightTier = precedenceTier(entry, right);
  const leftRank = leftTier === null ? Number.MAX_SAFE_INTEGER : TIER_RANK[leftTier];
  const rightRank =
    rightTier === null ? Number.MAX_SAFE_INTEGER : TIER_RANK[rightTier];
  if (leftRank !== rightRank) return leftRank - rightRank;

  if (leftTier === "regional_authority" && rightTier === "regional_authority") {
    const leftPriority = entry.regionalAuthorityLineages.indexOf(
      left.providerLineage,
    );
    const rightPriority = entry.regionalAuthorityLineages.indexOf(
      right.providerLineage,
    );
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  }

  // D-14: within one precedence tier the row carrying the highest local-day
  // maximum represents the day. Deliberately AFTER tier, so D-12's
  // "spot supersedes regional" cannot be outvoted by a bigger regional number.
  const leftMax = left.maxFaceFt ?? Number.NEGATIVE_INFINITY;
  const rightMax = right.maxFaceFt ?? Number.NEGATIVE_INFINITY;
  if (leftMax !== rightMax) return rightMax - leftMax;

  const basis =
    VALIDITY_BASIS_RANK[left.validityBasis] -
    VALIDITY_BASIS_RANK[right.validityBasis];
  if (basis !== 0) return basis;

  const issued = right.issuedAt.getTime() - left.issuedAt.getTime();
  if (issued !== 0) return issued;

  const dayPart = DAY_PART_RANK[left.dayPart] - DAY_PART_RANK[right.dayPart];
  if (dayPart !== 0) return dayPart;

  return compareStableIdentity(left, right);
}

/**
 * Stable, content-addressed final tie-break so ordering never depends on
 * database row order.
 *
 * `issue_identity_key` is Seaside's hash over the identity fields (which
 * include `issued_at`); `revision_hash` covers those plus the measured content,
 * parser version and source hash. So the second branch is the only
 * discriminator left between two stored revisions of one issuance — which is
 * exactly what `trusted_forecast_issues`' UNIQUE-on-`revision_hash` permits to
 * coexist. Both branches are shared with `compareIssuanceRecency`, which is
 * where the revision case is actually decided.
 */
function compareStableIdentity(
  left: TrustedForecastIssue,
  right: TrustedForecastIssue,
): number {
  if (left.issueIdentityKey !== right.issueIdentityKey) {
    return left.issueIdentityKey < right.issueIdentityKey ? -1 : 1;
  }
  if (left.revisionHash !== right.revisionHash) {
    return left.revisionHash < right.revisionHash ? -1 : 1;
  }
  return 0;
}

/**
 * Seaside's `_IDENTITY_FIELDS` (`trusted_forecasts/models.py`) minus
 * `issued_at`. Two rows sharing this key are the same logical issuance
 * re-stated by its source, never two independent calls: a different endpoint
 * carries a different `source_key`, a different window a different `day_part`,
 * a different place a different `region_key`/`exposure`.
 */
function issuanceIdentityKey(issue: TrustedForecastIssue): string {
  return [
    issue.providerLineage,
    issue.sourceKey,
    issue.validLocalDate,
    issue.validTimezone,
    issue.scopeType,
    issue.regionKey ?? "",
    issue.beachId ?? "",
    normalizeExposure(issue.exposure),
    issue.dayPart,
    issue.measurementBasis,
  ].join("|");
}

/** Newest issuance of one identity first; ties are content-addressed. */
function compareIssuanceRecency(
  left: TrustedForecastIssue,
  right: TrustedForecastIssue,
): number {
  const issued = right.issuedAt.getTime() - left.issuedAt.getTime();
  if (issued !== 0) return issued;
  return compareStableIdentity(left, right);
}

export interface SelectTrustedForecastAuthorityArgs {
  readonly entry: TrustedForecastCoverageEntry;
  readonly localDate: string;
  readonly issues: readonly TrustedForecastIssue[];
  readonly buildAnchorAt: Date;
  /**
   * Escape hatch for supersession the caller knows about but did not load —
   * issue ids a later revision replaces. 21-01 emits `supersedes_issue_id:
   * null` on every row and nothing populates this today, so ordinary
   * supersession is NOT expressed here: the engine derives it itself by
   * collapsing each issuance identity to its newest issuance (see
   * `issuanceIdentityKey`). Both paths mark their losers `superseded`.
   */
  readonly supersededIssueIds?: ReadonlySet<string>;
}

/**
 * Validate the authority that a row would have before it is allowed to retract
 * another row. Supersession is intentionally not part of this predicate: a
 * row cannot invalidate itself before its own source, scope, freshness and
 * authority checks have passed.
 */
function intrinsicIssueExclusionReason(args: {
  readonly entry: TrustedForecastCoverageEntry;
  readonly localDate: string;
  readonly issue: TrustedForecastIssue;
  readonly buildAnchorAt: Date;
  readonly allowRegionalEvidence?: boolean;
}): TrustedForecastExclusionReason | null {
  const {
    entry,
    localDate,
    issue,
    buildAnchorAt,
    allowRegionalEvidence = false,
  } = args;
  if (issue.validLocalDate !== localDate) return "wrong_local_date";
  if (issue.issueId === null) return "unstored_issue";
  // Scope is a hard authority boundary. Regional products remain available to
  // callers as evidence, but they can never become a beach-specific primary,
  // even when ingestion marks one as authority-eligible.
  if (issue.scopeType === "regional" && !allowRegionalEvidence) {
    return "regional_evidence_only";
  }
  if (issue.evidenceClass !== "human_face_height_authority") {
    return "non_authority_evidence_class";
  }
  if (!issue.authorityEligible) return "not_authority_eligible";
  if (issue.measurementBasis !== "breaking_face_ft") {
    return "unspecified_measurement_basis";
  }
  if (issue.minFaceFt === null || issue.maxFaceFt === null) {
    return "missing_measured_range";
  }
  if (!coversScope(entry, issue)) return "uncovered_scope";
  if (!isExposureCompatible(entry, issue.exposure)) {
    return "incompatible_exposure";
  }
  if (precedenceTier(entry, issue) === null) return "unapproved_lineage";
  const ageHours = issueAgeHours(issue, buildAnchorAt);
  if (ageHours < -FRESHNESS_CLOCK_SKEW_TOLERANCE_HOURS) {
    return "future_dated";
  }
  if (ageHours > freshnessMaxAgeHoursForSource(issue.sourceKey)) {
    return "stale";
  }
  return null;
}

/**
 * Deterministic authority selection for one beach and one local date.
 *
 * Order of operations matters and is asserted by the tests: invalid, stale,
 * uncovered, incompatible-exposure and non-authority rows are removed *before*
 * any lineage is allowed to vote (D-05 through D-08), so a mirror or a model
 * page can neither corroborate nor block.
 */
export function selectTrustedForecastAuthority(
  args: SelectTrustedForecastAuthorityArgs,
): TrustedForecastAuthoritySelection {
  const { entry, localDate, issues, buildAnchorAt } = args;
  const excluded: TrustedForecastExcludedIssue[] = [];
  const eligible: TrustedForecastIssue[] = [];
  const regionalEvidence: TrustedForecastIssue[] = [];

  const superseded = new Set<string>(args.supersededIssueIds ?? []);
  for (const issue of issues) {
    if (
      intrinsicIssueExclusionReason({
        entry,
        localDate,
        issue,
        buildAnchorAt,
      }) === null &&
      issue.supersedesIssueId !== null
    ) {
      superseded.add(issue.supersedesIssueId);
    }
  }

  for (const issue of issues) {
    const intrinsicReason = intrinsicIssueExclusionReason({
      entry,
      localDate,
      issue,
      buildAnchorAt,
    });
    if (intrinsicReason !== null) {
      if (intrinsicReason === "regional_evidence_only") {
        const evidenceReason = intrinsicIssueExclusionReason({
          entry,
          localDate,
          issue,
          buildAnchorAt,
          allowRegionalEvidence: true,
        });
        if (evidenceReason === null) {
          regionalEvidence.push(issue);
          continue;
        }
        excluded.push({ issue, reason: evidenceReason });
        continue;
      }
      excluded.push({ issue, reason: intrinsicReason });
      continue;
    }
    if (issue.issueId !== null && superseded.has(issue.issueId)) {
      excluded.push({ issue, reason: "superseded" });
      continue;
    }
    eligible.push(issue);
  }

  // A source that re-states a local day supersedes its own earlier call, and
  // nothing upstream says so: `issued_at` is one of Seaside's identity fields,
  // so every 6-hourly re-fetch mints a NEW identity, and
  // `trusted_forecast_issues` is UNIQUE on `revision_hash` alone — so a
  // morning "8-12 ft" and the evening "0-2 ft" that replaces it both sit in the
  // table, both inside the freshness bound.
  //
  // This collapse must run BEFORE `compareCandidates`, because that comparator
  // ranks the daily maximum ahead of recency: left to it, the stale 8-12 ft
  // call wins for as long as it stays fresh and no source that revises DOWNWARD
  // during a day is ever honoured.
  const newestOfIdentity = new Map<string, TrustedForecastIssue>();
  for (const issue of eligible) {
    const key = issuanceIdentityKey(issue);
    const incumbent = newestOfIdentity.get(key);
    if (incumbent === undefined || compareIssuanceRecency(issue, incumbent) < 0) {
      newestOfIdentity.set(key, issue);
    }
  }
  const current: TrustedForecastIssue[] = [];
  for (const issue of eligible) {
    if (newestOfIdentity.get(issuanceIdentityKey(issue)) === issue) {
      current.push(issue);
      continue;
    }
    excluded.push({ issue, reason: "superseded" });
  }

  // D-05/D-06: one vote per provider lineage. Every NJ mirror shares
  // `surfers_view`; every Stormsurf endpoint shares `stormsurf`. The best row
  // within a lineage represents it; the rest are recorded as deduped, never as
  // independent agreement or disagreement.
  const bestByLineage = new Map<string, TrustedForecastIssue>();
  for (const issue of current) {
    const incumbent = bestByLineage.get(issue.providerLineage);
    if (incumbent === undefined || compareCandidates(entry, issue, incumbent) < 0) {
      bestByLineage.set(issue.providerLineage, issue);
    }
  }
  for (const issue of current) {
    if (bestByLineage.get(issue.providerLineage) !== issue) {
      excluded.push({ issue, reason: "lineage_dedupe" });
    }
  }

  // D-09/D-10: fresh compatible spot WaveCast is the only authority tier. The
  // regional rows collected above can corroborate that primary, but they are
  // never admitted to this ranking and therefore cannot supply its range.
  const lineageWinners = [...bestByLineage.values()].sort((left, right) =>
    compareCandidates(entry, left, right),
  );
  if (lineageWinners.length === 0) {
    return {
      primary: null,
      primaryTier: null,
      corroborators: [],
      excluded: [
        ...excluded,
        ...regionalEvidence.map((issue) => ({
          issue,
          reason: "regional_evidence_only" as const,
        })),
      ],
    };
  }

  const primary = lineageWinners[0];
  const bestRegionalEvidenceByLineage = new Map<string, TrustedForecastIssue>();
  for (const issue of regionalEvidence) {
    if (issue.providerLineage === primary.providerLineage) continue;
    const incumbent = bestRegionalEvidenceByLineage.get(issue.providerLineage);
    if (
      incumbent === undefined ||
      compareCandidates(entry, issue, incumbent) < 0
    ) {
      bestRegionalEvidenceByLineage.set(issue.providerLineage, issue);
    }
  }

  return {
    primary,
    primaryTier: precedenceTier(entry, primary),
    corroborators: [
      ...lineageWinners.slice(1),
      ...bestRegionalEvidenceByLineage.values(),
    ],
    excluded,
  };
}
