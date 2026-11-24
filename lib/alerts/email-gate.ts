const ALERT_EMAIL_RECENT_WINDOW = 3;

export const ALERT_EMAIL_GATE_SKIP_REASONS = {
  pushDelivered: "email_gate:push_delivered",
  recentUnopened: "email_gate:last_3_alert_emails_unopened",
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
  /** opened_at of the user's conditions_alert emails, newest first. */
  recentAlertEmailOpenedAt: ReadonlyArray<string | null>;
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

export function decideAlertEmail(
  input: AlertEmailGateInput,
): AlertEmailGateDecision {
  if (pushWillAttemptDelivery(input)) {
    return { send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.pushDelivered };
  }

  const recent = input.recentAlertEmailOpenedAt.slice(
    0,
    ALERT_EMAIL_RECENT_WINDOW,
  );
  // Too little history to judge engagement; keep the user eligible.
  if (recent.length < ALERT_EMAIL_RECENT_WINDOW) return { send: true };
  if (recent.some((openedAt) => openedAt != null)) return { send: true };
  return { send: false, reason: ALERT_EMAIL_GATE_SKIP_REASONS.recentUnopened };
}
