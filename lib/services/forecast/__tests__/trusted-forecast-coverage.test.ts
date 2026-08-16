/**
 * Coverage authorship ratchet (Phase 21, 21-04).
 *
 * Seaside emits `beach_id: null` on every row, so coverage is the ONLY bridge
 * from a source's `(scope_type, region_key, exposure)` triple to a Quiver
 * beach. An unresolvable configured slug produces a named coverage error and a
 * baseline fallback, which is why the assertions below are driven by the 196
 * REAL rows from 21-01's shipped parsers rather than by anything authored here.
 *
 * Fixture provenance: every row read in this file comes verbatim from
 * `trusted-forecast-issues.real.json` (21-03's fixture, independently verified
 * byte-identical by its critic). The only synthetic values are coverage
 * definitions — coverage is operator configuration, not source data — and two
 * explicitly derived issue rows, each marked with `derivedIssue(...)` and a
 * note.
 */

import {
  TRUSTED_FORECAST_COVERAGE_DEFINITIONS,
  TRUSTED_FORECAST_SOURCE_KEYS,
  TRUSTED_FORECAST_SOURCE_REGION_KEYS,
  TRUSTED_FORECAST_SOURCE_TIMEZONES,
  TRUSTED_FORECAST_UNCOVERED_VOCABULARY,
  TrustedForecastCoverageError,
  WAVECAST_SOCAL_CHART_SLUGS,
  assertCoverageTimezonesAgree,
  assertIssueBeachIdsUnresolved,
  coverageAcceptsVocabulary,
  partitionIssuesByCoverageTimezone,
  resolveTrustedForecastCoveragePolicy,
  trustedForecastCoverageBeachSlugs,
  type TrustedForecastCoverageDefinition,
} from "../trusted-forecast-coverage";
import {
  coverageEntryForBeach,
  parseTrustedForecastIssue,
  selectTrustedForecastAuthority,
  type TrustedForecastCoverageEntry,
  type TrustedForecastIssue,
  type TrustedForecastScopeType,
} from "../trusted-forecast-policy";
import {
  REAL_ISSUE_FIXTURE,
  derivedIssue,
  realIssue,
  storedIssueId,
} from "./fixtures/trusted-forecast-real-issues";

interface RealRow {
  readonly documentId: string;
  readonly index: number;
  readonly row: Record<string, unknown>;
}

function allRealRows(): RealRow[] {
  const rows: RealRow[] = [];
  for (const [documentId, document] of Object.entries(
    REAL_ISSUE_FIXTURE.documents,
  )) {
    document.issues.forEach((row, index) => {
      rows.push({ documentId, index, row });
    });
  }
  return rows;
}

function vocabularyKey(
  scopeType: string,
  regionKey: string | null,
  exposure: string,
): string {
  return `${scopeType}|${regionKey ?? "<null>"}|${exposure}`;
}

const REAL_ROWS = allRealRows();

/** Every distinct triple the live sources actually emit. */
const REAL_VOCABULARY = new Map<
  string,
  { scopeType: string; regionKey: string | null; exposure: string; count: number; authorityCount: number }
>();
for (const { row } of REAL_ROWS) {
  const scopeType = row.scope_type as string;
  const regionKey = (row.region_key as string | null) ?? null;
  const exposure = row.exposure as string;
  const key = vocabularyKey(scopeType, regionKey, exposure);
  const existing = REAL_VOCABULARY.get(key);
  if (existing === undefined) {
    REAL_VOCABULARY.set(key, {
      scopeType,
      regionKey,
      exposure,
      count: 1,
      authorityCount: row.authority_eligible === true ? 1 : 0,
    });
  } else {
    existing.count += 1;
    if (row.authority_eligible === true) existing.authorityCount += 1;
  }
}

function coverageError(run: () => unknown): TrustedForecastCoverageError | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof TrustedForecastCoverageError ? error : null;
  }
}

function coverageErrorCode(run: () => unknown): string | null {
  return coverageError(run)?.code ?? null;
}

function definitionEntry(
  definition: TrustedForecastCoverageDefinition,
  beachId: string,
): TrustedForecastCoverageEntry {
  return {
    beachId,
    localTimezone: definition.localTimezone,
    spotRegionKeys: definition.spotRegionKeys,
    regionalRegionKeys: definition.regionalRegionKeys,
    compatibleExposures: definition.compatibleExposures,
    regionalAuthorityLineages: definition.regionalAuthorityLineages,
  };
}

describe("trusted forecast coverage — the live vocabulary resolves", () => {
  it("the real corpus carries the vocabulary this phase said it would", () => {
    // These are the shapes the 21-03 critic named explicitly. If a corpus
    // refresh drops one, the coverage assertions below would go vacuously green
    // without this.
    expect(REAL_ROWS).toHaveLength(196);
    const exposures = new Set(
      [...REAL_VOCABULARY.values()].map((entry) => entry.exposure),
    );
    expect(exposures.has("NNW")).toBe(true);
    expect(exposures.has("SSW")).toBe(true);
    expect(exposures.has("primary")).toBe(true);
    expect(exposures.has("dominant")).toBe(true);
    expect(exposures.has("kauai/NORTH")).toBe(true);

    const spotRegionKeys = new Set(
      [...REAL_VOCABULARY.values()]
        .filter((entry) => entry.scopeType === "spot")
        .map((entry) => entry.regionKey),
    );
    // 21-01 round 4 made the socal chart slug the region key.
    expect(spotRegionKeys.has("trestles")).toBe(true);
    expect(spotRegionKeys.has("malibu")).toBe(true);
    expect(spotRegionKeys.has("huntington-beach")).toBe(true);
    for (const key of spotRegionKeys) {
      expect(WAVECAST_SOCAL_CHART_SLUGS).toContain(key);
    }
  });

  it("every real combination is either covered or explicitly, individually excused", () => {
    const uncovered = new Set(
      TRUSTED_FORECAST_UNCOVERED_VOCABULARY.map((entry) =>
        vocabularyKey(entry.scopeType, entry.regionKey, entry.exposure),
      ),
    );

    const unclaimed: string[] = [];
    const doubleClaimed: string[] = [];
    for (const [key, entry] of REAL_VOCABULARY) {
      const covered = coverageAcceptsVocabulary(
        entry.scopeType as TrustedForecastScopeType,
        entry.regionKey,
        entry.exposure,
      );
      if (covered && uncovered.has(key)) doubleClaimed.push(key);
      if (!covered && !uncovered.has(key)) unclaimed.push(key);
    }

    expect(unclaimed).toEqual([]);
    expect(doubleClaimed).toEqual([]);
  });

  it("no excused combination is stale — each one is really in the corpus", () => {
    const stale = TRUSTED_FORECAST_UNCOVERED_VOCABULARY.filter(
      (entry) =>
        !REAL_VOCABULARY.has(
          vocabularyKey(entry.scopeType, entry.regionKey, entry.exposure),
        ),
    ).map((entry) => vocabularyKey(entry.scopeType, entry.regionKey, entry.exposure));
    expect(stale).toEqual([]);
  });

  it("every excused combination says why, at length", () => {
    for (const entry of TRUSTED_FORECAST_UNCOVERED_VOCABULARY) {
      expect(entry.reason.trim().length).toBeGreaterThan(40);
    }
  });

  it("no coverage entry is inert: each resolves at least one real authority row", () => {
    expect(TRUSTED_FORECAST_COVERAGE_DEFINITIONS.length).toBeGreaterThan(0);
    for (const definition of TRUSTED_FORECAST_COVERAGE_DEFINITIONS) {
      const matched = [...REAL_VOCABULARY.values()].filter(
        (entry) =>
          entry.authorityCount > 0 &&
          coverageAcceptsVocabulary(
            entry.scopeType as TrustedForecastScopeType,
            entry.regionKey,
            entry.exposure,
            [definition],
          ),
      );
      // Named so a failure says WHICH entry went inert.
      expect(`${definition.beachSlug}:${matched.length > 0}`).toBe(
        `${definition.beachSlug}:true`,
      );
    }
  });

  it("every beachSlug is one verified against the live beaches table", () => {
    // The feature shipped inert because both slugs were plausible and neither
    // existed. Nothing else here can catch that: a wrong slug is well-typed,
    // reads correctly, and only fails at run time against the real table.
    const verified = new Set(["lower-trestles", "malibu-first-point-surfrider"]);
    const unverified = TRUSTED_FORECAST_COVERAGE_DEFINITIONS.map(
      (definition) => definition.beachSlug,
    ).filter((beachSlug) => !verified.has(beachSlug));
    expect(unverified).toEqual([]);
  });

  it("no coverage entry's compatibleExposures silently excludes all of its own rows", () => {
    for (const definition of TRUSTED_FORECAST_COVERAGE_DEFINITIONS) {
      const acceptedKeys = new Set([
        ...definition.spotRegionKeys,
        ...definition.regionalRegionKeys,
      ]);
      // Rows this entry claims on scope alone, before exposure is consulted.
      const scopeMatched = [...REAL_VOCABULARY.values()].filter(
        (entry) =>
          entry.regionKey !== null &&
          entry.authorityCount > 0 &&
          acceptedKeys.has(entry.regionKey),
      );
      expect(scopeMatched.length).toBeGreaterThan(0);
      const exposureMatched = scopeMatched.filter((entry) =>
        coverageAcceptsVocabulary(
          entry.scopeType as TrustedForecastScopeType,
          entry.regionKey,
          entry.exposure,
          [definition],
        ),
      );
      expect(`${definition.beachSlug}:${exposureMatched.length > 0}`).toBe(
        `${definition.beachSlug}:true`,
      );
    }
  });

  it("a covered beach really produces a primary authority from real rows end to end", () => {
    const trestles = TRUSTED_FORECAST_COVERAGE_DEFINITIONS.find(
      (definition) => definition.beachSlug === "lower-trestles",
    );
    expect(TRUSTED_FORECAST_COVERAGE_DEFINITIONS.map((d) => d.beachSlug)).toContain(
      "lower-trestles",
    );
    const entry = definitionEntry(
      trestles as TrustedForecastCoverageDefinition,
      "00000000-0000-4000-8000-00000000beac",
    );

    const chartRows = REAL_ROWS.filter(
      ({ row }) => row.region_key === "trestles" && row.authority_eligible === true,
    );
    expect(chartRows.length).toBeGreaterThan(0);

    const issues = chartRows.map(({ documentId, index }) =>
      realIssue(documentId, index),
    );
    const localDate = issues[0].validLocalDate;
    const selection = selectTrustedForecastAuthority({
      entry,
      localDate,
      issues,
      buildAnchorAt: new Date(issues[0].issuedAt.getTime() + 60 * 60 * 1000),
    });

    expect(selection.primary).not.toBeNull();
    expect(selection.primaryTier).toBe("spot_wavecast");
    expect(selection.primary?.maxFaceFt).toBeGreaterThan(0);
  });
});

describe("trusted forecast coverage — timezone soundness (21-03 critic defect 4)", () => {
  it("every accepted region key belongs to sources stamping the entry's own zone", () => {
    expect(() => assertCoverageTimezonesAgree()).not.toThrow();
  });

  it("an entry whose zone disagrees with its source is a named failure", () => {
    const wrong: TrustedForecastCoverageDefinition = {
      ...TRUSTED_FORECAST_COVERAGE_DEFINITIONS[0],
      localTimezone: "Pacific/Honolulu",
    };
    expect(() => assertCoverageTimezonesAgree([wrong])).toThrow(
      TrustedForecastCoverageError,
    );
    expect(coverageErrorCode(() => assertCoverageTimezonesAgree([wrong]))).toBe(
      "timezone_disagreement",
    );
  });

  it("a row stamped in another zone is dropped, not compared by string equality", () => {
    const entry = definitionEntry(
      TRUSTED_FORECAST_COVERAGE_DEFINITIONS[0],
      "00000000-0000-4000-8000-00000000beac",
    );
    const local = realIssue("wavecast_spot_chart_live_trestles", 0);
    const foreign = derivedIssue({
      label: "coverage_timezone_mismatch",
      from: { document: "wavecast_spot_chart_live_trestles", index: 0 },
      overrides: { valid_timezone: "Pacific/Honolulu" },
      note:
        "No live source emits a spot-chart row stamped in a zone other than " +
        "its configured one, so the mismatch branch is unreachable from the " +
        "corpus and must be derived to be observable at all.",
    });

    const partition = partitionIssuesByCoverageTimezone(entry, [local, foreign]);
    expect(partition.matched).toEqual([local]);
    expect(partition.mismatchedCount).toBe(1);
  });

  it("the corpus alone cannot reach the timezone-mismatch branch", () => {
    const zonesBySource = new Map<string, Set<string>>();
    for (const { row } of REAL_ROWS) {
      const sourceKey = row.source_key as string;
      const zones = zonesBySource.get(sourceKey) ?? new Set<string>();
      zones.add(row.valid_timezone as string);
      zonesBySource.set(sourceKey, zones);
    }
    for (const [sourceKey, zones] of zonesBySource) {
      expect([...zones]).toEqual([TRUSTED_FORECAST_SOURCE_TIMEZONES[sourceKey]]);
    }
  });
});

describe("trusted forecast coverage — resolution is loud, never silent", () => {
  it("an unresolvable beach slug throws instead of dropping the entry", () => {
    expect(() =>
      resolveTrustedForecastCoveragePolicy(new Map()),
    ).toThrow(TrustedForecastCoverageError);
    const raised = coverageError(() =>
      resolveTrustedForecastCoveragePolicy(new Map()),
    );
    expect(raised?.code).toBe("unresolved_beach_slug");
    expect(raised?.detail).toEqual(trustedForecastCoverageBeachSlugs());
  });

  it("a duplicated slug is a configuration error, not a silently picked winner", () => {
    const duplicated = [
      TRUSTED_FORECAST_COVERAGE_DEFINITIONS[0],
      TRUSTED_FORECAST_COVERAGE_DEFINITIONS[0],
    ];
    const ids = new Map([
      [TRUSTED_FORECAST_COVERAGE_DEFINITIONS[0].beachSlug, "00000000-0000-4000-8000-00000000beac"],
    ]);
    expect(() =>
      resolveTrustedForecastCoveragePolicy(ids, duplicated),
    ).toThrow(/duplicate_beach_slug/);
  });

  it("a resolved policy yields exactly one entry per covered beach", () => {
    const ids = new Map(
      trustedForecastCoverageBeachSlugs().map((slug, index) => [
        slug,
        `00000000-0000-4000-8000-00000000bea${index}`,
      ]),
    );
    const policy = resolveTrustedForecastCoveragePolicy(ids);
    expect(policy.entries).toHaveLength(
      trustedForecastCoverageBeachSlugs().length,
    );
    for (const [slug, beachId] of ids) {
      const entry = coverageEntryForBeach(policy, beachId);
      expect(entry).not.toBeNull();
      expect(entry?.localTimezone).toBe(
        TRUSTED_FORECAST_COVERAGE_DEFINITIONS.find(
          (definition) => definition.beachSlug === slug,
        )?.localTimezone,
      );
    }
  });
});

describe("trusted forecast coverage — the beach_id collapse-key hazard", () => {
  it("every real row still carries a null beach_id", () => {
    const resolved = REAL_ROWS.filter(({ row }) => row.beach_id !== null);
    expect(resolved).toEqual([]);
  });

  it("a resolved beach_id is a loud failure, because the collapse key includes it", () => {
    const rows: TrustedForecastIssue[] = [realIssue("wavecast_regional_live_new_york", 0)];
    expect(() => assertIssueBeachIdsUnresolved(rows)).not.toThrow();

    const resolvedRow = derivedIssue({
      label: "coverage_seaside_resolved_beach_id",
      from: { document: "wavecast_regional_live_new_york", index: 0 },
      overrides: { beach_id: "00000000-0000-4000-8000-00000000beac" },
      note:
        "Seaside never resolves beach_id today, so this shape cannot come from " +
        "the corpus; it exists to prove the guard fires the day it starts to, " +
        "before an un-collapsed superseded issuance can win again.",
    });
    expect(() => assertIssueBeachIdsUnresolved([resolvedRow])).toThrow(
      /collapse key/,
    );
  });
});

describe("trusted forecast coverage — the Seaside source inventory", () => {
  it("pins all 41 canonical source keys so an unknown one cannot inherit a silent bound", () => {
    expect([...TRUSTED_FORECAST_SOURCE_KEYS]).toEqual([
      "socal",
      "hawaii",
      "new_england",
      "new_york",
      "new_jersey",
      "north_carolina",
      "florida_east_coast",
      "norcal",
      "central_california",
      "baja",
      "nws_hawaii_srf",
      "nws_akq_srf",
      "nws_box_srf",
      "nws_bro_srf",
      "nws_car_srf",
      "nws_chs_srf",
      "nws_crp_srf",
      "nws_eka_srf",
      "nws_gum_srf",
      "nws_gyx_srf",
      "nws_ilm_srf",
      "nws_jax_srf",
      "nws_lox_srf",
      "nws_mfl_srf",
      "nws_mhx_srf",
      "nws_mlb_srf",
      "nws_mob_srf",
      "nws_mtr_srf",
      "nws_okx_srf",
      "nws_phi_srf",
      "nws_pqr_srf",
      "nws_sgx_srf",
      "nws_sju_srf",
      "nws_tae_srf",
      "nws_tbw_srf",
      "surf_institute_pnw",
      "stormsurf_pnw_links",
      "stormsurf_pnw_buoy",
      "stormsurf_ny_shortcast",
      "nj_beach_cams_reports",
      "surfers_view_nj",
    ]);
    expect(Object.keys(TRUSTED_FORECAST_SOURCE_REGION_KEYS).sort()).toEqual(
      [...TRUSTED_FORECAST_SOURCE_KEYS].sort(),
    );
  });

  it("every real row's source_key and region_key are inside the pinned inventory", () => {
    for (const { row } of REAL_ROWS) {
      const sourceKey = row.source_key as string;
      expect(TRUSTED_FORECAST_SOURCE_KEYS).toContain(sourceKey);
      expect(TRUSTED_FORECAST_SOURCE_REGION_KEYS[sourceKey]).toContain(
        row.region_key as string,
      );
    }
  });

  it("stored issue ids stay distinct so fixture rows never alias", () => {
    const ids = new Set(
      REAL_ROWS.map(({ documentId, index }) => storedIssueId(documentId, index)),
    );
    expect(ids.size).toBe(REAL_ROWS.length);
  });

  it("rejects a row whose contract is violated rather than coercing it", () => {
    const row = { ...REAL_ROWS[0].row, day_part: "afternoon" };
    expect(() => parseTrustedForecastIssue(row)).toThrow(/day_part/);
  });
});
