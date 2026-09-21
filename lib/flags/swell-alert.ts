export const SWELL_ALERT_ENABLED_FLAG = "SWELL_ALERT_ENABLED";
export const SWELL_ALERT_USER_ALLOWLIST_FLAG = "SWELL_ALERT_USER_ALLOWLIST";

export function isSwellAlertEnabled(): boolean {
  return process.env[SWELL_ALERT_ENABLED_FLAG] === "true";
}

export function getSwellAlertAllowlist(): Set<string> {
  return new Set(
    (process.env[SWELL_ALERT_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export function isSwellAlertUserAllowed(userId: string): boolean {
  const allowlist = getSwellAlertAllowlist();
  return allowlist.size === 0 || allowlist.has(userId);
}
