import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeSessionFaceHeightTruthReport,
  filterCandidateRowsByRealProfiles,
  parseCliArgs,
  renderSessionFaceHeightTruthReport,
  validateSessionFaceHeightTruthReport,
  validateSessionFaceHeightTruthReportFile,
  writeSessionFaceHeightTruthReportJson,
  type SessionFaceHeightCandidateRow,
  type SessionFaceHeightProfileRow,
} from "../session-face-height-truth-report";

const START = "2025-06-19T00:00:00.000Z";
const END = "2026-06-19T00:00:00.000Z";

function row(
  overrides: Partial<SessionFaceHeightCandidateRow> = {}
): SessionFaceHeightCandidateRow {
  return {
    user_id: "user-secret",
    beach_id: "beach-secret",
    observed_at: "2026-06-01T12:00:00.000Z",
    reported_wave_height_ft: 3,
    observed_m: 0.914,
    ml_prediction_id: "prediction-secret",
    forecast_horizon_hours: 12,
    quality_state: "weak",
    rejection_reason: null,
    observation_weight: 0.2,
    source_created_by: "trigger",
    snapshot_display_height_m: 0.8,
    snapshot_raw_om_height_m: 0.7,
    snapshot_v5_shadow_height_m: 0.9,
    snapshot_display_source: "face-Hs-transformer-v1",
    ...overrides,
  };
}

function profileRow(
  id: string,
  overrides: Partial<SessionFaceHeightProfileRow> = {}
): SessionFaceHeightProfileRow {
  return {
    id,
    deleted_at: null,
    is_mock: false,
    analytics_is_real_user: true,
    is_system_account: false,
    ...overrides,
  };
}

describe("session-face-height-truth-report", () => {
  it("parses a default 365-day window and output JSON path", () => {
    const options = parseCliArgs(
      ["--output-json=/tmp/session-truth.json"],
      new Date("2026-06-19T00:00:00.000Z")
    );

    expect(options).toEqual({
      start: START,
      end: END,
      days: 365,
      minMatchedPositiveCandidates: 100,
      minShortHorizonMatchedCandidates: 75,
      minMatchedPositiveBeaches: 10,
      minMatchedPositiveUsers: 10,
      minSnapshotCompletenessRate: 0.95,
      minReportedHeightConsistencyRate: 1,
      maxForecastEchoRiskRate: 0.25,
      forecastEchoToleranceFt: 0.05,
      maxShortHorizonMatchedAgeDays: 30,
      failOnNotReady: false,
      outputJsonPath: "/tmp/session-truth.json",
      validateOutputJsonPath: null,
      maxReportAgeHours: null,
    });
  });

  it("parses readiness gate options", () => {
    const options = parseCliArgs(
      [
        "--min-matched-positive",
        "12",
        "--min-short-horizon-matched=8",
        "--min-matched-positive-beaches",
        "4",
        "--min-matched-positive-users=3",
        "--min-snapshot-completeness-rate",
        "0.9",
        "--min-reported-height-consistency-rate=0.95",
        "--max-forecast-echo-risk-rate=0.2",
        "--forecast-echo-tolerance-ft",
        "0.1",
        "--max-short-horizon-matched-age-days=14",
        "--fail-on-not-ready",
      ],
      new Date("2026-06-19T00:00:00.000Z")
    );

    expect(options).toMatchObject({
      minMatchedPositiveCandidates: 12,
      minShortHorizonMatchedCandidates: 8,
      minMatchedPositiveBeaches: 4,
      minMatchedPositiveUsers: 3,
      minSnapshotCompletenessRate: 0.9,
      minReportedHeightConsistencyRate: 0.95,
      maxForecastEchoRiskRate: 0.2,
      forecastEchoToleranceFt: 0.1,
      maxShortHorizonMatchedAgeDays: 14,
      failOnNotReady: true,
    });

    expect(
      parseCliArgs(
        [
          "--validate-output-json",
          "/tmp/session-truth.json",
          "--max-report-age-hours=24",
        ],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toMatchObject({
      validateOutputJsonPath: "/tmp/session-truth.json",
      maxReportAgeHours: 24,
    });
  });

  it("parses explicit equals-form measurement windows", () => {
    const options = parseCliArgs(
      [
        "--start=2026-06-01T00:00:00Z",
        "--end=2026-06-19T00:00:00Z",
        "--days=18",
      ],
      new Date("2026-06-19T00:00:00.000Z")
    );

    expect(options).toMatchObject({
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      days: 18,
    });
  });

  it("rejects invalid or reversed measurement windows", () => {
    expect(() =>
      parseCliArgs(
        ["--start=not-a-date"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--start must be a valid date.");

    expect(() =>
      parseCliArgs(
        ["--start=2026-06-20T00:00:00Z", "--end=2026-06-19T00:00:00Z"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("Measurement start must be before end.");
  });

  it("rejects non-integer measurement day windows", () => {
    expect(() =>
      parseCliArgs(["--days=0.5"], new Date("2026-06-19T00:00:00.000Z"))
    ).toThrow("--days must be a positive integer");

    expect(() =>
      parseCliArgs(["--days", "0"], new Date("2026-06-19T00:00:00.000Z"))
    ).toThrow("--days must be a positive integer");
  });

  it("rejects measurement flags without values", () => {
    expect(() =>
      parseCliArgs(["--start"], new Date("2026-06-19T00:00:00.000Z"))
    ).toThrow("--start requires a value.");

    expect(() =>
      parseCliArgs(["--end"], new Date("2026-06-19T00:00:00.000Z"))
    ).toThrow("--end requires a value.");

    expect(() =>
      parseCliArgs(["--days"], new Date("2026-06-19T00:00:00.000Z"))
    ).toThrow("--days requires a value.");

    expect(() =>
      parseCliArgs(["--output-json"], new Date("2026-06-19T00:00:00.000Z"))
    ).toThrow("--output-json requires a value.");

    expect(() =>
      parseCliArgs(["--output-json="], new Date("2026-06-19T00:00:00.000Z"))
    ).toThrow("--output-json requires a value.");

    expect(() =>
      parseCliArgs(
        ["--validate-output-json"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--validate-output-json requires a value.");

    expect(() =>
      parseCliArgs(
        ["--max-report-age-hours", "--fail-on-not-ready"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--max-report-age-hours requires a value.");
  });

  it("rejects readiness threshold flags without values", () => {
    expect(() =>
      parseCliArgs(
        ["--min-matched-positive"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--min-matched-positive requires a value.");

    expect(() =>
      parseCliArgs(
        ["--min-snapshot-completeness-rate="],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--min-snapshot-completeness-rate requires a value.");

    expect(() =>
      parseCliArgs(
        ["--forecast-echo-tolerance-ft="],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--forecast-echo-tolerance-ft requires a value.");

    expect(() =>
      parseCliArgs(
        ["--max-short-horizon-matched-age-days"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--max-short-horizon-matched-age-days requires a value.");
  });

  it("rejects unknown readiness arguments", () => {
    expect(() =>
      parseCliArgs(
        ["--fail-on-notready"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("Unknown argument: --fail-on-notready.");
    expect(() =>
      parseCliArgs(
        ["--min-matched-positives", "10"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("Unknown argument: --min-matched-positives.");
    expect(() =>
      parseCliArgs(
        ["/tmp/extra.json"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("Unknown argument: /tmp/extra.json.");

    expect(() =>
      parseCliArgs(
        [
          "--output-json=/tmp/session-truth.json",
          "--validate-output-json=/tmp/session-truth-review.json",
        ],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--validate-output-json cannot be combined with --output-json.");

    expect(() =>
      parseCliArgs(
        ["--max-report-age-hours=24"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--max-report-age-hours requires --validate-output-json.");
  });

  it("rejects fractional readiness count floors instead of rounding them down", () => {
    expect(() =>
      parseCliArgs(
        ["--min-matched-positive=99.5"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--min-matched-positive must be a non-negative integer");

    expect(() =>
      parseCliArgs(
        ["--min-short-horizon-matched", "74.5"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--min-short-horizon-matched must be a non-negative integer");

    expect(() =>
      parseCliArgs(
        ["--min-matched-positive-beaches=9.5"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow(
      "--min-matched-positive-beaches must be a non-negative integer"
    );

    expect(() =>
      parseCliArgs(
        ["--min-matched-positive-users=9.5"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--min-matched-positive-users must be a non-negative integer");

    expect(() =>
      parseCliArgs(
        ["--max-short-horizon-matched-age-days=0.5"],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow(
      "--max-short-horizon-matched-age-days must be a positive integer"
    );

    expect(() =>
      parseCliArgs(
        [
          "--validate-output-json=/tmp/session-truth.json",
          "--max-report-age-hours=0.5",
        ],
        new Date("2026-06-19T00:00:00.000Z")
      )
    ).toThrow("--max-report-age-hours must be a positive integer");
  });

  it("excludes non-real profiles from session truth candidate rows", () => {
    const rows = [
      row({ user_id: "real-user" }),
      row({ user_id: "mock-user" }),
      row({ user_id: "deleted-user" }),
      row({ user_id: "analytics-excluded-user" }),
      row({ user_id: "system-user" }),
      row({ user_id: "missing-profile-user" }),
      row({ user_id: null }),
    ];
    const profilesById = new Map<string, SessionFaceHeightProfileRow>(
      [
        profileRow("real-user"),
        profileRow("mock-user", { is_mock: true }),
        profileRow("deleted-user", { deleted_at: "2026-06-01T00:00:00Z" }),
        profileRow("analytics-excluded-user", {
          analytics_is_real_user: false,
        }),
        profileRow("system-user", { is_system_account: true }),
      ].map((profile) => [profile.id, profile])
    );

    expect(filterCandidateRowsByRealProfiles(rows, profilesById)).toEqual([
      rows[0],
    ]);
  });

  it("computes aggregate weak-label coverage without exposing raw ids", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      rows: [
        row(),
        row({
          observed_m: 1.2,
          forecast_horizon_hours: 48,
          snapshot_v5_shadow_height_m: null,
        }),
        row({
          observed_m: 0.5,
          ml_prediction_id: null,
          forecast_horizon_hours: null,
        }),
        row({
          observed_m: null,
          ml_prediction_id: null,
          quality_state: "rejected",
          rejection_reason: "missing_wave_height_ft",
          source_created_by: "backfill",
          snapshot_display_height_m: null,
          snapshot_raw_om_height_m: null,
          snapshot_v5_shadow_height_m: null,
        }),
      ],
    });

    expect(report.totalCandidates).toBe(4);
    expect(report.acceptedCandidates).toBe(3);
    expect(report.rejectedCandidates).toBe(1);
    expect(report.positiveObservedCandidates).toBe(3);
    expect(report.linkedPositiveCandidates).toBe(2);
    expect(report.nonCanonicalLinkedPositiveCandidates).toBe(0);
    expect(report.matchedPositiveCandidates).toBe(2);
    expect(report.unmatchedPositiveCandidates).toBe(1);
    expect(report.matchedPositiveBeachCount).toBe(1);
    expect(report.matchedPositiveUserCount).toBe(1);
    expect(report.qualityStates).toEqual({ weak: 3, rejected: 1 });
    expect(report.rejectionReasons).toEqual({ missing_wave_height_ft: 1 });
    expect(report.sourcesCreatedBy).toEqual({ trigger: 3, backfill: 1 });
    expect(report.linkedPositiveDisplaySources).toEqual({
      "face-Hs-transformer-v1": 2,
    });
    expect(report.matchedPositiveByHorizon).toEqual({
      "0-24h": 1,
      "25-72h": 1,
    });
    expect(report.positiveLabelsByHorizon).toEqual([
      {
        horizon: "0-24h",
        positiveObservedCandidates: 1,
        linkedPositiveCandidates: 1,
        unlinkedPositiveCandidates: 0,
        nonCanonicalLinkedPositiveCandidates: 0,
        matchedPositiveCandidates: 1,
        unmatchedPositiveCandidates: 0,
        matchedPositiveBeachCount: 1,
        matchedPositiveUserCount: 1,
      },
      {
        horizon: "25-72h",
        positiveObservedCandidates: 1,
        linkedPositiveCandidates: 1,
        unlinkedPositiveCandidates: 0,
        nonCanonicalLinkedPositiveCandidates: 0,
        matchedPositiveCandidates: 1,
        unmatchedPositiveCandidates: 0,
        matchedPositiveBeachCount: 1,
        matchedPositiveUserCount: 1,
      },
      {
        horizon: "73h+",
        positiveObservedCandidates: 0,
        linkedPositiveCandidates: 0,
        unlinkedPositiveCandidates: 0,
        nonCanonicalLinkedPositiveCandidates: 0,
        matchedPositiveCandidates: 0,
        unmatchedPositiveCandidates: 0,
        matchedPositiveBeachCount: 0,
        matchedPositiveUserCount: 0,
      },
      {
        horizon: "unknown",
        positiveObservedCandidates: 1,
        linkedPositiveCandidates: 0,
        unlinkedPositiveCandidates: 1,
        nonCanonicalLinkedPositiveCandidates: 0,
        matchedPositiveCandidates: 0,
        unmatchedPositiveCandidates: 1,
        matchedPositiveBeachCount: 0,
        matchedPositiveUserCount: 0,
      },
    ]);
    expect(report.unmatchedPositiveDiagnostics).toEqual({
      reasons: { unlinked_prediction: 1 },
      byHorizon: { unknown: 1 },
      bySourceCreatedBy: { trigger: 1 },
      nonCanonicalDisplaySources: {},
    });
    expect(report.snapshotCompleteness).toEqual({
      displayHeight: 2,
      rawOmHeight: 2,
      v5ShadowHeight: 1,
    });
    expect(report.forecastEchoRisk).toEqual({
      toleranceFt: 0.05,
      comparableMatchedPositiveCandidates: 2,
      displayEchoCandidates: 0,
      displayEchoRiskRate: 0,
    });
    expect(report.reportedHeightConsistency).toEqual({
      toleranceM: 0.01,
      consistentMatchedPositiveCandidates: 1,
      inconsistentMatchedPositiveCandidates: 1,
      consistencyRate: 0.5,
    });
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      observed: {
        matchedPositiveCandidates: 2,
        shortHorizonMatchedCandidates: 2,
        matchedPositiveBeachCount: 1,
        matchedPositiveUserCount: 1,
        displaySnapshotCompletenessRate: 1,
        rawOmSnapshotCompletenessRate: 1,
        v5ShadowSnapshotCompletenessRate: 0.5,
        reportedHeightConsistencyRate: 0.5,
        displayForecastEchoRiskRate: 0,
      },
    });
    expect(report.readiness.findings).toEqual(
      expect.arrayContaining([
        "Matched positive weak labels are below the 100-row floor.",
        "Matched 0-72h weak labels are below the 75-row floor.",
        "Matched positive beach coverage is below the 10-beach floor.",
        "Matched positive user coverage is below the 10-user floor.",
        "v5 shadow snapshot completeness is below 95.0%.",
        "Reported-height consistency is below 100.0%.",
      ])
    );
    expect(report.readiness.findingCodes).toEqual(
      expect.arrayContaining([
        "matched_positive_candidates_floor",
        "short_horizon_matched_candidates_floor",
        "matched_positive_beaches_floor",
        "matched_positive_users_floor",
        "v5_shadow_snapshot_completeness_floor",
        "reported_height_consistency_floor",
      ])
    );
  });

  it("marks session truth ready when configured floors are met", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 2,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 0,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [
        row({
          beach_id: "beach-1",
          user_id: "user-1",
          forecast_horizon_hours: 12,
        }),
        row({
          beach_id: "beach-2",
          user_id: "user-2",
          forecast_horizon_hours: 48,
        }),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "ready",
      readyForHarnessTruth: true,
      findings: [],
      findingCodes: [],
      observed: {
        latestShortHorizonMatchedObservedAt: "2026-06-01T12:00:00.000Z",
        shortHorizonMatchedAgeDays: 17.5,
      },
    });
  });

  it("blocks readiness when matched short-horizon truth is stale", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 2,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 7,
      },
      rows: [
        row({
          beach_id: "beach-1",
          user_id: "user-1",
          observed_at: "2026-06-01T12:00:00.000Z",
          forecast_horizon_hours: 12,
        }),
        row({
          beach_id: "beach-2",
          user_id: "user-2",
          observed_at: "2026-06-02T00:00:00.000Z",
          forecast_horizon_hours: 48,
        }),
      ],
    });

    expect(report).toMatchObject({
      latestMatchedPositiveObservedAt: "2026-06-02T00:00:00.000Z",
      latestShortHorizonMatchedObservedAt: "2026-06-02T00:00:00.000Z",
    });
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      observed: {
        shortHorizonMatchedCandidates: 2,
        latestShortHorizonMatchedObservedAt: "2026-06-02T00:00:00.000Z",
        shortHorizonMatchedAgeDays: 17,
      },
      findings: [
        "Latest matched 0-72h weak label is older than 7 days.",
      ],
      findingCodes: ["short_horizon_freshness_stale"],
    });
  });

  it("blocks readiness when no matched short-horizon truth exists for freshness proof", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 1,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [
        row({
          beach_id: "beach-1",
          user_id: "user-1",
          forecast_horizon_hours: 96,
        }),
        row({
          beach_id: "beach-2",
          user_id: "user-2",
          forecast_horizon_hours: 120,
        }),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      observed: {
        shortHorizonMatchedCandidates: 0,
        latestShortHorizonMatchedObservedAt: null,
        shortHorizonMatchedAgeDays: null,
      },
      findings: [
        "Matched 0-72h weak labels are below the 1-row floor.",
        "No matched 0-72h weak label exists for freshness proof.",
      ],
      findingCodes: [
        "short_horizon_matched_candidates_floor",
        "short_horizon_freshness_missing",
      ],
    });
  });

  it("blocks readiness when matched truth lacks beach or user diversity", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 2,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 0,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [
        row({ forecast_horizon_hours: 12 }),
        row({ forecast_horizon_hours: 48 }),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      observed: {
        matchedPositiveBeachCount: 1,
        matchedPositiveUserCount: 1,
      },
      findings: [
        "Matched positive beach coverage is below the 2-beach floor.",
        "Matched positive user coverage is below the 2-user floor.",
      ],
      findingCodes: [
        "matched_positive_beaches_floor",
        "matched_positive_users_floor",
      ],
    });
  });

  it("blocks readiness when matched truth has incomplete display, raw, or v5 snapshots", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 2,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [
        row({
          beach_id: "beach-1",
          user_id: "user-1",
          snapshot_display_height_m: null,
          snapshot_raw_om_height_m: 0.7,
          snapshot_v5_shadow_height_m: null,
        }),
        row({
          beach_id: "beach-2",
          user_id: "user-2",
          forecast_horizon_hours: 48,
          snapshot_display_height_m: 0.8,
          snapshot_raw_om_height_m: null,
          snapshot_v5_shadow_height_m: null,
        }),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      findings: [
        "display snapshot completeness is below 100.0%.",
        "raw OM snapshot completeness is below 100.0%.",
        "v5 shadow snapshot completeness is below 100.0%.",
      ],
      findingCodes: [
        "display_snapshot_completeness_floor",
        "raw_om_snapshot_completeness_floor",
        "v5_shadow_snapshot_completeness_floor",
      ],
    });
  });

  it("blocks readiness when matched labels look like forecast echoes", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 2,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 0.25,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [
        row({
          beach_id: "beach-1",
          user_id: "user-1",
          reported_wave_height_ft: 3,
          snapshot_display_height_m: 3 / 3.28084,
          forecast_horizon_hours: 12,
        }),
        row({
          beach_id: "beach-2",
          user_id: "user-2",
          reported_wave_height_ft: 4,
          observed_m: 1.219,
          snapshot_display_height_m: 4 / 3.28084,
          forecast_horizon_hours: 48,
        }),
      ],
    });

    expect(report.forecastEchoRisk).toEqual({
      toleranceFt: 0.05,
      comparableMatchedPositiveCandidates: 2,
      displayEchoCandidates: 2,
      displayEchoRiskRate: 1,
    });
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      observed: {
        displayForecastEchoRiskRate: 1,
      },
      findings: ["Display-height forecast echo risk is above 25.0%."],
      findingCodes: ["display_forecast_echo_risk_ceiling"],
    });
  });

  it("blocks readiness when observed meters diverge from reported face height", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 2,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [
        row({
          beach_id: "beach-1",
          user_id: "user-1",
          reported_wave_height_ft: 3,
          observed_m: 0.914,
          forecast_horizon_hours: 12,
        }),
        row({
          beach_id: "beach-2",
          user_id: "user-2",
          reported_wave_height_ft: 4,
          observed_m: 0.914,
          forecast_horizon_hours: 48,
        }),
      ],
    });

    expect(report.reportedHeightConsistency).toEqual({
      toleranceM: 0.01,
      consistentMatchedPositiveCandidates: 1,
      inconsistentMatchedPositiveCandidates: 1,
      consistencyRate: 0.5,
    });
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      observed: {
        reportedHeightConsistencyRate: 0.5,
      },
      findings: ["Reported-height consistency is below 100.0%."],
      findingCodes: ["reported_height_consistency_floor"],
    });
  });

  it("excludes non-canonical display-source links from matched truth counts", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 2,
        minShortHorizonMatchedCandidates: 2,
        minMatchedPositiveBeaches: 2,
        minMatchedPositiveUsers: 2,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [
        row({
          beach_id: "beach-1",
          user_id: "user-1",
          forecast_horizon_hours: 12,
        }),
        row({
          beach_id: "beach-2",
          user_id: "user-2",
          forecast_horizon_hours: 48,
          snapshot_display_source: "legacy-display",
        }),
      ],
    });

    expect(report).toMatchObject({
      linkedPositiveCandidates: 2,
      nonCanonicalLinkedPositiveCandidates: 1,
      matchedPositiveCandidates: 1,
      unmatchedPositiveCandidates: 1,
      linkedPositiveDisplaySources: {
        "face-Hs-transformer-v1": 1,
        "legacy-display": 1,
      },
    });
    expect(report.positiveLabelsByHorizon).toEqual(
      expect.arrayContaining([
        {
          horizon: "0-24h",
          positiveObservedCandidates: 1,
          linkedPositiveCandidates: 1,
          unlinkedPositiveCandidates: 0,
          nonCanonicalLinkedPositiveCandidates: 0,
          matchedPositiveCandidates: 1,
          unmatchedPositiveCandidates: 0,
          matchedPositiveBeachCount: 1,
          matchedPositiveUserCount: 1,
        },
        {
          horizon: "25-72h",
          positiveObservedCandidates: 1,
          linkedPositiveCandidates: 1,
          unlinkedPositiveCandidates: 0,
          nonCanonicalLinkedPositiveCandidates: 1,
          matchedPositiveCandidates: 0,
          unmatchedPositiveCandidates: 1,
          matchedPositiveBeachCount: 0,
          matchedPositiveUserCount: 0,
        },
      ])
    );
    expect(report.unmatchedPositiveDiagnostics).toEqual({
      reasons: { non_canonical_display_source: 1 },
      byHorizon: { "25-72h": 1 },
      bySourceCreatedBy: { trigger: 1 },
      nonCanonicalDisplaySources: { "legacy-display": 1 },
    });
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForHarnessTruth: false,
      observed: {
        matchedPositiveCandidates: 1,
        shortHorizonMatchedCandidates: 1,
      },
      findings: [
        "Matched positive weak labels are below the 2-row floor.",
        "Matched 0-72h weak labels are below the 2-row floor.",
        "Matched positive beach coverage is below the 2-beach floor.",
        "Matched positive user coverage is below the 2-user floor.",
      ],
      findingCodes: [
        "matched_positive_candidates_floor",
        "short_horizon_matched_candidates_floor",
        "matched_positive_beaches_floor",
        "matched_positive_users_floor",
      ],
    });
  });

  it("renders aggregate-only markdown without candidate or prediction ids", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      rows: [row({ ml_prediction_id: "prediction-secret" })],
    });

    const markdown = renderSessionFaceHeightTruthReport(report);

    expect(markdown).toContain("# Track A Session Face-Height Truth Report");
    expect(markdown).toContain("| Linked positive labels | 1 |");
    expect(markdown).toContain("| Matched positive labels | 1 |");
    expect(markdown).toContain("| face-Hs-transformer-v1 | 1 |");
    expect(markdown).toContain("## Positive Label Coverage By Horizon");
    expect(markdown).toContain("## Unmatched Positive Diagnostics");
    expect(markdown).toContain("### Reasons");
    expect(markdown).toContain(
      "| 0-24h | 1 | 1 | 0 | 0 | 1 | 0 | 1 | 1 |"
    );
    expect(markdown).toContain("| Matched positive beaches | 1 |");
    expect(markdown).toContain("| Matched positive users | 1 |");
    expect(markdown).not.toContain("prediction-secret");
    expect(markdown).not.toContain("beach-secret");
    expect(markdown).not.toContain("user-secret");
  });

  it("writes aggregate-only JSON without candidate or prediction ids", () => {
    const dir = mkdtempSync(join(tmpdir(), "session-truth-report-"));
    const outputPath = join(dir, "nested", "report.json");

    try {
      const report = computeSessionFaceHeightTruthReport({
        start: START,
        end: END,
        days: 365,
        generatedAt: "2026-06-19T00:00:00.000Z",
        rows: [row({ ml_prediction_id: "prediction-secret" })],
      });

      const resolvedPath = writeSessionFaceHeightTruthReportJson(
        outputPath,
        report
      );
      const json = readFileSync(resolvedPath, "utf8");

      expect(json).toContain('"reportSchemaVersion": 2');
      expect(json).toContain('"generatedAt": "2026-06-19T00:00:00.000Z"');
      expect(json).toContain('"matchedPositiveCandidates": 1');
      expect(json).toContain('"positiveLabelsByHorizon"');
      expect(json).toContain('"unmatchedPositiveDiagnostics"');
      expect(json).toContain('"matchedPositiveBeachCount": 1');
      expect(json).toContain('"matchedPositiveUserCount": 1');
      expect(json).not.toContain("prediction-secret");
      expect(json).not.toContain("beach-secret");
      expect(json).not.toContain("user-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates saved JSON reports and rejects stale or unsafe report shapes", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 1,
        minShortHorizonMatchedCandidates: 1,
        minMatchedPositiveBeaches: 1,
        minMatchedPositiveUsers: 1,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [row()],
    });

    expect(
      validateSessionFaceHeightTruthReport(report, {
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T01:00:00.000Z"),
      })
    ).toEqual({
      ok: true,
      blockers: [],
    });

    expect(
      validateSessionFaceHeightTruthReport(
        {
          ...report,
          reportSchemaVersion: 0,
          generatedAt: "2026-06-17T00:00:00.000Z",
          readiness: {
            ...report.readiness,
            verdict: "ready",
            readyForHarnessTruth: false,
          },
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T01:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "report_schema_version_invalid",
        "generated_at_too_old",
        "readiness_verdict_ready_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport(
        {
          ...report,
          start: "2026-05-01T00:00:00.000Z",
          end: "2026-05-31T00:00:00.000Z",
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T01:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["measurement_end_too_old"]),
    });

    expect(
      validateSessionFaceHeightTruthReport(
        {
          ...report,
          end: "2026-06-20T00:00:00.000Z",
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T01:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["measurement_end_after_generated_at"]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        leakedCandidateId: "11111111-1111-4111-8111-111111111111",
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["report_contains_uuid"]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        readiness: {
          ...report.readiness,
          criteria: {
            ...report.readiness.criteria,
            minMatchedPositiveCandidates: 2,
          },
          verdict: "ready",
          readyForHarnessTruth: true,
          findings: [],
          findingCodes: [],
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "readiness_finding_codes_mismatch",
        "readiness_ready_for_harness_truth_mismatch",
        "readiness_verdict_mismatch",
        "readiness_findings_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        readiness: {
          ...report.readiness,
          observed: {
            ...report.readiness.observed,
            matchedPositiveCandidates: 999,
          },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["readiness_observed_mismatch"]),
    });
  });

  it("rejects hand-edited latest matched timestamp contradictions", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 1,
        minShortHorizonMatchedCandidates: 1,
        minMatchedPositiveBeaches: 1,
        minMatchedPositiveUsers: 1,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [row()],
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        latestMatchedPositiveObservedAt: null,
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "latest_matched_positive_observed_at_count_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        latestShortHorizonMatchedObservedAt: null,
        readiness: {
          ...report.readiness,
          observed: {
            ...report.readiness.observed,
            latestShortHorizonMatchedObservedAt: null,
            shortHorizonMatchedAgeDays: null,
          },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "latest_short_horizon_matched_observed_at_count_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        latestMatchedPositiveObservedAt: "2026-05-31T00:00:00.000Z",
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "latest_short_horizon_after_latest_matched_positive",
      ]),
    });
  });

  it("rejects a latest short-horizon timestamp when no short-horizon matches exist", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      readinessCriteria: {
        minMatchedPositiveCandidates: 1,
        minShortHorizonMatchedCandidates: 0,
        minMatchedPositiveBeaches: 1,
        minMatchedPositiveUsers: 1,
        minSnapshotCompletenessRate: 1,
        minReportedHeightConsistencyRate: 1,
        maxForecastEchoRiskRate: 1,
        forecastEchoToleranceFt: 0.05,
        maxShortHorizonMatchedAgeDays: 30,
      },
      rows: [row({ forecast_horizon_hours: 96 })],
    });
    const latestMatchedPositiveObservedAt =
      report.latestMatchedPositiveObservedAt;

    expect(latestMatchedPositiveObservedAt).toBe("2026-06-01T12:00:00.000Z");
    expect(report.latestShortHorizonMatchedObservedAt).toBeNull();
    expect(report.readiness.observed.shortHorizonMatchedCandidates).toBe(0);

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        latestShortHorizonMatchedObservedAt: latestMatchedPositiveObservedAt,
        readiness: {
          ...report.readiness,
          observed: {
            ...report.readiness.observed,
            latestShortHorizonMatchedObservedAt:
              latestMatchedPositiveObservedAt,
            shortHorizonMatchedAgeDays: 17.5,
          },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "latest_short_horizon_matched_observed_at_count_mismatch",
      ]),
    });
  });

  it("rejects hand-edited horizon and unmatched diagnostic counts", () => {
    const report = computeSessionFaceHeightTruthReport({
      start: START,
      end: END,
      days: 365,
      generatedAt: "2026-06-19T00:00:00.000Z",
      rows: [row()],
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        positiveLabelsByHorizon: report.positiveLabelsByHorizon.map(
          (coverage) =>
            coverage.horizon === "0-24h"
              ? {
                  ...coverage,
                  positiveObservedCandidates: 2,
                }
              : coverage
        ),
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "positive_labels_by_horizon_row_counts_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        positiveLabelsByHorizon: report.positiveLabelsByHorizon.map(
          (coverage) =>
            coverage.horizon === "0-24h"
              ? {
                  ...coverage,
                  positiveObservedCandidates: 2,
                  linkedPositiveCandidates: 2,
                  matchedPositiveCandidates: 2,
                }
              : coverage
        ),
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "positive_labels_by_horizon_counts_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        matchedPositiveByHorizon: { "25-72h": 1 },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "matched_positive_by_horizon_counts_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        unmatchedPositiveDiagnostics: {
          ...report.unmatchedPositiveDiagnostics,
          reasons: { unlinked_prediction: 1 },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "unmatched_positive_reasons_counts_mismatch",
      ]),
    });

    expect(
      validateSessionFaceHeightTruthReport({
        ...report,
        unmatchedPositiveDiagnostics: {
          ...report.unmatchedPositiveDiagnostics,
          nonCanonicalDisplaySources: { "legacy-display": 1 },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "unmatched_positive_non_canonical_sources_counts_mismatch",
      ]),
    });
  });

  it("validates a saved JSON report file from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "session-truth-report-file-"));
    const outputPath = join(dir, "report.json");

    try {
      const report = computeSessionFaceHeightTruthReport({
        start: START,
        end: END,
        days: 365,
        generatedAt: "2026-06-19T00:00:00.000Z",
        rows: [row()],
      });
      const resolvedPath = writeSessionFaceHeightTruthReportJson(
        outputPath,
        report
      );

      expect(
        validateSessionFaceHeightTruthReportFile(resolvedPath, {
          maxReportAgeHours: 24,
          now: new Date("2026-06-19T01:00:00.000Z"),
        })
      ).toEqual({
        ok: true,
        blockers: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
