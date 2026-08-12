import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_MATCH_WEIGHTS,
  buildCohortDiagnosticSummary,
  buildCohortSanityCheck,
  buildCurrentHeuristicValidation,
  buildMatchHeuristicMeasurementWindow,
  buildRatingInventory,
  buildRpcFloorDiagnosticSummary,
  buildReweightingReadiness,
  buildWeightSearchHoldout,
  buildMatchHeuristicValidationReport,
  buildPreferenceProfile,
  filterSessionRowsByRealProfiles,
  findBestWeights,
  parseCliArgs,
  parseNumeric,
  pearsonCorrelation,
  scoreAgainstProfile,
  spearmanCorrelation,
  validateMatchHeuristicValidationReport,
  validateMatchHeuristicValidationReportFile,
  validateMatchHeuristic,
  writeMatchHeuristicValidationReportJson,
  type MatchWeights,
  type ProfileRow,
  type RatingInventory,
  type RatedSessionSample,
  type SessionRow,
  type SnapshotRow,
  type ValidationSummary,
} from "../validate-match-score-heuristic";

const latestMatchScoreMigrationPath =
  "supabase/migrations/20260811183000_fix_match_score_core_board_aliases.sql";

const baseSession = (
  overrides: Partial<RatedSessionSample> = {}
): RatedSessionSample => ({
  id: "session-1",
  userId: "user-1",
  beachId: "beach-1",
  beachName: "Test Beach",
  breakType: "beach_break",
  arrivalTime: "2026-06-01T12:00:00Z",
  rating: 4,
  wave: 3,
  period: 12,
  wind: 5,
  windDir: 220,
  tide: 2,
  ...overrides,
});

const emptyComponentMetrics = (): ValidationSummary["componentPearson"] => ({
  wave: null,
  period: null,
  wind: null,
  tide: null,
  windDir: null,
});

const holdoutSummary = (
  overrides: Partial<ValidationSummary["reweightingHoldout"]> = {}
): ValidationSummary["reweightingHoldout"] => ({
  strategy: "user-deterministic-80-20",
  trainScoredCount: 0,
  trainUserCount: 0,
  holdoutScoredCount: 0,
  holdoutUserCount: 0,
  trainedWeights: null,
  trainPearson: null,
  holdoutPearson: null,
  ...overrides,
});

const rpcFloorDiagnostic = (
  summary: ValidationSummary,
  overrides: Partial<ReturnType<typeof buildRpcFloorDiagnosticSummary>> = {}
): ReturnType<typeof buildRpcFloorDiagnosticSummary> => ({
  profileScope: "user",
  historyMode: "prior-only",
  minHistory: 1,
  productionEvidence: false,
  summary,
  warning: "Diagnostic only.",
  ...overrides,
});

const sessionRow = (
  id: string,
  userId: string,
  overrides: Partial<SessionRow> = {}
): SessionRow => ({
  id,
  user_id: userId,
  beach_id: "beach-1",
  arrival_time: "2026-06-01T12:00:00Z",
  rating: 4,
  session_skill_fit: null,
  session_board_fit: null,
  ...overrides,
});

const profileRow = (
  id: string,
  overrides: Partial<ProfileRow> = {}
): ProfileRow => ({
  id,
  deleted_at: null,
  is_mock: false,
  analytics_is_real_user: true,
  is_system_account: false,
  ...overrides,
});

describe("validate-match-score-heuristic", () => {
  it("parses defaults and an output JSON path", () => {
    expect(parseCliArgs(["--output-json=/tmp/match-validation.json"])).toEqual({
      months: 12,
      minHistory: 5,
      historyMode: "prior-only",
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
      failOnNotReady: false,
      outputJsonPath: "/tmp/match-validation.json",
      validateOutputJsonPath: null,
      maxReportAgeHours: null,
    });
  });

  it("parses reweighting readiness gate and report-validation options", () => {
    expect(
      parseCliArgs([
        "--months=6",
        "--min-history=3",
        "--min-scored-sessions=200",
        "--min-users",
        "50",
        "--min-pearson",
        "0.35",
        "--fail-on-not-ready",
      ])
    ).toEqual({
      months: 6,
      minHistory: 3,
      historyMode: "prior-only",
      minScoredSessions: 200,
      minUsers: 50,
      minPearson: 0.35,
      failOnNotReady: true,
      outputJsonPath: null,
      validateOutputJsonPath: null,
      maxReportAgeHours: null,
    });

    expect(
      parseCliArgs([
        "--validate-output-json",
        "/tmp/match-validation.json",
        "--max-report-age-hours=24",
      ])
    ).toEqual({
      months: 12,
      minHistory: 5,
      historyMode: "prior-only",
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
      failOnNotReady: false,
      outputJsonPath: null,
      validateOutputJsonPath: "/tmp/match-validation.json",
      maxReportAgeHours: 24,
    });
  });

  it("rejects invalid readiness count floors instead of rounding or defaulting", () => {
    expect(() => parseCliArgs(["--months", "1.5"])).toThrow(
      "--months must be a positive integer."
    );
    expect(() => parseCliArgs(["--min-history=-1"])).toThrow(
      "--min-history must be a non-negative integer."
    );
    expect(() => parseCliArgs(["--min-history", "4.5"])).toThrow(
      "--min-history must be a non-negative integer."
    );
    expect(() => parseCliArgs(["--min-scored-sessions=99.5"])).toThrow(
      "--min-scored-sessions must be a positive integer."
    );
    expect(() => parseCliArgs(["--min-users", "24.5"])).toThrow(
      "--min-users must be a positive integer."
    );
    expect(() => parseCliArgs(["--min-pearson=0"])).toThrow(
      "--min-pearson must be greater than 0 and no more than 1."
    );
    expect(() => parseCliArgs(["--min-pearson", "1.1"])).toThrow(
      "--min-pearson must be greater than 0 and no more than 1."
    );
    expect(() =>
      parseCliArgs(["--max-report-age-hours=0", "--validate-output-json=/tmp/a.json"])
    ).toThrow("--max-report-age-hours must be a positive integer.");
  });

  it("rejects readiness flags without values", () => {
    expect(() => parseCliArgs(["--months"])).toThrow(
      "--months requires a value."
    );
    expect(() => parseCliArgs(["--min-history="])).toThrow(
      "--min-history requires a value."
    );
    expect(() =>
      parseCliArgs(["--min-users", "--fail-on-not-ready"])
    ).toThrow("--min-users requires a value.");
    expect(() => parseCliArgs(["--min-pearson="])).toThrow(
      "--min-pearson requires a value."
    );
    expect(() => parseCliArgs(["--validate-output-json"])).toThrow(
      "--validate-output-json requires a value."
    );
    expect(() =>
      parseCliArgs(["--max-report-age-hours", "--fail-on-not-ready"])
    ).toThrow("--max-report-age-hours requires a value.");
  });

  it("rejects unknown validation arguments", () => {
    expect(() => parseCliArgs(["--fail-on-notready"])).toThrow(
      "Unknown argument: --fail-on-notready."
    );
    expect(() =>
      parseCliArgs(["--min-scored-session", "100"])
    ).toThrow("Unknown argument: --min-scored-session.");
    expect(() => parseCliArgs(["/tmp/extra.json"])).toThrow(
      "Unknown argument: /tmp/extra.json."
    );
    expect(() =>
      parseCliArgs([
        "--output-json=/tmp/a.json",
        "--validate-output-json=/tmp/b.json",
      ])
    ).toThrow("--validate-output-json cannot be combined with --output-json.");
    expect(() => parseCliArgs(["--max-report-age-hours=24"])).toThrow(
      "--max-report-age-hours requires --validate-output-json."
    );
  });

  it("parses explicit diagnostic history mode", () => {
    expect(
      parseCliArgs(["--history-mode", "leave-one-out"])
    ).toMatchObject({
      historyMode: "leave-one-out",
    });
    expect(parseCliArgs(["--include-future-history"])).toMatchObject({
      historyMode: "leave-one-out",
    });
    expect(() => parseCliArgs(["--history-mode", "future"])).toThrow(
      "--history-mode must be prior-only or leave-one-out."
    );
  });

  it("builds an exact UTC measurement window for saved Track C artifacts", () => {
    expect(
      buildMatchHeuristicMeasurementWindow(
        12,
        new Date("2026-06-20T04:00:00.000Z")
      )
    ).toEqual({
      start: "2025-06-20T04:00:00.000Z",
      end: "2026-06-20T04:00:00.000Z",
      months: 12,
    });

    expect(() =>
      buildMatchHeuristicMeasurementWindow(
        0,
        new Date("2026-06-20T04:00:00.000Z")
      )
    ).toThrow("months must be a positive integer.");
  });

  it("parses numeric forecast snapshot strings", () => {
    expect(parseNumeric("3-4 ft")).toBe(3);
    expect(parseNumeric("12s")).toBe(12);
    expect(parseNumeric("W 270")).toBe(270);
    expect(parseNumeric(4.5)).toBe(4.5);
    expect(parseNumeric("flat")).toBeNull();
    expect(parseNumeric(null)).toBeNull();
  });

  it("excludes non-real profiles before validating rating samples", () => {
    const sessions = [
      sessionRow("real-session", "real-user"),
      sessionRow("mock-session", "mock-user"),
      sessionRow("deleted-session", "deleted-user"),
      sessionRow("analytics-excluded-session", "analytics-excluded-user"),
      sessionRow("system-session", "system-user"),
      sessionRow("missing-profile-session", "missing-profile-user"),
    ];
    const profilesById = new Map<string, ProfileRow>(
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

    expect(filterSessionRowsByRealProfiles(sessions, profilesById)).toEqual([
      sessions[0],
    ]);
  });

  it("builds aggregate rating inventory attrition without actor identifiers", () => {
    const ratedSessions = [
      sessionRow("loaded-session", "real-user"),
      sessionRow("missing-snapshot-session", "real-user"),
      sessionRow("null-snapshot-session", "another-real-user"),
      sessionRow("mock-session", "mock-user"),
    ];
    const realUserSessions = ratedSessions.slice(0, 3);
    const snapshotsBySessionId = new Map<string, SnapshotRow>([
      [
        "loaded-session",
        {
          session_id: "loaded-session",
          forecast_snapshot: { wave_height: 3 },
        },
      ],
      [
        "null-snapshot-session",
        {
          session_id: "null-snapshot-session",
          forecast_snapshot: null,
        },
      ],
    ]);
    const loadedSessions = [
      baseSession({
        id: "loaded-session",
        userId: "real-user",
      }),
    ];

    expect(
      buildRatingInventory({
        ratedSessions,
        realUserSessions,
        snapshotsBySessionId,
        loadedSessions,
      })
    ).toEqual({
      rawRatedSessionCount: 4,
      rawRatedUserCount: 3,
      realProfileRatedSessionCount: 3,
      realProfileUserCount: 2,
      excludedProfileSessionCount: 1,
      missingForecastSnapshotSessionCount: 2,
      loadedRatedSessionCount: 1,
      loadedUserCount: 1,
    });
  });

  it("builds positive preference peaks from rating-weighted history", () => {
    const target = baseSession({
      id: "target",
      rating: 5,
      arrivalTime: "2026-06-04T12:00:00Z",
    });
    const profile = buildPreferenceProfile(
      [
        target,
        baseSession({
          id: "good",
          rating: 4,
          wave: 2,
          period: 10,
          arrivalTime: "2026-06-01T12:00:00Z",
        }),
        baseSession({
          id: "great",
          rating: 5,
          wave: 4,
          period: 14,
          arrivalTime: "2026-06-02T12:00:00Z",
        }),
        baseSession({
          id: "bad",
          rating: 2,
          wave: 8,
          period: 6,
          arrivalTime: "2026-06-03T12:00:00Z",
        }),
      ],
      target
    );

    expect(profile.sessionCount).toBe(3);
    expect(profile.positiveCount).toBe(2);
    expect(profile.aversionCount).toBe(1);
    expect(profile.peak.wave).toBeCloseTo((2 * 1 + 4 * 2) / 3);
    expect(profile.peak.period).toBeCloseTo((10 * 1 + 14 * 2) / 3);
  });

  it("excludes future sessions from the default prior-only profile", () => {
    const target = baseSession({
      id: "target",
      rating: 4,
      arrivalTime: "2026-06-02T12:00:00Z",
    });
    const sessions = [
      target,
      baseSession({
        id: "prior",
        rating: 5,
        wave: 3,
        arrivalTime: "2026-06-01T12:00:00Z",
      }),
      baseSession({
        id: "future",
        rating: 5,
        wave: 9,
        arrivalTime: "2026-06-03T12:00:00Z",
      }),
    ];

    expect(buildPreferenceProfile(sessions, target).peak.wave).toBe(3);
    expect(
      buildPreferenceProfile(sessions, target, {
        historyMode: "leave-one-out",
      }).peak.wave
    ).toBe(6);
  });

  it("scores sessions higher when they are close to the preference peak", () => {
    const history = [
      baseSession({
        id: "h1",
        rating: 5,
        wave: 3,
        period: 12,
        wind: 5,
        arrivalTime: "2026-06-01T12:00:00Z",
      }),
      baseSession({
        id: "h2",
        rating: 4,
        wave: 3.2,
        period: 11,
        wind: 6,
        arrivalTime: "2026-06-02T12:00:00Z",
      }),
    ];
    const closeTarget = baseSession({
      id: "close",
      rating: 5,
      wave: 3.1,
      arrivalTime: "2026-06-03T12:00:00Z",
    });
    const farTarget = baseSession({
      id: "far",
      rating: 2,
      wave: 8,
      period: 6,
      arrivalTime: "2026-06-04T12:00:00Z",
    });

    const closeScore = scoreAgainstProfile(
      closeTarget,
      buildPreferenceProfile([...history, closeTarget], closeTarget)
    );
    const farScore = scoreAgainstProfile(
      farTarget,
      buildPreferenceProfile([...history, farTarget], farTarget)
    );

    expect(closeScore?.score).toBeGreaterThan(farScore?.score ?? 0);
    expect(closeScore?.componentCloseness.wave).toBeGreaterThan(
      farScore?.componentCloseness.wave ?? 0
    );
  });

  it("computes Pearson and Spearman correlations", () => {
    expect(pearsonCorrelation([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(spearmanCorrelation([10, 20, 30], [1, 2, 3])).toBe(1);
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it("validates prior-only scored sessions and can find exploratory weights", () => {
    const sessions = [
      baseSession({
        id: "h1",
        rating: 5,
        wave: 3,
        period: 12,
        wind: 5,
        arrivalTime: "2026-06-01T12:00:00Z",
      }),
      baseSession({
        id: "h2",
        rating: 5,
        wave: 3.1,
        period: 12,
        wind: 5,
        arrivalTime: "2026-06-02T12:00:00Z",
      }),
      baseSession({
        id: "h3",
        rating: 4,
        wave: 3.2,
        period: 11,
        wind: 6,
        arrivalTime: "2026-06-03T12:00:00Z",
      }),
      baseSession({
        id: "h4",
        rating: 4,
        wave: 2.8,
        period: 13,
        wind: 4,
        arrivalTime: "2026-06-04T12:00:00Z",
      }),
      baseSession({
        id: "h5",
        rating: 4,
        wave: 3,
        period: 12,
        wind: 5,
        arrivalTime: "2026-06-05T12:00:00Z",
      }),
      baseSession({
        id: "bad",
        rating: 2,
        wave: 8,
        period: 6,
        wind: 18,
        arrivalTime: "2026-06-06T12:00:00Z",
      }),
    ];

    const summary = validateMatchHeuristic(sessions, 3);
    expect(summary.loadedCount).toBe(6);
    expect(summary.usableCount).toBe(6);
    expect(summary.scoredCount).toBeGreaterThan(0);
    expect(summary.loadedUserCount).toBe(1);
    expect(summary.userCount).toBe(1);
    expect(summary.scorePearson).not.toBeNull();

    const best = findBestWeights(
      sessions.flatMap((session) => {
        const score = scoreAgainstProfile(
          session,
          buildPreferenceProfile(sessions, session, {
            historyMode: "leave-one-out",
          })
        );
        return score ? [score] : [];
      }),
      0.5
    );
    expect(best?.weights).toEqual(
      expect.objectContaining({
        wave: expect.any(Number),
      })
    );
  });

  it("trains exploratory weights on a deterministic user-level holdout split", () => {
    const scored = ["a", "b", "c", "d", "e"].flatMap((userId) =>
      [1, 3, 5].map((rating) => ({
        userId: `user-${userId}`,
        rating,
        score: rating,
        componentCloseness: {
          wave: rating / 5,
          period: 0,
          wind: 0,
          tide: 0,
          windDir: 0,
        },
        historyCount: 5,
      }))
    ) satisfies Parameters<typeof buildWeightSearchHoldout>[0];

    const holdout = buildWeightSearchHoldout(scored);

    expect(holdout).toMatchObject({
      strategy: "user-deterministic-80-20",
      trainScoredCount: 12,
      trainUserCount: 4,
      holdoutScoredCount: 3,
      holdoutUserCount: 1,
      trainPearson: 1,
      holdoutPearson: 1,
    });
    expect(holdout.trainedWeights).not.toBeNull();
  });

  it("scores a broad cohort diagnostic without weakening prior-history scoring", () => {
    const sparseUserSessions = [
      baseSession({
        id: "user-a-good",
        userId: "user-a",
        rating: 5,
        wave: 3,
        period: 12,
        wind: 5,
        arrivalTime: "2026-06-01T12:00:00Z",
      }),
      baseSession({
        id: "user-b-good",
        userId: "user-b",
        rating: 4,
        wave: 3.1,
        period: 12,
        wind: 5,
        arrivalTime: "2026-06-02T12:00:00Z",
      }),
      baseSession({
        id: "user-c-good",
        userId: "user-c",
        rating: 4,
        wave: 3.2,
        period: 11,
        wind: 6,
        arrivalTime: "2026-06-03T12:00:00Z",
      }),
      baseSession({
        id: "user-d-bad",
        userId: "user-d",
        rating: 2,
        wave: 8,
        period: 6,
        wind: 18,
        arrivalTime: "2026-06-04T12:00:00Z",
      }),
    ];

    expect(validateMatchHeuristic(sparseUserSessions, 1).scoredCount).toBe(0);

    const diagnostic = buildCohortDiagnosticSummary(sparseUserSessions, 1);

    expect(diagnostic).toMatchObject({
      profileScope: "cohort",
      historyMode: "leave-one-out",
      minHistory: 1,
    });
    expect(diagnostic.summary.scoredCount).toBe(4);
    expect(diagnostic.summary.userCount).toBe(4);
    expect(diagnostic.warning).toContain("not production personalization");

    const sanityCheck = buildCohortSanityCheck(diagnostic, {
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
    });

    expect(sanityCheck).toMatchObject({
      verdict: "insufficient-signal",
      productionEvidence: false,
      criteria: {
        profileScope: "cohort",
        historyMode: "leave-one-out",
        minHistory: 1,
      },
      observed: {
        scoredCount: 4,
        userCount: 4,
      },
    });
    expect(sanityCheck.findingCodes).toEqual(
      expect.arrayContaining([
        "cohort_not_production_evidence",
        "cohort_scored_sessions_floor",
        "cohort_scored_users_floor",
      ])
    );
  });

  it("scores an RPC-floor same-user diagnostic without weakening the strict gate", () => {
    const sessions = [
      baseSession({
        id: "u1-positive",
        userId: "user-1",
        rating: 5,
        wave: 3,
        arrivalTime: "2026-06-01T12:00:00Z",
      }),
      baseSession({
        id: "u1-target",
        userId: "user-1",
        rating: 2,
        wave: 7,
        arrivalTime: "2026-06-02T12:00:00Z",
      }),
      baseSession({
        id: "u2-lone",
        userId: "user-2",
        rating: 5,
        wave: 3,
        arrivalTime: "2026-06-03T12:00:00Z",
      }),
    ];

    expect(validateMatchHeuristic(sessions, 5).scoredCount).toBe(0);

    const diagnostic = buildRpcFloorDiagnosticSummary(sessions);

    expect(diagnostic).toMatchObject({
      profileScope: "user",
      historyMode: "prior-only",
      minHistory: 1,
      productionEvidence: false,
      summary: {
        loadedCount: 3,
        usableCount: 3,
        scoredCount: 1,
        userCount: 1,
      },
    });
    expect(diagnostic.warning).toContain("Diagnostic only");
  });

  it("marks reweighting not ready when scored samples and users are sparse", () => {
    const sessions = [
      baseSession({ id: "h1", rating: 5, wave: 3, period: 12, wind: 5 }),
      baseSession({ id: "h2", rating: 5, wave: 3.1, period: 12, wind: 5 }),
      baseSession({ id: "h3", rating: 4, wave: 3.2, period: 11, wind: 6 }),
      baseSession({ id: "h4", rating: 4, wave: 2.8, period: 13, wind: 4 }),
      baseSession({ id: "h5", rating: 4, wave: 3, period: 12, wind: 5 }),
      baseSession({ id: "bad", rating: 2, wave: 8, period: 6, wind: 18 }),
    ];
    const summary = validateMatchHeuristic(sessions, 3);

    const readiness = buildReweightingReadiness(summary, {
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
    });

    expect(readiness).toMatchObject({
      verdict: "not-ready",
      readyForExperiment: false,
      readyForProduction: false,
    });
    expect(readiness.findings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Prior-history scored sessions"),
        expect.stringContaining("Scored users represented"),
      ])
    );
    expect(readiness.findingCodes).toEqual(
      expect.arrayContaining([
        "scored_sessions_floor",
        "scored_users_floor",
      ])
    );
  });

  it("marks current heuristic not validated when current weights are negatively aligned", () => {
    const summary: ValidationSummary = {
      loadedCount: 150,
      usableCount: 145,
      scoredCount: 120,
      loadedUserCount: 35,
      userCount: 30,
      scorePearson: -0.3,
      scoreSpearman: -0.2,
      componentPearson: emptyComponentMetrics(),
      componentSpearman: emptyComponentMetrics(),
      bestWeights: {
        wave: 0.4,
        period: 0.2,
        wind: 0.2,
        tide: 0.1,
        windDir: 0.1,
      },
      bestWeightPearson: 0.25,
      reweightingHoldout: holdoutSummary({
        trainScoredCount: 96,
        trainUserCount: 24,
        holdoutScoredCount: 24,
        holdoutUserCount: 6,
        trainedWeights: {
          wave: 0.4,
          period: 0.2,
          wind: 0.2,
          tide: 0.1,
          windDir: 0.1,
        },
        trainPearson: 0.25,
        holdoutPearson: 0.22,
      }),
      currentWeightPearson: -0.3,
      ratingBuckets: [],
    };

    const validation = buildCurrentHeuristicValidation(summary, {
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
    });

    expect(validation).toMatchObject({
      verdict: "not-validated",
      observed: {
        scoredCount: 120,
        userCount: 30,
        currentWeightPearson: -0.3,
        currentWeightSpearman: -0.2,
      },
    });
    expect(validation.findings).toEqual([
      "Current-weight Pearson -0.300 is below 0.200.",
    ]);
    expect(validation.findingCodes).toEqual([
      "current_weight_pearson_floor",
    ]);
  });

  it("emits stable finding codes when Track C samples and correlations are unavailable", () => {
    const summary: ValidationSummary = {
      loadedCount: 0,
      usableCount: 0,
      scoredCount: 0,
      loadedUserCount: 0,
      userCount: 0,
      scorePearson: null,
      scoreSpearman: null,
      componentPearson: emptyComponentMetrics(),
      componentSpearman: emptyComponentMetrics(),
      bestWeights: null,
      bestWeightPearson: null,
      reweightingHoldout: holdoutSummary(),
      currentWeightPearson: null,
      ratingBuckets: [],
    };

    const currentValidation = buildCurrentHeuristicValidation(summary, {
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
    });
    const reweightingReadiness = buildReweightingReadiness(summary, {
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
    });

    expect(currentValidation.findingCodes).toEqual([
      "current_scored_sessions_floor",
      "current_scored_users_floor",
      "current_weight_pearson_unavailable",
    ]);
    expect(reweightingReadiness.findingCodes).toEqual([
      "scored_sessions_floor",
      "scored_users_floor",
      "best_grid_pearson_unavailable",
      "holdout_grid_pearson_unavailable",
    ]);

    const weakGridReadiness = buildReweightingReadiness(
      {
        ...summary,
        scoredCount: 100,
        userCount: 25,
        bestWeightPearson: 0.1,
        reweightingHoldout: holdoutSummary({
          trainScoredCount: 80,
          trainUserCount: 20,
          holdoutScoredCount: 20,
          holdoutUserCount: 5,
          trainedWeights: {
            wave: 0.4,
            period: 0.2,
            wind: 0.2,
            tide: 0.1,
            windDir: 0.1,
          },
          trainPearson: 0.1,
          holdoutPearson: 0.25,
        }),
      },
      {
        minScoredSessions: 100,
        minUsers: 25,
        minPearson: 0.2,
      }
    );

    expect(weakGridReadiness.findingCodes).toEqual([
      "best_grid_pearson_floor",
    ]);
  });

  it("blocks reweighting candidates when user-level holdout is unavailable or weak", () => {
    const summary: ValidationSummary = {
      loadedCount: 150,
      usableCount: 145,
      scoredCount: 120,
      loadedUserCount: 35,
      userCount: 30,
      scorePearson: 0.1,
      scoreSpearman: null,
      componentPearson: emptyComponentMetrics(),
      componentSpearman: emptyComponentMetrics(),
      bestWeights: {
        wave: 0.4,
        period: 0.2,
        wind: 0.2,
        tide: 0.1,
        windDir: 0.1,
      },
      bestWeightPearson: 0.25,
      reweightingHoldout: holdoutSummary({
        trainScoredCount: 96,
        trainUserCount: 24,
        holdoutScoredCount: 24,
        holdoutUserCount: 6,
        trainedWeights: {
          wave: 0.4,
          period: 0.2,
          wind: 0.2,
          tide: 0.1,
          windDir: 0.1,
        },
        trainPearson: 0.25,
        holdoutPearson: null,
      }),
      currentWeightPearson: 0.1,
      ratingBuckets: [],
    };

    expect(
      buildReweightingReadiness(summary, {
        minScoredSessions: 100,
        minUsers: 25,
        minPearson: 0.2,
      })
    ).toMatchObject({
      verdict: "not-ready",
      findingCodes: ["holdout_grid_pearson_unavailable"],
    });

    expect(
      buildReweightingReadiness(
        {
          ...summary,
          reweightingHoldout: {
            ...summary.reweightingHoldout,
            holdoutPearson: 0.1,
          },
        },
        {
          minScoredSessions: 100,
          minUsers: 25,
          minPearson: 0.2,
        }
      )
    ).toMatchObject({
      verdict: "not-ready",
      findingCodes: ["holdout_grid_pearson_floor"],
    });
  });

  it("marks current heuristic validated only when sample and correlation floors pass", () => {
    const summary: ValidationSummary = {
      loadedCount: 150,
      usableCount: 145,
      scoredCount: 120,
      loadedUserCount: 35,
      userCount: 30,
      scorePearson: 0.24,
      scoreSpearman: 0.21,
      componentPearson: emptyComponentMetrics(),
      componentSpearman: emptyComponentMetrics(),
      bestWeights: {
        wave: 0.4,
        period: 0.2,
        wind: 0.2,
        tide: 0.1,
        windDir: 0.1,
      },
      bestWeightPearson: 0.25,
      reweightingHoldout: holdoutSummary({
        trainScoredCount: 96,
        trainUserCount: 24,
        holdoutScoredCount: 24,
        holdoutUserCount: 6,
        trainedWeights: {
          wave: 0.4,
          period: 0.2,
          wind: 0.2,
          tide: 0.1,
          windDir: 0.1,
        },
        trainPearson: 0.25,
        holdoutPearson: 0.22,
      }),
      currentWeightPearson: 0.24,
      ratingBuckets: [],
    };

    const validation = buildCurrentHeuristicValidation(summary, {
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
    });

    expect(validation).toMatchObject({
      verdict: "validated",
      observed: {
        scoredCount: 120,
        userCount: 30,
        currentWeightPearson: 0.24,
        currentWeightSpearman: 0.21,
      },
    });
    expect(validation.findings).toEqual([
      "Current weights clear the validation floor for this historical sample.",
    ]);
    expect(validation.findingCodes).toEqual(["current_weights_validated"]);
  });

  it("marks reweighting as an experiment candidate without production approval", () => {
    const summary: ValidationSummary = {
      loadedCount: 150,
      usableCount: 145,
      scoredCount: 120,
      loadedUserCount: 35,
      userCount: 30,
      scorePearson: 0.1,
      scoreSpearman: null,
      componentPearson: emptyComponentMetrics(),
      componentSpearman: emptyComponentMetrics(),
      bestWeights: {
        wave: 0.4,
        period: 0.2,
        wind: 0.2,
        tide: 0.1,
        windDir: 0.1,
      },
      bestWeightPearson: 0.25,
      reweightingHoldout: holdoutSummary({
        trainScoredCount: 96,
        trainUserCount: 24,
        holdoutScoredCount: 24,
        holdoutUserCount: 6,
        trainedWeights: {
          wave: 0.4,
          period: 0.2,
          wind: 0.2,
          tide: 0.1,
          windDir: 0.1,
        },
        trainPearson: 0.25,
        holdoutPearson: 0.22,
      }),
      currentWeightPearson: 0.1,
      ratingBuckets: [],
    };

    const readiness = buildReweightingReadiness(summary, {
      minScoredSessions: 100,
      minUsers: 25,
      minPearson: 0.2,
    });

    expect(readiness).toMatchObject({
      verdict: "candidate",
      readyForExperiment: true,
      readyForProduction: false,
    });
    expect(readiness.findings).toEqual([
      expect.stringContaining("not production approval"),
    ]);
    expect(readiness.findingCodes).toEqual([
      "reweighting_candidate_not_production_approval",
    ]);
  });

  it("writes an aggregate-only JSON report without raw actor identifiers", () => {
    const dir = mkdtempSync(join(tmpdir(), "match-validation-"));
    const outputPath = join(dir, "nested", "report.json");

    try {
      const sessions = [
        baseSession({ id: "session-secret-1", userId: "user-secret", rating: 5 }),
        baseSession({ id: "session-secret-2", userId: "user-secret", rating: 5 }),
        baseSession({ id: "session-secret-3", userId: "user-secret", rating: 4 }),
        baseSession({ id: "session-secret-4", userId: "user-secret", rating: 4 }),
        baseSession({ id: "session-secret-5", userId: "user-secret", rating: 4 }),
        baseSession({ id: "session-secret-6", userId: "user-secret", rating: 2 }),
      ];
      const summary = validateMatchHeuristic(sessions, 3, "leave-one-out");
      const report = buildMatchHeuristicValidationReport(
        summary,
        {
          months: 12,
          minHistory: 3,
          historyMode: "leave-one-out",
          minScoredSessions: 100,
          minUsers: 25,
          minPearson: 0.2,
          failOnNotReady: false,
          outputJsonPath: outputPath,
          validateOutputJsonPath: null,
          maxReportAgeHours: null,
        },
        buildRpcFloorDiagnosticSummary(sessions),
        "2026-06-19T00:00:00.000Z",
        buildRatingInventoryForJsonTest(),
        buildCohortDiagnosticSummary(sessions, 3)
      );

      const resolvedPath = writeMatchHeuristicValidationReportJson(
        outputPath,
        report
      );
      const json = readFileSync(resolvedPath, "utf8");

      expect(json).toContain('"reportSchemaVersion": 4');
      expect(json).toContain('"generatedAt": "2026-06-19T00:00:00.000Z"');
      expect(json).toContain('"measurementWindow"');
      expect(json).toContain('"start": "2025-06-19T00:00:00.000Z"');
      expect(json).toContain('"end": "2026-06-19T00:00:00.000Z"');
      expect(json).toContain('"ratingInventory"');
      expect(json).toContain('"rpcFloorDiagnostic"');
      expect(json).toContain('"cohortDiagnostic"');
      expect(json).toContain('"cohortSanityCheck"');
      expect(json).toContain('"profileScope": "cohort"');
      expect(json).toContain('"profileScope": "user"');
      expect(json).toContain('"productionEvidence": false');
      expect(json).toContain('"warning"');
      expect(json).toContain('"rawRatedSessionCount": 60');
      expect(json).toContain('"realProfileRatedSessionCount": 43');
      expect(json).toContain('"missingForecastSnapshotSessionCount": 17');
      expect(json).toContain('"loadedCount": 6');
      expect(json).toContain('"loadedUserCount": 1');
      expect(json).toContain('"userCount": 1');
      expect(json).toContain('"historyMode": "leave-one-out"');
      expect(json).toContain('"wave": 0.35');
      expect(json).toContain('"currentHeuristicValidation"');
      expect(json).toContain('"verdict": "not-validated"');
      expect(json).toContain('"currentWeightPearson"');
      expect(json).toContain('"reweightingHoldout"');
      expect(json).toContain('"holdoutPearson"');
      expect(json).toContain('"reweightingReadiness"');
      expect(json).toContain('"readyForProduction": false');
      expect(json).not.toContain("user-secret");
      expect(json).not.toContain("session-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates saved aggregate JSON reports and rejects stale report shapes", () => {
    const summary: ValidationSummary = {
      loadedCount: 6,
      usableCount: 6,
      scoredCount: 3,
      loadedUserCount: 2,
      userCount: 1,
      scorePearson: 0.2,
      scoreSpearman: 0.1,
      componentPearson: emptyComponentMetrics(),
      componentSpearman: emptyComponentMetrics(),
      bestWeights: {
        wave: 0,
        period: 0,
        wind: 0,
        tide: 1,
        windDir: 0,
      },
      bestWeightPearson: 0.2,
      reweightingHoldout: holdoutSummary({
        trainScoredCount: 3,
        trainUserCount: 1,
        holdoutScoredCount: 0,
        holdoutUserCount: 0,
        trainedWeights: {
          wave: 0,
          period: 0,
          wind: 0,
          tide: 1,
          windDir: 0,
        },
        trainPearson: 0.2,
        holdoutPearson: null,
      }),
      currentWeightPearson: 0.2,
      ratingBuckets: [{ rating: 5, count: 3, averageScore: 7.5 }],
    };
    const report = buildMatchHeuristicValidationReport(
      summary,
      {
        months: 12,
        minHistory: 3,
        historyMode: "prior-only",
        minScoredSessions: 3,
        minUsers: 1,
        minPearson: 0.2,
        failOnNotReady: false,
        outputJsonPath: null,
        validateOutputJsonPath: null,
        maxReportAgeHours: null,
      },
      rpcFloorDiagnostic(summary),
      "2026-06-20T04:00:00.000Z",
      buildRatingInventoryForJsonTest(),
      null
    );

    expect(
      validateMatchHeuristicValidationReport(report, {
        maxReportAgeHours: 24,
        now: new Date("2026-06-20T05:00:00.000Z"),
      })
    ).toEqual({
      ok: true,
      blockers: [],
    });

    expect(
      validateMatchHeuristicValidationReport(
        {
          ...report,
          reportSchemaVersion: 0,
          reweightingReadiness: {
            ...report.reweightingReadiness,
            readyForProduction: true,
          },
          cohortSanityCheck: {
            ...report.cohortSanityCheck,
            productionEvidence: true,
          },
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-06-21T05:00:01.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "report_schema_version_invalid",
        "generated_at_too_old",
        "cohort_sanity_production_evidence_not_false",
        "reweighting_ready_for_production_not_false",
      ]),
    });

    const reportWithoutMeasurementWindow = {
      ...report,
    } as Record<string, unknown>;
    delete reportWithoutMeasurementWindow.measurementWindow;

    expect(
      validateMatchHeuristicValidationReport(reportWithoutMeasurementWindow)
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["measurement_window_invalid"]),
    });

    const summaryWithoutHoldout: Record<string, unknown> = {
      ...report.summary,
    };
    delete summaryWithoutHoldout.reweightingHoldout;
    const reportWithoutHoldout = {
      ...report,
      summary: summaryWithoutHoldout,
    };

    expect(
      validateMatchHeuristicValidationReport(reportWithoutHoldout)
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "summary_reweighting_holdout_invalid",
      ]),
    });

    const reportWithoutRpcFloorDiagnostic = {
      ...report,
    } as Record<string, unknown>;
    delete reportWithoutRpcFloorDiagnostic.rpcFloorDiagnostic;

    expect(
      validateMatchHeuristicValidationReport(reportWithoutRpcFloorDiagnostic)
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["rpc_floor_diagnostic_invalid"]),
    });

    expect(
      validateMatchHeuristicValidationReport({
        ...report,
        rpcFloorDiagnostic: {
          ...report.rpcFloorDiagnostic,
          productionEvidence: true,
          summary: {
            ...report.rpcFloorDiagnostic.summary,
            loadedCount: report.summary.loadedCount + 1,
          },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "rpc_floor_diagnostic_production_evidence_not_false",
        "rpc_floor_summary_loaded_sample_mismatch",
      ]),
    });

    expect(
      validateMatchHeuristicValidationReport(
        {
          ...report,
          measurementWindow: {
            start: "2025-06-18T04:00:00.000Z",
            end: "2026-06-18T04:00:00.000Z",
            months: 12,
          },
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-06-20T05:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["measurement_end_too_old"]),
    });

    expect(
      validateMatchHeuristicValidationReport(
        {
          ...report,
          measurementWindow: {
            start: "2025-06-21T04:00:00.000Z",
            end: "2026-06-21T04:00:00.000Z",
            months: 12,
          },
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-06-20T05:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["measurement_end_after_generated_at"]),
    });

    expect(
      validateMatchHeuristicValidationReport({
        ...report,
        measurementWindow: {
          ...report.measurementWindow,
          start: "2026-01-20T04:00:00.000Z",
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "measurement_window_months_mismatch",
      ]),
    });

    expect(
      validateMatchHeuristicValidationReport({
        ...report,
        measurementWindow: {
          ...report.measurementWindow,
          months: 6,
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "measurement_window_options_mismatch",
        "measurement_window_months_mismatch",
      ]),
    });

    expect(
      validateMatchHeuristicValidationReport({
        ...report,
        leakedSessionId: "11111111-1111-4111-8111-111111111111",
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["report_contains_uuid"]),
    });

    expect(
      validateMatchHeuristicValidationReport({
        ...report,
        cohortDiagnostic: buildCohortDiagnosticSummary(
          [
            baseSession({ id: "cohort-a", userId: "cohort-a", rating: 5 }),
            baseSession({ id: "cohort-b", userId: "cohort-b", rating: 4 }),
            baseSession({ id: "cohort-c", userId: "cohort-c", rating: 2 }),
          ],
          1
        ),
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["cohort_sanity_observed_mismatch"]),
    });
  });

  it("validates a saved report JSON file from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "match-validation-file-"));
    const outputPath = join(dir, "report.json");

    try {
      const sessions = [
        baseSession({ id: "a", rating: 5 }),
        baseSession({ id: "b", rating: 5 }),
        baseSession({ id: "c", rating: 4 }),
        baseSession({ id: "d", rating: 4 }),
        baseSession({ id: "e", rating: 3 }),
        baseSession({ id: "f", rating: 2 }),
      ];
      const report = buildMatchHeuristicValidationReport(
        validateMatchHeuristic(sessions, 3, "leave-one-out"),
        {
          months: 12,
          minHistory: 3,
          historyMode: "leave-one-out",
          minScoredSessions: 100,
          minUsers: 25,
          minPearson: 0.2,
          failOnNotReady: false,
          outputJsonPath: outputPath,
          validateOutputJsonPath: null,
          maxReportAgeHours: null,
        },
        buildRpcFloorDiagnosticSummary(sessions),
        "2026-06-20T04:00:00.000Z",
        buildRatingInventoryForJsonTest(),
        null
      );

      const resolvedPath = writeMatchHeuristicValidationReportJson(
        outputPath,
        report
      );

      expect(
        validateMatchHeuristicValidationReportFile(resolvedPath, {
          maxReportAgeHours: 24,
          now: new Date("2026-06-20T05:00:00.000Z"),
        })
      ).toEqual({
        ok: true,
        blockers: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps reported current weights aligned with the latest match-score RPC", () => {
    const sql = readFileSync(latestMatchScoreMigrationPath, "utf8");
    const baseDistanceBlock = sql.match(
      /v_base_distance := LEAST\(([\s\S]*?)1\.0\s*\);/
    )?.[1];

    expect(baseDistanceBlock).toBeDefined();
    expect(extractSqlWeights(baseDistanceBlock ?? "")).toEqual(
      DEFAULT_MATCH_WEIGHTS
    );
  });
});

function buildRatingInventoryForJsonTest(): RatingInventory {
  return {
    rawRatedSessionCount: 60,
    rawRatedUserCount: 20,
    realProfileRatedSessionCount: 43,
    realProfileUserCount: 15,
    excludedProfileSessionCount: 17,
    missingForecastSnapshotSessionCount: 17,
    loadedRatedSessionCount: 6,
    loadedUserCount: 1,
  };
}

function extractSqlWeights(sqlBlock: string): MatchWeights {
  const componentMap = {
    wave: "wave",
    period: "period",
    wind: "wind",
    tide: "tide",
    wind_dir: "windDir",
  } as const;
  const weights: Partial<MatchWeights> = {};

  for (const match of sqlBlock.matchAll(
    /(\d+\.\d+)\s*\*\s*v_(wave|period|wind|tide|wind_dir)_distance/g
  )) {
    const component = componentMap[match[2] as keyof typeof componentMap];
    weights[component] = Number(match[1]);
  }

  return weights as MatchWeights;
}
