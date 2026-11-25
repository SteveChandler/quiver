import {
  ALERT_EMAIL_GATE_SKIP_REASONS,
  alertEmailDaysEngagedByUser,
  decideAlertEmail,
} from "@/lib/alerts/email-gate";

const OPENED = "2026-11-20T15:00:00Z";

function input(overrides: Partial<Parameters<typeof decideAlertEmail>[0]> = {}) {
  return {
    ruleNotifyPush: true,
    profilePushEnabled: true,
    profileForecastAlertsPush: true,
    hasActiveDevice: true,
    recentAlertEmailDaysEngaged: [false, false, false],
    ...overrides,
  };
}

describe("decideAlertEmail", () => {
  it("skips the email when push will deliver the same alert", () => {
    expect(decideAlertEmail(input({ recentAlertEmailDaysEngaged: [true] }))).toEqual({
      send: false,
      reason: ALERT_EMAIL_GATE_SKIP_REASONS.pushDelivered,
    });
  });

  it("sends when there is no push and one of the last three was opened", () => {
    expect(
      decideAlertEmail(
        input({ hasActiveDevice: false, recentAlertEmailDaysEngaged: [false, false, true] }),
      ),
    ).toEqual({ send: true });
  });

  it("skips when there is no push and the last three were all unopened", () => {
    expect(
      decideAlertEmail(
        input({ hasActiveDevice: false, recentAlertEmailDaysEngaged: [false, false, false, true] }),
      ),
    ).toEqual({ send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.recentUnopened });
  });

  it("keeps a user with fewer than three prior alert emails eligible", () => {
    expect(
      decideAlertEmail(input({ hasActiveDevice: false, recentAlertEmailDaysEngaged: [false, false] })),
    ).toEqual({ send: true });
    expect(
      decideAlertEmail(input({ hasActiveDevice: false, recentAlertEmailDaysEngaged: [] })),
    ).toEqual({ send: true });
  });

  it("applies the open rule to an email-only rule for a push-capable user", () => {
    expect(
      decideAlertEmail(input({ ruleNotifyPush: false, recentAlertEmailDaysEngaged: [false, false, false] })),
    ).toEqual({ send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.recentUnopened });
    expect(
      decideAlertEmail(input({ ruleNotifyPush: false, recentAlertEmailDaysEngaged: [true, false, false] })),
    ).toEqual({ send: true });
  });

  it.each([
    ["push master off", { profilePushEnabled: false }],
    ["forecast alert push pref off", { profileForecastAlertsPush: false }],
    ["no active device", { hasActiveDevice: false }],
  ])("does not count push as delivered when %s", (_label, overrides) => {
    expect(
      decideAlertEmail(input({ ...overrides, recentAlertEmailDaysEngaged: [true] })),
    ).toEqual({ send: true });
  });

  it("treats a missing forecast alert pref as on, like the push worker", () => {
    expect(decideAlertEmail(input({ profileForecastAlertsPush: null }))).toEqual({
      send: false,
      reason: ALERT_EMAIL_GATE_SKIP_REASONS.pushDelivered,
    });
  });
});

describe("alertEmailDaysEngagedByUser", () => {
  function row(day: string, overrides: { opened_at?: string | null; clicked_at?: string | null; user_id?: string } = {}) {
    return { user_id: "u1", local_date: day, sent_at: `${day}T14:00:00Z`, opened_at: null, clicked_at: null, ...overrides };
  }

  it("counts three emails on one morning as one day", () => {
    const days = alertEmailDaysEngagedByUser([row("2026-11-20"), row("2026-11-20"), row("2026-11-20")]);
    expect(days.get("u1")).toEqual([false]);
  });

  it("counts a click as engagement when no open was recorded", () => {
    const days = alertEmailDaysEngagedByUser([
      row("2026-11-20"),
      row("2026-11-19", { clicked_at: OPENED }),
      row("2026-11-18"),
    ]);
    expect(days.get("u1")).toEqual([false, true, false]);
  });

  it("marks a day engaged when any email that day was opened, and keeps users apart", () => {
    const days = alertEmailDaysEngagedByUser([
      row("2026-11-20"),
      row("2026-11-20", { opened_at: OPENED }),
      row("2026-11-20", { user_id: "u2" }),
    ]);
    expect(days.get("u1")).toEqual([true]);
    expect(days.get("u2")).toEqual([false]);
  });
});
