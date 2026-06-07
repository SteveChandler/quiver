import {
  assertNoPiiInWeeklyActivationPollOutput,
  buildWeeklyActivationPollOutput,
} from "@/lib/analytics/weekly-activation-poll";

describe("weekly activation poll output", () => {
  it("emits PII-free activation metrics and PostHog reconciliation status", () => {
    const output = buildWeeklyActivationPollOutput({
      generatedAt: "2026-06-04T12:00:00.000Z",
      dateRange: {
        from: "2026-05-28T12:00:00.000Z",
        to: "2026-06-04T12:00:00.000Z",
      },
      profiles: [
        {
          id: "real-1",
          email: "surfer@example.com",
          is_mock: false,
          analytics_is_real_user: true,
          analytics_exclusion_reason: null,
          created_at: "2026-06-02T12:00:00.000Z",
          home_beach_id: "beach-1",
          onboarding_completed_at: "2026-06-02T12:10:00.000Z",
          experience_level: "intermediate",
          surf_styles: ["longboard"],
        },
        {
          id: "test-1",
          email: "qa-test@local.test",
          is_mock: false,
          analytics_is_real_user: false,
          analytics_exclusion_reason: "local_test_email",
          created_at: "2026-06-02T12:00:00.000Z",
          home_beach_id: "beach-2",
          onboarding_completed_at: "2026-06-02T12:10:00.000Z",
          experience_level: "beginner",
          surf_styles: ["shortboard"],
        },
        {
          id: "real-2",
          email: null,
          is_mock: false,
          analytics_is_real_user: true,
          analytics_exclusion_reason: null,
          created_at: "2026-05-01T12:00:00.000Z",
          home_beach_id: null,
          onboarding_completed_at: null,
          experience_level: null,
          surf_styles: [],
        },
      ],
      sessions: [
        { id: "session-1", user_id: "real-1", created_at: "2026-06-03T12:00:00.000Z", deleted_at: null },
      ],
      boards: [
        { id: "board-1", user_id: "real-1", created_at: "2026-06-03T13:00:00.000Z" },
      ],
      events: [
        {
          event_type: "onboarding_video_started",
          user_id: null,
          session_id: "launch-1",
          created_at: "2026-06-02T12:00:00.000Z",
          bot_flagged: false,
          metadata: { _platform: "native-ios", is_emulator: false },
        },
        {
          event_type: "board_form_saved",
          user_id: "real-1",
          session_id: null,
          created_at: "2026-06-03T13:01:00.000Z",
          bot_flagged: false,
          metadata: { _platform: "native-ios", selected_board_type: "longboard" },
        },
        {
          event_type: "page_view",
          user_id: null,
          session_id: "bot-1",
          created_at: "2026-06-03T14:00:00.000Z",
          bot_flagged: true,
          metadata: {},
        },
      ],
      posthogRealUserProfileCount: 3,
      missingSources: ["direct Supabase MCP execute_sql"],
    });

    expect(output.realUsers.total).toBe(2);
    expect(output.weeklyCohort.newUsers).toBe(1);
    expect(output.adoption.sessions.distinctUsersInWindow).toBe(1);
    expect(output.events.onboardingVideo.started.count).toBe(1);
    expect(output.events.boardManagement.boardFormSaved.count).toBe(1);
    expect(output.events.botFlagged.count).toBe(1);
    expect(output.reconciliation.status).toBe("mismatch");
    expect(output.reconciliation.supabaseRealUsers).toBe(2);
    expect(output.reconciliation.posthogRealUsers).toBe(3);
    expect(JSON.stringify(output)).not.toContain("surfer@example.com");
    expect(JSON.stringify(output)).not.toContain("qa-test@local.test");
    expect(() => assertNoPiiInWeeklyActivationPollOutput(output)).not.toThrow();
  });
});
