const GARMIN_WATCH_ENABLED_FLAG = "GARMIN_WATCH_ENABLED";
const GARMIN_WATCH_USER_ALLOWLIST_FLAG = "GARMIN_WATCH_USER_ALLOWLIST";

export function isGarminWatchEnabled(): boolean {
  return process.env[GARMIN_WATCH_ENABLED_FLAG] === "true";
}

export function isGarminWatchUserAllowed(userId: string): boolean {
  if (!isGarminWatchEnabled()) return false;

  return (process.env[GARMIN_WATCH_USER_ALLOWLIST_FLAG] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}
