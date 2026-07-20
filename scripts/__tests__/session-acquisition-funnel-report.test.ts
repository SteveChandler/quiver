import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeSessionAcquisitionReport,
  computeTimeToNthRatedSession,
  parseCliArgs,
  renderSessionAcquisitionReport,
  SESSION_ACQUISITION_EVENT_TYPES,
  SESSION_FORM_VALIDATION_ERROR_CODES,
  sessionAcquisitionReadinessCriteriaFromOptions,
  validateSessionAcquisitionReport,
  validateSessionAcquisitionReportFile,
  writeSessionAcquisitionReportJson,
  type SessionAcquisitionEventRow,
  type SessionAcquisitionProfileRow,
  type SessionAcquisitionSessionRow,
} from "../session-acquisition-funnel-report";
import { VALID_EVENTS } from "../../lib/analytics/event-taxonomy";

const START = "2026-06-01T00:00:00.000Z";
const END = "2026-07-01T00:00:00.000Z";

function eventRow(
  userId: string | null,
  eventType: string,
  overrides: Partial<SessionAcquisitionEventRow> = {}
): SessionAcquisitionEventRow {
  return {
    user_id: userId,
    session_id: userId ? null : "anon-session-1",
    event_type: eventType,
    created_at: "2026-06-15T12:00:00.000Z",
    metadata: { _platform: "native-ios" },
    bot_flagged: false,
    ...overrides,
  };
}

function sessionRow(
  userId: string,
  createdAt: string,
  overrides: Partial<SessionAcquisitionSessionRow> = {}
): SessionAcquisitionSessionRow {
  return {
    id: "session-" + userId + "-" + createdAt,
    user_id: userId,
    created_at: createdAt,
    arrival_time: createdAt,
    status: "completed",
    source: "native",
    rating: 4,
    wave_height_ft: 3,
    deleted_at: null,
    ...overrides,
  };
}

function profileRow(
  id: string,
  overrides: Partial<SessionAcquisitionProfileRow> = {}
): SessionAcquisitionProfileRow {
  return {
    id,
    created_at: "2026-06-10T00:00:00.000Z",
    deleted_at: null,
    onboarding_completed_at: "2026-06-10T00:05:00.000Z",
    experience_level: "intermediate",
    activity_level: "weekly",
    home_beach_id: "beach-1",
    surf_styles: ["shortboard"],
    preferred_session_time: "morning",
    timezone: "America/Los_Angeles",
    is_mock: false,
    analytics_is_real_user: true,
    is_system_account: false,
    analytics_exclusion_reason: null,
    ...overrides,
  };
}

function nativeBuildMetadata(): Record<string, string> {
  return {
    _platform: "native-ios",
    app_version: "1.0.1",
    app_build: "42",
  };
}

function resolveNativeRepoPath(...segments: string[]): string {
  const candidates = [
    join(process.cwd(), "..", "quiver-native"),
    join(process.cwd(), "..", "..", "..", "quiver-native"),
    join(__dirname, "..", "..", "..", "quiver-native"),
    join(__dirname, "..", "..", "..", "..", "..", "quiver-native"),
  ];
  const nativeRoot = candidates.find((candidate) =>
    existsSync(join(candidate, "package.json"))
  );

  if (!nativeRoot) {
    throw new Error(
      `Unable to find quiver-native repo. Checked: ${candidates.join(", ")}`
    );
  }

  return join(nativeRoot, ...segments);
}

describe("session acquisition funnel report", () => {
  it("parses a default 30-day window from the provided clock", () => {
    const options = parseCliArgs([], new Date("2026-06-19T12:00:00.000Z"));

    expect(options).toEqual({
      start: "2026-05-20T12:00:00.000Z",
      end: "2026-06-19T12:00:00.000Z",
      minRatedSessions: 100,
      minRatedSessionUsers: 25,
      minFiveRatedSessionUsers: 25,
      minFaceHeightTruthSessions: 75,
      minBeachSelectedCoverage: 0.8,
      minConditionsSetCoverage: 0.8,
      minSubmitEventCoverage: 0.8,
      minRecentBuildMetadataCoverage: 0.8,
      expectedRecentClientBuilds: [],
      recentTelemetryDays: 7,
      failOnNotReady: false,
      outputJsonPath: null,
      validateOutputJsonPath: null,
      maxReportAgeHours: null,
    });
  });

  it("maps parsed CLI thresholds into the readiness criteria", () => {
    const options = parseCliArgs(
      [
        "--min-rated-sessions=80",
        "--min-rated-session-users=20",
        "--min-five-rated-session-users=10",
        "--min-face-height-truth-sessions=60",
        "--min-beach-selected-coverage=0.7",
        "--min-conditions-set-coverage=0.65",
        "--min-submit-event-coverage=0.75",
        "--min-recent-build-metadata-coverage=0.9",
        "--expect-recent-client-build=native-ios,1.0.1,42",
      ],
      new Date("2026-06-19T12:00:00.000Z")
    );

    expect(sessionAcquisitionReadinessCriteriaFromOptions(options)).toEqual({
      minRatedSessions: 80,
      minRatedSessionUsers: 20,
      minFiveRatedSessionUsers: 10,
      minFaceHeightTruthSessions: 60,
      minBeachSelectedCoverage: 0.7,
      minConditionsSetCoverage: 0.65,
      minSubmitEventCoverage: 0.75,
      minRecentBuildMetadataCoverage: 0.9,
      expectedRecentClientBuilds: ["native-ios / 1.0.1 / 42"],
    });
  });

  it("legacy telemetry corrections: keeps Track B event coverage aligned with web and native analytics allowlists", () => {
    const nativeAnalytics = readFileSync(
      resolveNativeRepoPath(
        "src",
        "lib",
        "analytics.ts"
      ),
      "utf8"
    );
    const nativeEventTypes = extractQuotedValuesBetween(
      nativeAnalytics,
      "export const NATIVE_ANALYTICS_EVENT_TYPES = [",
      "] as const;"
    );

    expect(VALID_EVENTS).toEqual(
      expect.arrayContaining([...SESSION_ACQUISITION_EVENT_TYPES])
    );
    expect(nativeEventTypes).toEqual(
      expect.arrayContaining([...SESSION_ACQUISITION_EVENT_TYPES])
    );
  });

  it("legacy telemetry corrections: fetches form views and keeps first-session markers out of submit", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start"),
        eventRow("user-1", "session_log_form_view"),
        eventRow("user-1", "first_session_logged", {
          metadata: {
            ...nativeBuildMetadata(),
            session_id: "session-user-1",
          },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(SESSION_ACQUISITION_EVENT_TYPES).toContain("session_log_form_view");
    expect(stepActors(report, "stored_submit_event")).toBe(0);
    expect(report.telemetryCoverageByPlatform[0]).toMatchObject({
      platform: "native-ios",
      startActors: 1,
      formViewActors: 1,
      formViewActorsWithStart: 1,
      formViewOfStart: 1,
      submitEventActors: 0,
      submitActorsWithStart: 0,
      submitEventOfStart: 0,
    });
  });

  it("legacy telemetry corrections: excludes marker-only platforms and client builds from coverage", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      recentTelemetryDays: 30,
      profiles: [profileRow("marker-only-user")],
      events: [
        eventRow("marker-only-user", "first_session_logged", {
          created_at: "2026-06-30T12:00:00.000Z",
          metadata: {
            _platform: "legacy-marker-only",
            app_version: "9.9.9",
            app_build: "999",
          },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.eventsByType).toEqual({ first_session_logged: 1 });
    expect(report.telemetryCoverageByPlatform).toEqual([]);
    expect(report.recentTelemetry.telemetryCoverageByPlatform).toEqual([]);
    expect(report.recentTelemetry.telemetryCoverageByClientBuild).toEqual([]);
  });

  it("keeps validation-failure codes aligned with the native session form", () => {
    const nativeSessionFormUtils = readFileSync(
      resolveNativeRepoPath(
        "src",
        "lib",
        "session-form-utils.ts"
      ),
      "utf8"
    );
    const nativeErrorCodes = extractQuotedValuesBetween(
      nativeSessionFormUtils,
      "export type SessionFormErrorCode =",
      ";"
    );

    expect(new Set(SESSION_FORM_VALIDATION_ERROR_CODES)).toEqual(
      new Set(nativeErrorCodes)
    );
  });

  it("parses an output JSON path", () => {
    const options = parseCliArgs(
      ["--days=7", "--output-json=/tmp/session-funnel.json"],
      new Date("2026-06-19T12:00:00.000Z")
    );

    expect(options.start).toBe("2026-06-12T12:00:00.000Z");
    expect(options.outputJsonPath).toBe("/tmp/session-funnel.json");
  });

  it("parses explicit equals-form measurement windows", () => {
    const options = parseCliArgs(
      [
        "--start=2026-06-01T00:00:00Z",
        "--end=2026-06-19T00:00:00Z",
        "--days=18",
      ],
      new Date("2026-06-19T12:00:00.000Z")
    );

    expect(options).toMatchObject({
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
    });
  });

  it("rejects invalid or reversed measurement windows", () => {
    expect(() =>
      parseCliArgs(
        ["--start=not-a-date"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--start must be a valid date.");

    expect(() =>
      parseCliArgs(
        ["--start=2026-06-20T00:00:00Z", "--end=2026-06-19T00:00:00Z"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("Measurement start must be before end.");
  });

  it("rejects non-integer measurement day windows", () => {
    expect(() =>
      parseCliArgs(["--days=0.5"], new Date("2026-06-19T12:00:00.000Z"))
    ).toThrow("--days must be a positive integer");

    expect(() =>
      parseCliArgs(["--days", "0"], new Date("2026-06-19T12:00:00.000Z"))
    ).toThrow("--days must be a positive integer");
  });

  it("rejects measurement flags without values", () => {
    expect(() =>
      parseCliArgs(["--start"], new Date("2026-06-19T12:00:00.000Z"))
    ).toThrow("--start requires a value.");

    expect(() =>
      parseCliArgs(["--end"], new Date("2026-06-19T12:00:00.000Z"))
    ).toThrow("--end requires a value.");

    expect(() =>
      parseCliArgs(["--days"], new Date("2026-06-19T12:00:00.000Z"))
    ).toThrow("--days requires a value.");

    expect(() =>
      parseCliArgs(["--output-json"], new Date("2026-06-19T12:00:00.000Z"))
    ).toThrow("--output-json requires a value.");

    expect(() =>
      parseCliArgs(["--output-json="], new Date("2026-06-19T12:00:00.000Z"))
    ).toThrow("--output-json requires a value.");

    expect(() =>
      parseCliArgs(
        ["--validate-output-json"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--validate-output-json requires a value.");

    expect(() =>
      parseCliArgs(
        ["--max-report-age-hours", "--fail-on-not-ready"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--max-report-age-hours requires a value.");
  });

  it("rejects readiness threshold flags without values", () => {
    expect(() =>
      parseCliArgs(
        ["--min-rated-sessions"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-rated-sessions requires a value.");

    expect(() =>
      parseCliArgs(
        ["--min-beach-selected-coverage="],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-beach-selected-coverage requires a value.");

    expect(() =>
      parseCliArgs(
        ["--min-submit-event-coverage="],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-submit-event-coverage requires a value.");

    expect(() =>
      parseCliArgs(
        ["--min-conditions-set-coverage="],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-conditions-set-coverage requires a value.");

    expect(() =>
      parseCliArgs(
        ["--min-recent-build-metadata-coverage="],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-recent-build-metadata-coverage requires a value.");

    expect(() =>
      parseCliArgs(
        ["--recent-telemetry-days"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--recent-telemetry-days requires a value.");

    expect(() =>
      parseCliArgs(
        ["--expect-recent-client-build"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--expect-recent-client-build requires a value.");
  });

  it("rejects unknown readiness arguments", () => {
    expect(() =>
      parseCliArgs(
        ["--fail-on-notready"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("Unknown argument: --fail-on-notready.");
    expect(() =>
      parseCliArgs(
        ["--min-rated-session", "10"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("Unknown argument: --min-rated-session.");
    expect(() =>
      parseCliArgs(
        ["/tmp/extra.json"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("Unknown argument: /tmp/extra.json.");

    expect(() =>
      parseCliArgs(
        [
          "--output-json=/tmp/session-funnel.json",
          "--validate-output-json=/tmp/session-funnel-review.json",
        ],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--validate-output-json cannot be combined with --output-json.");

    expect(() =>
      parseCliArgs(
        ["--max-report-age-hours=24"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--max-report-age-hours requires --validate-output-json.");
  });

  it("parses readiness gate options", () => {
    const options = parseCliArgs(
      [
        "--min-rated-sessions",
        "80",
        "--min-rated-session-users=20",
        "--min-five-rated-session-users",
        "10",
        "--min-face-height-truth-sessions=60",
        "--min-beach-selected-coverage",
        "0.7",
        "--min-conditions-set-coverage=0.65",
        "--min-submit-event-coverage=0.75",
        "--min-recent-build-metadata-coverage",
        "0.9",
        "--expect-recent-client-build",
        "native-ios,1.0.1,42",
        "--expect-recent-client-build=native-android / 1.0.1 / 43",
        "--recent-telemetry-days=3",
        "--fail-on-not-ready",
      ],
      new Date("2026-06-19T12:00:00.000Z")
    );

    expect(options).toMatchObject({
      minRatedSessions: 80,
      minRatedSessionUsers: 20,
      minFiveRatedSessionUsers: 10,
      minFaceHeightTruthSessions: 60,
      minBeachSelectedCoverage: 0.7,
      minConditionsSetCoverage: 0.65,
      minSubmitEventCoverage: 0.75,
      minRecentBuildMetadataCoverage: 0.9,
      expectedRecentClientBuilds: [
        "native-ios / 1.0.1 / 42",
        "native-android / 1.0.1 / 43",
      ],
      recentTelemetryDays: 3,
      failOnNotReady: true,
    });

    expect(
      parseCliArgs(
        [
          "--validate-output-json",
          "/tmp/session-funnel.json",
          "--max-report-age-hours=24",
        ],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toMatchObject({
      validateOutputJsonPath: "/tmp/session-funnel.json",
      maxReportAgeHours: 24,
    });
  });

  it("rejects malformed expected recent client build arguments", () => {
    expect(() =>
      parseCliArgs(
        ["--expect-recent-client-build=native-ios/1.0.1/42"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow(
      "--expect-recent-client-build must be platform,version,build"
    );
  });

  it("rejects fractional readiness count floors instead of rounding them down", () => {
    expect(() =>
      parseCliArgs(
        ["--min-rated-sessions=0.9"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-rated-sessions must be a non-negative integer");

    expect(() =>
      parseCliArgs(
        ["--min-rated-session-users=24.5"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-rated-session-users must be a non-negative integer");

    expect(() =>
      parseCliArgs(
        ["--min-five-rated-session-users", "1.5"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow(
      "--min-five-rated-session-users must be a non-negative integer"
    );

    expect(() =>
      parseCliArgs(
        ["--min-face-height-truth-sessions=74.5"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow(
      "--min-face-height-truth-sessions must be a non-negative integer"
    );

    expect(() =>
      parseCliArgs(
        ["--recent-telemetry-days=1.5"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--recent-telemetry-days must be a positive integer");

    expect(() =>
      parseCliArgs(
        [
          "--validate-output-json=/tmp/session-funnel.json",
          "--max-report-age-hours=0.5",
        ],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--max-report-age-hours must be a positive integer");
  });

  it("rejects readiness coverage floors outside the 0-1 range", () => {
    expect(() =>
      parseCliArgs(
        ["--min-beach-selected-coverage=1.1"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-beach-selected-coverage must be between 0 and 1");

    expect(() =>
      parseCliArgs(
        ["--min-submit-event-coverage=-0.1"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-submit-event-coverage must be between 0 and 1");

    expect(() =>
      parseCliArgs(
        ["--min-conditions-set-coverage=1.1"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow("--min-conditions-set-coverage must be between 0 and 1");

    expect(() =>
      parseCliArgs(
        ["--min-recent-build-metadata-coverage=1.1"],
        new Date("2026-06-19T12:00:00.000Z")
      )
    ).toThrow(
      "--min-recent-build-metadata-coverage must be between 0 and 1"
    );
  });

  it("uses saved sessions as durable conversion truth and actual submit telemetry", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [profileRow("user-1"), profileRow("mock-user", { is_mock: true })],
      events: [
        eventRow("user-1", "session_log_start"),
        eventRow("user-1", "session_log_beach_selected"),
        eventRow("user-1", "session_log_rating_set"),
        eventRow("user-1", "session_log_submit"),
        eventRow("mock-user", "session_log_start"),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:00:00.000Z"),
        sessionRow("mock-user", "2026-06-15T12:00:00.000Z"),
      ],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(report.savedSessionUsers).toBe(1);
    expect(report.ratedSessionUsers).toBe(1);
    expect(report.faceHeightTruthUsers).toBe(1);
    expect(report.ratedFaceHeightTruthUsers).toBe(1);
    expect(report.excludedEventRows).toBe(1);
    expect(report.excludedSessionRows).toBe(1);
    expect(stepActors(report, "stored_submit_event")).toBe(1);
    expect(stepActors(report, "rated_face_height_truth_session")).toBe(1);
    expect(report.activation.lifetimeScopedUsersWithFiveRatedSessions).toBe(1);
    expect(report.activation.medianDaysToFifthRating).toBe(15);
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForPersonalizationEvaluation: false,
      observed: {
        ratedSessions: 1,
        ratedSessionUsers: 1,
        lifetimeScopedUsersWithFiveRatedSessions: 1,
        faceHeightTruthSessions: 1,
        ratedFaceHeightTruthSessions: 1,
        beachSelectedCoverage: 1,
        submitEventCoverage: 1,
      },
    });
    expect(report.readiness.findings).toEqual(
      expect.arrayContaining([
        "Rated sessions are below the 100-session floor.",
        "Rated-session users are below the 25-user floor.",
        "Users with 5+ rated sessions are below the 25-user floor.",
        "Rated face-height truth sessions are below the 75-session floor.",
      ])
    );
    expect(report.readiness.findingCodes).toEqual(
      expect.arrayContaining([
        "rated_sessions_floor",
        "rated_session_users_floor",
        "five_rated_session_users_floor",
        "rated_face_height_truth_sessions_floor",
      ])
    );
    expect(report.gaps.join("\n")).not.toContain("Stored submit events cover");
  });

  it("marks session acquisition ready when configured floors are met", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 1,
        minConditionsSetCoverage: 1,
        minSubmitEventCoverage: 1,
        minRecentBuildMetadataCoverage: 1,
        expectedRecentClientBuilds: ["native-ios / 1.0.1 / 42"],
      },
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_beach_selected", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_conditions_set", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_rating_set", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_submit", {
          metadata: nativeBuildMetadata(),
        }),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "ready",
      readyForPersonalizationEvaluation: true,
      findings: [],
      findingCodes: [],
    });
    expect(report.readiness.observed.expectedRecentClientBuildStartActors).toEqual({
      "native-ios / 1.0.1 / 42": 1,
    });
  });

  it("blocks readiness until the expected instrumented build has recent starts", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 1,
        minConditionsSetCoverage: 1,
        minSubmitEventCoverage: 1,
        minRecentBuildMetadataCoverage: 1,
        expectedRecentClientBuilds: ["native-ios / 1.0.2 / 99"],
      },
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_beach_selected", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_conditions_set", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_submit", {
          metadata: nativeBuildMetadata(),
        }),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForPersonalizationEvaluation: false,
      observed: {
        expectedRecentClientBuildStartActors: {
          "native-ios / 1.0.2 / 99": 0,
        },
      },
      findings: [
        "Expected recent client build native-ios / 1.0.2 / 99 has no session-log start actors.",
      ],
      findingCodes: ["expected_recent_client_build_missing"],
    });

    const markdown = renderSessionAcquisitionReport(report);
    expect(markdown).toContain(
      "- Expected recent client builds: native-ios / 1.0.2 / 99"
    );
    expect(markdown).toContain(
      "| native-ios / 1.0.2 / 99 | 0 |"
    );
  });

  it("does not count unrated wave-height labels as personalization-ready truth", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 1,
        minConditionsSetCoverage: 0,
        minSubmitEventCoverage: 1,
        minRecentBuildMetadataCoverage: 0,
      },
      profiles: [profileRow("rated-user"), profileRow("height-only-user")],
      events: [
        eventRow("rated-user", "session_log_start"),
        eventRow("rated-user", "session_log_beach_selected"),
        eventRow("rated-user", "session_log_rating_set"),
        eventRow("rated-user", "session_log_submit"),
        eventRow("height-only-user", "session_log_start"),
        eventRow("height-only-user", "session_log_beach_selected"),
        eventRow("height-only-user", "session_log_submit"),
      ],
      windowSessions: [
        sessionRow("rated-user", "2026-06-15T12:00:00.000Z", {
          wave_height_ft: null,
        }),
        sessionRow("height-only-user", "2026-06-15T12:00:00.000Z", {
          rating: null,
          wave_height_ft: 3,
        }),
      ],
      lifetimeSessions: [
        sessionRow("rated-user", "2026-06-01T12:00:00.000Z"),
        sessionRow("rated-user", "2026-06-03T12:00:00.000Z"),
        sessionRow("rated-user", "2026-06-05T12:00:00.000Z"),
        sessionRow("rated-user", "2026-06-09T12:00:00.000Z"),
        sessionRow("rated-user", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(report.faceHeightTruthSessions).toBe(1);
    expect(report.ratedFaceHeightTruthSessions).toBe(0);
    expect(stepActors(report, "rated_face_height_truth_session")).toBe(0);
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForPersonalizationEvaluation: false,
      observed: {
        faceHeightTruthSessions: 1,
        ratedFaceHeightTruthSessions: 0,
      },
      findings: ["Rated face-height truth sessions are below the 1-session floor."],
      findingCodes: ["rated_face_height_truth_sessions_floor"],
    });
    expect(report.gaps.join("\n")).toContain(
      "Some face-height labels are on unrated sessions"
    );
  });

  it("blocks readiness when durable saved sessions lack matching submit telemetry", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 1,
        minConditionsSetCoverage: 0,
        minSubmitEventCoverage: 1,
        minRecentBuildMetadataCoverage: 0,
      },
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start"),
        eventRow("user-1", "session_log_beach_selected"),
        eventRow("user-1", "session_log_rating_set"),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForPersonalizationEvaluation: false,
      observed: {
        submitEventCoverage: 0,
      },
      findings: ["Submit-event coverage is below 100.0%."],
      findingCodes: ["submit_event_coverage_floor"],
    });
  });

  it("blocks readiness when started forms lack completed conditions telemetry", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 1,
        minConditionsSetCoverage: 1,
        minSubmitEventCoverage: 1,
        minRecentBuildMetadataCoverage: 0,
      },
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start"),
        eventRow("user-1", "session_log_beach_selected"),
        eventRow("user-1", "session_log_rating_set"),
        eventRow("user-1", "session_log_submit"),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(stepActors(report, "conditions_set_event")).toBe(0);
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForPersonalizationEvaluation: false,
      observed: {
        conditionsSetCoverage: 0,
      },
      findings: ["Conditions-set event coverage is below 100.0%."],
      findingCodes: ["conditions_set_coverage_floor"],
    });
    expect(report.gaps.join("\n")).toContain(
      "Conditions-set events cover 0.0% of start actors"
    );
  });

  it("blocks readiness when recent starts lack app version/build metadata", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 1,
        minConditionsSetCoverage: 0,
        minSubmitEventCoverage: 1,
        minRecentBuildMetadataCoverage: 1,
      },
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start"),
        eventRow("user-1", "session_log_beach_selected"),
        eventRow("user-1", "session_log_submit"),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForPersonalizationEvaluation: false,
      observed: {
        recentBuildMetadataCoverage: 0,
      },
      findings: [
        "Recent app version/build metadata coverage is below 100.0%.",
      ],
      findingCodes: ["recent_build_metadata_coverage_floor"],
    });
  });

  it("blocks readiness when only stale telemetry satisfies event coverage", () => {
    const oldUsers = ["old-1", "old-2", "old-3", "old-4"];
    const completeOldEvents = oldUsers.flatMap((userId) => [
      eventRow(userId, "session_log_start", {
        created_at: "2026-06-10T12:00:00.000Z",
      }),
      eventRow(userId, "session_log_beach_selected", {
        created_at: "2026-06-10T12:01:00.000Z",
      }),
      eventRow(userId, "session_log_conditions_set", {
        created_at: "2026-06-10T12:02:00.000Z",
      }),
      eventRow(userId, "session_log_submit", {
        created_at: "2026-06-10T12:03:00.000Z",
      }),
    ]);
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 7,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 0.8,
        minConditionsSetCoverage: 0.8,
        minSubmitEventCoverage: 0.8,
        minRecentBuildMetadataCoverage: 1,
      },
      profiles: [...oldUsers.map((userId) => profileRow(userId)), profileRow("recent-1")],
      events: [
        ...completeOldEvents,
        eventRow("recent-1", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: nativeBuildMetadata(),
        }),
      ],
      windowSessions: [sessionRow("old-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("old-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("old-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("old-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("old-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("old-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(report.readiness.observed).toMatchObject({
      beachSelectedCoverage: 0.8,
      conditionsSetCoverage: 0.8,
      submitEventCoverage: 1,
      recentBeachSelectedCoverage: 0,
      recentConditionsSetCoverage: 0,
      recentSubmitEventCoverage: 0,
      recentBuildMetadataCoverage: 1,
    });
    expect(report.readiness).toMatchObject({
      verdict: "not-ready",
      readyForPersonalizationEvaluation: false,
      findings: [
        "Recent 7-day beach-selected event coverage is below 80.0%.",
        "Recent 7-day conditions-set event coverage is below 80.0%.",
        "Recent 7-day submit-event coverage is below 80.0%.",
      ],
      findingCodes: [
        "recent_beach_selected_coverage_floor",
        "recent_conditions_set_coverage_floor",
        "recent_submit_event_coverage_floor",
      ],
    });
  });

  it("uses actor intersection instead of raw counts for telemetry coverage", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 0.75,
        minConditionsSetCoverage: 0,
        minSubmitEventCoverage: 0.75,
        minRecentBuildMetadataCoverage: 0,
      },
      profiles: [profileRow("user-1"), profileRow("user-2")],
      events: [
        eventRow("user-1", "session_log_start"),
        eventRow("user-2", "session_log_start"),
        eventRow("user-2", "session_log_beach_selected"),
        eventRow("user-2", "session_log_submit"),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(stepActors(report, "stored_submit_event")).toBe(1);
    expect(stepActors(report, "saved_completed_session")).toBe(1);
    expect(report.readiness.observed).toMatchObject({
      beachSelectedCoverage: 0.5,
      submitEventCoverage: 0,
    });
    expect(report.readiness.findings).toEqual([
      "Beach-selected event coverage is below 75.0%.",
      "Submit-event coverage is below 75.0%.",
    ]);
    expect(report.readiness.findingCodes).toEqual([
      "beach_selected_coverage_floor",
      "submit_event_coverage_floor",
    ]);
    expect(report.gaps.join("\n")).toContain("Stored submit events cover 0.0%");
  });

  it("legacy telemetry corrections: reports telemetry coverage by platform without mixing client surfaces", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      profiles: [
        profileRow("native-1"),
        profileRow("native-2"),
        profileRow("web-1"),
      ],
      events: [
        eventRow("native-1", "session_log_start", {
          metadata: { _platform: "native-ios" },
        }),
        eventRow("native-1", "session_log_beach_selected", {
          metadata: { _platform: "native-ios" },
        }),
        eventRow("native-1", "session_log_submit", {
          metadata: { _platform: "native-ios" },
        }),
        eventRow("native-2", "session_log_start", {
          metadata: { _platform: "native-ios" },
        }),
        eventRow("native-2", "session_log_submit", {
          metadata: { _platform: "native-ios" },
        }),
        eventRow("web-1", "session_log_start", {
          metadata: { _device: { device_type: "mobile", os: "iOS" } },
        }),
        eventRow("web-1", "session_log_beach_selected", {
          metadata: { _device: { device_type: "mobile", os: "iOS" } },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.telemetryCoverageByPlatform).toEqual([
      {
        platform: "native-ios",
        startActors: 2,
        formViewActors: expect.any(Number),
        formViewActorsWithStart: expect.any(Number),
        formViewOfStart: expect.anything(),
        beachSelectedActors: 1,
        beachSelectedActorsWithStart: 1,
        beachSelectedOfStart: 0.5,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 2,
        submitActorsWithStart: 2,
        submitEventOfStart: 1,
      },
      {
        platform: "mobile/iOS",
        startActors: 1,
        formViewActors: expect.any(Number),
        formViewActorsWithStart: expect.any(Number),
        formViewOfStart: expect.anything(),
        beachSelectedActors: 1,
        beachSelectedActorsWithStart: 1,
        beachSelectedOfStart: 1,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 0,
        submitActorsWithStart: 0,
        submitEventOfStart: 0,
      },
    ]);

    const markdown = renderSessionAcquisitionReport(report);
    expect(markdown).toContain("## Telemetry Coverage By Platform");
    expect(markdown).toContain(
      "| native-ios | 2 | 0 | 0.0% | 1 | 50.0% | 0 | 0.0% | 2 | 100.0% |"
    );
    expect(markdown).toContain(
      "| mobile/iOS | 1 | 0 | 0.0% | 1 | 100.0% | 0 | 0.0% | 0 | 0.0% |"
    );
  });

  it("legacy telemetry corrections: reports a recent telemetry window separately from the full window", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 7,
      profiles: [
        profileRow("old-user"),
        profileRow("native-recent"),
        profileRow("web-recent"),
      ],
      events: [
        eventRow("old-user", "session_log_start", {
          created_at: "2026-06-10T12:00:00.000Z",
          metadata: { _platform: "native-ios" },
        }),
        eventRow("old-user", "session_log_beach_selected", {
          created_at: "2026-06-10T12:01:00.000Z",
          metadata: { _platform: "native-ios" },
        }),
        eventRow("native-recent", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: { _platform: "native-ios" },
        }),
        eventRow("web-recent", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: { _device: { device_type: "mobile", os: "iOS" } },
        }),
        eventRow("web-recent", "session_log_beach_selected", {
          created_at: "2026-06-28T12:01:00.000Z",
          metadata: { _device: { device_type: "mobile", os: "iOS" } },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.telemetryCoverage.beachSelectedOfStart).toBe(2 / 3);
    expect(report.recentTelemetry).toMatchObject({
      start: "2026-06-24T00:00:00.000Z",
      end: END,
      days: 7,
      eventRows: 3,
      startActors: 2,
      startActorsWithoutBuildMetadata: 2,
      formViewActors: 0,
      formViewActorsWithStart: 0,
      formViewOfStart: 0,
      beachSelectedActors: 1,
      beachSelectedActorsWithStart: 1,
      beachSelectedOfStart: 0.5,
      conditionsSetActors: 0,
      conditionsSetActorsWithStart: 0,
      conditionsSetOfStart: 0,
      submitEventActors: 0,
      submitActorsWithStart: 0,
      submitEventOfStart: 0,
    });
    expect(report.readiness.observed.recentBuildMetadataCoverage).toBe(0);
    expect(report.recentTelemetry.telemetryCoverageByPlatform).toEqual([
      {
        platform: "mobile/iOS",
        startActors: 1,
        formViewActors: expect.any(Number),
        formViewActorsWithStart: expect.any(Number),
        formViewOfStart: expect.anything(),
        beachSelectedActors: 1,
        beachSelectedActorsWithStart: 1,
        beachSelectedOfStart: 1,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 0,
        submitActorsWithStart: 0,
        submitEventOfStart: 0,
      },
      {
        platform: "native-ios",
        startActors: 1,
        formViewActors: expect.any(Number),
        formViewActorsWithStart: expect.any(Number),
        formViewOfStart: expect.anything(),
        beachSelectedActors: 0,
        beachSelectedActorsWithStart: 0,
        beachSelectedOfStart: 0,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 0,
        submitActorsWithStart: 0,
        submitEventOfStart: 0,
      },
    ]);
    expect(report.recentTelemetry.telemetryCoverageByClientBuild).toEqual([
      {
        clientBuild: "mobile/iOS / unknown-version / unknown-build",
        hasVersionMetadata: false,
        hasBuildMetadata: false,
        startActors: 1,
        formViewActors: expect.any(Number),
        formViewActorsWithStart: expect.any(Number),
        formViewOfStart: expect.anything(),
        beachSelectedActors: 1,
        beachSelectedActorsWithStart: 1,
        beachSelectedOfStart: 1,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 0,
        submitActorsWithStart: 0,
        submitEventOfStart: 0,
      },
      {
        clientBuild: "native-ios / unknown-version / unknown-build",
        hasVersionMetadata: false,
        hasBuildMetadata: false,
        startActors: 1,
        formViewActors: expect.any(Number),
        formViewActorsWithStart: expect.any(Number),
        formViewOfStart: expect.anything(),
        beachSelectedActors: 0,
        beachSelectedActorsWithStart: 0,
        beachSelectedOfStart: 0,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 0,
        submitActorsWithStart: 0,
        submitEventOfStart: 0,
      },
    ]);
    expect(report.gaps.join("\n")).toContain(
      "Recent 7-day telemetry still has beach-selected coverage at 50.0%"
    );
    expect(report.gaps.join("\n")).toContain(
      "Recent 7-day telemetry has 2 start actors without app version/build metadata"
    );

    const markdown = renderSessionAcquisitionReport(report);
    expect(markdown).toContain("## Recent Telemetry Window");
    expect(markdown).toContain("| Event rows | 3 |");
    expect(markdown).toContain(
      "| Start actors without version/build metadata | 2 |"
    );
    expect(markdown).toContain(
      "| native-ios | 1 | 0.0% | 0.0% | 0.0% | 0.0% |"
    );
    expect(markdown).toContain(
      "| native-ios / unknown-version / unknown-build | 1 | 0.0% | 0.0% | 0.0% | 0.0% |"
    );
  });

  it("legacy telemetry corrections: reports recent telemetry by client build metadata", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      recentTelemetryDays: 7,
      profiles: [profileRow("new-client"), profileRow("old-client")],
      events: [
        eventRow("new-client", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: "1.0.1",
            app_build: "42",
          },
        }),
        eventRow("new-client", "session_log_beach_selected", {
          created_at: "2026-06-28T12:01:00.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: "1.0.1",
            app_build: "42",
          },
        }),
        eventRow("new-client", "session_log_form_view", {
          created_at: "2026-06-28T12:01:30.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: "1.0.1",
            app_build: "42",
          },
        }),
        eventRow("new-client", "session_log_submit", {
          created_at: "2026-06-28T12:02:00.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: "1.0.1",
            app_build: "42",
          },
        }),
        eventRow("old-client", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: { _platform: "native-ios" },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.recentTelemetry.telemetryCoverageByClientBuild).toEqual([
      {
        clientBuild: "native-ios / 1.0.1 / 42",
        hasVersionMetadata: true,
        hasBuildMetadata: true,
        startActors: 1,
        formViewActors: 1,
        formViewActorsWithStart: 1,
        formViewOfStart: 1,
        beachSelectedActors: 1,
        beachSelectedActorsWithStart: 1,
        beachSelectedOfStart: 1,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 1,
        submitActorsWithStart: 1,
        submitEventOfStart: 1,
      },
      {
        clientBuild: "native-ios / unknown-version / unknown-build",
        hasVersionMetadata: false,
        hasBuildMetadata: false,
        startActors: 1,
        formViewActors: 0,
        formViewActorsWithStart: 0,
        formViewOfStart: 0,
        beachSelectedActors: 0,
        beachSelectedActorsWithStart: 0,
        beachSelectedOfStart: 0,
        conditionsSetActors: 0,
        conditionsSetActorsWithStart: 0,
        conditionsSetOfStart: 0,
        submitEventActors: 0,
        submitActorsWithStart: 0,
        submitEventOfStart: 0,
      },
    ]);
    expect(report.recentTelemetry.startActorsWithoutBuildMetadata).toBe(1);
    expect(report.gaps.join("\n")).toContain(
      "Recent 7-day telemetry has 1 start actor without app version/build metadata"
    );

    const markdown = renderSessionAcquisitionReport(report);
    expect(markdown).toContain(
      "| native-ios / 1.0.1 / 42 | 1 | 100.0% | 100.0% | 0.0% | 100.0% |"
    );
    expect(markdown).toContain(
      "| native-ios / unknown-version / unknown-build | 1 | 0.0% | 0.0% | 0.0% | 0.0% |"
    );
  });

  it("flags missing beach-selected coverage separately from saved-session conversion", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1"), profileRow("user-2")],
      events: [
        eventRow("user-1", "session_log_start"),
        eventRow("user-1", "session_log_beach_selected"),
        eventRow("user-1", "session_log_submit"),
        eventRow("user-2", "session_log_start"),
        eventRow("user-2", "session_log_validation_failed"),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
    });

    expect(stepActors(report, "form_started")).toBe(2);
    expect(stepActors(report, "beach_selected_event")).toBe(1);
    expect(report.validationFailedActors).toBe(1);
    expect(report.gaps.join("\n")).toContain("Beach-selected events cover 50.0%");
    expect(report.gaps.join("\n")).toContain(
      "inspect Telemetry Coverage By Platform"
    );
    expect(report.gaps.join("\n")).toContain(
      "Platform gaps: native-ios 50.0% (2 starts)."
    );
    expect(report.gaps.join("\n")).toContain("actors hit validation failures");
  });

  it("aggregates validation-failure codes without rendering raw actor data", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [
        profileRow("user-1"),
        profileRow("user-2"),
        profileRow("user-3"),
      ],
      events: [
        eventRow("user-1", "session_log_start", {
          metadata: { _platform: "native-ios" },
        }),
        eventRow("user-1", "session_log_validation_failed", {
          metadata: {
            _platform: "native-ios",
            validation_errors: ["beach_required", "rating_required"],
          },
        }),
        eventRow("user-2", "session_log_start", {
          metadata: { _platform: "native-ios" },
        }),
        eventRow("user-2", "session_log_validation_failed", {
          metadata: {
            _platform: "native-ios",
            validation_errors: ["beach_required"],
          },
        }),
        eventRow("user-3", "session_log_start", {
          metadata: { _platform: "native-android" },
        }),
        eventRow("user-3", "session_log_validation_failed", {
          metadata: {
            _platform: "native-android",
            validation_error: "raw error message with spaces",
          },
        }),
        eventRow("user-3", "session_log_validation_failed", {
          metadata: {
            _platform: "native-android",
            validation_errors: ["new_client_code"],
          },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.validationFailuresByCode).toEqual([
      {
        code: "beach_required",
        events: 2,
        actors: 2,
        platforms: { "native-ios": 2 },
      },
      {
        code: "rating_required",
        events: 1,
        actors: 1,
        platforms: { "native-ios": 1 },
      },
      {
        code: "unknown_code:new_client_code",
        events: 1,
        actors: 1,
        platforms: { "native-android": 1 },
      },
      {
        code: "unrecognized",
        events: 1,
        actors: 1,
        platforms: { "native-android": 1 },
      },
    ]);

    const markdown = renderSessionAcquisitionReport(report);
    expect(markdown).toContain("## Validation Failure Codes");
    expect(markdown).toContain(
      "| beach_required | 2 | 2 | native-ios (2) |"
    );
    expect(markdown).toContain(
      "| unrecognized | 1 | 1 | native-android (1) |"
    );
    expect(markdown).toContain(
      "| unknown_code:new_client_code | 1 | 1 | native-android (1) |"
    );
    expect(markdown).toContain(
      "Top validation failures: beach_required (2 actors), rating_required (1 actor), unknown_code:new_client_code (1 actor)."
    );
    expect(markdown).not.toContain("user-1");
    expect(markdown).not.toContain("raw error message with spaces");
  });

  it("renders aggregate-only markdown without raw actor identifiers", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-06-19T00:00:00.000Z",
      profiles: [profileRow("user-secret")],
      events: [
        eventRow("user-secret", "session_log_start"),
        eventRow(null, "session_log_start", { session_id: "anon-secret" }),
      ],
      windowSessions: [sessionRow("user-secret", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [sessionRow("user-secret", "2026-06-15T12:00:00.000Z")],
    });

    const markdown = renderSessionAcquisitionReport(report);

    expect(markdown).toContain("# Track B Session Acquisition Instrumentation Report");
    expect(markdown).not.toContain("user-secret");
    expect(markdown).not.toContain("anon-secret");
  });

  it("writes aggregate-only JSON without raw actor identifiers", () => {
    const dir = mkdtempSync(join(tmpdir(), "session-funnel-report-"));
    const outputPath = join(dir, "nested", "report.json");

    try {
      const report = computeSessionAcquisitionReport({
        start: START,
        end: END,
        generatedAt: "2026-06-19T00:00:00.000Z",
        profiles: [profileRow("user-secret")],
        events: [
          eventRow("user-secret", "session_log_start"),
          eventRow(null, "session_log_start", { session_id: "anon-secret" }),
        ],
        windowSessions: [sessionRow("user-secret", "2026-06-15T12:00:00.000Z")],
        lifetimeSessions: [
          sessionRow("user-secret", "2026-06-15T12:00:00.000Z"),
        ],
      });

      const resolvedPath = writeSessionAcquisitionReportJson(outputPath, report);
      const json = readFileSync(resolvedPath, "utf8");

      expect(json).toContain('"reportSchemaVersion": 2');
      expect(json).toContain('"generatedAt": "2026-06-19T00:00:00.000Z"');
      expect(json).toContain('"savedSessions": 1');
      expect(json).not.toContain("user-secret");
      expect(json).not.toContain("anon-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates saved JSON reports and rejects stale or unsafe report shapes", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      recentTelemetryDays: 30,
      readinessCriteria: {
        minRatedSessions: 1,
        minRatedSessionUsers: 1,
        minFiveRatedSessionUsers: 1,
        minFaceHeightTruthSessions: 1,
        minBeachSelectedCoverage: 1,
        minConditionsSetCoverage: 1,
        minSubmitEventCoverage: 1,
        minRecentBuildMetadataCoverage: 1,
        expectedRecentClientBuilds: ["native-ios / 1.0.1 / 42"],
      },
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_beach_selected", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_conditions_set", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_rating_set", {
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_submit", {
          metadata: nativeBuildMetadata(),
        }),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-01T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-05T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-09T12:00:00.000Z"),
        sessionRow("user-1", "2026-06-16T12:00:00.000Z"),
      ],
    });

    expect(
      validateSessionAcquisitionReport(report, {
        maxReportAgeHours: 24,
        now: new Date("2026-07-01T01:00:00.000Z"),
      })
    ).toEqual({
      ok: true,
      blockers: [],
    });

    expect(
      validateSessionAcquisitionReport(
        {
          ...report,
          reportSchemaVersion: 0,
          generatedAt: "2026-06-17T00:00:00.000Z",
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-07-01T01:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "report_schema_version_invalid",
        "generated_at_too_old",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        leakedUserId: "11111111-1111-4111-8111-111111111111",
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["report_contains_uuid"]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        readiness: {
          ...report.readiness,
          criteria: {
            ...report.readiness.criteria,
            minRatedSessions: 2,
          },
          verdict: "ready",
          readyForPersonalizationEvaluation: true,
          findings: [],
          findingCodes: [],
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "readiness_finding_codes_mismatch",
        "readiness_ready_for_personalization_mismatch",
        "readiness_verdict_mismatch",
        "readiness_findings_mismatch",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        readiness: {
          ...report.readiness,
          observed: {
            ...report.readiness.observed,
            ratedSessions: 999,
          },
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["readiness_observed_mismatch"]),
    });

    expect(
      validateSessionAcquisitionReport(
        {
          ...report,
          start: "2026-05-01T00:00:00.000Z",
          end: "2026-05-31T00:00:00.000Z",
          days: 30,
          recentTelemetry: {
            ...report.recentTelemetry,
            start: "2026-05-24T00:00:00.000Z",
            end: "2026-05-31T00:00:00.000Z",
          },
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-07-01T01:00:00.000Z"),
        }
      )
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "measurement_end_too_old",
        "recent_telemetry_end_too_old",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        recentTelemetry: {
          ...report.recentTelemetry,
          start: "2026-06-25T00:00:00.000Z",
          end: "2026-06-24T00:00:00.000Z",
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["recent_telemetry_window_invalid"]),
    });
  });

  it("rejects hand-edited telemetry coverage counts and rates", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start", {
          created_at: "2026-06-30T12:00:00.000Z",
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_beach_selected", {
          created_at: "2026-06-30T12:01:00.000Z",
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_conditions_set", {
          created_at: "2026-06-30T12:02:00.000Z",
          metadata: nativeBuildMetadata(),
        }),
        eventRow("user-1", "session_log_submit", {
          created_at: "2026-06-30T12:03:00.000Z",
          metadata: nativeBuildMetadata(),
        }),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-15T12:00:00.000Z"),
      ],
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        recentTelemetry: {
          ...report.recentTelemetry,
          startActorsWithoutBuildMetadata:
            report.recentTelemetry.startActors + 1,
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "recent_telemetry_build_metadata_counts_inconsistent",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        recentTelemetry: {
          ...report.recentTelemetry,
          beachSelectedActorsWithStart:
            report.recentTelemetry.beachSelectedActors + 1,
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "recent_telemetry_counts_inconsistent",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        telemetryCoverage: {
          ...report.telemetryCoverage,
          beachSelectedOfStart: 0,
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "telemetry_coverage_funnel_mismatch",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        telemetryCoverageByPlatform: report.telemetryCoverageByPlatform.map(
          (coverage) =>
            coverage.platform === "native-ios"
              ? {
                  ...coverage,
                  beachSelectedOfStart: 0,
                }
              : coverage
        ),
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "telemetry_coverage_by_platform_invalid_rate_mismatch",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        recentTelemetry: {
          ...report.recentTelemetry,
          telemetryCoverageByClientBuild:
            report.recentTelemetry.telemetryCoverageByClientBuild.map(
              (coverage) =>
                coverage.clientBuild === "native-ios / 1.0.1 / 42"
                  ? {
                      ...coverage,
                      submitActorsWithStart: coverage.startActors + 1,
                    }
                  : coverage
            ),
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "recent_telemetry_client_build_coverage_invalid_counts_inconsistent",
      ]),
    });
  });

  it("rejects unsafe validation-failure evidence in saved JSON reports", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [profileRow("user-1")],
      events: [
        eventRow("user-1", "session_log_start", {
          metadata: nativeBuildMetadata(),
        }),
      ],
      windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
      lifetimeSessions: [
        sessionRow("user-1", "2026-06-15T12:00:00.000Z"),
      ],
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationFailuresByCode: [
          {
            code: "raw prose code with spaces",
            events: 1,
            actors: 1,
            platforms: { "native-ios": 1 },
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["validation_failures_invalid_code"]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationFailuresByCode: [
          {
            code: "rating_required",
            events: 1,
            actors: 2,
            platforms: { "native-ios": 1 },
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["validation_failures_invalid_counts"]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationFailuresByCode: [
          {
            code: "rating_required",
            events: 2,
            actors: 1,
            platforms: { "native-ios": 1 },
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "validation_failures_invalid_platform_counts",
      ]),
    });

    expect(
      validateSessionAcquisitionReport({
        ...report,
        recentTelemetry: {
          ...report.recentTelemetry,
          validationFailuresByCode: [
            {
              code: "raw prose code with spaces",
              events: 1,
              actors: 1,
              platforms: { "native-ios": 1 },
            },
          ],
        },
      })
    ).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "recent_telemetry_validation_failures_invalid_code",
      ]),
    });
  });

  it("validates a saved JSON report file from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "session-funnel-report-file-"));
    const outputPath = join(dir, "report.json");

    try {
      const report = computeSessionAcquisitionReport({
        start: START,
        end: END,
        generatedAt: "2026-07-01T00:00:00.000Z",
        profiles: [profileRow("user-1")],
        events: [eventRow("user-1", "session_log_start")],
        windowSessions: [sessionRow("user-1", "2026-06-15T12:00:00.000Z")],
        lifetimeSessions: [
          sessionRow("user-1", "2026-06-15T12:00:00.000Z"),
        ],
      });
      const resolvedPath = writeSessionAcquisitionReportJson(outputPath, report);

      expect(
        validateSessionAcquisitionReportFile(resolvedPath, {
          maxReportAgeHours: 24,
          now: new Date("2026-07-01T01:00:00.000Z"),
        })
      ).toEqual({
        ok: true,
        blockers: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("computes days from first to nth rated session per user", () => {
    const durations = computeTimeToNthRatedSession(
      [
        sessionRow("user-1", "2026-06-01T00:00:00.000Z"),
        sessionRow("user-1", "2026-06-03T00:00:00.000Z"),
        sessionRow("user-1", "2026-06-04T00:00:00.000Z"),
        sessionRow("user-1", "2026-06-08T00:00:00.000Z"),
        sessionRow("user-1", "2026-06-11T00:00:00.000Z"),
        sessionRow("user-2", "2026-06-01T00:00:00.000Z"),
        sessionRow("user-2", "2026-06-04T00:00:00.000Z"),
      ],
      5
    );

    expect(durations).toEqual([10]);
  });
});

function stepActors(
  report: ReturnType<typeof computeSessionAcquisitionReport>,
  key: string
): number {
  return report.funnelSteps.find((step) => step.key === key)?.actors ?? 0;
}

function extractQuotedValuesBetween(
  source: string,
  startMarker: string,
  endMarker: string
): string[] {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end).toBeGreaterThan(start);

  const block = source.slice(start + startMarker.length, end);
  return Array.from(
    block.matchAll(/['"]([^'"]+)['"]/g),
    (match) => match[1]
  );
}
