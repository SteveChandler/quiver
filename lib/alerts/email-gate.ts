const ALERT_EMAIL_RECENT_WINDOW = 3;
// Bounds the per-run read. A user cut by the open rule becomes eligible again
// once their unopened emails are older than this.
export const ALERT_EMAIL_HISTORY_DAYS = 180;

export const ALERT_EMAIL_GATE_SKIP_REASONS = {
  pushDelivered: "email_gate:push_delivered",
  recentUnopened: "email_gate:last_3_alert_email_days_unopened",
} as const;

type AlertEmailGateSkipReason =
  (typeof ALERT_EMAIL_GATE_SKIP_REASONS)[keyof typeof ALERT_EMAIL_GATE_SKIP_REASONS];

type AlertEmailGateDecision =
  | { send: true }
  | { send: false; reason: AlertEmailGateSkipReason };

interface AlertEmailGateInput {
  /** The alert rule has push on. */
  ruleNotifyPush: boolean;
  /** profiles.notif_push_enabled (the push branch master gate). */
  profilePushEnabled: boolean;
  /** profiles.notif_forecast_alerts; the push worker skips only on an explicit false. */
  profileForecastAlertsPush: boolean | null | undefined;
  /** The user has a user_devices row with retired_at null. */
  hasActiveDevice: boolean;
  /** One entry per day with a conditions_alert email, newest first: was any email that day opened or clicked. */
  recentAlertEmailDaysEngaged: ReadonlyArray<boolean>;
}

function pushWillAttemptDelivery(
  input: Pick<
    AlertEmailGateInput,
    | "ruleNotifyPush"
    | "profilePushEnabled"
    | "profileForecastAlertsPush"
    | "hasActiveDevice"
  >,
): boolean {
  return (
    input.ruleNotifyPush &&
    input.profilePushEnabled &&
    input.profileForecastAlertsPush !== false &&
    input.hasActiveDevice
  );
}

interface AlertEmailLogRow {
  user_id: string;
  local_date: string | null;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
}

/**
 * Rows must be newest first. Days, not emails: three beaches alerting on one
 * morning must not use up the whole window. A click counts because clients
 * that block images never record an open.
 */
export function alertEmailDaysEngagedByUser(
  rows: ReadonlyArray<AlertEmailLogRow>,
): Map<string, boolean[]> {
  const daysByUser = new Map<string, Map<string, boolean>>();
  for (const row of rows) {
    const day = row.local_date ?? row.sent_at.slice(0, 10);
    const days = daysByUser.get(row.user_id) ?? new Map<string, boolean>();
    const engaged = row.opened_at != null || row.clicked_at != null;
    days.set(day, (days.get(day) ?? false) || engaged);
    daysByUser.set(row.user_id, days);
  }
  return new Map(
    Array.from(daysByUser, ([userId, days]) => [userId, Array.from(days.values())]),
  );
}

export function decideAlertEmail(
  input: AlertEmailGateInput,
): AlertEmailGateDecision {
  if (pushWillAttemptDelivery(input)) {
    return { send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.pushDelivered };
  }

  const recent = input.recentAlertEmailDaysEngaged.slice(
    0,
    ALERT_EMAIL_RECENT_WINDOW,
  );
  // Too little history to judge engagement; keep the user eligible.
  if (recent.length < ALERT_EMAIL_RECENT_WINDOW) return { send: true };
  if (recent.some((engaged) => engaged)) return { send: true };
  return { send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.recentUnopened };
}
