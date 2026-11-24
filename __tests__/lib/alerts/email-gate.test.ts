import {
  ALERT_EMAIL_GATE_SKIP_REASONS,
  decideAlertEmail,
} from "@/lib/alerts/email-gate";

const OPENED = "2026-11-20T15:00:00Z";

function input(overrides: Partial<Parameters<typeof decideAlertEmail>[0]> = {}) {
  return {
    ruleNotifyPush: true,
    profilePushEnabled: true,
    profileForecastAlertsPush: true,
    hasActiveDevice: true,
    recentAlertEmailOpenedAt: [null, null, null],
    ...overrides,
  };
}

describe("decideAlertEmail", () => {
  it("skips the email when push will deliver the same alert", () => {
    expect(decideAlertEmail(input({ recentAlertEmailOpenedAt: [OPENED] }))).toEqual({
      send: false,
      reason: ALERT_EMAIL_GATE_SKIP_REASONS.pushDelivered,
    });
  });

  it("sends when there is no push and one of the last three was opened", () => {
    expect(
      decideAlertEmail(
        input({ hasActiveDevice: false, recentAlertEmailOpenedAt: [null, null, OPENED] }),
      ),
    ).toEqual({ send: true });
  });

  it("skips when there is no push and the last three were all unopened", () => {
    expect(
      decideAlertEmail(
        input({ hasActiveDevice: false, recentAlertEmailOpenedAt: [null, null, null, OPENED] }),
      ),
    ).toEqual({ send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.recentUnopened });
  });

  it("keeps a user with fewer than three prior alert emails eligible", () => {
    expect(
      decideAlertEmail(input({ hasActiveDevice: false, recentAlertEmailOpenedAt: [null, null] })),
    ).toEqual({ send: true });
    expect(
      decideAlertEmail(input({ hasActiveDevice: false, recentAlertEmailOpenedAt: [] })),
    ).toEqual({ send: true });
  });

  it("applies the open rule to an email-only rule for a push-capable user", () => {
    expect(
      decideAlertEmail(input({ ruleNotifyPush: false, recentAlertEmailOpenedAt: [null, null, null] })),
    ).toEqual({ send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.recentUnopened });
    expect(
      decideAlertEmail(input({ ruleNotifyPush: false, recentAlertEmailOpenedAt: [OPENED, null, null] })),
    ).toEqual({ send: true });
  });

  it.each([
    ["push master off", { profilePushEnabled: false }],
    ["forecast alert push pref off", { profileForecastAlertsPush: false }],
    ["no active device", { hasActiveDevice: false }],
  ])("does not count push as delivered when %s", (_label, overrides) => {
    expect(
      decideAlertEmail(input({ ...overrides, recentAlertEmailOpenedAt: [OPENED] })),
    ).toEqual({ send: true });
  });

  it("treats a missing forecast alert pref as on, like the push worker", () => {
    expect(decideAlertEmail(input({ profileForecastAlertsPush: null }))).toEqual({
      send: false,
      reason: ALERT_EMAIL_GATE_SKIP_REASONS.pushDelivered,
    });
  });
});
