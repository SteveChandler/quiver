import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyStablePaginationOrder,
  computeSessionAcquisitionReport,
  computeTimeToNthRatedSession,
  parseCliArgs,
  readSessionAcquisitionSourceRows,
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

function canonicalMetadata(input: {
  flowId: string;
  clientStageAt: string;
  eventId: string;
  sessionId?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...nativeBuildMetadata(),
    schema_version: 1,
    flow_id: input.flowId,
    client_stage_at: input.clientStageAt,
    event_id: input.eventId,
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
    ...(input.extra ?? {}),
  };
}

function canonicalEventRow(
  userId: string | null,
  eventType: string,
  input: {
    flowId: string;
    clientStageAt: string;
    eventId: string;
    sessionId?: string;
    createdAt?: string;
    extra?: Record<string, unknown>;
  },
): SessionAcquisitionEventRow {
  return eventRow(userId, eventType, {
    created_at: input.createdAt ?? input.clientStageAt,
    metadata: canonicalMetadata(input),
  });
}

function persistedCanonicalFlowEvents(input: {
  userId: string;
  flowId: string;
  sessionId: string;
}): SessionAcquisitionEventRow[] {
  return [
    canonicalEventRow(input.userId, "session_log_start", {
      flowId: input.flowId,
      clientStageAt: "2026-06-15T12:00:00.000Z",
      eventId: `${input.flowId}-start`,
    }),
    canonicalEventRow(input.userId, "session_log_form_view", {
      flowId: input.flowId,
      clientStageAt: "2026-06-15T12:01:00.000Z",
      eventId: `${input.flowId}-form-view`,
    }),
    canonicalEventRow(input.userId, "session_log_submit", {
      flowId: input.flowId,
      clientStageAt: "2026-06-15T12:02:00.000Z",
      eventId: `${input.flowId}-submit`,
      sessionId: input.sessionId,
    }),
  ];
}

function firstSessionMarkerEvent(input: {
  userId: string;
  sessionId: string;
  eventId: string;
}): SessionAcquisitionEventRow {
  return canonicalEventRow(input.userId, "first_session_logged", {
    flowId: "marker-only-flow",
    clientStageAt: "2026-06-01T00:00:00.000Z",
    eventId: input.eventId,
    sessionId: input.sessionId,
  });
}

function schemaV3ReportFixture() {
  const session = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
    id: "session-a",
  });
  return computeSessionAcquisitionReport({
    start: START,
    end: END,
    generatedAt: "2026-07-01T00:00:00.000Z",
    recentTelemetryDays: 30,
    profiles: [profileRow("user-1")],
    events: [
      ...persistedCanonicalFlowEvents({
        userId: "user-1",
        flowId: "flow-a",
        sessionId: session.id,
      }),
      canonicalEventRow("user-1", "session_log_validation_failed", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:01:30.000Z",
        eventId: "validation-a",
      }),
      firstSessionMarkerEvent({
        userId: "user-1",
        sessionId: session.id,
        eventId: "marker-a",
      }),
    ],
    windowSessions: [session],
    lifetimeSessions: [session],
  });
}

function cloneReport(
  report: ReturnType<typeof computeSessionAcquisitionReport>,
): ReturnType<typeof computeSessionAcquisitionReport> {
  return JSON.parse(JSON.stringify(report)) as ReturnType<
    typeof computeSessionAcquisitionReport
  >;
}

function schemaV3HalfRatioReportFixture() {
  const report = cloneReport(schemaV3ReportFixture());
  const [start, formView, submit, persisted] = report.canonicalFunnel.steps;
  Object.assign(start, {
    users: 4,
    flows: 4,
    pctOfStart: 1,
    pctOfPrevious: null,
  });
  Object.assign(formView, {
    users: 2,
    flows: 2,
    pctOfStart: 0.5,
    pctOfPrevious: 0.5,
  });
  Object.assign(submit, {
    users: 2,
    flows: 2,
    pctOfStart: 0.5,
    pctOfPrevious: 1,
  });
  Object.assign(persisted, {
    users: 2,
    flows: 2,
    pctOfStart: 0.5,
    pctOfPrevious: 1,
  });
  Object.assign(report.validationBranch, {
    affectedUsers: 1,
    affectedFlows: 1,
    pctOfFormViewUsers: 0.5,
    recoveredUsers: 1,
    recoveredFlows: 1,
    recoveryRate: 1,
  });
  Object.assign(report.firstSessionTelemetryCoverage, {
    persistedFirstSessionUsers: 2,
    markerUsers: 1,
    coverage: 0.5,
  });
  return report;
}

type FormViewCoverageLayer = "top" | "recent-platform" | "recent-build";

function tamperFirstCoverage(
  source: ReturnType<typeof schemaV3ReportFixture>,
  layer: FormViewCoverageLayer,
  changes: Record<string, unknown>,
): ReturnType<typeof schemaV3ReportFixture> {
  const tampered = cloneReport(source);
  if (layer === "top") {
    Object.assign(tampered.telemetryCoverageByPlatform[0], changes);
  } else if (layer === "recent-platform") {
    Object.assign(
      tampered.recentTelemetry.telemetryCoverageByPlatform[0],
      changes,
    );
  } else {
    Object.assign(
      tampered.recentTelemetry.telemetryCoverageByClientBuild[0],
      changes,
    );
  }
  return tampered;
}

const FORM_VIEW_TAMPER_CASES = [
  {
    label: "top-level platform count",
    layer: "top",
    changes: { formViewActorsWithStart: 2 },
    blocker: "telemetry_coverage_by_platform_invalid_counts_inconsistent",
  },
  {
    label: "top-level platform rate",
    layer: "top",
    changes: { formViewOfStart: 0.5 },
    blocker: "telemetry_coverage_by_platform_invalid_rate_mismatch",
  },
  {
    label: "recent platform count",
    layer: "recent-platform",
    changes: { formViewActorsWithStart: 2 },
    blocker:
      "recent_telemetry_platform_coverage_invalid_counts_inconsistent",
  },
  {
    label: "recent platform rate",
    layer: "recent-platform",
    changes: { formViewOfStart: 0.5 },
    blocker: "recent_telemetry_platform_coverage_invalid_rate_mismatch",
  },
  {
    label: "recent client-build count",
    layer: "recent-build",
    changes: { formViewActorsWithStart: 2 },
    blocker:
      "recent_telemetry_client_build_coverage_invalid_counts_inconsistent",
  },
  {
    label: "recent client-build rate",
    layer: "recent-build",
    changes: { formViewOfStart: 0.5 },
    blocker:
      "recent_telemetry_client_build_coverage_invalid_rate_mismatch",
  },
] as const;

function canonicalStep(
  report: ReturnType<typeof computeSessionAcquisitionReport>,
  key: "start" | "form_view" | "submit" | "persisted_session",
) {
  const step = report.canonicalFunnel.steps.find((entry) => entry.key === key);
  if (!step) throw new Error("Missing canonical step: " + key);
  return step;
}

const NATIVE_REPO_CANDIDATES = [
  join(process.cwd(), "..", "quiver-native"),
  join(process.cwd(), "..", "..", "Desktop", "dev", "quiver-native"),
  join(process.cwd(), "..", "..", "..", "quiver-native"),
  join(__dirname, "..", "..", "..", "quiver-native"),
  join(__dirname, "..", "..", "..", "..", "..", "quiver-native"),
];

const nativeRepoRoot = NATIVE_REPO_CANDIDATES.find((candidate) =>
  existsSync(join(candidate, "package.json"))
);

// Cross-repo alignment tests need a sibling quiver-native checkout; CI checks
// out only this repo, so they run wherever the sibling exists (local dev).
const itWithNativeRepo = nativeRepoRoot ? it : it.skip;

function resolveNativeRepoPath(...segments: string[]): string {
  if (!nativeRepoRoot) {
    throw new Error(
      `Unable to find quiver-native repo. Checked: ${NATIVE_REPO_CANDIDATES.join(", ")}`
    );
  }

  return join(nativeRepoRoot, ...segments);
}

describe("session acquisition funnel report", () => {
  it("stable pagination: orders offset pages by created_at and id", () => {
    const orderCalls: Array<{
      column: string;
      options: { ascending: boolean };
    }> = [];
    const query = {
      order(column: string, options: { ascending: boolean }) {
        orderCalls.push({ column, options });
        return this;
      },
    };

    expect(applyStablePaginationOrder(query)).toBe(query);
    expect(orderCalls).toEqual([
      { column: "created_at", options: { ascending: true } },
      { column: "id", options: { ascending: true } },
    ]);
  });

  it("stable pagination: applies deterministic ordering in every offset-paginated fetch path", async () => {
    type QueryTrace = {
      table: string;
      calls: string[];
    };
    const traces: QueryTrace[] = [];
    const fakeSupabase = {
      from(table: string) {
        const trace: QueryTrace = { table, calls: [] };
        traces.push(trace);

        type FakeQueryBuilder = {
          select(): FakeQueryBuilder;
          gte(column: string): FakeQueryBuilder;
          lt(column: string): FakeQueryBuilder;
          in(column: string): FakeQueryBuilder;
          order(
            column: string,
            options: { ascending: boolean },
          ): FakeQueryBuilder;
          range(from: number, to: number): FakeQueryBuilder;
          then(
            resolve: (result: { data: unknown[]; error: null }) => unknown,
          ): unknown;
        };
        const builder: FakeQueryBuilder = {
          select(): typeof builder {
            return builder;
          },
          gte(column: string): typeof builder {
            trace.calls.push(`gte:${column}`);
            return builder;
          },
          lt(column: string): typeof builder {
            trace.calls.push(`lt:${column}`);
            return builder;
          },
          in(column: string): typeof builder {
            trace.calls.push(`in:${column}`);
            return builder;
          },
          order(
            column: string,
            options: { ascending: boolean },
          ): typeof builder {
            trace.calls.push(
              `order:${column}:${options.ascending ? "ASC" : "DESC"}`,
            );
            return builder;
          },
          range(from: number, to: number): typeof builder {
            trace.calls.push(`range:${from}:${to}`);
            return builder;
          },
          then(resolve: (result: { data: unknown[]; error: null }) => unknown) {
            const isCreatedProfileQuery =
              table === "profiles" && trace.calls.includes("gte:created_at");
            return resolve({
              data: isCreatedProfileQuery
                ? [profileRow("pagination-user")]
                : [],
              error: null,
            });
          },
        };

        return builder;
      },
    };

    await readSessionAcquisitionSourceRows(
      fakeSupabase as unknown as Parameters<
        typeof readSessionAcquisitionSourceRows
      >[0],
      parseCliArgs(["--start", START, "--end", END]),
    );

    const paginatedTraces = traces.filter((trace) =>
      trace.calls.some((call) => call.startsWith("range:")),
    );
    expect(paginatedTraces).toHaveLength(4);

    const callsByPath = Object.fromEntries(
      paginatedTraces.map((trace) => {
        const path =
          trace.table === "user_events"
            ? "events"
            : trace.table === "profiles"
              ? "profiles-created-in-window"
              : trace.calls.includes("gte:created_at")
                ? "window-sessions"
                : "lifetime-sessions";
        return [
          path,
          trace.calls.filter(
            (call) => call.startsWith("order:") || call.startsWith("range:"),
          ),
        ];
      }),
    );
    const expectedPaginationCalls = [
      "order:created_at:ASC",
      "order:id:ASC",
      "range:0:999",
    ];
    expect(callsByPath).toEqual({
      events: expectedPaginationCalls,
      "window-sessions": expectedPaginationCalls,
      "profiles-created-in-window": expectedPaginationCalls,
      "lifetime-sessions": expectedPaginationCalls,
    });
  });

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

  itWithNativeRepo("legacy telemetry corrections: keeps Track B event coverage aligned with web and native analytics allowlists", () => {
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

  itWithNativeRepo("keeps validation-failure codes aligned with the native session form", () => {
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

  it("canonical funnel: advances one flow by logical stage time and exact persisted session", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          createdAt: "2026-06-15T12:06:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          createdAt: "2026-06-15T12:05:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:04:00.000Z",
          eventId: "form-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(report.canonicalFunnel.steps).toMatchObject([
      { key: "start", users: 1, flows: 1, pctOfStart: 1, pctOfPrevious: null },
      { key: "form_view", users: 1, flows: 1, pctOfStart: 1, pctOfPrevious: 1 },
      { key: "submit", users: 1, flows: 1, pctOfStart: 1, pctOfPrevious: 1 },
      {
        key: "persisted_session",
        users: 1,
        flows: 1,
        pctOfStart: 1,
        pctOfPrevious: 1,
      },
    ]);
  });

  it("validation recovery: leaves a clean submitted flow out of the branch", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:00:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:02:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(report.validationBranch).toEqual({
      affectedUsers: 0,
      affectedFlows: 0,
      pctOfFormViewUsers: 0,
      recoveredUsers: 0,
      recoveredFlows: 0,
      recoveryRate: null,
    });
  });

  it("validation recovery: returns null rates when there are no canonical form views", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:00:00.000Z",
          eventId: "start-a",
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.validationBranch).toEqual({
      affectedUsers: 0,
      affectedFlows: 0,
      pctOfFormViewUsers: null,
      recoveredUsers: 0,
      recoveredFlows: 0,
      recoveryRate: null,
    });
  });

  it("validation recovery: marks post-form validation affected and same-flow submit recovered", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:00:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_validation_failed", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "validation-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(report.validationBranch).toEqual({
      affectedUsers: 1,
      affectedFlows: 1,
      pctOfFormViewUsers: 1,
      recoveredUsers: 1,
      recoveredFlows: 1,
      recoveryRate: 1,
    });
  });

  it("validation recovery: does not recover a validation failure through another flow", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:00:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_validation_failed", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "validation-a",
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-b",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "start-b",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-b",
          clientStageAt: "2026-06-15T12:04:00.000Z",
          eventId: "form-b",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-b",
          clientStageAt: "2026-06-15T12:05:00.000Z",
          eventId: "submit-b",
          sessionId: "session-b",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:05:00.000Z", { id: "session-b" }),
      ],
      lifetimeSessions: [],
    });

    expect(report.validationBranch).toEqual({
      affectedUsers: 1,
      affectedFlows: 1,
      pctOfFormViewUsers: 1,
      recoveredUsers: 0,
      recoveredFlows: 0,
      recoveryRate: 0,
    });
  });

  it("validation recovery: orders equal logical timestamps by delivery time", () => {
    const baseEvents = [
      canonicalEventRow("user-1", "session_log_start", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:00:00.000Z",
        eventId: "start-a",
      }),
      canonicalEventRow("user-1", "session_log_form_view", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:01:00.000Z",
        eventId: "form-a",
      }),
    ];
    const reportWithEarlierValidation = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        ...baseEvents,
        canonicalEventRow("user-1", "session_log_validation_failed", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:03:00.000Z",
          eventId: "validation-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:04:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:02:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });
    const reportWithLaterValidation = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        ...baseEvents,
        canonicalEventRow("user-1", "session_log_validation_failed", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:04:00.000Z",
          eventId: "validation-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:03:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:02:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(reportWithEarlierValidation.validationBranch).toMatchObject({
      affectedFlows: 1,
      recoveredFlows: 1,
    });
    expect(reportWithLaterValidation.validationBranch).toMatchObject({
      affectedFlows: 0,
      recoveredFlows: 0,
    });
  });

  it("validation recovery: uses input order when form and validation timestamps tie", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:00:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          createdAt: "2026-06-15T12:02:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_validation_failed", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          createdAt: "2026-06-15T12:02:00.000Z",
          eventId: "validation-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(report.validationBranch).toEqual({
      affectedUsers: 1,
      affectedFlows: 1,
      pctOfFormViewUsers: 1,
      recoveredUsers: 1,
      recoveredFlows: 1,
      recoveryRate: 1,
    });
  });

  it("validation recovery: counts repeated failures once per flow and deduplicates users", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1"), profileRow("user-2")],
      events: [
        ...["flow-a", "flow-b"].flatMap((flowId, index) => {
          const minute = index * 4;
          return [
            canonicalEventRow("user-1", "session_log_start", {
              flowId,
              clientStageAt: `2026-06-15T12:0${minute}:00.000Z`,
              eventId: `${flowId}-start`,
            }),
            canonicalEventRow("user-1", "session_log_form_view", {
              flowId,
              clientStageAt: `2026-06-15T12:0${minute + 1}:00.000Z`,
              eventId: `${flowId}-form`,
            }),
            canonicalEventRow("user-1", "session_log_validation_failed", {
              flowId,
              clientStageAt: `2026-06-15T12:0${minute + 2}:00.000Z`,
              eventId: `${flowId}-validation-1`,
            }),
            canonicalEventRow("user-1", "session_log_validation_failed", {
              flowId,
              clientStageAt: `2026-06-15T12:0${minute + 2}:30.000Z`,
              eventId: `${flowId}-validation-2`,
            }),
            ...(flowId === "flow-a"
              ? [
                  canonicalEventRow("user-1", "session_log_submit", {
                    flowId,
                    clientStageAt: `2026-06-15T12:0${minute + 3}:00.000Z`,
                    eventId: `${flowId}-submit`,
                    sessionId: `${flowId}-session`,
                  }),
                ]
              : []),
          ];
        }),
        canonicalEventRow("user-2", "session_log_start", {
          flowId: "flow-c",
          clientStageAt: "2026-06-15T12:10:00.000Z",
          eventId: "start-c",
        }),
        canonicalEventRow("user-2", "session_log_form_view", {
          flowId: "flow-c",
          clientStageAt: "2026-06-15T12:11:00.000Z",
          eventId: "form-c",
        }),
        canonicalEventRow("user-2", "session_log_validation_failed", {
          flowId: "flow-c",
          clientStageAt: "2026-06-15T12:12:00.000Z",
          eventId: "validation-c",
        }),
        canonicalEventRow("user-2", "session_log_submit", {
          flowId: "flow-c",
          clientStageAt: "2026-06-15T12:13:00.000Z",
          eventId: "submit-c",
          sessionId: "session-c",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "flow-a-session" }),
        sessionRow("user-2", "2026-06-15T12:13:00.000Z", { id: "session-c" }),
      ],
      lifetimeSessions: [],
    });

    expect(report.validationBranch).toEqual({
      affectedUsers: 2,
      affectedFlows: 3,
      pctOfFormViewUsers: 1,
      recoveredUsers: 2,
      recoveredFlows: 2,
      recoveryRate: 1,
    });
  });

  it("canonical funnel: does not stitch stages from separate flows", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-b",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "submit-b",
          sessionId: "session-b",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-b" }),
      ],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "start").users).toBe(1);
    expect(canonicalStep(report, "form_view").users).toBe(1);
    expect(canonicalStep(report, "submit").users).toBe(0);
    expect(canonicalStep(report, "persisted_session").users).toBe(0);
  });

  it("canonical funnel: rejects submits ordered before their form", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "form-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:02:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "form_view").flows).toBe(1);
    expect(canonicalStep(report, "submit").flows).toBe(0);
  });

  it("canonical funnel: does not advance a form that input-orders before an equal-time start", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:01:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:01:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "form_view").flows).toBe(0);
    expect(canonicalStep(report, "submit").flows).toBe(0);
  });

  it("canonical funnel: does not advance a submit that sorts before an equal-time form", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:03:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          createdAt: "2026-06-15T12:02:00.000Z",
          eventId: "submit-a",
          sessionId: "session-a",
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:02:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "form_view").flows).toBe(1);
    expect(canonicalStep(report, "submit").flows).toBe(0);
  });

  it("canonical funnel: excludes unusable logical timestamps and records coverage", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-valid",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "valid",
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-missing",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "missing",
          extra: { client_stage_at: "" },
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-invalid",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "invalid",
          extra: { client_stage_at: "invalid" },
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-outside",
          clientStageAt: "2026-06-15T12:04:00.000Z",
          eventId: "outside",
          extra: { client_stage_at: "2026-07-01T00:00:00.000Z" },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "start").flows).toBe(1);
    expect(
      report.canonicalFunnel.joinCoverage.funnelEventsWithUnusableClientStageAt,
    ).toBe(3);
  });

  it("canonical funnel: keeps legacy rows out of the canonical denominator", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [eventRow("user-1", "session_log_start")],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(stepActors(report, "form_started")).toBe(1);
    expect(canonicalStep(report, "start").flows).toBe(0);
    expect(report.canonicalFunnel.joinCoverage.funnelEventsMissingFlowId).toBe(
      1,
    );
  });

  it("canonical funnel: keeps the same flow ID isolated by user", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1"), profileRow("user-2")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "shared-flow",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "start-user-1",
        }),
        canonicalEventRow("user-2", "session_log_form_view", {
          flowId: "shared-flow",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "form-user-2",
        }),
        canonicalEventRow("user-2", "session_log_submit", {
          flowId: "shared-flow",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "submit-user-2",
          sessionId: "session-user-2",
        }),
      ],
      windowSessions: [
        sessionRow("user-2", "2026-06-15T12:03:00.000Z", {
          id: "session-user-2",
        }),
      ],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "start")).toMatchObject({ users: 1, flows: 1 });
    expect(canonicalStep(report, "form_view")).toMatchObject({ users: 0, flows: 0 });
    expect(canonicalStep(report, "submit")).toMatchObject({ users: 0, flows: 0 });
  });

  it("canonical funnel: counts two qualifying flows for one user separately", () => {
    const events = ["flow-a", "flow-b"].flatMap((flowId, index) => {
      const minute = index * 3 + 1;
      const stageAt = (offset: number) =>
        `2026-06-15T12:${String(minute + offset).padStart(2, "0")}:00.000Z`;
      return [
        canonicalEventRow("user-1", "session_log_start", {
          flowId,
          clientStageAt: stageAt(0),
          eventId: `${flowId}-start`,
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId,
          clientStageAt: stageAt(1),
          eventId: `${flowId}-form`,
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId,
          clientStageAt: stageAt(2),
          eventId: `${flowId}-submit`,
          sessionId: `${flowId}-session`,
        }),
      ];
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events,
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", {
          id: "flow-a-session",
        }),
        sessionRow("user-1", "2026-06-15T12:06:00.000Z", {
          id: "flow-b-session",
        }),
      ],
      lifetimeSessions: [],
    });

    for (const key of ["start", "form_view", "submit", "persisted_session"] as const) {
      expect(canonicalStep(report, key)).toMatchObject({ users: 1, flows: 2 });
    }
  });

  it("canonical funnel: records submits without session IDs without advancing them", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "start-a",
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "form-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "submit-a",
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "form_view").flows).toBe(1);
    expect(canonicalStep(report, "submit").flows).toBe(0);
    expect(report.canonicalFunnel.joinCoverage.submitEventsMissingSessionId).toBe(1);
  });

  it("canonical funnel: accepts ordered flows without stable event IDs", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "placeholder",
          extra: { event_id: "" },
        }),
        canonicalEventRow("user-1", "session_log_form_view", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "placeholder",
          extra: { event_id: "" },
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "placeholder",
          sessionId: "session-a",
          extra: { event_id: "" },
        }),
      ],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "persisted_session")).toMatchObject({
      users: 1,
      flows: 1,
    });
    expect(report.canonicalFunnel.joinCoverage.stableIdConflictGroups).toBe(0);
  });

  it("canonical funnel: deduplicates identical stable-ID retries", () => {
    const events = [
      canonicalEventRow("user-1", "session_log_start", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:01:00.000Z",
        eventId: "start-a",
      }),
      canonicalEventRow("user-1", "session_log_form_view", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:02:00.000Z",
        eventId: "form-a",
      }),
      canonicalEventRow("user-1", "session_log_submit", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:03:00.000Z",
        eventId: "submit-a",
        sessionId: "session-a",
      }),
    ];
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [...events, ...events],
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
      ],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "persisted_session").flows).toBe(1);
    expect(report.canonicalFunnel.joinCoverage.stableIdConflictGroups).toBe(0);
  });

  it("canonical funnel: excludes stable-ID conflict groups", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1"), profileRow("user-2")],
      events: [
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "user-conflict",
        }),
        canonicalEventRow(null, "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:01:00.000Z",
          eventId: "user-conflict",
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "flow-conflict",
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "placeholder-flow",
          clientStageAt: "2026-06-15T12:02:00.000Z",
          eventId: "flow-conflict",
          extra: { flow_id: "" },
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:03:00.000Z",
          eventId: "time-conflict",
        }),
        canonicalEventRow("user-1", "session_log_start", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:04:00.000Z",
          eventId: "time-conflict",
          extra: { client_stage_at: "2026-07-01T00:00:00.000Z" },
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:05:00.000Z",
          eventId: "session-conflict",
          sessionId: "session-a",
        }),
        canonicalEventRow("user-1", "session_log_submit", {
          flowId: "flow-a",
          clientStageAt: "2026-06-15T12:05:00.000Z",
          eventId: "session-conflict",
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(canonicalStep(report, "start").flows).toBe(0);
    expect(report.canonicalFunnel.joinCoverage).toMatchObject({
      stableIdConflictGroups: 4,
      funnelEventRowsMissingUserId: 0,
      funnelEventsMissingFlowId: 0,
      submitEventsMissingSessionId: 0,
      funnelEventsWithUnusableClientStageAt: 0,
    });
  });

  it("canonical funnel: records incomplete first-session markers outside submit attempts", () => {
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        eventRow(null, "first_session_logged", {
          metadata: { session_id: "session-a" },
        }),
        eventRow("user-1", "first_session_logged", {
          metadata: nativeBuildMetadata(),
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.canonicalFunnel.joinCoverage).toMatchObject({
      firstSessionMarkersMissingUserId: 1,
      firstSessionMarkersMissingSessionId: 1,
    });
    expect(canonicalStep(report, "submit").flows).toBe(0);
  });

  it("first-session telemetry coverage: counts a matching marker for a canonical persisted first session", () => {
    const session = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "first-session",
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        ...persistedCanonicalFlowEvents({
          userId: "user-1",
          flowId: "flow-a",
          sessionId: session.id,
        }),
        firstSessionMarkerEvent({
          userId: "user-1",
          sessionId: session.id,
          eventId: "first-session-marker",
        }),
      ],
      windowSessions: [session],
      lifetimeSessions: [session],
    });

    expect(report.firstSessionTelemetryCoverage).toEqual({
      persistedFirstSessionUsers: 1,
      markerUsers: 1,
      coverage: 1,
    });
  });

  it("first-session telemetry coverage: excludes a marker with a mismatched session", () => {
    const session = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "first-session",
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        ...persistedCanonicalFlowEvents({
          userId: "user-1",
          flowId: "flow-a",
          sessionId: session.id,
        }),
        firstSessionMarkerEvent({
          userId: "user-1",
          sessionId: "different-session",
          eventId: "mismatched-session-marker",
        }),
      ],
      windowSessions: [session],
      lifetimeSessions: [session],
    });

    expect(report.firstSessionTelemetryCoverage).toEqual({
      persistedFirstSessionUsers: 1,
      markerUsers: 0,
      coverage: 0,
    });
  });

  it("first-session telemetry coverage: excludes a marker with a mismatched user", () => {
    const session = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "first-session",
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1"), profileRow("user-2")],
      events: [
        ...persistedCanonicalFlowEvents({
          userId: "user-1",
          flowId: "flow-a",
          sessionId: session.id,
        }),
        firstSessionMarkerEvent({
          userId: "user-2",
          sessionId: session.id,
          eventId: "mismatched-user-marker",
        }),
      ],
      windowSessions: [session],
      lifetimeSessions: [session],
    });

    expect(report.firstSessionTelemetryCoverage).toEqual({
      persistedFirstSessionUsers: 1,
      markerUsers: 0,
      coverage: 0,
    });
  });

  it("first-session telemetry coverage: ignores a marker without a canonical submit", () => {
    const session = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "first-session",
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        firstSessionMarkerEvent({
          userId: "user-1",
          sessionId: session.id,
          eventId: "marker-without-submit",
        }),
      ],
      windowSessions: [session],
      lifetimeSessions: [session],
    });

    expect(report.firstSessionTelemetryCoverage).toEqual({
      persistedFirstSessionUsers: 0,
      markerUsers: 0,
      coverage: null,
    });
  });

  it("first-session telemetry coverage: deduplicates duplicate markers for one user", () => {
    const session = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "first-session",
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        ...persistedCanonicalFlowEvents({
          userId: "user-1",
          flowId: "flow-a",
          sessionId: session.id,
        }),
        firstSessionMarkerEvent({
          userId: "user-1",
          sessionId: session.id,
          eventId: "first-session-marker-a",
        }),
        firstSessionMarkerEvent({
          userId: "user-1",
          sessionId: session.id,
          eventId: "first-session-marker-b",
        }),
      ],
      windowSessions: [session],
      lifetimeSessions: [session],
    });

    expect(report.firstSessionTelemetryCoverage).toEqual({
      persistedFirstSessionUsers: 1,
      markerUsers: 1,
      coverage: 1,
    });
  });

  it("first-session telemetry coverage: does not reclassify a later current session after the historical first was soft-deleted", () => {
    const historicalFirst = sessionRow("user-1", "2026-06-01T12:00:00.000Z", {
      id: "historical-first",
      deleted_at: "2026-06-10T12:00:00.000Z",
    });
    const currentSession = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "current-session",
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        ...persistedCanonicalFlowEvents({
          userId: "user-1",
          flowId: "flow-a",
          sessionId: currentSession.id,
        }),
        firstSessionMarkerEvent({
          userId: "user-1",
          sessionId: currentSession.id,
          eventId: "current-session-marker",
        }),
      ],
      windowSessions: [currentSession],
      lifetimeSessions: [historicalFirst, currentSession],
    });

    expect(report.firstSessionTelemetryCoverage).toEqual({
      persistedFirstSessionUsers: 0,
      markerUsers: 0,
      coverage: null,
    });
  });

  it("first-session telemetry coverage: uses the session ID to break lifetime creation-time ties", () => {
    const firstById = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "a-first-session",
    });
    const currentSession = sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
      id: "b-current-session",
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [profileRow("user-1")],
      events: [
        ...persistedCanonicalFlowEvents({
          userId: "user-1",
          flowId: "flow-a",
          sessionId: currentSession.id,
        }),
        firstSessionMarkerEvent({
          userId: "user-1",
          sessionId: currentSession.id,
          eventId: "current-session-marker",
        }),
      ],
      windowSessions: [currentSession],
      lifetimeSessions: [currentSession, firstById],
    });

    expect(report.firstSessionTelemetryCoverage).toEqual({
      persistedFirstSessionUsers: 0,
      markerUsers: 0,
      coverage: null,
    });
  });

  it("persistence buckets: partitions every submitted flow exactly once", () => {
    const flowEvents = [
      "persisted",
      "missing",
      "owner-mismatch",
      "draft",
      "deleted",
    ].flatMap((flowId, index) => {
      const minute = index * 3;
      const timestamp = (offset: number) =>
        `2026-06-15T12:${String(minute + offset).padStart(2, "0")}:00.000Z`;
      const sessionId =
        flowId === "persisted"
          ? "persisted-session"
          : flowId === "missing"
            ? "missing-session"
            : flowId === "owner-mismatch"
              ? "other-user-session"
              : flowId === "draft"
                ? "draft-session"
                : "deleted-session";
      const userId = `user-${index + 1}`;
      return [
        canonicalEventRow(userId, "session_log_start", {
          flowId,
          clientStageAt: timestamp(0),
          eventId: `${flowId}-start`,
        }),
        canonicalEventRow(userId, "session_log_form_view", {
          flowId,
          clientStageAt: timestamp(1),
          eventId: `${flowId}-form`,
        }),
        canonicalEventRow(userId, "session_log_submit", {
          flowId,
          clientStageAt: timestamp(2),
          eventId: `${flowId}-submit`,
          sessionId,
        }),
      ];
    });
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      profiles: [
        ...["user-1", "user-2", "user-3", "user-4", "user-5"].map((id) =>
          profileRow(id),
        ),
        profileRow("other-user"),
      ],
      events: flowEvents,
      windowSessions: [
        sessionRow("user-1", "2026-06-15T12:02:00.000Z", {
          id: "persisted-session",
        }),
        sessionRow("other-user", "2026-06-15T12:08:00.000Z", {
          id: "other-user-session",
        }),
        sessionRow("user-4", "2026-06-15T12:11:00.000Z", {
          id: "draft-session",
          status: "draft",
        }),
        sessionRow("user-5", "2026-06-15T12:14:00.000Z", {
          id: "deleted-session",
          deleted_at: "2026-06-15T12:15:00.000Z",
        }),
      ],
      lifetimeSessions: [],
    });

    expect(report.canonicalFunnel.joinCoverage).toMatchObject({
      submitFlowsWithoutWindowSession: 1,
      submitFlowsWithSessionOwnerMismatch: 1,
      submitFlowsWithIneligibleSession: 2,
    });
    expect(canonicalStep(report, "submit").flows).toBe(5);
    expect(canonicalStep(report, "persisted_session").flows).toBe(1);
    expect(canonicalStep(report, "persisted_session").users).toBe(1);
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
      generatedAt: "2026-07-01T00:00:00.000Z",
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
      generatedAt: "2026-07-01T00:00:00.000Z",
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
      generatedAt: "2026-07-01T00:00:00.000Z",
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
    const report = schemaV3ReportFixture();

    const markdown = renderSessionAcquisitionReport(report);

    expect(markdown).toContain("# Track B Session Acquisition Instrumentation Report");
    expect(markdown).toContain("## Canonical Session Funnel");
    expect(markdown).toContain("## Validation Recovery");
    expect(markdown).toContain("## First-Session Telemetry Coverage");
    expect(markdown).toContain("Correlation-complete traffic");
    expect(markdown).toContain("right-censor offline delivery after the report end");
    expect(markdown).not.toContain("flow-a");
    expect(markdown).not.toContain("session-a");
  });

  it("final review privacy: normalizes UUID-valued client dimensions before rendering", () => {
    const platformUuid = "11111111-1111-4111-8111-111111111111";
    const versionUuid = "22222222-2222-4222-8222-222222222222";
    const buildUuid = "33333333-3333-4333-8333-333333333333";
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [
        profileRow("platform-user"),
        profileRow("version-user"),
        profileRow("build-user"),
        profileRow("web-user"),
      ],
      events: [
        eventRow("platform-user", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: { _platform: platformUuid },
        }),
        eventRow("version-user", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: versionUuid,
            app_build: "42",
          },
        }),
        eventRow("build-user", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: {
            _platform: "native-android",
            app_version: "1.2.3-beta.1",
            app_build: buildUuid,
          },
        }),
        eventRow("web-user", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: {
            _device: { device_type: "desktop", os: "macOS" },
            app_version: "2.3.4",
            app_build: 99,
          },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(report.eventsByPlatform).toEqual({
      "desktop/macOS": 1,
      "native-android": 1,
      "native-ios": 1,
      "unknown-platform": 1,
    });
    expect(
      report.recentTelemetry.telemetryCoverageByClientBuild.map(
        ({ clientBuild }) => clientBuild,
      ),
    ).toEqual([
      "desktop/macOS / 2.3.4 / 99",
      "native-android / 1.2.3-beta.1 / unknown-build",
      "native-ios / unknown-version / 42",
      "unknown-platform / unknown-version / unknown-build",
    ]);

    const markdown = renderSessionAcquisitionReport(report);
    expect(markdown).toContain("desktop/macOS / 2.3.4 / 99");
    expect(markdown).toContain("unknown-platform");
    expect(markdown).toContain("unknown-version");
    expect(markdown).toContain("unknown-build");
    expect(markdown).not.toContain(platformUuid);
    expect(markdown).not.toContain(versionUuid);
    expect(markdown).not.toContain(buildUuid);
  });

  it("final review privacy: bounds app versions and removes identifier-bearing suffixes", () => {
    const uuidVersion =
      "1.2.3-22222222-2222-4222-8222-222222222222";
    const oversizedVersion = `1.2.3-${"a".repeat(80)}`;
    const report = computeSessionAcquisitionReport({
      start: START,
      end: END,
      generatedAt: "2026-07-01T00:00:00.000Z",
      profiles: [
        profileRow("uuid-version-user"),
        profileRow("oversized-version-user"),
        profileRow("valid-version-user"),
      ],
      events: [
        eventRow("uuid-version-user", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: uuidVersion,
            app_build: "42",
          },
        }),
        eventRow("oversized-version-user", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: oversizedVersion,
            app_build: "42",
          },
        }),
        eventRow("valid-version-user", "session_log_start", {
          created_at: "2026-06-28T12:00:00.000Z",
          metadata: {
            _platform: "native-ios",
            app_version: "1.2.3-beta.1",
            app_build: "42",
          },
        }),
      ],
      windowSessions: [],
      lifetimeSessions: [],
    });

    expect(
      report.recentTelemetry.telemetryCoverageByClientBuild.map(
        ({ clientBuild, startActors }) => ({ clientBuild, startActors }),
      ),
    ).toEqual([
      {
        clientBuild: "native-ios / unknown-version / 42",
        startActors: 2,
      },
      {
        clientBuild: "native-ios / 1.2.3-beta.1 / 42",
        startActors: 1,
      },
    ]);
    expect(validateSessionAcquisitionReport(report)).toEqual({
      ok: true,
      blockers: [],
    });

    const markdown = renderSessionAcquisitionReport(report);
    expect(markdown).toContain("native-ios / 1.2.3-beta.1 / 42");
    expect(markdown).toContain("native-ios / unknown-version / 42");
    expect(markdown).not.toContain(uuidVersion);
    expect(markdown).not.toContain(oversizedVersion);
  });

  it("final review privacy: renderer rejects unnormalized tampering with blocker codes", () => {
    const report = schemaV3ReportFixture();
    const platformUuid = "44444444-4444-4444-8444-444444444444";
    const tampered = {
      ...report,
      eventsByPlatform: { [platformUuid]: report.eventRows },
    };

    expect(() =>
      renderSessionAcquisitionReport(tampered as typeof report),
    ).toThrow(
      "Refusing to render invalid session acquisition report: report_contains_uuid, events_by_platform_invalid_label",
    );
  });

  it("writes aggregate-only JSON without raw actor identifiers", () => {
    const dir = mkdtempSync(join(tmpdir(), "session-funnel-report-"));
    const outputPath = join(dir, "nested", "report.json");

    try {
      const report = computeSessionAcquisitionReport({
        start: START,
        end: END,
        generatedAt: "2026-07-01T00:00:00.000Z",
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

      const parsed = JSON.parse(json);

      expect(json).toContain('"reportSchemaVersion": 3');
      expect(json).toContain('"generatedAt": "2026-07-01T00:00:00.000Z"');
      expect(json).toContain('"savedSessions": 1');
      expect(parsed.reportSchemaVersion).toBe(3);
      expect(
        parsed.canonicalFunnel.steps.map((step: { key: string }) => step.key),
      ).toEqual(["start", "form_view", "submit", "persisted_session"]);
      expect(json).not.toContain("user-secret");
      expect(json).not.toContain("anon-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("schema v3 tamper: enforces exact report and canonical object keys", () => {
    const report = schemaV3ReportFixture();

    expect(validateSessionAcquisitionReport(report)).toEqual({
      ok: true,
      blockers: [],
    });
    expect(
      validateSessionAcquisitionReport({ ...report, unexpectedAggregate: 1 })
        .blockers,
    ).toContain("report_keys_invalid");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        canonicalFunnel: {
          ...report.canonicalFunnel,
          unexpectedAggregate: 1,
        },
      }).blockers,
    ).toContain("canonical_funnel_keys_invalid");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        canonicalFunnel: {
          ...report.canonicalFunnel,
          steps: report.canonicalFunnel.steps.map((step, index) =>
            index === 0 ? { ...step, unexpectedAggregate: 1 } : step,
          ),
        },
      }).blockers,
    ).toContain("canonical_funnel_step_keys_invalid");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationBranch: {
          ...report.validationBranch,
          unexpectedAggregate: 1,
        },
      }).blockers,
    ).toContain("validation_branch_keys_invalid");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        firstSessionTelemetryCoverage: {
          ...report.firstSessionTelemetryCoverage,
          unexpectedAggregate: 1,
        },
      }).blockers,
    ).toContain("first_session_telemetry_keys_invalid");
  });

  it("schema v3 tamper: rejects stale, missing, reordered, and duplicate canonical steps", () => {
    const report = schemaV3ReportFixture();

    expect(
      validateSessionAcquisitionReport({
        ...report,
        reportSchemaVersion: 2,
      }).blockers,
    ).toContain("report_schema_version_invalid");

    for (const steps of [
      report.canonicalFunnel.steps.slice(0, 3),
      [
        report.canonicalFunnel.steps[1],
        report.canonicalFunnel.steps[0],
        ...report.canonicalFunnel.steps.slice(2),
      ],
      [
        report.canonicalFunnel.steps[0],
        report.canonicalFunnel.steps[1],
        report.canonicalFunnel.steps[1],
        report.canonicalFunnel.steps[3],
      ],
    ]) {
      expect(
        validateSessionAcquisitionReport({
          ...report,
          canonicalFunnel: { ...report.canonicalFunnel, steps },
        }).blockers,
      ).toContain("canonical_funnel_step_order_invalid");
    }
  });

  it("schema v3 tamper: rejects canonical count, ordering, bounds, and rate violations", () => {
    const report = schemaV3ReportFixture();
    const withStep = (
      index: number,
      changes: Record<string, unknown>,
    ): ReturnType<typeof computeSessionAcquisitionReport> => {
      const tampered = cloneReport(report);
      Object.assign(tampered.canonicalFunnel.steps[index], changes);
      return tampered;
    };

    expect(
      validateSessionAcquisitionReport(withStep(0, { users: 0.5 })).blockers,
    ).toContain("canonical_funnel_step_counts_invalid");
    expect(
      validateSessionAcquisitionReport(withStep(0, { flows: -1 })).blockers,
    ).toContain("canonical_funnel_step_counts_invalid");
    expect(
      validateSessionAcquisitionReport(
        withStep(1, { users: 2, flows: 2 }),
      ).blockers,
    ).toContain("canonical_funnel_users_non_monotonic");
    expect(
      validateSessionAcquisitionReport(withStep(1, { flows: 2 })).blockers,
    ).toContain("canonical_funnel_flows_non_monotonic");
    expect(
      validateSessionAcquisitionReport(withStep(3, { flows: 0 })).blockers,
    ).toContain("canonical_funnel_users_exceed_flows");
    expect(
      validateSessionAcquisitionReport(withStep(0, { pctOfStart: 0.5 }))
        .blockers,
    ).toContain("canonical_funnel_rate_mismatch");
    expect(
      validateSessionAcquisitionReport(withStep(2, { pctOfPrevious: 0.5 }))
        .blockers,
    ).toContain("canonical_funnel_rate_mismatch");
  });

  it("schema v3 tamper: rejects join coverage and rejection partition violations", () => {
    const report = schemaV3ReportFixture();
    const missingJoinField = cloneReport(report);
    delete (missingJoinField.canonicalFunnel.joinCoverage as Partial<
      typeof missingJoinField.canonicalFunnel.joinCoverage
    >).funnelEventsMissingFlowId;
    const negativeJoinField = cloneReport(report);
    negativeJoinField.canonicalFunnel.joinCoverage.submitEventsMissingSessionId =
      -1;
    const invalidPartition = cloneReport(report);
    invalidPartition.canonicalFunnel.joinCoverage.submitFlowsWithoutWindowSession =
      1;

    expect(validateSessionAcquisitionReport(missingJoinField).blockers).toContain(
      "canonical_join_coverage_keys_invalid",
    );
    expect(validateSessionAcquisitionReport(negativeJoinField).blockers).toContain(
      "canonical_join_coverage_counts_invalid",
    );
    expect(validateSessionAcquisitionReport(invalidPartition).blockers).toContain(
      "canonical_persistence_rejection_partition_invalid",
    );
  });

  it("schema v3 tamper: rejects validation recovery bounds and rates", () => {
    const report = schemaV3ReportFixture();

    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationBranch: { ...report.validationBranch, affectedUsers: 2 },
      }).blockers,
    ).toContain("validation_branch_counts_inconsistent");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationBranch: { ...report.validationBranch, affectedFlows: 2 },
      }).blockers,
    ).toContain("validation_branch_counts_inconsistent");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationBranch: { ...report.validationBranch, recoveredUsers: 2 },
      }).blockers,
    ).toContain("validation_branch_counts_inconsistent");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationBranch: { ...report.validationBranch, recoveredFlows: 2 },
      }).blockers,
    ).toContain("validation_branch_counts_inconsistent");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationBranch: {
          ...report.validationBranch,
          pctOfFormViewUsers: 0.5,
        },
      }).blockers,
    ).toContain("validation_branch_rate_mismatch");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        validationBranch: { ...report.validationBranch, recoveryRate: 0.5 },
      }).blockers,
    ).toContain("validation_branch_rate_mismatch");
  });

  it("schema v3 tamper: rejects first-session denominator, marker, and coverage violations", () => {
    const report = schemaV3ReportFixture();

    expect(
      validateSessionAcquisitionReport({
        ...report,
        firstSessionTelemetryCoverage: {
          ...report.firstSessionTelemetryCoverage,
          persistedFirstSessionUsers: 2,
        },
      }).blockers,
    ).toContain("first_session_telemetry_counts_inconsistent");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        firstSessionTelemetryCoverage: {
          ...report.firstSessionTelemetryCoverage,
          markerUsers: 2,
        },
      }).blockers,
    ).toContain("first_session_telemetry_counts_inconsistent");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        firstSessionTelemetryCoverage: {
          ...report.firstSessionTelemetryCoverage,
          coverage: 0.5,
        },
      }).blockers,
    ).toContain("first_session_telemetry_rate_mismatch");
  });

  it("schema v3 exact ratios: rejects near-equal canonical, validation, and first-session rates", () => {
    const report = schemaV3HalfRatioReportFixture();
    expect(validateSessionAcquisitionReport(report)).toEqual({
      ok: true,
      blockers: [],
    });

    const canonicalRate = cloneReport(report);
    canonicalRate.canonicalFunnel.steps[1].pctOfStart = 0.5000000005;
    expect(validateSessionAcquisitionReport(canonicalRate).blockers).toContain(
      "canonical_funnel_rate_mismatch",
    );

    const validationRate = cloneReport(report);
    validationRate.validationBranch.pctOfFormViewUsers = 0.5000000005;
    expect(validateSessionAcquisitionReport(validationRate).blockers).toContain(
      "validation_branch_rate_mismatch",
    );

    const firstSessionRate = cloneReport(report);
    firstSessionRate.firstSessionTelemetryCoverage.coverage = 0.5000000005;
    expect(
      validateSessionAcquisitionReport(firstSessionRate).blockers,
    ).toContain("first_session_telemetry_rate_mismatch");
  });

  it("privacy tamper: rejects identifier keys, UUID values, and unsafe evidence without false positives", () => {
    const report = schemaV3ReportFixture();

    expect(validateSessionAcquisitionReport(report)).toEqual({
      ok: true,
      blockers: [],
    });
    for (const key of ["user_id", "flow_id", "event_id", "session_id"]) {
      expect(
        validateSessionAcquisitionReport({
          ...report,
          readiness: {
            ...report.readiness,
            diagnostic: { [key]: "secret" },
          },
        }).blockers,
      ).toContain("report_contains_identifier_key");
    }
    expect(
      validateSessionAcquisitionReport({
        ...report,
        gaps: ["11111111-1111-4111-8111-111111111111"],
      }).blockers,
    ).toContain("report_contains_uuid");
    expect(
      validateSessionAcquisitionReport({
        ...report,
        gaps: ["unsafe correlation evidence flow_id=flow-a"],
      }).blockers,
    ).toContain("report_contains_identifier_evidence");
  });

  it("privacy hardening: rejects UUIDv7 values with a stable blocker", () => {
    const report = schemaV3ReportFixture();

    expect(
      validateSessionAcquisitionReport({
        ...report,
        gaps: ["018f0c5e-7b2a-7c4d-8e9f-0123456789ab"],
      }).blockers,
    ).toContain("report_contains_uuid");
  });

  it("privacy matrix: rejects every exact identifier key nested inside arrays", () => {
    const report = schemaV3ReportFixture();

    expect(
      validateSessionAcquisitionReport({
        ...report,
        readiness: {
          ...report.readiness,
          diagnostic: [{ submitEventsMissingSessionId: 1 }],
        },
      }).blockers,
    ).not.toContain("report_contains_identifier_key");

    for (const key of [
      "user_id",
      "userId",
      "flow_id",
      "flowId",
      "event_id",
      "eventId",
      "session_id",
      "sessionId",
    ]) {
      expect(
        validateSessionAcquisitionReport({
          ...report,
          readiness: {
            ...report.readiness,
            diagnostic: [{ aggregate: { [key]: "secret" } }],
          },
        }).blockers,
      ).toContain("report_contains_identifier_key");
    }
  });

  it("privacy hardening: returns a stable blocker for cyclic reports", () => {
    const cyclicReport = cloneReport(schemaV3ReportFixture());
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    cycle.correlationValue = "018f0c5e-7b2a-7c4d-8e9f-0123456789ab";
    Object.assign(cyclicReport.readiness, { diagnostic: cycle });
    const blockers = validateSessionAcquisitionReport(cyclicReport).blockers;

    expect(blockers).toContain("report_not_serializable");
    expect(blockers).toContain("report_contains_uuid");
  });

  it("privacy hardening: returns a stable blocker for BigInt reports", () => {
    const bigintReport = cloneReport(schemaV3ReportFixture());
    Object.assign(bigintReport.readiness, { diagnostic: BigInt(1) });
    expect(validateSessionAcquisitionReport(bigintReport).blockers).toContain(
      "report_not_serializable",
    );
  });

  it.each(FORM_VIEW_TAMPER_CASES)(
    "legacy telemetry corrections: rejects form-view $label tampering",
    ({ layer, changes, blocker }) => {
      const report = schemaV3ReportFixture();
      expect(
        validateSessionAcquisitionReport(
          tamperFirstCoverage(report, layer, changes),
        ).blockers,
      ).toContain(blocker);
    },
  );

  it("privacy hardening: refuses a cyclic report before filesystem side effects", () => {
    const dir = mkdtempSync(join(tmpdir(), "session-funnel-cyclic-report-"));
    const outputPath = join(dir, "missing", "report.json");
    const report = schemaV3ReportFixture();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    Object.assign(report.readiness, { diagnostic: cycle });

    try {
      expect(() => writeSessionAcquisitionReportJson(outputPath, report)).toThrow(
        "Refusing to write invalid session acquisition report: report_not_serializable",
      );
      expect(existsSync(outputPath)).toBe(false);
      expect(existsSync(join(dir, "missing"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("schema v3 tamper: refuses invalid JSON before creating output directories", () => {
    const dir = mkdtempSync(join(tmpdir(), "session-funnel-invalid-report-"));
    const outputPath = join(dir, "missing", "report.json");
    const report = schemaV3ReportFixture();

    try {
      expect(() =>
        writeSessionAcquisitionReportJson(outputPath, {
          ...report,
          reportSchemaVersion: 2,
        } as unknown as typeof report),
      ).toThrow(
        "Refusing to write invalid session acquisition report: report_schema_version_invalid",
      );
      expect(existsSync(outputPath)).toBe(false);
      expect(existsSync(join(dir, "missing"))).toBe(false);
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
