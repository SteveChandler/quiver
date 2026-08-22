export const ALERTS_DELIVERY_ENABLED_FLAG = "ALERTS_DELIVERY_ENABLED";

/**
 * Legacy similarity-alert send switch, also consulted by the condition-alert
 * deliver cron and surfaced to the rules API as `alertDeliveryPaused`.
 *
 * Unset means OFF. Read it through this helper rather than comparing the env
 * var inline: the three call sites had drifted into `=== "true"` in the crons
 * and `!== "true"` in the rules route, which agreed only by accident.
 */
export function isAlertsDeliveryEnabled(): boolean {
  return process.env[ALERTS_DELIVERY_ENABLED_FLAG] === "true";
}
