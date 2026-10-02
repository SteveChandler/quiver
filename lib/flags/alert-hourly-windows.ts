export const ALERT_HOURLY_WINDOWS_ENABLED_FLAG = "ALERT_HOURLY_WINDOWS_ENABLED";
export const ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG = "ALERT_HOURLY_WINDOWS_USER_ALLOWLIST";

/** Match condition alerts on hourly rows (3-hourly forecast expanded, NOAA hourly tide). */
export function isAlertHourlyWindowsEnabledFor(userId: string): boolean {
  if (process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG] !== "true") return false;
  const allowlist = new Set(
    (process.env[ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return allowlist.size === 0 || allowlist.has(userId);
}
