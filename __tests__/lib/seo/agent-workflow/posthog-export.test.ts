import {
  buildPostHogExport,
  parsePostHogNativeRows,
  parsePostHogWebRows,
  toPostHogSeoPages,
} from "@/lib/seo/agent-workflow/posthog-export";

describe("SEO workflow PostHog export", () => {
  it("maps HogQL web and native rows into report input", () => {
    const webRows = parsePostHogWebRows({
      results: [["/beginner/san-diego", 100, 0.2, 0.08, 0.01]],
    });
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

    expect(toPostHogSeoPages(exportInput)[0]?.signupRate).toBe(0.08);
    expect(exportInput.nativeFunnels).toEqual([
      { platform: "native-android", events: { onboarding_completed: 2 } },
      {
        platform: "native-ios",
        events: { onboarding_completed: 10, session_log_submit: 4 },
      },
    ]);
  });
});
