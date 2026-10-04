import { getSwellAlertAllowlist } from "./swell-alert";

export const SWELL_FOLLOWUP_ENABLED_FLAG = "SWELL_FOLLOWUP_ENABLED";

export function isSwellFollowupEnabled(): boolean {
  return process.env[SWELL_FOLLOWUP_ENABLED_FLAG] === "true";
}

/** Shares SWELL_ALERT_USER_ALLOWLIST, but an empty list means nobody: follow-ups roll out by name. */
export function isSwellFollowupUserAllowed(userId: string): boolean {
  return getSwellAlertAllowlist().has(userId);
}
