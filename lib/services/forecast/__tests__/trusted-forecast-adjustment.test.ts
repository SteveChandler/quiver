/**
 * 21-03 Tasks 1 and 3 — the versioned authority policy and the pure local-day
 * decision engine (D-05 through D-16).
 *
 * FIXTURE PROVENANCE. Every issue here comes from
 * `fixtures/trusted-forecast-issues.real.json`, which holds 196 rows produced
 * by 21-01's shipped Seaside parsers over the bounded corpus. `realIssue(...)`
 * uses a row verbatim. `derivedIssue(...)` is a real row plus explicitly named
 * overrides and a mandatory note saying why the live corpus cannot produce that
 * shape — four of the seventeen sources are disabled and emit nothing, and no
 * live pair of independent lineages disagrees by more than a foot.
 *
 * Slots and coverage entries are NOT source data: slots are Quiver's own
 * post-offset baseline, and coverage is operator configuration.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

import {
  TRUSTED_FORECAST_ALERT_RANGE_SEPARATION,
  appliedDeltaFtForGap,
  buildTrustedForecastDecisions,
  isEligibleHorizon,
  isLocalDateFullyCoveredByBuildWindow,
  isTrustedForecastAdjustmentEnabled,
  localDateInTimeZone,
  nearestEdgeSeparationFt,
  signedGapFt,
  type ExistingTrustedForecastDecision,
  type TrustedForecastEngineResult,
  type TrustedForecastSlot,
} from "../trusted-forecast-adjustment";
import {
  TRUSTED_FORECAST_POLICY_VERSION,
  coverageEntryForBeach,
  dayPartsOverlap,
  freshnessMaxAgeHoursForSource,
  parseTrustedForecastIssue,
  selectTrustedForecastAuthority,
  type TrustedForecastCoverageEntry,
  type TrustedForecastCoveragePolicy,
  type TrustedForecastIssue,
} from "../trusted-forecast-policy";
import {
  REAL_ISSUE_FIXTURE,
  derivedIssue as createDerivedIssue,
  derivedIssueInventory,
  realIssue as createRealIssue,
  realIssueDocument,
  realIssueRow,
} from "./fixtures/trusted-forecast-real-issues";

// ---------------------------------------------------------------------------
// Fixture selection helpers
// ---------------------------------------------------------------------------

interface RealIssueQuery {
  readonly validLocalDate?: string;
  readonly exposure?: string;
  readonly dayPart?: string;
}

/** Exactly-one lookup: a corpus change that removes the row fails loudly. */
function findRealIndex(documentId: string, query: RealIssueQuery): number {
  const matches: number[] = [];
  realIssueDocument(documentId).issues.forEach((row, index) => {
    if (
      query.validLocalDate !== undefined &&
      row.valid_local_date !== query.validLocalDate
    ) {
      return;
    }
    if (query.exposure !== undefined && row.exposure !== query.exposure) return;
    if (query.dayPart !== undefined && row.day_part !== query.dayPart) return;
    matches.push(index);
  });
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one ${documentId} row for ${JSON.stringify(query)}, found ${matches.length}`,
    );
  }
  return matches[0];
}

function realIssueWhere(
  documentId: string,
  query: RealIssueQuery,
): TrustedForecastIssue {
  return realIssue(documentId, findRealIndex(documentId, query));
}

function realRef(documentId: string, query: RealIssueQuery) {
  return { document: documentId, index: findRealIndex(documentId, query) };
}

/**
 * Most pre-existing engine cases exercise mechanics that remain valid for a
 * spot authority. Their captured rows predate the regional evidence-only
 * boundary, so the test adapter keeps their ranges and provenance while
 * making the intended spot-policy input explicit. The raw helper below is
 * reserved for tests of the new regional boundary itself.
 */
function asSpotPolicyInput(issue: TrustedForecastIssue): TrustedForecastIssue {
  if (issue.scopeType !== "regional" || issue.providerLineage !== "wavecast") {
    return issue;
  }
  return { ...issue, scopeType: "spot" };
}

function realIssue(documentId: string, index: number): TrustedForecastIssue {
  return asSpotPolicyInput(createRealIssue(documentId, index));
}

function derivedIssue(
  args: Parameters<typeof createDerivedIssue>[0],
): TrustedForecastIssue {
  return asSpotPolicyInput(createDerivedIssue(args));
}

function rawDerivedIssue(
  args: Parameters<typeof createDerivedIssue>[0],
): TrustedForecastIssue {
  return createDerivedIssue(args);
}

function rawRegionalIssue(
  documentId: string,
  query: RealIssueQuery,
): TrustedForecastIssue {
  return createRealIssue(documentId, findRealIndex(documentId, query));
}

function wavecastNewYorkSpot(
  label: string,
  overrides: Record<string, unknown> = {},
): TrustedForecastIssue {
  return derivedIssue({
    label,
    from: realRef("wavecast_regional_live_new_york", {
      validLocalDate: "2026-08-06",
    }),
    overrides: {
      region_key: "new_york",
      exposure: "primary",
      ...overrides,
    },
    note:
      "The captured WaveCast New York regional row is adapted to the explicit " +
      "spot-policy shape needed by this engine test; production regional rows " +
      "are covered by the regional evidence-only test.",
  });
}

function wavecastKauaiSpot(
  label: string,
  overrides: Record<string, unknown> = {},
): TrustedForecastIssue {
  return derivedIssue({
    label,
    from: realRef("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    }),
    overrides: {
      region_key: "hawaii",
      exposure: "kauai/NORTH",
      ...overrides,
    },
    note:
      "The captured WaveCast Hawaii row is adapted to the explicit spot-policy " +
      "shape needed to keep the local day-part engine test independent of the " +
      "regional authority boundary.",
  });
}

// ---------------------------------------------------------------------------
// Coverage configuration (operator policy, not source data)
// ---------------------------------------------------------------------------

const OAHU_NORTH: TrustedForecastCoverageEntry = {
  beachId: "11111111-1111-4111-8111-111111111111",
  localTimezone: "Pacific/Honolulu",
  spotRegionKeys: ["hawaii"],
  regionalRegionKeys: ["hawaii"],
  // WaveCast names the swell direction; NWS names the shore. Both describe
  // this beach's exposure. SSW deliberately does not.
  compatibleExposures: ["NNW", "oahu/NORTH"],
  regionalAuthorityLineages: ["nws_hfo"],
};

const LONG_ISLAND: TrustedForecastCoverageEntry = {
  beachId: "22222222-2222-4222-8222-222222222222",
  localTimezone: "America/New_York",
  spotRegionKeys: ["new_york"],
  regionalRegionKeys: ["new_york"],
  compatibleExposures: ["primary"],
  regionalAuthorityLineages: ["stormsurf"],
};

/**
 * Pairs the real WaveCast Trestles spot chart with the real WaveCast Hawaii
 * regional page so tier precedence inside one lineage is exercised. Coverage is
 * operator configuration, so pairing two real documents here configures the
 * test; it does not fabricate forecast data.
 */
const SPOT_OVER_REGIONAL: TrustedForecastCoverageEntry = {
  beachId: "33333333-3333-4333-8333-333333333333",
  localTimezone: "America/Los_Angeles",
  spotRegionKeys: ["trestles"],
  regionalRegionKeys: ["hawaii"],
  compatibleExposures: ["NNW"],
  regionalAuthorityLineages: [],
};

const NORCAL: TrustedForecastCoverageEntry = {
  beachId: "44444444-4444-4444-8444-444444444444",
  localTimezone: "America/Los_Angeles",
  spotRegionKeys: ["norcal"],
  regionalRegionKeys: ["norcal"],
  compatibleExposures: ["primary"],
  regionalAuthorityLineages: [],
};

const PNW: TrustedForecastCoverageEntry = {
  beachId: "55555555-5555-4555-8555-555555555555",
  localTimezone: "America/Los_Angeles",
  spotRegionKeys: ["pnw"],
  regionalRegionKeys: ["pnw"],
  compatibleExposures: ["coastal", "surf"],
  regionalAuthorityLineages: ["surf_institute", "stormsurf"],
};

const NEW_JERSEY: TrustedForecastCoverageEntry = {
  beachId: "66666666-6666-4666-8666-666666666666",
  localTimezone: "America/New_York",
  spotRegionKeys: ["new_jersey"],
  regionalRegionKeys: ["new_jersey"],
  compatibleExposures: ["primary"],
  regionalAuthorityLineages: ["surfers_view"],
};

// ---------------------------------------------------------------------------
// Slot helpers (Quiver baseline, not source data)
// ---------------------------------------------------------------------------

function slotAt(
  iso: string,
  baselineMaxFaceFt: number | null,
  anchor: Date,
): TrustedForecastSlot {
  const forecastAt = new Date(iso);
  return {
    forecastAt,
    forecastHorizonHours:
      (forecastAt.getTime() - anchor.getTime()) / 3_600_000,
    baselineMaxFaceFt,
  };
}

function onlyDecision(result: TrustedForecastEngineResult) {
  expect(result.decisions).toHaveLength(1);
  return result.decisions[0];
}

// ---------------------------------------------------------------------------
// D-05 / D-06 / D-07 / D-08 — lineage and evidence class
// ---------------------------------------------------------------------------

describe("MFA-03 lineage and evidence filtering (D-05 through D-08)", () => {
  const anchor = new Date("2026-08-06T18:00:00.000Z");

  it("D-08: an unconvertible height scale stays evidence-only and cannot be authority", () => {
    // REAL. surf.institute reports metres significant-wave-height, so 21-01
    // emits `measurement_basis: unspecified` with no face range at all.
    const evidence = [
      realIssueWhere("surf_institute_pnw_live", { exposure: "coastal" }),
      realIssueWhere("surf_institute_pnw_live", { exposure: "surf" }),
    ];
    expect(evidence.map((issue) => issue.measurementBasis)).toEqual([
      "unspecified",
      "unspecified",
    ]);
    expect(evidence.map((issue) => issue.minFaceFt)).toEqual([null, null]);

    const selection = selectTrustedForecastAuthority({
      entry: PNW,
      localDate: "2026-08-06",
      issues: evidence,
      buildAnchorAt: anchor,
    });
    expect(selection.primary).toBeNull();
    expect(selection.excluded.map((entry) => entry.reason)).toEqual([
      "non_authority_evidence_class",
      "non_authority_evidence_class",
    ]);

    const result = buildTrustedForecastDecisions({
      coverage: PNW,
      issues: evidence,
      slots: [slotAt("2026-08-06T18:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
    });
    expect(onlyDecision(result).status).toBe("no_authority");
    expect(onlyDecision(result).appliedDeltaFt).toBe(0);
  });

  it("D-07: a model/buoy row never becomes a human face-height authority", () => {
    const modelRow = derivedIssue({
      label: "stormsurf_pnw_buoy_model_evidence",
      from: realRef("stormsurf_ny_shortcast_live", {
        validLocalDate: "2026-08-06",
      }),
      overrides: {
        source_key: "stormsurf_pnw_buoy",
        parser_version: "stormsurf-pnw-buoy-v1",
        region_key: "pnw",
        evidence_class: "model_buoy_evidence",
        authority_eligible: false,
        measurement_basis: "unspecified",
        min_face_ft: null,
        max_face_ft: null,
        exposure: "coastal",
      },
      note:
        "stormsurf_pnw_buoy is enabled: false in the 17-source registry and emits nothing live, so no real row carries evidence_class=model_buoy_evidence. Fields copied from the registry entry.",
    });

    const selection = selectTrustedForecastAuthority({
      entry: PNW,
      localDate: "2026-08-06",
      issues: [modelRow],
      buildAnchorAt: anchor,
    });
    expect(selection.primary).toBeNull();
    expect(selection.excluded).toEqual([
      { issue: modelRow, reason: "non_authority_evidence_class" },
    ]);
  });

  it("D-06: regional Stormsurf endpoints cannot produce a vote", () => {
    const real = rawRegionalIssue("stormsurf_ny_shortcast_live", {
      validLocalDate: "2026-08-06",
    });
    const secondEndpoint = rawDerivedIssue({
      label: "stormsurf_second_endpoint_same_lineage",
      from: realRef("stormsurf_ny_shortcast_live", {
        validLocalDate: "2026-08-06",
      }),
      overrides: {
        source_key: "stormsurf_pnw_links",
        parser_version: "stormsurf-pnw-links-v1",
        min_face_ft: 6,
        max_face_ft: 8,
        issue_identity_key: "b".repeat(64),
        revision_hash: "c".repeat(64),
      },
      note:
        "Only stormsurf_ny_shortcast is enabled among the three Stormsurf endpoints, so the live corpus can never show two Stormsurf rows for one beach/day.",
    });

    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [real, secondEndpoint],
      buildAnchorAt: anchor,
    });

    // Regression: regional Stormsurf rows cannot vote at all, even when the
    // row is authority-eligible and multiple endpoints share one lineage.
    expect(selection.primary).toBeNull();
    expect(selection.corroborators).toEqual([]);
    expect(selection.excluded).toEqual([
      { issue: real, reason: "regional_evidence_only" },
      { issue: secondEndpoint, reason: "regional_evidence_only" },
    ]);
  });

  it("D-05: regional NJ mirrors cannot produce a vote", () => {
    const njBeachCams = rawDerivedIssue({
      label: "nj_beach_cams_authority_shape",
      from: realRef("wavecast_regional_live_new_york", {
        validLocalDate: "2026-08-06",
      }),
      overrides: {
        provider_lineage: "surfers_view",
        source_key: "nj_beach_cams_reports",
        parser_version: "nj-beach-cams-v1",
        region_key: "new_jersey",
        min_face_ft: 1,
        max_face_ft: 2,
        issue_identity_key: "d".repeat(64),
        revision_hash: "e".repeat(64),
      },
      note: "Both NJ sources are enabled: false AND evidence_only in the registry (their pages are iframe shells reporting significant wave height), so no authority-eligible surfers_view row can exist live. Promoted here solely to prove the mirrors still cast one vote.",
    });
    const surfersView = rawDerivedIssue({
      label: "surfers_view_authority_shape",
      from: realRef("wavecast_regional_live_new_york", {
        validLocalDate: "2026-08-06",
      }),
      overrides: {
        provider_lineage: "surfers_view",
        source_key: "surfers_view_nj",
        parser_version: "surfers-view-nj-v1",
        region_key: "new_jersey",
        min_face_ft: 5,
        max_face_ft: 6,
        issue_identity_key: "f".repeat(64),
        revision_hash: "0".repeat(64),
      },
      note:
        "The same disabled, evidence-only upstream iframe as nj_beach_cams_authority_shape; promoted to authority only so the shared-lineage rule is observable.",
    });

    const selection = selectTrustedForecastAuthority({
      entry: NEW_JERSEY,
      localDate: "2026-08-06",
      issues: [njBeachCams, surfersView],
      buildAnchorAt: anchor,
    });
    // Regression: regional mirrors remain evidence-only; shared lineage must
    // not turn either one into a beach-specific authority.
    expect(selection.primary).toBeNull();
    expect(selection.corroborators).toEqual([]);
    expect(selection.excluded).toEqual([
      { issue: njBeachCams, reason: "regional_evidence_only" },
      { issue: surfersView, reason: "regional_evidence_only" },
    ]);
  });

  it("same-lineage disagreement can neither corroborate nor block", () => {
    const anchorHere = new Date("2026-08-06T12:00:00.000Z");
    const real = realIssueWhere("stormsurf_ny_shortcast_live", {
      validLocalDate: "2026-08-06",
    });
    const loud = derivedIssue({
      label: "stormsurf_loud_second_endpoint",
      from: realRef("stormsurf_ny_shortcast_live", {
        validLocalDate: "2026-08-06",
      }),
      overrides: {
        source_key: "stormsurf_pnw_links",
        parser_version: "stormsurf-pnw-links-v1",
        min_face_ft: 6,
        max_face_ft: 8,
        issue_identity_key: "1".repeat(64),
        revision_hash: "2".repeat(64),
      },
      note:
        "Second Stormsurf endpoint disagreeing by 5 ft; unreachable live because the other Stormsurf endpoints are disabled.",
    });

    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [real, loud],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 7, anchorHere)],
      buildAnchorAt: anchorHere,
    });
    expect(result.alerts).toEqual([]);
    expect(onlyDecision(result).status).not.toBe("blocked_conflict");
  });
});

// ---------------------------------------------------------------------------
// D-09 / D-10 — precedence, freshness, single authority
// ---------------------------------------------------------------------------

describe("MFA-03 authority precedence (D-09, D-10)", () => {
  it("rejects evidence issued materially after the build anchor", () => {
    const issue = wavecastNewYorkSpot("future_dated_wavecast_spot");
    const tooEarly = new Date(issue.issuedAt.getTime() - 10 * 60_000);
    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [issue],
      buildAnchorAt: tooEarly,
    });

    expect(selection.primary).toBeNull();
    expect(selection.excluded).toEqual([{ issue, reason: "future_dated" }]);
  });

  it("allows a small clock-skew tolerance for a nearly simultaneous issue", () => {
    const issue = wavecastNewYorkSpot("clock_skew_wavecast_spot");
    const nearFuture = new Date(issue.issuedAt.getTime() - 4 * 60_000);
    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [issue],
      buildAnchorAt: nearFuture,
    });

    expect(selection.primary?.issueId).toBe(issue.issueId);
  });

  it("allows the current local day but rejects the trailing partial day", () => {
    const buildAnchorAt = new Date("2026-08-06T18:00:00.000Z");

    expect(
      isLocalDateFullyCoveredByBuildWindow({
        localDate: "2026-08-06",
        timeZone: "America/Los_Angeles",
        buildAnchorAt,
      }),
    ).toBe(true);
    expect(
      isLocalDateFullyCoveredByBuildWindow({
        localDate: "2026-08-07",
        timeZone: "America/Los_Angeles",
        buildAnchorAt,
      }),
    ).toBe(true);
    expect(
      isLocalDateFullyCoveredByBuildWindow({
        localDate: "2026-08-13",
        timeZone: "America/Los_Angeles",
        buildAnchorAt,
      }),
    ).toBe(false);
  });

  it("D-09 tier 1: compatible spot WaveCast beats regional WaveCast even when regional reads bigger", () => {
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const spot = realIssueWhere("wavecast_spot_chart_live_trestles", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const biggerRegional = derivedIssue({
      label: "wavecast_regional_out_maxing_the_spot_chart",
      from: realRef("wavecast_regional_live_hawaii", {
        validLocalDate: "2026-08-06",
        exposure: "NNW",
      }),
      overrides: { min_face_ft: 5, max_face_ft: 6 },
      note:
        "In the live corpus the WaveCast spot chart always out-maxes the regional page, so tier precedence and the daily-maximum preference never disagree there. This fixture puts them in conflict, which is the only way the spot-supersedes-regional branch is observable.",
    });

    const selection = selectTrustedForecastAuthority({
      entry: SPOT_OVER_REGIONAL,
      localDate: "2026-08-06",
      issues: [biggerRegional, spot],
      buildAnchorAt: anchor,
    });

    expect(selection.primaryTier).toBe("spot_wavecast");
    expect(selection.primary?.regionKey).toBe("trestles");
    expect(selection.primary?.maxFaceFt).toBe(2);
    // Both are WaveCast, so the regional row is deduped, never a second vote.
    expect(selection.corroborators).toEqual([]);
  });

  it("D-09 tier 2: regional WaveCast cannot become authority over a break", () => {
    // Regression: the old regional WaveCast tier is intentionally unreachable;
    // row authority flags and configured regional lineages cannot override the
    // scope boundary.
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const waveCast = rawRegionalIssue("wavecast_regional_live_new_york", {
      validLocalDate: "2026-08-06",
    });
    const stormsurf = rawRegionalIssue("stormsurf_ny_shortcast_live", {
      validLocalDate: "2026-08-06",
    });

    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [stormsurf, waveCast],
      buildAnchorAt: anchor,
    });

    expect(selection.primary).toBeNull();
    expect(selection.primaryTier).toBeNull();
    expect(selection.corroborators).toEqual([]);
    expect(selection.excluded).toEqual([
      { issue: stormsurf, reason: "regional_evidence_only" },
      { issue: waveCast, reason: "regional_evidence_only" },
    ]);
  });

  it("D-09 tier 3: configured regional authority cannot take over once WaveCast goes stale", () => {
    // WaveCast NY issued 2026-08-06T08:15Z with a 36-hour bound; Stormsurf's NY
    // shortcast issued 2026-08-04T17:09Z with its own 336-hour bound.
    const waveCast = rawRegionalIssue("wavecast_regional_live_new_york", {
      validLocalDate: "2026-08-07",
    });
    const stormsurf = rawRegionalIssue("stormsurf_ny_shortcast_live", {
      validLocalDate: "2026-08-07",
    });
    expect(freshnessMaxAgeHoursForSource("new_york")).toBe(36);
    expect(freshnessMaxAgeHoursForSource("stormsurf_ny_shortcast")).toBe(336);
    expect(waveCast.issuedAt.toISOString()).toBe("2026-08-06T08:15:00.000Z");

    // A fixture on each side of the bound, both within minutes of it.
    const justInside = new Date("2026-08-07T20:15:00.000Z"); // exactly 36.0 h
    const justOutside = new Date("2026-08-07T20:15:00.001Z"); // 36.0 h + 1 ms

    const fresh = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-07",
      issues: [waveCast, stormsurf],
      buildAnchorAt: justInside,
    });
    expect(fresh.primary).toBeNull();

    const stale = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-07",
      issues: [waveCast, stormsurf],
      buildAnchorAt: justOutside,
    });
    expect(stale.primary).toBeNull();
    expect(stale.primaryTier).toBeNull();
    expect(stale.excluded).toEqual([
      { issue: waveCast, reason: "stale" },
      { issue: stormsurf, reason: "regional_evidence_only" },
    ]);
  });

  it("D-10: one valid authority activates with no corroboration at all", () => {
    const anchor = new Date("2026-08-06T12:00:00.000Z");
    const wavecast = wavecastNewYorkSpot("single_wavecast_spot_authority");
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [wavecast],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 9, anchor)],
      buildAnchorAt: anchor,
    });
    const decision = onlyDecision(result);
    expect(decision.status).toBe("applied");
    expect(decision.trustedMinFaceFt).toBe(1);
    expect(decision.trustedMaxFaceFt).toBe(2);
    expect(decision.appliedDeltaFt).toBe(-0.5);
    expect(result.alerts).toEqual([]);
  });

  it("configured regional lineages cannot override the scope boundary", () => {
    const anchor = new Date("2026-08-07T02:00:00.000Z");
    const stormsurf = rawDerivedIssue({
      label: "stormsurf_in_pnw",
      from: realRef("stormsurf_ny_shortcast_live", {
        validLocalDate: "2026-08-06",
      }),
      overrides: { region_key: "pnw", exposure: "coastal" },
      note: "No live region has two enabled non-WaveCast authority lineages: nws_hfo covers only Hawaii and stormsurf only New York.",
    });
    const surfInstitute = rawDerivedIssue({
      label: "surf_institute_promoted_to_authority",
      from: realRef("surf_institute_pnw_live", { exposure: "coastal" }),
      overrides: {
        measurement_basis: "breaking_face_ft",
        evidence_class: "human_face_height_authority",
        authority_eligible: true,
        min_face_ft: 3,
        max_face_ft: 4,
      },
      note:
        "surf.institute publishes metres significant wave height, so 21-01 correctly refuses it authority (D-07/D-08). Promoted only to exercise the configured priority ordering.",
    });

    const surfInstituteFirst = selectTrustedForecastAuthority({
      entry: PNW,
      localDate: "2026-08-06",
      issues: [stormsurf, surfInstitute],
      buildAnchorAt: anchor,
    });
    expect(surfInstituteFirst.primary).toBeNull();
    expect(surfInstituteFirst.excluded).toEqual([
      { issue: stormsurf, reason: "regional_evidence_only" },
      { issue: surfInstitute, reason: "regional_evidence_only" },
    ]);

    const stormsurfFirst = selectTrustedForecastAuthority({
      entry: {
        ...PNW,
        regionalAuthorityLineages: ["stormsurf", "surf_institute"],
      },
      localDate: "2026-08-06",
      issues: [stormsurf, surfInstitute],
      buildAnchorAt: anchor,
    });
    expect(stormsurfFirst.primary).toBeNull();
    expect(stormsurfFirst.excluded).toEqual([
      { issue: stormsurf, reason: "regional_evidence_only" },
      { issue: surfInstitute, reason: "regional_evidence_only" },
    ]);
  });

  it("a stated validity basis outranks a newer derived publication-day window", () => {
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const stated = wavecastNewYorkSpot("stated_wavecast_spot");
    expect(stated.validityBasis).toBe("stated");

    // Deliberately identical in every dimension the comparator ranks ahead of
    // validity basis — same tier, same lineage (so same configured priority),
    // same daily maximum — so ONLY the basis can decide. It is also newer, so a
    // recency-first ordering would pick it.
    const newerDerived = derivedIssue({
      label: "newer_derived_publication_day_authority",
      from: realRef("wavecast_regional_live_new_york", {
        validLocalDate: "2026-08-06",
      }),
      overrides: {
        source_key: "socal",
        parser_version: "socal-v1",
        region_key: "new_york",
        exposure: "primary",
        validity_basis: "derived_publication_day",
        issued_at: "2026-08-06T12:00:00-04:00",
        issue_identity_key: "3".repeat(64),
        revision_hash: "4".repeat(64),
      },
      note: "No live source emits an authority-eligible row with validity_basis=derived_publication_day: the two derived-basis sources (the WaveCast socal index and surf.institute) are both evidence_only. A derived window is the publication DAY, not a stated forecast window, so it must lose to a stated one even when newer.",
    });
    expect(newerDerived.issuedAt.getTime()).toBeGreaterThan(
      stated.issuedAt.getTime(),
    );
    expect(newerDerived.providerLineage).toBe(stated.providerLineage);
    expect(newerDerived.maxFaceFt).toBe(stated.maxFaceFt);

    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [newerDerived, stated],
      buildAnchorAt: anchor,
    });
    expect(selection.primary?.validityBasis).toBe("stated");
    expect(selection.primary?.issueId).toBe(stated.issueId);
    expect(selection.excluded).toEqual([
      { issue: newerDerived, reason: "lineage_dedupe" },
    ]);
  });

  it("an issue with no durable issue_id cannot back a decision", () => {
    // A freshly serialized Seaside row has no `issue_id`; a decision's
    // `primary_issue_id` is a foreign key, so such a row must never be primary.
    const anchor = new Date("2026-08-06T12:00:00.000Z");
    const unstored = parseTrustedForecastIssue(
      realIssueRow(
        "stormsurf_ny_shortcast_live",
        findRealIndex("stormsurf_ny_shortcast_live", {
          validLocalDate: "2026-08-06",
        }),
      ),
    );
    expect(unstored.issueId).toBeNull();

    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [unstored],
      buildAnchorAt: anchor,
    });
    expect(selection.primary).toBeNull();
    expect(selection.excluded).toEqual([
      { issue: unstored, reason: "unstored_issue" },
    ]);

    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [unstored],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 9, anchor)],
      buildAnchorAt: anchor,
    });
    expect(onlyDecision(result).status).toBe("no_authority");
    expect(onlyDecision(result).primaryIssueId).toBeNull();
  });

  it("regional revisions cannot become a beach authority", () => {
    // REAL PAIR. NWS Honolulu has two issuances for this local day, but the
    // scope gate runs before revision ordering and keeps both evidence-only.
    const anchor = new Date("2026-08-07T02:00:00.000Z");
    const evening = rawRegionalIssue("nws_hawaii_srf_live_evening_issuance", {
      validLocalDate: "2026-08-07",
      exposure: "oahu/NORTH",
    });
    const morning = rawDerivedIssue({
      label: "nws_morning_issuance_revised_down_by_the_evening_issuance",
      from: realRef("nws_hawaii_srf_live_morning_issuance", {
        validLocalDate: "2026-08-07",
        exposure: "oahu/NORTH",
      }),
      overrides: {
        min_face_ft: 8,
        max_face_ft: 12,
        revision_hash: "7".repeat(64),
      },
      note:
        "Both NWS issuances of this day are real and both state 0-2 ft, so the corpus cannot show a revision at all — the fourth case of live data agreeing everywhere and hiding a branch. Only the EARLIER row's range moves (and its revision hash with it, since revision_hash covers the measured content); every identity field, issued_at included, is the real morning row's.",
    });
    expect(morning.issuedAt.toISOString()).toBe("2026-08-06T13:06:00.000Z");
    expect(evening.issuedAt.toISOString()).toBe("2026-08-07T01:10:00.000Z");
    expect(morning.issueIdentityKey).not.toBe(evening.issueIdentityKey);
    expect(freshnessMaxAgeHoursForSource("nws_hawaii_srf")).toBe(24);

    for (const issues of [
      [morning, evening],
      [evening, morning],
    ]) {
      const selection = selectTrustedForecastAuthority({
        entry: OAHU_NORTH,
        localDate: "2026-08-07",
        issues,
        buildAnchorAt: anchor,
      });
      // Regression: the regional scope gate runs before source revision
      // ordering, so neither NWS issuance can become a beach authority.
      expect(selection.primary).toBeNull();
      expect(selection.corroborators).toEqual([]);
      expect(selection.excluded).toHaveLength(2);
      expect(selection.excluded).toEqual(
        expect.arrayContaining([
          { issue: morning, reason: "regional_evidence_only" },
          { issue: evening, reason: "regional_evidence_only" },
        ]),
      );
    }

    // And the durable decision's `primary_issue_id` points at the current call.
    const result = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [morning, evening],
      slots: [slotAt("2026-08-07T20:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
    });
    const decision = onlyDecision(result);
    expect(decision.primaryIssueId).toBeNull();
    expect(decision.trustedMaxFaceFt).toBeNull();
  });

  it("does not let an invalid superseder suppress a valid authority", () => {
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const valid = wavecastNewYorkSpot("valid_wavecast_spot");
    const futureSuperseder = wavecastNewYorkSpot(
      "future_superseder_cannot_retract_valid_authority",
      {
        issued_at: new Date(anchor.getTime() + 10 * 60_000).toISOString(),
        supersedes_issue_id: valid.issueId,
        revision_hash: "f".repeat(64),
      },
    );

    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [valid, futureSuperseder],
      buildAnchorAt: anchor,
    });

    expect(selection.primary?.issueId).toBe(valid.issueId);
    expect(selection.excluded).toEqual([
      { issue: futureSuperseder, reason: "future_dated" },
    ]);
  });

  it("selection is stable when every ranked dimension ties", () => {
    // The tie-break is reached through `bestByLineage`, so the pair must share
    // a lineage and tie on tier, configured priority, daily maximum, validity
    // basis, issuance time and day part — leaving only the identity key. They
    // differ in `source_key`, so they are two endpoints of one provider rather
    // than two issuances of one identity, and neither supersedes the other.
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const base = realRef("wavecast_regional_live_new_york", {
      validLocalDate: "2026-08-06",
    });
    const lowKey = derivedIssue({
      label: "tie_break_low_identity_key",
      from: base,
      overrides: {
        source_key: "new_york",
        parser_version: "wavecast-v3",
        region_key: "new_york",
        exposure: "primary",
        issue_identity_key: "0".repeat(64),
        revision_hash: "5".repeat(64),
      },
      note: "Identity-key tie-break needs two otherwise identical rows; the live corpus has 196 rows with 196 distinct identities and no such pair.",
    });
    const highKey = derivedIssue({
      label: "tie_break_high_identity_key",
      from: base,
      overrides: {
        source_key: "socal",
        parser_version: "wavecast-v3",
        region_key: "new_york",
        exposure: "primary",
        issue_identity_key: "f".repeat(64),
        revision_hash: "6".repeat(64),
      },
      note: "Second half of the identity-key tie-break pair. Only stormsurf_ny_shortcast is enabled among the three Stormsurf endpoints, so the corpus can never carry two Stormsurf rows for one beach/day, let alone two that agree exactly.",
    });
    expect(highKey.providerLineage).toBe(lowKey.providerLineage);
    expect(highKey.maxFaceFt).toBe(lowKey.maxFaceFt);
    expect(highKey.issuedAt.getTime()).toBe(lowKey.issuedAt.getTime());
    expect(freshnessMaxAgeHoursForSource("socal")).toBe(96);

    const forward = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [highKey, lowKey],
      buildAnchorAt: anchor,
    });
    const reversed = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [lowKey, highKey],
      buildAnchorAt: anchor,
    });
    expect(forward.primary?.issueIdentityKey).toBe(
      reversed.primary?.issueIdentityKey,
    );
    expect(forward.primary?.issueIdentityKey).toBe("0".repeat(64));
    // Deduped as a second endpoint of one lineage, never as a superseded
    // revision: the collapse must not swallow an independent row.
    expect(forward.excluded).toEqual([
      { issue: highKey, reason: "lineage_dedupe" },
    ]);
  });

  it("two stored revisions of ONE issuance resolve by revision hash, not by size", () => {
    // `trusted_forecast_issues` is UNIQUE on `revision_hash`, so a re-parse of
    // one issuance with different measured content is a second stored row with
    // every identity field — `issued_at` included — identical. Recency cannot
    // separate them; only the content-addressed hash can.
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const base = realRef("wavecast_regional_live_new_york", {
      validLocalDate: "2026-08-06",
    });
    const lowRevision = derivedIssue({
      label: "revision_low_hash_small_range",
      from: base,
      overrides: {
        source_key: "new_york",
        parser_version: "wavecast-v3",
        region_key: "new_york",
        exposure: "primary",
        min_face_ft: 1,
        max_face_ft: 2,
        revision_hash: "1".repeat(64),
      },
      note: "The live corpus has 196 rows with 196 distinct revision hashes and no two revisions of one identity, because each document was fetched once. Only the measured range and the revision hash that covers it move here.",
    });
    const highRevision = derivedIssue({
      label: "revision_high_hash_large_range",
      from: base,
      overrides: {
        source_key: "new_york",
        parser_version: "wavecast-v3",
        region_key: "new_york",
        exposure: "primary",
        min_face_ft: 6,
        max_face_ft: 8,
        revision_hash: "9".repeat(64),
      },
      note: "Second half of the one-identity revision pair; deliberately the LARGER range, so a daily-maximum-first ordering would pick it and the content-addressed tie-break is the only thing that can decide.",
    });
    expect(highRevision.issueIdentityKey).toBe(lowRevision.issueIdentityKey);
    expect(highRevision.issuedAt.getTime()).toBe(
      lowRevision.issuedAt.getTime(),
    );

    for (const issues of [
      [lowRevision, highRevision],
      [highRevision, lowRevision],
    ]) {
      const selection = selectTrustedForecastAuthority({
        entry: LONG_ISLAND,
        localDate: "2026-08-06",
        issues,
        buildAnchorAt: anchor,
      });
      expect(selection.primary?.revisionHash).toBe("1".repeat(64));
      expect(selection.primary?.maxFaceFt).toBe(2);
      expect(selection.excluded).toEqual([
        { issue: highRevision, reason: "superseded" },
      ]);
    }
  });
});

// ---------------------------------------------------------------------------
// D-12 — exposure and scope
// ---------------------------------------------------------------------------

describe("MFA-04 exposure compatibility (D-12)", () => {
  const anchor = new Date("2026-08-06T18:00:00.000Z");

  it("regional scope is evidence-only even when the row is authority-eligible", () => {
    const regional = rawRegionalIssue("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    expect(regional.scopeType).toBe("regional");
    expect(regional.authorityEligible).toBe(true);

    const selection = selectTrustedForecastAuthority({
      entry: OAHU_NORTH,
      localDate: "2026-08-06",
      issues: [regional],
      buildAnchorAt: anchor,
    });

    // Regression: a regional "Hawaii is 0-1 ft" row must not become the
    // primary authority for a named beach merely because ingestion set its
    // authority flag to true.
    expect(selection.primary).toBeNull();
    expect(selection.primaryTier).toBeNull();
    expect(selection.excluded).toEqual([
      { issue: regional, reason: "regional_evidence_only" },
    ]);

    const result = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [regional],
      slots: [slotAt("2026-08-06T20:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
    });
    expect(onlyDecision(result).status).toBe("no_authority");
    expect(onlyDecision(result).appliedDeltaFt).toBe(0);
    expect(result.applications).toEqual([]);
  });

  it("NNW and SSW are never unioned", () => {
    // REAL. The live WaveCast Hawaii page states NNW 0-1 and SSW 1-2 for
    // 2026-08-06. An NNW-facing beach must see 0-1 and nothing wider.
    const nnw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const ssw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "SSW",
    });
    expect([nnw.minFaceFt, nnw.maxFaceFt]).toEqual([0, 1]);
    expect([ssw.minFaceFt, ssw.maxFaceFt]).toEqual([1, 2]);

    const result = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [nnw, ssw],
      slots: [slotAt("2026-08-06T20:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
    });
    const decision = onlyDecision(result);
    expect(decision.trustedMinFaceFt).toBe(0);
    expect(decision.trustedMaxFaceFt).toBe(1);
    expect(decision.primaryIssueId).toBe(nnw.issueId);

    const selection = selectTrustedForecastAuthority({
      entry: OAHU_NORTH,
      localDate: "2026-08-06",
      issues: [nnw, ssw],
      buildAnchorAt: anchor,
    });
    expect(selection.excluded).toEqual([
      { issue: ssw, reason: "incompatible_exposure" },
    ]);
  });

  it("exposure matching is exact, not a prefix or substring match", () => {
    const nnw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const selection = selectTrustedForecastAuthority({
      entry: { ...OAHU_NORTH, compatibleExposures: ["NNWW", "N"] },
      localDate: "2026-08-06",
      issues: [nnw],
      buildAnchorAt: anchor,
    });
    expect(selection.primary).toBeNull();
    expect(selection.excluded).toEqual([
      { issue: nnw, reason: "incompatible_exposure" },
    ]);
  });

  it("a region_key outside the coverage entry is excluded before voting", () => {
    const trestles = realIssueWhere("wavecast_spot_chart_live_trestles", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const selection = selectTrustedForecastAuthority({
      entry: OAHU_NORTH,
      localDate: "2026-08-06",
      issues: [trestles],
      buildAnchorAt: anchor,
    });
    expect(selection.excluded).toEqual([
      { issue: trestles, reason: "uncovered_scope" },
    ]);
  });

  it("a spot row is not matched against the regional key list, or vice versa", () => {
    const trestles = realIssueWhere("wavecast_spot_chart_live_trestles", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    expect(trestles.scopeType).toBe("spot");
    const regionalOnly = selectTrustedForecastAuthority({
      entry: { ...SPOT_OVER_REGIONAL, spotRegionKeys: [], regionalRegionKeys: ["trestles"] },
      localDate: "2026-08-06",
      issues: [trestles],
      buildAnchorAt: anchor,
    });
    expect(regionalOnly.primary).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D-13 — one decision per beach/local day, IANA local days, durable reuse
// ---------------------------------------------------------------------------

describe("MFA-04 local-day identity (D-13) and DST", () => {
  it("groups by the beach's IANA local date across a 23-hour spring-forward day", () => {
    // REAL. The corpus's spring-forward document states 2026-03-08 in
    // America/Los_Angeles, whose local day runs 08:00Z -> 07:00Z next day.
    const issue = realIssue("wavecast_regional_dst_spring_23h", 0);
    expect(issue.validLocalDate).toBe("2026-03-08");
    expect(issue.validStartAt.toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(issue.validEndAt.toISOString()).toBe("2026-03-09T07:00:00.000Z");
    expect(
      (issue.validEndAt.getTime() - issue.validStartAt.getTime()) / 3_600_000,
    ).toBe(23);

    const anchor = new Date("2026-03-08T08:00:00.000Z");
    const result = buildTrustedForecastDecisions({
      coverage: NORCAL,
      issues: [issue],
      slots: [
        slotAt("2026-03-08T08:00:00.000Z", 4, anchor), // 00:00 local
        slotAt("2026-03-09T06:59:00.000Z", 4, anchor), // 23:59 local, same day
        slotAt("2026-03-09T07:00:00.000Z", 4, anchor), // 00:00 local next day
      ],
      buildAnchorAt: anchor,
    });

    expect(localDateInTimeZone(new Date("2026-03-09T06:59:00.000Z"), "America/Los_Angeles")).toBe("2026-03-08");
    expect(result.decisions.map((decision) => decision.localDate)).toEqual([
      "2026-03-08",
      "2026-03-09",
    ]);
    expect(result.applications.filter((a) => a.localDate === "2026-03-08")).toHaveLength(2);
  });

  it("groups by the beach's IANA local date across a 25-hour fall-back day", () => {
    const issue = realIssue("wavecast_regional_dst_fall_25h", 0);
    expect(issue.validLocalDate).toBe("2026-11-01");
    expect(
      (issue.validEndAt.getTime() - issue.validStartAt.getTime()) / 3_600_000,
    ).toBe(25);

    const anchor = new Date("2026-11-01T07:00:00.000Z");
    const result = buildTrustedForecastDecisions({
      coverage: NORCAL,
      issues: [issue],
      slots: [
        slotAt("2026-11-01T07:00:00.000Z", 4, anchor), // 00:00 PDT
        slotAt("2026-11-01T08:30:00.000Z", 4, anchor), // 01:30, first pass
        slotAt("2026-11-01T09:30:00.000Z", 4, anchor), // 01:30, second pass
        slotAt("2026-11-02T07:59:00.000Z", 4, anchor), // 23:59 PST, same day
        slotAt("2026-11-02T08:00:00.000Z", 4, anchor), // next local day
      ],
      buildAnchorAt: anchor,
    });

    expect(result.decisions.map((decision) => decision.localDate)).toEqual([
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(
      result.applications.filter((a) => a.localDate === "2026-11-01"),
    ).toHaveLength(4);
  });

  it("produces exactly one decision per beach/local day and one claim per slot", () => {
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const nnw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const repeated = slotAt("2026-08-06T20:00:00.000Z", 3, anchor);
    const result = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [nnw],
      slots: [repeated, { ...repeated }, slotAt("2026-08-06T22:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
    });

    expect(result.decisions).toHaveLength(1);
    const forecastAts = result.applications.map((a) => a.forecastAt);
    expect(forecastAts).toEqual([...new Set(forecastAts)]);
    expect(forecastAts).toHaveLength(2);
  });

  it("D-13/D-18: an existing durable decision is reused exactly and never superseded", () => {
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const nnw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const existing: ExistingTrustedForecastDecision = {
      decisionId: "99999999-9999-4999-8999-999999999999",
      beachId: OAHU_NORTH.beachId,
      localDate: "2026-08-06",
      appliedDeltaFt: 0.25,
      status: "applied",
    };

    const withoutDurable = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [nnw],
      slots: [slotAt("2026-08-06T20:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
    });
    // Recomputation on its own would have moved the other way.
    expect(onlyDecision(withoutDurable).appliedDeltaFt).toBe(-0.5);

    const withDurable = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [nnw],
      slots: [slotAt("2026-08-06T20:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
      existingDecisions: [existing],
    });
    expect(withDurable.decisions).toEqual([]);
    expect(withDurable.applications).toEqual([]);
    expect(withDurable.alerts).toEqual([]);
    expect(withDurable.reusedDecisions).toEqual([
      {
        decisionId: existing.decisionId,
        beachId: existing.beachId,
        localDate: "2026-08-06",
        appliedDeltaFt: 0.25,
        status: "applied",
        governedForecastAts: ["2026-08-06T20:00:00.000Z"],
      },
    ]);
  });

  it("a durable decision for another beach does not suppress this beach's day", () => {
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const nnw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const result = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [nnw],
      slots: [slotAt("2026-08-06T20:00:00.000Z", 3, anchor)],
      buildAnchorAt: anchor,
      existingDecisions: [
        {
          decisionId: "88888888-8888-4888-8888-888888888888",
          beachId: LONG_ISLAND.beachId,
          localDate: "2026-08-06",
          appliedDeltaFt: 0.5,
          status: "applied",
        },
      ],
    });
    expect(result.reusedDecisions).toEqual([]);
    expect(result.decisions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// D-11 — conflict, alerts, day-part overlap
// ---------------------------------------------------------------------------

describe("MFA-04 independent conflict (D-11)", () => {
  const anchor = new Date("2026-08-06T12:00:00.000Z");
  const waveCastNy = () =>
    realIssueWhere("wavecast_regional_live_new_york", {
      validLocalDate: "2026-08-06",
    });

  /** Stormsurf NY row moved to a chosen range so separation is exact. */
  function conflictingStormsurf(
    label: string,
    minFaceFt: number,
    maxFaceFt: number,
  ): TrustedForecastIssue {
    return derivedIssue({
      label,
      from: realRef("stormsurf_ny_shortcast_live", {
        validLocalDate: "2026-08-06",
      }),
      overrides: { min_face_ft: minFaceFt, max_face_ft: maxFaceFt },
      note:
        "Live WaveCast NY (1-2 ft) and Stormsurf NY (0-1 ft) touch, so their real nearest-edge separation is 0 and neither side of the 1.00 ft bound is reachable from the corpus alone. Only the range moves; lineage, dates and window are the real row's.",
    });
  }

  it("real overlapping authorities separate by zero and the primary range is untouched", () => {
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [waveCastNy(), realIssueWhere("stormsurf_ny_shortcast_live", { validLocalDate: "2026-08-06" })],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
    const decision = onlyDecision(result);
    expect(decision.status).toBe("applied");
    // WaveCast's own 1-2, never widened to 0-2 by the corroborator.
    expect(decision.trustedMinFaceFt).toBe(1);
    expect(decision.trustedMaxFaceFt).toBe(2);
    expect(result.alerts).toEqual([]);
  });

  it("separation of exactly 1.00 ft does not block", () => {
    const conflicting = conflictingStormsurf("stormsurf_separation_1_00", 3, 4);
    expect(
      nearestEdgeSeparationFt({ minFt: 1, maxFt: 2 }, { minFt: 3, maxFt: 4 }),
    ).toBe(1);

    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [waveCastNy(), conflicting],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
    expect(onlyDecision(result).status).toBe("applied");
    expect(result.alerts).toEqual([]);
  });

  it("separation of 1.0001 ft blocks and raises exactly one alert", () => {
    const conflicting = conflictingStormsurf(
      "stormsurf_separation_1_0001",
      3.0001,
      4,
    );
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [waveCastNy(), conflicting],
      slots: [
        slotAt("2026-08-06T16:00:00.000Z", 4, anchor),
        slotAt("2026-08-06T19:00:00.000Z", 4, anchor),
      ],
      buildAnchorAt: anchor,
    });

    const decision = onlyDecision(result);
    expect(decision.status).toBe("blocked_conflict");
    expect(decision.appliedDeltaFt).toBe(0);
    expect(decision.signedGapFt).toBeNull();
    expect(result.applications).toEqual([]);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].alertCode).toBe(
      TRUSTED_FORECAST_ALERT_RANGE_SEPARATION,
    );
    expect(result.alerts[0].separationFt).toBe(1.0001);
    expect(result.alerts[0].primaryIssueId).toBe(waveCastNy().issueId);
    expect(result.alerts[0].conflictingIssueId).toBe(conflicting.issueId);
    expect(result.alerts[0].evidence.policyVersion).toBe(
      TRUSTED_FORECAST_POLICY_VERSION,
    );
  });

  it("day and night windows of one local date are not an independent disagreement", () => {
    // NWS states "Today" and "Tonight" separately; those are two windows, not a
    // disagreement. WaveCast is all_day live, so the day-vs-night cross-lineage
    // case needs one derived day_part.
    const waveCastDayOnly = derivedIssue({
      label: "wavecast_ny_day_part_day",
      from: realRef("wavecast_regional_live_new_york", {
        validLocalDate: "2026-08-06",
      }),
      overrides: { day_part: "day" },
      note:
        "Every live WaveCast row is all_day and every live NWS row is day or night, and the two providers cover different regions, so no real pair of independent lineages is day-vs-night on one date.",
    });
    const stormsurfNight = derivedIssue({
      label: "stormsurf_ny_day_part_night_big",
      from: realRef("stormsurf_ny_shortcast_live", {
        validLocalDate: "2026-08-06",
      }),
      overrides: { day_part: "night", min_face_ft: 8, max_face_ft: 12 },
      note:
        "Pairs with wavecast_ny_day_part_day; the 8-12 ft range reproduces the NWS 'Today 2-4 / Tonight 8-12' shape that must NOT read as a 6-foot disagreement.",
    });

    expect(dayPartsOverlap("day", "night")).toBe(false);
    const disjoint = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [waveCastDayOnly, stormsurfNight],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
    expect(disjoint.alerts).toEqual([]);
    expect(onlyDecision(disjoint).status).not.toBe("blocked_conflict");

    // The same 6-foot gap DOES block once the primary claims the whole day.
    expect(dayPartsOverlap("all_day", "night")).toBe(true);
    const overlapping = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [waveCastNy(), stormsurfNight],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
    expect(overlapping.alerts).toHaveLength(1);
    expect(onlyDecision(overlapping).status).toBe("blocked_conflict");
  });

  it("the worst conflicting corroborator is the one recorded", () => {
    const mild = conflictingStormsurf("stormsurf_mild_conflict", 3, 4);
    const severe = derivedIssue({
      label: "nws_severe_conflict_in_ny",
      from: realRef("nws_hawaii_srf_live_evening_issuance", {
        validLocalDate: "2026-08-06",
        exposure: "oahu/NORTH",
      }),
      overrides: {
        region_key: "new_york",
        exposure: "primary",
        day_part: "all_day",
        valid_timezone: "America/New_York",
        min_face_ft: 9,
        max_face_ft: 10,
        issued_at: "2026-08-06T11:00:00.000Z",
        issue_identity_key: "7".repeat(64),
        revision_hash: "8".repeat(64),
      },
      note:
        "nws_hfo covers only Hawaii live, so no real three-lineage overlap exists on one beach/day. Only the coverage keys and range move.",
    });

    const result = buildTrustedForecastDecisions({
      coverage: {
        ...LONG_ISLAND,
        regionalAuthorityLineages: ["stormsurf", "nws_hfo"],
      },
      issues: [waveCastNy(), mild, severe],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].separationFt).toBe(7);
    expect(result.alerts[0].conflictingIssueId).toBe(severe.issueId);
  });

  it("nearest-edge separation is edge-to-edge, never midpoint-to-midpoint", () => {
    // Midpoints 1.5 and 4.5 are 3 apart; the nearest edges are 1 apart.
    expect(
      nearestEdgeSeparationFt({ minFt: 1, maxFt: 2 }, { minFt: 3, maxFt: 6 }),
    ).toBe(1);
    // Fully contained ranges separate by zero even with very different midpoints.
    expect(
      nearestEdgeSeparationFt({ minFt: 0, maxFt: 10 }, { minFt: 9, maxFt: 10 }),
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// D-14 / D-15 — signed adjustment bands
// ---------------------------------------------------------------------------

describe("MFA-05 signed adjustment bands (D-14, D-15)", () => {
  const anchor = new Date("2026-08-06T12:00:00.000Z");
  // REAL trusted range: WaveCast New York states 1-2 ft for 2026-08-06.
  const TRUSTED_MIN = 1;
  const TRUSTED_MAX = 2;

  function decideWithBaseline(baselineMaxFaceFt: number) {
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [
        realIssueWhere("wavecast_regional_live_new_york", {
          validLocalDate: "2026-08-06",
        }),
      ],
      slots: [slotAt("2026-08-06T16:00:00.000Z", baselineMaxFaceFt, anchor)],
      buildAnchorAt: anchor,
    });
    return { result, decision: onlyDecision(result) };
  }

  const boundaryMatrix: readonly [
    baseline: number,
    expectedGap: number,
    expectedDelta: number,
    label: string,
  ][] = [
    [1.5, 0, 0, "inside the range is a no-op"],
    [1.0, 0, 0, "on the lower edge is a no-op"],
    [2.0, 0, 0, "on the upper edge is a no-op"],
    [0.501, 0.499, 0, "positive 0.499 is a no-op"],
    [0.5, 0.5, 0.25, "positive 0.500 moves a quarter foot"],
    [0.251, 0.749, 0.25, "positive 0.749 moves a quarter foot"],
    [0.25, 0.75, 0.5, "positive 0.750 moves a half foot"],
    [0, 1, 0.5, "a positive gap far past the band is capped at +0.50"],
    [2.499, -0.499, 0, "negative 0.499 is a no-op"],
    [2.5, -0.5, -0.25, "negative 0.500 moves a quarter foot"],
    [2.749, -0.749, -0.25, "negative 0.749 moves a quarter foot"],
    [2.75, -0.75, -0.5, "negative 0.750 moves a half foot"],
    [12, -10, -0.5, "a negative gap far past the band is capped at -0.50"],
  ];

  it.each(boundaryMatrix)(
    "baseline %p -> gap %p, delta %p (%s)",
    (baseline, expectedGap, expectedDelta) => {
      expect(signedGapFt(baseline, TRUSTED_MIN, TRUSTED_MAX)).toBe(expectedGap);
      expect(appliedDeltaFtForGap(expectedGap)).toBe(expectedDelta);

      const { decision, result } = decideWithBaseline(baseline);
      expect(decision.baselineMaxFaceFt).toBe(baseline);
      expect(decision.trustedMinFaceFt).toBe(TRUSTED_MIN);
      expect(decision.trustedMaxFaceFt).toBe(TRUSTED_MAX);
      expect(decision.signedGapFt).toBe(expectedGap);
      expect(decision.appliedDeltaFt).toBe(expectedDelta);
      expect(decision.status).toBe(
        expectedDelta === 0 ? "no_adjustment" : "applied",
      );
      expect(result.applications).toHaveLength(expectedDelta === 0 ? 0 : 1);
    },
  );

  it("appliedDeltaFt has addition semantics and always moves toward the range", () => {
    for (const [baseline, , expectedDelta] of boundaryMatrix) {
      if (expectedDelta === 0) continue;
      const { result } = decideWithBaseline(baseline);
      const application = result.applications[0];
      expect(application.adjustedMaxFaceFt).toBe(
        Math.round((baseline + expectedDelta) * 10_000) / 10_000,
      );
      const before = signedGapFt(baseline, TRUSTED_MIN, TRUSTED_MAX);
      const after = signedGapFt(
        baseline + expectedDelta,
        TRUSTED_MIN,
        TRUSTED_MAX,
      );
      expect(Math.abs(after)).toBeLessThan(Math.abs(before));
    }
  });

  it("no delta outside the three approved magnitudes can ever be produced", () => {
    const seen = new Set<number>();
    for (let gap = -6; gap <= 6; gap += 0.001) {
      seen.add(appliedDeltaFtForGap(Math.round(gap * 1000) / 1000));
    }
    expect([...seen].sort((left, right) => left - right)).toEqual([
      -0.5, -0.25, 0, 0.25, 0.5,
    ]);
  });

  it("the local-day maximum drives the decision, not any single slot", () => {
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [
        realIssueWhere("wavecast_regional_live_new_york", {
          validLocalDate: "2026-08-06",
        }),
      ],
      slots: [
        slotAt("2026-08-06T12:00:00.000Z", 1.5, anchor),
        slotAt("2026-08-06T16:00:00.000Z", 3.0, anchor),
        slotAt("2026-08-06T20:00:00.000Z", null, anchor),
      ],
      buildAnchorAt: anchor,
    });
    const decision = onlyDecision(result);
    expect(decision.baselineMaxFaceFt).toBe(3);
    expect(decision.appliedDeltaFt).toBe(-0.5);
    // Every eligible slot of the day carries the one decision's delta.
    expect(result.applications.map((a) => a.appliedDeltaFt)).toEqual([
      -0.5, -0.5, -0.5,
    ]);
    expect(result.applications[2].adjustedMaxFaceFt).toBeNull();
  });

  it("an adjusted height is never pushed below zero", () => {
    // The delta is decided by the local-day maximum, so a much smaller slot in
    // the same day can be carried below zero by it.
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [wavecastNewYorkSpot("below_zero_wavecast_spot")],
      slots: [
        slotAt("2026-08-06T16:00:00.000Z", 5, anchor),
        slotAt("2026-08-06T19:00:00.000Z", 0.1, anchor),
      ],
      buildAnchorAt: anchor,
    });
    const decision = onlyDecision(result);
    expect(decision.baselineMaxFaceFt).toBe(5);
    expect(decision.appliedDeltaFt).toBe(-0.5);
    expect(result.applications[1].baselineMaxFaceFt).toBe(0.1);
    expect(result.applications[1].adjustedMaxFaceFt).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// D-16 — raw horizon eligibility
// ---------------------------------------------------------------------------

describe("MFA-05 raw horizon eligibility (D-16)", () => {
  const anchor = new Date("2026-08-06T18:00:00.000Z");

  it.each([
    [0, true],
    [0.0001, true],
    [167.999, true],
    [168, true],
    [-0.0001, false],
    [-1, false],
    [168.0001, false],
    [200, false],
  ])("raw horizon %p eligible: %p", (hours, eligible) => {
    expect(isEligibleHorizon(hours)).toBe(eligible);
  });

  it("filters on the raw hour, before any rounding", () => {
    // 168.4 rounds to 168 but is past the bound; 167.6 rounds to 168 and is not.
    expect(Math.round(168.4)).toBe(168);
    expect(isEligibleHorizon(168.4)).toBe(false);
    expect(Math.round(167.6)).toBe(168);
    expect(isEligibleHorizon(167.6)).toBe(true);
    expect(Math.round(-0.4)).toBe(-0);
    expect(isEligibleHorizon(-0.4)).toBe(false);
  });

  it("ineligible slots are neither adjusted nor allowed to set the day baseline", () => {
    const nnw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const at = new Date("2026-08-06T20:00:00.000Z");
    const result = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [nnw],
      slots: [
        { forecastAt: at, forecastHorizonHours: 2, baselineMaxFaceFt: 1.4 },
        {
          forecastAt: new Date("2026-08-06T22:00:00.000Z"),
          forecastHorizonHours: 168.0001,
          baselineMaxFaceFt: 40,
        },
        {
          forecastAt: new Date("2026-08-06T23:00:00.000Z"),
          forecastHorizonHours: -0.0001,
          baselineMaxFaceFt: 40,
        },
      ],
      buildAnchorAt: anchor,
    });
    const decision = onlyDecision(result);
    // The two 40 ft slots would have forced a -0.50 adjustment if admitted.
    expect(decision.baselineMaxFaceFt).toBe(1.4);
    expect(decision.appliedDeltaFt).toBe(0);
    expect(result.applications).toEqual([]);
  });

  it("a slot at exactly 0 and one at exactly 168 both participate", () => {
    const nnw = realIssueWhere("wavecast_regional_live_hawaii", {
      validLocalDate: "2026-08-06",
      exposure: "NNW",
    });
    const result = buildTrustedForecastDecisions({
      coverage: OAHU_NORTH,
      issues: [nnw],
      slots: [
        {
          forecastAt: new Date("2026-08-06T20:00:00.000Z"),
          forecastHorizonHours: 0,
          baselineMaxFaceFt: 3,
        },
        {
          forecastAt: new Date("2026-08-06T22:00:00.000Z"),
          forecastHorizonHours: 168,
          baselineMaxFaceFt: 3,
        },
      ],
      buildAnchorAt: anchor,
    });
    expect(result.applications).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Flag, persistence contract, privacy, provenance ratchets
// ---------------------------------------------------------------------------

describe("serving flag (D-24)", () => {
  const original = process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
    } else {
      process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = original;
    }
  });

  it.each([
    [undefined, true],
    ["", false],
    ["true", true],
    ["TRUE", true],
    ["yes", true],
    ["1", true],
    ["on", true],
    ["false", false],
    ["FALSE", false],
    ["  False  ", false],
    ["0", false],
    ["no", false],
    ["off", false],
    ["banana", false],
  ])("env %p enables adjustments: %p", (value, enabled) => {
    if (value === undefined) {
      delete process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
    } else {
      process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = value;
    }
    expect(isTrustedForecastAdjustmentEnabled()).toBe(enabled);
    if (value === "banana") {
      expectConsoleErrors([/trusted_forecast_adjustments_invalid_flag/]);
    }
  });

  it("logs a named error for an unrecognized value", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = "maybe";

    expect(isTrustedForecastAdjustmentEnabled()).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      "trusted_forecast_adjustments_invalid_flag",
      expect.objectContaining({ serving: "disabled" }),
    );
    errorSpy.mockRestore();
  });

  it("an explicit false returns nothing at all", () => {
    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = "false";
    const anchor = new Date("2026-08-06T18:00:00.000Z");
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [
        realIssueWhere("wavecast_regional_live_new_york", {
          validLocalDate: "2026-08-06",
        }),
      ],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 9, anchor)],
      buildAnchorAt: anchor,
    });
    expect(result.decisions).toEqual([]);
    expect(result.applications).toEqual([]);
    expect(result.alerts).toEqual([]);
  });
});

describe("21-02 persistence contract and privacy", () => {
  const MIGRATION_SQL = readFileSync(
    path.join(
      __dirname,
      "../../../../supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql",
    ),
    "utf8",
  );

  function rpcKeys(constantName: string): string[] {
    const pattern = new RegExp(
      `${constantName} CONSTANT text\\[\\] := ARRAY\\[([^\\]]*)\\]`,
      "s",
    );
    const match = pattern.exec(MIGRATION_SQL);
    expect(match).not.toBeNull();
    return [...(match as RegExpExecArray)[1].matchAll(/'([A-Za-z]+)'/g)].map(
      (hit) => hit[1],
    );
  }

  const anchor = new Date("2026-08-06T12:00:00.000Z");

  function conflictedResult(): TrustedForecastEngineResult {
    return buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [
        realIssueWhere("wavecast_regional_live_new_york", {
          validLocalDate: "2026-08-06",
        }),
        derivedIssue({
          label: "stormsurf_payload_conflict",
          from: realRef("stormsurf_ny_shortcast_live", {
            validLocalDate: "2026-08-06",
          }),
          overrides: { min_face_ft: 6, max_face_ft: 8 },
          note:
            "The live NY pair separates by 0 ft, so an alert payload cannot be produced from the corpus alone.",
        }),
      ],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
  }

  it("decision payload keys are exactly the RPC's decision key set", () => {
    const result = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [
        realIssueWhere("wavecast_regional_live_new_york", {
          validLocalDate: "2026-08-06",
        }),
      ],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
    expect(Object.keys(result.decisions[0]).sort()).toEqual(
      rpcKeys("c_decision_keys").sort(),
    );
    expect(Object.keys(result.applications[0]).sort()).toEqual(
      [
        ...rpcKeys("c_application_keys"),
        "forecastHorizonBucket",
        "displaySource",
      ].sort(),
    );
  });

  it("alert payload keys are exactly the RPC's alert key set", () => {
    const result = conflictedResult();
    expect(Object.keys(result.alerts[0]).sort()).toEqual(
      rpcKeys("c_alert_keys").sort(),
    );
  });

  it("statuses and delta bands satisfy the migration's CHECK constraints", () => {
    expect(MIGRATION_SQL).toContain(
      "CHECK (applied_delta_ft IN (-0.5, -0.25, 0, 0.25, 0.5))",
    );
    expect(MIGRATION_SQL).toContain("CHECK (separation_ft > 1.0)");
    const result = conflictedResult();
    for (const decision of result.decisions) {
      expect([-0.5, -0.25, 0, 0.25, 0.5]).toContain(decision.appliedDeltaFt);
      expect([
        "applied",
        "no_adjustment",
        "no_authority",
        "blocked_conflict",
      ]).toContain(decision.status);
      expect(decision.status === "applied").toBe(decision.appliedDeltaFt !== 0);
    }
    for (const alert of result.alerts) {
      expect(alert.separationFt).toBeGreaterThan(1.0);
    }
    for (const application of result.applications) {
      expect([-0.5, -0.25, 0.25, 0.5]).toContain(application.appliedDeltaFt);
    }
  });

  it("applied and no_adjustment decisions always carry the fields the CHECK demands", () => {
    for (const baseline of [1.5, 4]) {
      const result = buildTrustedForecastDecisions({
        coverage: LONG_ISLAND,
        issues: [
          realIssueWhere("wavecast_regional_live_new_york", {
            validLocalDate: "2026-08-06",
          }),
        ],
        slots: [slotAt("2026-08-06T16:00:00.000Z", baseline, anchor)],
        buildAnchorAt: anchor,
      });
      const decision = onlyDecision(result);
      expect(["applied", "no_adjustment"]).toContain(decision.status);
      expect(decision.primaryIssueId).not.toBeNull();
      expect(decision.trustedMinFaceFt).not.toBeNull();
      expect(decision.trustedMaxFaceFt).not.toBeNull();
      expect(decision.baselineMaxFaceFt).not.toBeNull();
    }
  });

  it("the policy version travels with every build and every alert", () => {
    const result = conflictedResult();
    expect(result.policyVersion).toBe(TRUSTED_FORECAST_POLICY_VERSION);
    for (const alert of result.alerts) {
      expect(alert.evidence.policyVersion).toBe(TRUSTED_FORECAST_POLICY_VERSION);
    }
  });

  it("no source hash, URL, narrative or parser metadata reaches any payload", () => {
    const result = conflictedResult();
    const serialized = JSON.stringify({
      decisions: result.decisions,
      applications: result.applications,
      alerts: result.alerts,
    });
    const source = realIssueWhere("wavecast_regional_live_new_york", {
      validLocalDate: "2026-08-06",
    });
    for (const secret of [
      source.sourceHash,
      source.issueIdentityKey,
      source.revisionHash,
      source.parserVersion,
      source.sourceKey,
      "wavecast.com",
      "stormsurf.com",
      "http",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("results are deterministic across repeated builds and input order", () => {
    const issues = [
      realIssueWhere("wavecast_regional_live_new_york", {
        validLocalDate: "2026-08-06",
      }),
      realIssueWhere("stormsurf_ny_shortcast_live", {
        validLocalDate: "2026-08-06",
      }),
    ];
    const slots = [
      slotAt("2026-08-06T19:00:00.000Z", 4, anchor),
      slotAt("2026-08-06T16:00:00.000Z", 4, anchor),
    ];
    const first = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues,
      slots,
      buildAnchorAt: anchor,
    });
    const second = buildTrustedForecastDecisions({
      coverage: LONG_ISLAND,
      issues: [...issues].reverse(),
      slots: [...slots].reverse(),
      buildAnchorAt: anchor,
    });
    expect(second).toEqual(first);
    // Applications are emitted in ascending forecast_at order regardless.
    expect(first.applications.map((a) => a.forecastAt)).toEqual([
      "2026-08-06T16:00:00.000Z",
      "2026-08-06T19:00:00.000Z",
    ]);
  });
});

describe("versioned coverage policy", () => {
  const policy: TrustedForecastCoveragePolicy = {
    version: TRUSTED_FORECAST_POLICY_VERSION,
    entries: [OAHU_NORTH, LONG_ISLAND, SPOT_OVER_REGIONAL, NORCAL, PNW, NEW_JERSEY],
  };

  it("resolves a configured beach and returns null for an unconfigured one", () => {
    expect(coverageEntryForBeach(policy, LONG_ISLAND.beachId)).toBe(LONG_ISLAND);
    expect(
      coverageEntryForBeach(policy, "77777777-7777-4777-8777-777777777777"),
    ).toBeNull();
  });

  it("refuses a policy that covers one beach twice", () => {
    expect(() =>
      coverageEntryForBeach(
        { ...policy, entries: [...policy.entries, LONG_ISLAND] },
        LONG_ISLAND.beachId,
      ),
    ).toThrow(/2 entries for one beach/);
  });

  it("carries its version into every build result", () => {
    const anchor = new Date("2026-08-06T12:00:00.000Z");
    const entry = coverageEntryForBeach(
      policy,
      LONG_ISLAND.beachId,
    ) as TrustedForecastCoverageEntry;
    const result = buildTrustedForecastDecisions({
      coverage: entry,
      issues: [
        realIssueWhere("wavecast_regional_live_new_york", {
          validLocalDate: "2026-08-06",
        }),
      ],
      slots: [slotAt("2026-08-06T16:00:00.000Z", 4, anchor)],
      buildAnchorAt: anchor,
    });
    expect(result.policyVersion).toBe(policy.version);
  });
});

describe("fixture provenance ratchet", () => {
  it("every synthetic fixture is a documented derivation of a real row", () => {
    const inventory = derivedIssueInventory();
    // Pinned so the fixture registry cannot silently drift. The policy-boundary
    // adapters and the alert-payload helper each register named derivations,
    // so registrations exceed the number of source documents.
    // The regional-scope adapter and the explicit WaveCast spot fixtures add
    // six named derivations; pin the new inventory so undocumented test data
    // cannot creep in unnoticed.
    expect(new Set(inventory.map((record) => record.label)).size).toBe(28);
    for (const record of inventory) {
      expect(record.note.length).toBeGreaterThan(40);
      expect(record.overrides.length).toBeGreaterThan(0);
      const [documentId, index] = record.from.split("#");
      expect(Object.keys(REAL_ISSUE_FIXTURE.documents)).toContain(documentId);
      expect(
        typeof REAL_ISSUE_FIXTURE.documents[documentId].issues[Number(index)],
      ).toBe("object");
    }
  });

  it("the four disabled sources emit nothing, so their shapes must be derived", () => {
    // D-05 (the two NJ mirrors), D-06 (a second Stormsurf endpoint) and D-07
    // (the Stormsurf buoy page) all derive from sources that are
    // `enabled: false` in the 17-source registry. If one is ever enabled its
    // rows appear here and those derivations stop being necessary.
    const emitted = new Set<unknown>();
    for (const document of Object.values(REAL_ISSUE_FIXTURE.documents)) {
      for (const issue of document.issues) emitted.add(issue.source_key);
    }
    expect([...emitted].sort()).toEqual([
      "hawaii",
      "new_york",
      "norcal",
      "nws_hawaii_srf",
      "socal",
      "stormsurf_ny_shortcast",
      "surf_institute_pnw",
    ]);
    for (const disabled of [
      "stormsurf_pnw_buoy",
      "stormsurf_pnw_links",
      "nj_beach_cams_reports",
      "surfers_view_nj",
    ]) {
      expect(emitted.has(disabled)).toBe(false);
    }
  });

  it("the spot chart out-maxes the regional page on every shared date, hiding D-09 tier 1", () => {
    // Scoped exactly to the pairing `SPOT_OVER_REGIONAL` configures — the real
    // Trestles spot chart and the real WaveCast Hawaii page, at the one
    // exposure that entry accepts. On every date both state, the spot maximum
    // is at least the regional one, so the daily-maximum rule alone already
    // picks the spot row and "spot supersedes regional" stays unobservable.
    // (Claimed no wider: at SSW the corpus has regional rows that DO out-max
    // the spot chart, and that exposure is not compatible here.)
    const regionalByDate = new Map<unknown, number>();
    for (const issue of realIssueDocument("wavecast_regional_live_hawaii")
      .issues) {
      if (issue.exposure !== "NNW") continue;
      regionalByDate.set(issue.valid_local_date, issue.max_face_ft as number);
    }
    let comparedDates = 0;
    for (const issue of realIssueDocument("wavecast_spot_chart_live_trestles")
      .issues) {
      if (issue.exposure !== "NNW") continue;
      const regionalMax = regionalByDate.get(issue.valid_local_date);
      if (regionalMax === undefined) continue;
      comparedDates += 1;
      expect(issue.max_face_ft as number).toBeGreaterThanOrEqual(regionalMax);
    }
    expect(comparedDates).toBe(15);
  });

  it("the real corpus alone cannot reach the two branches the derivations exist for", () => {
    // 1. No live authority row carries a derived publication-day window.
    // 2. No live independent pair separates by more than a foot.
    let authorityWithDerivedBasis = 0;
    for (const document of Object.values(REAL_ISSUE_FIXTURE.documents)) {
      for (const issue of document.issues) {
        if (
          issue.authority_eligible === true &&
          issue.validity_basis === "derived_publication_day"
        ) {
          authorityWithDerivedBasis += 1;
        }
      }
    }
    expect(authorityWithDerivedBasis).toBe(0);

    const anchorHere = new Date("2026-08-06T18:00:00.000Z");
    const selection = selectTrustedForecastAuthority({
      entry: LONG_ISLAND,
      localDate: "2026-08-06",
      issues: [
        realIssueWhere("wavecast_regional_live_new_york", {
          validLocalDate: "2026-08-06",
        }),
        realIssueWhere("stormsurf_ny_shortcast_live", {
          validLocalDate: "2026-08-06",
        }),
      ],
      buildAnchorAt: anchorHere,
    });
    const primary = selection.primary as TrustedForecastIssue;
    const other = selection.corroborators[0];
    expect(
      nearestEdgeSeparationFt(
        { minFt: primary.minFaceFt as number, maxFt: primary.maxFaceFt as number },
        { minFt: other.minFaceFt as number, maxFt: other.maxFaceFt as number },
      ),
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 21-04: day-part application restriction (21-03 critic ruling 2)
//
// `day_part` gated conflict eligibility but not APPLICATION, so a `day`-only
// primary applied its delta to every night slot of the local day while a
// disjoint `night` row from another lineage stayed exempt from the conflict
// check. The exemption is right on its own terms, so the application side is
// what 21-04 restricts.
// ---------------------------------------------------------------------------

describe("D-17/D-14: a primary may only move the part of the day it spoke about", () => {
  /** 06:00 HST on the day the captured HFO morning product covers. */
  const HAWAII_DAY_SLOT_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

  function hawaiiSlots(): TrustedForecastSlot[] {
    // 2026-08-06T10:00Z is 00:00 HST (Hawaii has no DST).
    const midnightHst = Date.parse("2026-08-06T10:00:00Z");
    return HAWAII_DAY_SLOT_HOURS.map((hour) => ({
      forecastAt: new Date(midnightHst + hour * 3_600_000),
      forecastHorizonHours: hour,
      baselineMaxFaceFt: 5,
    }));
  }

  const KAUAI_NORTH: TrustedForecastCoverageEntry = {
    beachId: "77777777-7777-4777-8777-777777777777",
    localTimezone: "Pacific/Honolulu",
    spotRegionKeys: ["hawaii"],
    regionalRegionKeys: ["hawaii"],
    compatibleExposures: ["kauai/NORTH"],
    regionalAuthorityLineages: ["nws_hfo"],
  };

  it("a day-only primary claims only the local day slots, never the night ones", () => {
    // The WaveCast spot-policy fixture speaks for kauai/NORTH, day_part 'day',
    // 0-2 ft, valid 06:00-18:00 HST.
    const dayRow = wavecastKauaiSpot("day_only_wavecast_spot", {
      day_part: "day",
      min_face_ft: 0,
      max_face_ft: 2,
    });
    expect(dayRow.dayPart).toBe("day");

    const result = buildTrustedForecastDecisions({
      coverage: KAUAI_NORTH,
      issues: [dayRow],
      slots: hawaiiSlots(),
      buildAnchorAt: new Date(dayRow.issuedAt.getTime() + 3_600_000),
    });

    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]).toMatchObject({
      localDate: "2026-08-06",
      status: "applied",
      trustedMinFaceFt: 0,
      trustedMaxFaceFt: 2,
      appliedDeltaFt: -0.5,
    });

    // 06, 09, 12 and 15 HST are inside the stated window; 00, 03, 18 and 21 are
    // not, and a day-only call must not move them.
    const claimedHours = result.applications.map((application) =>
      Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Pacific/Honolulu",
          hour: "2-digit",
          hour12: false,
        }).format(new Date(application.forecastAt)),
      ) % 24,
    );
    expect(claimedHours.sort((a, b) => a - b)).toEqual([6, 9, 12, 15]);
  });

  it("a night-only primary claims only the night slots", () => {
    const nightRow = wavecastKauaiSpot("night_only_wavecast_spot", {
      day_part: "night",
    });
    expect(nightRow.dayPart).toBe("night");

    const result = buildTrustedForecastDecisions({
      coverage: KAUAI_NORTH,
      issues: [nightRow],
      slots: hawaiiSlots(),
      buildAnchorAt: new Date(nightRow.issuedAt.getTime() + 3_600_000),
    });

    const claimedHours = result.applications
      .map((application) =>
        Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Pacific/Honolulu",
            hour: "2-digit",
            hour12: false,
          }).format(new Date(application.forecastAt)),
        ) % 24,
      )
      .sort((a, b) => a - b);
    expect(claimedHours).toEqual([0, 3, 18, 21]);
  });

  it("an all_day primary still claims every eligible slot", () => {
    // The captured WaveCast row states whole days, and nothing about the
    // restriction may narrow those.
    const allDayRow = realIssueWhere("wavecast_regional_live_hawaii", {
      exposure: "NNW",
      validLocalDate: "2026-08-06",
    });
    expect(allDayRow.dayPart).toBe("all_day");

    const result = buildTrustedForecastDecisions({
      coverage: {
        ...KAUAI_NORTH,
        compatibleExposures: ["NNW"],
        regionalAuthorityLineages: [],
      },
      issues: [allDayRow],
      slots: hawaiiSlots(),
      buildAnchorAt: new Date(allDayRow.issuedAt.getTime() + 3_600_000),
    });

    expect(result.decisions[0]?.status).toBe("applied");
    expect(result.applications).toHaveLength(HAWAII_DAY_SLOT_HOURS.length);
  });

  it("the daily maximum is still taken across the whole local day", () => {
    // The critic accepted the daily-maximum rule and rejected only its pairing
    // with unrestricted application, so the comparison basis must not narrow.
    const dayRow = wavecastKauaiSpot("daily_maximum_day_only_wavecast_spot", {
      day_part: "day",
    });
    const slots = hawaiiSlots().map((slot, index) => ({
      ...slot,
      // Only a NIGHT slot carries the day's biggest baseline.
      baselineMaxFaceFt: index === 0 ? 9 : 5,
    }));

    const result = buildTrustedForecastDecisions({
      coverage: KAUAI_NORTH,
      issues: [dayRow],
      slots,
      buildAnchorAt: new Date(dayRow.issuedAt.getTime() + 3_600_000),
    });

    expect(result.decisions[0]?.baselineMaxFaceFt).toBe(9);
    expect(result.applications).toHaveLength(4);
  });
});
