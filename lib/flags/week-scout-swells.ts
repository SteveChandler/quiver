export const WEEK_SCOUT_SWELLS_ENABLED_FLAG = "WEEK_SCOUT_SWELLS_ENABLED";
export const WEEK_SCOUT_SWELLS_USER_ALLOWLIST_FLAG = "WEEK_SCOUT_SWELLS_USER_ALLOWLIST";

export function isWeekScoutSwellsEnabled(): boolean {
  return process.env[WEEK_SCOUT_SWELLS_ENABLED_FLAG] === "true";
}

export function getWeekScoutSwellsAllowlist(): Set<string> {
  return new Set(
    (process.env[WEEK_SCOUT_SWELLS_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export function isWeekScoutSwellsUserAllowed(userId: string): boolean {
  const allowlist = getWeekScoutSwellsAllowlist();
  return allowlist.size === 0 || allowlist.has(userId);
}
