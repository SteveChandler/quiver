import { cooldownDecision, weeklyCapDecision } from "@/lib/alerts/throttle";

const RULE_ID = "rule-1";
const OTHER_RULE_ID = "rule-2";
const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

const NOW = new Date("2026-04-25T12:00:00Z");

function ago(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

describe("cooldownDecision", () => {

  it("returns ok when no prior sent attempts exist", () => {
    expect(
      cooldownDecision({ ruleId: RULE_ID, now: NOW, recentSentAttempts: [], windowHours: 24 })
    ).toEqual({ ok: true });
  });

  it("returns ok when prior attempts are for other rules", () => {
    expect(
      cooldownDecision({
        ruleId: RULE_ID,
        now: NOW,
        recentSentAttempts: [{ rule_id: OTHER_RULE_ID, attempted_at: ago(1) }],
        windowHours: 24,
      })
    ).toEqual({ ok: true });
  });

  it("returns skip when most recent sent attempt is inside the window", () => {
    const result = cooldownDecision({
      ruleId: RULE_ID,
      now: NOW,
      recentSentAttempts: [{ rule_id: RULE_ID, attempted_at: ago(12) }],
      windowHours: 24,
    });
    expect(result).toEqual({
      ok: false,
      status: "skipped_cooldown",
      reason: expect.stringContaining("12"),
    });
  });

  it("returns ok when most recent sent attempt is just outside the window", () => {
    const result = cooldownDecision({
      ruleId: RULE_ID,
      now: NOW,
      recentSentAttempts: [{ rule_id: RULE_ID, attempted_at: ago(24.5) }],
      windowHours: 24,
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("weeklyCapDecision", () => {
  it("returns ok with zero attempts", () => {
    expect(
      weeklyCapDecision({ userId: USER_ID, now: NOW, recentSentAttempts: [], cap: 10 })
    ).toEqual({ ok: true });
  });

  it("ignores other users' attempts", () => {
    const attempts = Array.from({ length: 20 }, () => ({
      user_id: OTHER_USER_ID,
      attempted_at: ago(1),
    }));
    expect(
      weeklyCapDecision({ userId: USER_ID, now: NOW, recentSentAttempts: attempts, cap: 10 })
    ).toEqual({ ok: true });
  });

  it("returns skip when this user's sent attempts in the last 7d reach the cap", () => {
    const attempts = Array.from({ length: 10 }, (_, i) => ({
      user_id: USER_ID,
      attempted_at: ago(i + 1),
    }));
    const result = weeklyCapDecision({ userId: USER_ID, now: NOW, recentSentAttempts: attempts, cap: 10 });
    expect(result).toEqual({
      ok: false,
      status: "skipped_user_cap",
      reason: expect.stringContaining("10"),
    });
  });

  it("ignores attempts older than 7d", () => {
    const attempts = Array.from({ length: 20 }, () => ({
      user_id: USER_ID,
      attempted_at: ago(8 * 24), // 8 days ago
    }));
    expect(
      weeklyCapDecision({ userId: USER_ID, now: NOW, recentSentAttempts: attempts, cap: 10 })
    ).toEqual({ ok: true });
  });
});
