import {
  buildPostHogExport,
  computePostHogWebRows,
  parsePostHogWebEvents,
  parsePostHogNativeRows,
  toPostHogSeoPages,
} from "@/lib/seo/agent-workflow/posthog-export";

describe("SEO workflow PostHog export", () => {
  it("maps HogQL web and native rows into report input", () => {
    const webRows = computePostHogWebRows(parsePostHogWebEvents({
      results: [
        ["page_view", "2026-05-20T10:00:00Z", "s1", "/beginner/san-diego"],
        ["page_view", "2026-05-20T10:01:00Z", "s1", "/map"],
        ["signup_success", "2026-05-20T10:02:00Z", "s1", "/map"],
      ],
    }));
    const nativeRows = parsePostHogNativeRows({
      results: [
        ["native-ios", "onboarding_completed", 10],
        ["native-ios", "session_log_submit", 4],
        ["native-android", "onboarding_completed", 2],
      ],
    });

    const exportInput = buildPostHogExport(
      webRows,
      nativeRows,
      "2026-05-20T12:00:00Z",
      { from: "2026-05-13", to: "2026-05-20" },
    );

    expect(exportInput.nativeFunnels).toEqual([
      { platform: "native-android", events: { onboarding_completed: 2 } },
      {
        platform: "native-ios",
        events: { onboarding_completed: 10, session_log_submit: 4 },
      },
    ]);
    expect(exportInput.pages[0]).toEqual({
      path: "/beginner/san-diego",
      landingSessions: 1,
      multiPageRate: 1,
      landingSignupRate: 1,
      assistedSignupRate: 1,
      topNextPaths: [{ path: "/map", count: 1 }],
      topExitPaths: [{ path: "/map", count: 1 }],
    });
  });

  it("computes a deduped session funnel from ordered page_view events", () => {
    const webRows = computePostHogWebRows(parsePostHogWebEvents({
      results: [
        ["page_view", "2026-05-20T10:00:00Z", "s1", "/beginner/san-diego"],
        ["page_view", "2026-05-20T10:01:00Z", "s1", "/map"],
        ["signup_success", "2026-05-20T10:02:00Z", "s1", "/map"],
        ["page_view", "2026-05-20T11:00:00Z", "s2", "/beginner/san-diego"],
        ["page_view", "2026-05-20T11:01:00Z", "s2", "/beginner/san-diego"],
        ["page_view", "2026-05-20T12:00:00Z", "s3", "/water-temp/playa-del-rey"],
        ["signup_success", "2026-05-20T12:01:00Z", "s3", "/water-temp/playa-del-rey"],
        ["$pageview", "2026-05-20T13:00:00Z", "s4", null],
      ],
    }));

    expect(webRows).toEqual([
      {
        path: "/beginner/san-diego",
        landingSessions: 2,
        multiPageRate: 0.5,
        landingSignupRate: 0.5,
        assistedSignupRate: 0.5,
        topNextPaths: [{ path: "/map", count: 1 }],
        topExitPaths: [
          { path: "/beginner/san-diego", count: 1 },
          { path: "/map", count: 1 },
        ],
      },
      {
        path: "/water-temp/playa-del-rey",
        landingSessions: 1,
        multiPageRate: 0,
        landingSignupRate: 1,
        assistedSignupRate: 1,
        topNextPaths: [],
        topExitPaths: [{ path: "/water-temp/playa-del-rey", count: 1 }],
      },
    ]);
  });

  it("converts computed web rows into the export schema", () => {
    const exportInput = buildPostHogExport(
      [
        {
          path: "/beginner/san-diego",
          landingSessions: 100,
          multiPageRate: 0.2,
          landingSignupRate: 0.08,
          assistedSignupRate: 0.12,
          topNextPaths: [{ path: "/map", count: 20 }],
          topExitPaths: [{ path: "/beginner/san-diego", count: 80 }],
        },
      ],
      [],
      "2026-05-20T12:00:00Z",
      { from: "2026-05-13", to: "2026-05-20" },
    );

    expect(toPostHogSeoPages(exportInput)[0]).toEqual({
      path: "/beginner/san-diego",
      landingSessions: 100,
      multiPageRate: 0.2,
      landingSignupRate: 0.08,
      assistedSignupRate: 0.12,
      topNextPaths: [{ path: "/map", count: 20 }],
      topExitPaths: [{ path: "/beginner/san-diego", count: 80 }],
    });
  });

  it("ignores sessions that only have native PostHog pageviews", () => {
    const webRows = computePostHogWebRows(parsePostHogWebEvents({
      results: [
        ["$pageview", "2026-05-20T13:00:00Z", "s1", null],
        ["signup_success", "2026-05-20T13:00:05Z", "s1", "/beginner/san-diego"],
      ],
    }));

    expect(webRows).toEqual([]);
  });

  it("preserves native funnel grouping", () => {
    const exportInput = buildPostHogExport([], nativeRowsFixture(), "2026-05-20T12:00:00Z", {
      from: "2026-05-13",
      to: "2026-05-20",
    });

    expect(exportInput.nativeFunnels).toEqual([
      { platform: "native-android", events: { onboarding_completed: 2 } },
      {
        platform: "native-ios",
        events: { onboarding_completed: 10, session_log_submit: 4 },
      },
    ]);
  });
});

function nativeRowsFixture() {
  return parsePostHogNativeRows({
    results: [
      ["native-ios", "onboarding_completed", 10],
      ["native-ios", "session_log_submit", 4],
      ["native-android", "onboarding_completed", 2],
    ],
  });
}
