/**
 * Approved trusted-forecast coverage configuration (Phase 21, MFA-05).
 *
 * Seaside never resolves `beach_id` — every row it emits carries `null` — so
 * this table is the ONLY bridge from a source's
 * `(scope_type, region_key, exposure)` triple to a Quiver beach. Without it the
 * feature is inert. An unresolvable configured slug produces a named coverage
 * error, and the builder serves baseline for that run.
 *
 * Two rules keep it honest:
 *  1. Entries are keyed by beach SLUG, resolved to `beach_id` at run time. An
 *     unresolvable slug is a loud, named configuration error, never a silent
 *     drop.
 *  2. Every `(scope_type, region_key, exposure)` combination the live sources
 *     actually emit must be either accepted by an entry or listed in
 *     `TRUSTED_FORECAST_UNCOVERED_VOCABULARY` with a reason. A ratchet test
 *     runs the 196 real 21-01 rows through both lists, so a combination cannot
 *     go silently unclaimed and an entry cannot silently exclude all of its own
 *     rows on exposure.
 *
 * Pure and framework-free: no database access, no Next.js imports. The
 * server-only repository resolves slugs; this module only describes policy.
 */

import {
  isExposureCompatible,
  type TrustedForecastCoverageEntry,
  type TrustedForecastCoveragePolicy,
  type TrustedForecastIssue,
  type TrustedForecastScopeType,
} from "./trusted-forecast-policy";

export const TRUSTED_FORECAST_COVERAGE_VERSION = "trusted-forecast-coverage-v1";

/**
 * The IANA zone each Seaside source stamps on `valid_local_date`, mirroring
 * `seaside/trusted_forecasts/sources.py::SOURCES[].timezone`.
 *
 * D-13 groups Quiver slots by the BEACH's zone and then matches
 * `validLocalDate` by string equality. That is only sound when the source
 * stamped its date in the same zone, so a coverage entry may only accept region
 * keys whose sources agree with its `localTimezone`
 * (`assertCoverageTimezonesAgree`), and any row that still disagrees at run
 * time is dropped by `partitionIssuesByCoverageTimezone` rather than compared.
 */
export const TRUSTED_FORECAST_SOURCE_TIMEZONES: Readonly<
  Record<string, string>
> = Object.freeze({
  socal: "America/Los_Angeles",
  hawaii: "Pacific/Honolulu",
  new_england: "America/New_York",
  new_york: "America/New_York",
  new_jersey: "America/New_York",
  north_carolina: "America/New_York",
  florida_east_coast: "America/New_York",
  norcal: "America/Los_Angeles",
  central_california: "America/Los_Angeles",
  baja: "America/Tijuana",
  nws_hawaii_srf: "Pacific/Honolulu",
  nws_akq_srf: "America/New_York",
  nws_box_srf: "America/New_York",
  nws_bro_srf: "America/Chicago",
  nws_car_srf: "America/New_York",
  nws_chs_srf: "America/New_York",
  nws_crp_srf: "America/Chicago",
  nws_eka_srf: "America/Los_Angeles",
  nws_gum_srf: "Pacific/Guam",
  nws_gyx_srf: "America/New_York",
  nws_ilm_srf: "America/New_York",
  nws_jax_srf: "America/New_York",
  nws_lox_srf: "America/Los_Angeles",
  nws_mfl_srf: "America/New_York",
  nws_mhx_srf: "America/New_York",
  nws_mlb_srf: "America/New_York",
  nws_mob_srf: "America/Chicago",
  nws_mtr_srf: "America/Los_Angeles",
  nws_okx_srf: "America/New_York",
  nws_phi_srf: "America/New_York",
  nws_pqr_srf: "America/Los_Angeles",
  nws_sgx_srf: "America/Los_Angeles",
  nws_sju_srf: "America/Puerto_Rico",
  nws_tae_srf: "America/New_York",
  nws_tbw_srf: "America/New_York",
  surf_institute_pnw: "America/Los_Angeles",
  stormsurf_pnw_links: "America/Los_Angeles",
  stormsurf_pnw_buoy: "America/Los_Angeles",
  stormsurf_ny_shortcast: "America/New_York",
  nj_beach_cams_reports: "America/New_York",
  surfers_view_nj: "America/New_York",
});

/**
 * The complete Seaside inventory, in `sources.py` order. Pinned here so an
 * unknown `source_key` reaching the repository is a loud failure instead of
 * silently inheriting the strictest 24-hour freshness bound and vanishing.
 */
export const TRUSTED_FORECAST_SOURCE_KEYS: readonly string[] = Object.freeze(
  Object.keys(TRUSTED_FORECAST_SOURCE_TIMEZONES),
);

/**
 * `region_key` values each source can emit. `socal` is the one source whose
 * `region_key` is not its own key: its eight-chart fan-out uses the chart spot
 * slug as the region key (21-01 round 4), and its index page uses `socal`.
 */
export const WAVECAST_SOCAL_CHART_SLUGS: readonly string[] = Object.freeze([
  "malibu",
  "rincon",
  "trestles",
  "oldmans",
  "beacons",
  "ventura",
  "huntington-beach",
  "oceanside",
]);

export const TRUSTED_FORECAST_SOURCE_REGION_KEYS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  socal: Object.freeze(["socal", ...WAVECAST_SOCAL_CHART_SLUGS]),
  hawaii: Object.freeze(["hawaii"]),
  new_england: Object.freeze(["new_england"]),
  new_york: Object.freeze(["new_york"]),
  new_jersey: Object.freeze(["new_jersey"]),
  north_carolina: Object.freeze(["north_carolina"]),
  florida_east_coast: Object.freeze(["florida_east_coast"]),
  norcal: Object.freeze(["norcal"]),
  central_california: Object.freeze(["central_california"]),
  baja: Object.freeze(["baja"]),
  nws_hawaii_srf: Object.freeze(["hawaii"]),
  nws_akq_srf: Object.freeze(["virginia"]),
  nws_box_srf: Object.freeze(["new_england"]),
  nws_bro_srf: Object.freeze(["texas"]),
  nws_car_srf: Object.freeze(["new_england"]),
  nws_chs_srf: Object.freeze(["south_carolina"]),
  nws_crp_srf: Object.freeze(["texas"]),
  nws_eka_srf: Object.freeze(["norcal"]),
  nws_gum_srf: Object.freeze(["guam"]),
  nws_gyx_srf: Object.freeze(["new_england"]),
  nws_ilm_srf: Object.freeze(["north_carolina"]),
  nws_jax_srf: Object.freeze(["florida_east_coast"]),
  nws_lox_srf: Object.freeze(["socal"]),
  nws_mfl_srf: Object.freeze(["florida_east_coast"]),
  nws_mhx_srf: Object.freeze(["north_carolina"]),
  nws_mlb_srf: Object.freeze(["florida_east_coast"]),
  nws_mob_srf: Object.freeze(["gulf_coast"]),
  nws_mtr_srf: Object.freeze(["central_california"]),
  nws_okx_srf: Object.freeze(["new_york"]),
  nws_phi_srf: Object.freeze(["new_jersey"]),
  nws_pqr_srf: Object.freeze(["pnw"]),
  nws_sgx_srf: Object.freeze(["socal"]),
  nws_sju_srf: Object.freeze(["puerto_rico"]),
  nws_tae_srf: Object.freeze(["florida_panhandle"]),
  nws_tbw_srf: Object.freeze(["florida_west_coast"]),
  surf_institute_pnw: Object.freeze(["pnw"]),
  stormsurf_pnw_links: Object.freeze(["pnw"]),
  stormsurf_pnw_buoy: Object.freeze(["pnw"]),
  stormsurf_ny_shortcast: Object.freeze(["new_york"]),
  nj_beach_cams_reports: Object.freeze(["new_jersey"]),
  surfers_view_nj: Object.freeze(["new_jersey"]),
});

/** A coverage entry before its beach slug has been resolved to a `beach_id`. */
export interface TrustedForecastCoverageDefinition {
  /** `beaches.slug`, resolved to `beaches.id` at run time. */
  readonly beachSlug: string;
  readonly localTimezone: string;
  readonly spotRegionKeys: readonly string[];
  readonly regionalRegionKeys: readonly string[];
  readonly compatibleExposures: readonly string[];
  readonly regionalAuthorityLineages: readonly string[];
  /** Why these keys and exposures, and what evidence backs them. */
  readonly note: string;
}

/**
 * Approved coverage.
 *
 * Deliberately small. Every accepted `region_key`/`exposure` pair below is
 * backed by rows in the 196-row real corpus produced by 21-01's shipped
 * parsers; nothing here was inferred from a page that was never captured. The
 * combinations that are real but not yet covered are enumerated with reasons in
 * `TRUSTED_FORECAST_UNCOVERED_VOCABULARY`, so expanding coverage is a data
 * change with a ratchet behind it rather than a rediscovery.
 */
export const TRUSTED_FORECAST_COVERAGE_DEFINITIONS: readonly TrustedForecastCoverageDefinition[] =
  Object.freeze([
    Object.freeze({
      beachSlug: "lower-trestles",
      localTimezone: "America/Los_Angeles",
      spotRegionKeys: Object.freeze(["trestles"]),
      regionalRegionKeys: Object.freeze(["socal"]),
      compatibleExposures: Object.freeze(["NNW", "SSW"]),
      regionalAuthorityLineages: Object.freeze([]),
      note:
        "WaveCast publishes a dedicated socal spot chart for `trestles` with " +
        "exactly two sections, NNW and SSW; both appear as authority rows in " +
        "the captured chart. The socal index also emits a `dominant` " +
        "evidence-only row for this slug, which carries no height and is " +
        "excluded on evidence class before exposure is consulted. The " +
        "`lower-trestles` beach slug was verified against the live `beaches` " +
        "table on 2026-08-08.",
    }),
    Object.freeze({
      beachSlug: "malibu-first-point-surfrider",
      localTimezone: "America/Los_Angeles",
      spotRegionKeys: Object.freeze(["malibu"]),
      regionalRegionKeys: Object.freeze(["socal"]),
      compatibleExposures: Object.freeze(["NNW", "SSW"]),
      regionalAuthorityLineages: Object.freeze([]),
      note:
        "Same shape as trestles: the captured `malibu` socal spot chart emits " +
        "NNW and SSW authority rows, plus one `dominant` evidence-only index " +
        "row. The `malibu-first-point-surfrider` beach slug was verified " +
        "against the live `beaches` table on 2026-08-08, and it was chosen " +
        "over the duplicate `malibu-surfrider-first-point-malibu-ca` because " +
        "it is the CDIP-198, terrain-calibrated row.",
    }),
  ]);

/** A live vocabulary combination that is deliberately not covered yet. */
export interface UncoveredTrustedForecastVocabulary {
  readonly scopeType: TrustedForecastScopeType;
  readonly regionKey: string;
  readonly exposure: string;
  readonly reason: string;
}

/**
 * Real combinations the live sources emit that no entry above accepts.
 *
 * This list is what stops "the feature ships inert" from being invisible: the
 * ratchet test walks the whole real corpus and fails if a combination is
 * neither covered nor listed here, and equally if a listed combination has
 * silently become covered.
 */
export const TRUSTED_FORECAST_UNCOVERED_VOCABULARY: readonly UncoveredTrustedForecastVocabulary[] =
  Object.freeze([
    Object.freeze({
      scopeType: "regional" as const,
      regionKey: "hawaii",
      exposure: "NNW",
      reason:
        "No Hawaii beach slug has been verified against the `beaches` table " +
        "from this worktree (a database read was not available). The " +
        "vocabulary itself is proven by 16 real WaveCast rows.",
    }),
    Object.freeze({
      scopeType: "regional" as const,
      regionKey: "hawaii",
      exposure: "SSW",
      reason:
        "Same as hawaii/NNW: the exposure vocabulary is proven by 16 real " +
        "WaveCast rows, but no Hawaii beach slug has been verified against " +
        "the beaches table from this worktree.",
    }),
    Object.freeze({
      scopeType: "regional" as const,
      regionKey: "new_york",
      exposure: "primary",
      reason:
        "Two independent lineages (WaveCast `new_york` and " +
        "`stormsurf_ny_shortcast`) both emit `primary` here, which is the " +
        "corroboration case D-11 exists for. Blocked only on a verified New " +
        "York beach slug.",
    }),
    Object.freeze({
      scopeType: "regional" as const,
      regionKey: "norcal",
      exposure: "primary",
      reason:
        "WaveCast NorCal emits `primary`; blocked on a verified NorCal beach " +
        "slug. `config/regions.ts` names candidate slugs but their " +
        "`beaches.slug` values were not confirmed here.",
    }),
    Object.freeze({
      scopeType: "regional" as const,
      regionKey: "pnw",
      exposure: "coastal",
      reason:
        "surf.institute is evidence-only by design (D-08, metres Hs). It can " +
        "never be authority, so covering it would add no adjustment.",
    }),
    Object.freeze({
      scopeType: "regional" as const,
      regionKey: "pnw",
      exposure: "surf",
      reason:
        "Same as pnw/coastal: surf.institute reports metres Hs, which D-08 " +
        "makes non-face evidence, so this row can never become authority and " +
        "covering it would add no adjustment.",
    }),
    ...WAVECAST_SOCAL_CHART_SLUGS.filter(
      (slug) => slug !== "trestles" && slug !== "malibu",
    ).map((slug) =>
      Object.freeze({
        scopeType: "spot" as const,
        regionKey: slug,
        exposure: "dominant",
        reason:
          "Only the socal index row for this slug was captured, and index rows " +
          "are evidence-only with no height. This slug's own spot chart was " +
          "never captured, so its section vocabulary is unknown and inventing " +
          "NNW/SSW here would be a guess.",
      }),
    ),
    Object.freeze({
      scopeType: "spot" as const,
      regionKey: "trestles",
      exposure: "dominant",
      reason:
        "The socal index `dominant` row is evidence-only and height-free; the " +
        "covered entry deliberately lists only the chart's NNW/SSW sections " +
        "so D-12 exposure matching stays meaningful.",
    }),
    Object.freeze({
      scopeType: "spot" as const,
      regionKey: "malibu",
      exposure: "dominant",
      reason:
        "Same as trestles/dominant: the socal index row for malibu is " +
        "evidence-only and carries no height, so covering it would add no " +
        "adjustment while weakening D-12 exposure matching.",
    }),
    ...[
      "big-island-leeward/SOUTH",
      "big-island-leeward/WEST",
      "big-island-windward-and-southeast/EAST",
      "big-island-windward-and-southeast/NORTH",
      "big-island-windward-and-southeast/SOUTH",
      "kauai/EAST",
      "kauai/NORTH",
      "kauai/SOUTH",
      "kauai/WEST",
      "maui/EAST",
      "maui/NORTH",
      "maui/SOUTH",
      "maui/WEST",
      "oahu/EAST",
      "oahu/NORTH",
      "oahu/SOUTH",
      "oahu/WEST",
    ].map((exposure) =>
      Object.freeze({
        scopeType: "regional" as const,
        regionKey: "hawaii",
        exposure,
        reason:
          "NWS Hawaii SRF `<island>/<SHORE>` exposure. Real and " +
          "authority-eligible, but it needs a verified Hawaii beach slug AND " +
          "the island half must match that beach's island, which cannot be " +
          "decided without the `beaches` row.",
      }),
    ),
  ]);

export type TrustedForecastCoverageErrorCode =
  | "unresolved_beach_slug"
  | "duplicate_beach_slug"
  | "timezone_disagreement";

export class TrustedForecastCoverageError extends Error {
  readonly code: TrustedForecastCoverageErrorCode;
  /** Configuration identifiers only — never source content. */
  readonly detail: readonly string[];

  constructor(code: TrustedForecastCoverageErrorCode, detail: readonly string[]) {
    super(`trusted forecast coverage ${code}: ${detail.join(", ")}`);
    this.name = "TrustedForecastCoverageError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Every accepted region key must belong to sources that stamp their local date
 * in the entry's own zone (defect 4 of the 21-03 critic). Otherwise
 * `validLocalDate` and the beach's IANA date are two different calendars
 * compared by string equality, and the adjustment silently lands on the wrong
 * day.
 */
export function assertCoverageTimezonesAgree(
  definitions: readonly TrustedForecastCoverageDefinition[] = TRUSTED_FORECAST_COVERAGE_DEFINITIONS,
): void {
  const disagreements: string[] = [];
  for (const definition of definitions) {
    const acceptedKeys = new Set([
      ...definition.spotRegionKeys,
      ...definition.regionalRegionKeys,
    ]);
    for (const [sourceKey, regionKeys] of Object.entries(
      TRUSTED_FORECAST_SOURCE_REGION_KEYS,
    )) {
      if (!regionKeys.some((key) => acceptedKeys.has(key))) continue;
      const sourceZone = TRUSTED_FORECAST_SOURCE_TIMEZONES[sourceKey];
      if (sourceZone !== definition.localTimezone) {
        disagreements.push(
          `${definition.beachSlug}:${sourceKey} (${definition.localTimezone} vs ${sourceZone})`,
        );
      }
    }
  }
  if (disagreements.length > 0) {
    throw new TrustedForecastCoverageError("timezone_disagreement", disagreements);
  }
}

/**
 * Resolve the approved definitions into the policy the engine consumes.
 *
 * An unresolvable slug throws. The caller decides what to do with that — the
 * builder logs it as a named coverage error and serves baseline for the run —
 * but it must never be mistaken for "this beach has no coverage".
 */
export function resolveTrustedForecastCoveragePolicy(
  beachIdBySlug: ReadonlyMap<string, string>,
  definitions: readonly TrustedForecastCoverageDefinition[] = TRUSTED_FORECAST_COVERAGE_DEFINITIONS,
): TrustedForecastCoveragePolicy {
  assertCoverageTimezonesAgree(definitions);

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const unresolved: string[] = [];
  const entries: TrustedForecastCoverageEntry[] = [];

  for (const definition of definitions) {
    if (seen.has(definition.beachSlug)) {
      duplicates.push(definition.beachSlug);
      continue;
    }
    seen.add(definition.beachSlug);

    const beachId = beachIdBySlug.get(definition.beachSlug);
    if (beachId === undefined) {
      unresolved.push(definition.beachSlug);
      continue;
    }
    entries.push({
      beachId,
      localTimezone: definition.localTimezone,
      spotRegionKeys: definition.spotRegionKeys,
      regionalRegionKeys: definition.regionalRegionKeys,
      compatibleExposures: definition.compatibleExposures,
      regionalAuthorityLineages: definition.regionalAuthorityLineages,
    });
  }

  if (duplicates.length > 0) {
    throw new TrustedForecastCoverageError("duplicate_beach_slug", duplicates);
  }
  if (unresolved.length > 0) {
    throw new TrustedForecastCoverageError("unresolved_beach_slug", unresolved);
  }

  return { version: TRUSTED_FORECAST_COVERAGE_VERSION, entries };
}

/** Slugs the repository must resolve before a policy can be built. */
export function trustedForecastCoverageBeachSlugs(
  definitions: readonly TrustedForecastCoverageDefinition[] = TRUSTED_FORECAST_COVERAGE_DEFINITIONS,
): readonly string[] {
  return [...new Set(definitions.map((definition) => definition.beachSlug))];
}

export interface CoverageTimezonePartition {
  readonly matched: readonly TrustedForecastIssue[];
  /** Rows whose source stamped `valid_local_date` in a different zone. */
  readonly mismatchedCount: number;
}

/**
 * Keep only rows whose `validTimezone` is the coverage entry's own zone.
 *
 * `selectTrustedForecastAuthority` compares `validLocalDate` to the beach's
 * IANA local date by string equality. A row stamped in another zone can be a
 * full day off while comparing equal, so it is dropped here by construction
 * instead of being trusted.
 */
export function partitionIssuesByCoverageTimezone(
  entry: TrustedForecastCoverageEntry,
  issues: readonly TrustedForecastIssue[],
): CoverageTimezonePartition {
  const matched: TrustedForecastIssue[] = [];
  let mismatchedCount = 0;
  for (const issue of issues) {
    if (issue.validTimezone === entry.localTimezone) matched.push(issue);
    else mismatchedCount += 1;
  }
  return { matched, mismatchedCount };
}

/**
 * 21-03's issuance-collapse key includes `beach_id`.
 *
 * It is inert today because Seaside emits `beach_id: null` on every row. The
 * day Seaside starts resolving it, an older `null` row and a newer resolved row
 * of the same call stop collapsing and 21-03's supersession P0 silently returns
 * — the stale, bigger issuance wins again. That must not be discovered from a
 * wrong forecast, so it is a loud failure here.
 */
export function assertIssueBeachIdsUnresolved(
  issues: readonly TrustedForecastIssue[],
): void {
  const resolved = issues.filter((issue) => issue.beachId !== null).length;
  if (resolved === 0) return;
  throw new TrustedForecastCoverageError("unresolved_beach_slug", [
    `seaside resolved beach_id on ${resolved} issue rows; the issuance ` +
      "collapse key in trusted-forecast-policy.ts includes beach_id, so a " +
      "null row and a resolved row of the same call would stop collapsing and " +
      "a superseded issuance could win again. Review that key before " +
      "enabling, or set TRUSTED_FORECAST_ADJUSTMENTS_ENABLED=false",
  ]);
}

/**
 * Does any approved entry accept this `(scope_type, region_key, exposure)`?
 * Used by the coverage ratchet to prove the live vocabulary resolves.
 */
export function coverageAcceptsVocabulary(
  scopeType: TrustedForecastScopeType,
  regionKey: string | null,
  exposure: string,
  definitions: readonly TrustedForecastCoverageDefinition[] = TRUSTED_FORECAST_COVERAGE_DEFINITIONS,
): boolean {
  if (regionKey === null) return false;
  return definitions.some((definition) => {
    const keys =
      scopeType === "spot"
        ? definition.spotRegionKeys
        : definition.regionalRegionKeys;
    if (!keys.includes(regionKey)) return false;
    return isExposureCompatible(
      {
        beachId: "",
        localTimezone: definition.localTimezone,
        spotRegionKeys: definition.spotRegionKeys,
        regionalRegionKeys: definition.regionalRegionKeys,
        compatibleExposures: definition.compatibleExposures,
        regionalAuthorityLineages: definition.regionalAuthorityLineages,
      },
      exposure,
    );
  });
}
