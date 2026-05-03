export type AttemptStatus =
  | "sent"
  | "skipped_disabled"
  | "skipped_allowlist"
  | "skipped_cooldown"
  | "skipped_user_cap"
  | "skipped_no_device"
  | "skipped_no_email"
  | "skipped_channel_disabled"
  | "skipped_dedup_collision"
  | "failed_provider"
  | "failed_internal";

export type ThrottleDecision =
  | { ok: true }
  | { ok: false; status: AttemptStatus; reason: string };

export function cooldownDecision(args: {
  ruleId: string;
  now: Date;
  recentSentAttempts: Array<{ rule_id: string; attempted_at: Date }>;
  windowHours: number;
}): ThrottleDecision {
  const { ruleId, now, recentSentAttempts, windowHours } = args;
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const matched = recentSentAttempts.filter(
    (a) => a.rule_id === ruleId && a.attempted_at >= windowStart
  );
  if (matched.length === 0) return { ok: true };

  const mostRecent = matched.reduce((a, b) => (a.attempted_at > b.attempted_at ? a : b));
  const hoursAgo = Math.round((now.getTime() - mostRecent.attempted_at.getTime()) / (60 * 60 * 1000));
  return {
    ok: false,
    status: "skipped_cooldown",
    reason: `rule ${ruleId} last sent ${hoursAgo}h ago, within ${windowHours}h cooldown`,
  };
}

export function weeklyCapDecision(args: {
  userId: string;
  now: Date;
  recentSentAttempts: Array<{ user_id: string; attempted_at: Date }>;
  cap: number;
}): ThrottleDecision {
  const { userId, now, recentSentAttempts, cap } = args;
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const count = recentSentAttempts.filter(
    (a) => a.user_id === userId && a.attempted_at >= windowStart
  ).length;
  if (count < cap) return { ok: true };

  return {
    ok: false,
    status: "skipped_user_cap",
    reason: `user ${userId} has ${count} sent attempts in last 7d, cap is ${cap}`,
  };
}
