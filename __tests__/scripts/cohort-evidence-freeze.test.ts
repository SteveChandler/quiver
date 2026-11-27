import {
  assertCanWrite, buildCohortFreeze, classifyPlatform, isAndroidClosedTest, loadCohortFreezeInput, parseCliArgs,
  type CohortEvent, type CohortProfile,
} from "@/scripts/cohort-evidence-freeze";
import { readOnlySupabase } from "@/lib/analytics/report-guards";

const INTERNAL_ID = "610a5745-1fac-429c-8f5a-8d085783a5ea";

function profile(id: string, createdAt: string, extra: Partial<CohortProfile> = {}): CohortProfile {
  return {
    id, created_at: createdAt, home_beach_id: null, onboarding_completed_at: null, deleted_at: null,
    is_mock: false, is_system_account: false, analytics_is_real_user: true, analytics_exclusion_reason: null,
    ...extra,
  };
}

function event(userId: string, type: string, createdAt: string, metadata: Record<string, unknown> | null = null): CohortEvent {
  return { user_id: userId, event_type: type, created_at: createdAt, metadata };
}

describe("cohort evidence freeze aggregation", () => {
  // Sign-ups at 10:00 PT (18:00Z). As of 2026-10-30 00:00 PT.
  const asOf = "2026-10-30T07:00:00.000Z";
  const profiles = [
    profile("ios-user", "2026-10-01T18:00:00Z", { home_beach_id: 7, onboarding_completed_at: "2026-10-01T18:05:00Z" }),
    profile("web-user", "2026-10-02T18:00:00Z"),
    profile("app-user", "2026-10-25T18:00:00Z", { home_beach_id: 3 }),
    profile("mock-user", "2026-10-03T18:00:00Z", { is_mock: true }),
    profile(INTERNAL_ID, "2026-10-03T18:00:00Z"),
    profile("null-flag", "2026-10-28T18:00:00Z", { analytics_is_real_user: null }),
  ];
  const events = [
    event("ios-user", "native_app_first_open", "2026-10-01T17:50:00Z", { platform: "ios" }),
    event("ios-user", "decision_loop_completed", "2026-10-02T18:00:00Z"),
    event("ios-user", "paywall_opened", "2026-10-05T18:00:01Z"), // after 72 h
    event("ios-user", "home_viewed", "2026-10-03T18:00:00Z"), // LA day 2
    event("ios-user", "home_viewed", "2026-10-09T18:00:00Z"), // LA day 8
    event("web-user", "alert_sent", "2026-10-04T18:00:00Z", { source: "server" }), // server, not a return
    event("web-user", "page_view", "2026-10-10T18:00:00Z"), // LA day 8
    event("app-user", "tab_view", "2026-10-26T18:00:00Z"),
    event("mock-user", "home_viewed", "2026-10-04T18:00:00Z"),
  ];

  it("counts sign-ups, platform, maturity-gated returns and 72 h subgroups without ids", () => {
    const result = buildCohortFreeze({
      asOf, profiles, events,
      devices: [{ user_id: "ios-user", created_at: "2026-10-02T00:00:00Z" }, { user_id: "web-user", created_at: "2026-10-20T00:00:00Z" }],
      sessions: [{ user_id: "ios-user", created_at: "2026-10-20T00:00:00Z" }],
    });

    expect(result.signups).toBe(4);
    expect(result.homeBeachSet).toBe(2);
    expect(result.onboardingCompleted).toBe(1);
    expect(result.platform).toEqual({ ios: 1, android: 0, app_unknown: 1, web: 2 });
    expect(result.exclusions).toEqual({ total: 2, byReason: { mock_profile: 1, internal_account: 1 } });
    expect(result.stricterFlagRuleWouldDrop).toEqual({ analyticsIsRealUserNull: 1, analyticsExclusionReasonSet: 0 });
    // ios + web are 7- and 14-day mature; app-user (10-25) and null-flag (10-28) are not.
    expect(result.returnedDays1to6).toEqual({ numerator: 1, denominator: 2, rate: 0.5 });
    expect(result.returnedDays7to13).toEqual({ numerator: 2, denominator: 2, rate: 1 });
    expect(result.first72h.decision_loop_completed).toEqual({
      did: { numerator: 1, denominator: 3, rate: 0.3333 },
      returnedDays7to13: { numerator: 1, denominator: 1, rate: 1 },
    });
    expect(result.first72h.paywall_opened.did.numerator).toBe(0);
    expect(result.pushDeviceWithin72h).toEqual({ numerator: 1, denominator: 3, rate: 0.3333 });
    expect(result.sessionLoggedWithin30d).toEqual({ numerator: 0, denominator: 0, rate: null });
    expect(result.byPlatform.web.returnedDays1to6).toEqual({ numerator: 0, denominator: 1, rate: 0 });
    expect(JSON.stringify(result)).not.toMatch(/ios-user|web-user|app-user|null-flag/);
  });

  it("excludes Android closed-test sign-ups from November but keeps earlier Android users", () => {
    const result = buildCohortFreeze({
      asOf: "2026-11-27T08:00:00.000Z",
      profiles: [profile("tester", "2026-11-05T18:00:00Z"), profile("early", "2026-10-20T18:00:00Z")],
      events: [
        event("tester", "native_app_first_open", "2026-11-05T17:00:00Z", { platform: "android" }),
        event("early", "native_app_first_open", "2026-10-20T17:00:00Z", { platform: "android" }),
      ],
      devices: [], sessions: [],
    });
    expect(result.signups).toBe(1);
    expect(result.platform.android).toBe(1);
    expect(result.exclusions.byReason).toEqual({ android_closed_test: 1 });
  });

  it("classifies platform from first open, then app events, else web", () => {
    expect(classifyPlatform([event("u", "native_app_first_open", "2026-10-01T00:00:00Z", { platform: "android" })])).toBe("android");
    expect(classifyPlatform([event("u", "paywall_opened", "2026-10-01T00:00:00Z")])).toBe("app_unknown");
    expect(classifyPlatform([event("u", "page_view", "2026-10-01T00:00:00Z")])).toBe("web");
  });
});

describe("cohort evidence freeze runner", () => {
  it("defaults to the last full LA calendar month and the workspace output path", () => {
    const options = parseCliArgs([], new Date("2026-12-01T09:30:00Z"), () => "/ws");
    expect(options).toMatchObject({
      startDate: "2026-11-01", endDate: "2026-11-30",
      start: "2026-11-01T07:00:00.000Z", endExclusive: "2026-12-01T08:00:00.000Z",
      out: "/ws/.quiver/runs/cohort-freeze/2026-11.json",
    });
    expect(parseCliArgs(["--start", "2026-10-01", "--end", "2026-10-31", "--as-of", "2026-11-27", "--out", "x.json"],
      new Date(), () => "/ws")).toMatchObject({ endExclusive: "2026-11-01T07:00:00.000Z", asOf: "2026-11-27T08:00:00.000Z", out: "x.json" });
    expect(() => parseCliArgs(["--start", "2026-10-01"], new Date(), () => "/ws")).toThrow();
    expect(() => parseCliArgs(["--as-of", "2026-11-27T00:00:00"], new Date(), () => "/ws")).toThrow();
  });

  it("reads user_events per user chunk through the read-only client", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const builder: Record<string, jest.Mock> = {};
    for (const name of ["gte", "lt", "lte", "in", "is", "order"]) {
      builder[name] = jest.fn((...args: unknown[]) => { calls.push([name, args]); return builder; });
    }
    builder.range = jest.fn().mockResolvedValue({ data: [], error: null });
    const from = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(builder), insert: jest.fn() });
    const guarded = readOnlySupabase({ from });
    builder.range.mockResolvedValueOnce({ data: [profile("a", "2026-10-01T18:00:00Z")], error: null });
    await loadCohortFreezeInput(guarded, {
      startDate: "2026-10-01", endDate: "2026-10-31", start: "2026-10-01T07:00:00.000Z",
      endExclusive: "2026-11-01T07:00:00.000Z", asOf: "2026-11-27T08:00:00.000Z", out: "x.json", force: false,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["profiles", "user_events", "user_devices", "sessions"]);
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
    expect(calls).toContainEqual(["is", ["deleted_at", null]]);
    expect(() => (guarded.from("user_events") as unknown as { insert: (row: object) => unknown }).insert({}))
      .toThrow("read-only");
  });

  it("counts Android sign-ups after the closed test as real users", () => {
    expect(isAndroidClosedTest("android", "2026-11-27")).toBe(true);
    expect(isAndroidClosedTest("android", "2026-12-03")).toBe(false);
    expect(isAndroidClosedTest("ios", "2026-11-20")).toBe(false);
  });

  it("refuses to overwrite an earlier freeze unless --force is passed", () => {
    expect(() => assertCanWrite("/ws/2026-10.json", false, () => true)).toThrow("--force");
    expect(() => assertCanWrite("/ws/2026-10.json", true, () => true)).not.toThrow();
    expect(() => assertCanWrite("/ws/2026-11.json", false, () => false)).not.toThrow();
    expect(parseCliArgs(["--force"], new Date("2026-12-01T09:30:00Z"), () => "/ws").force).toBe(true);
  });
});
