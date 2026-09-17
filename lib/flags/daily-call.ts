export const DAILY_CALL_ENABLED_FLAG = "DAILY_CALL_ENABLED";
export const DAILY_CALL_USER_ALLOWLIST_FLAG = "DAILY_CALL_USER_ALLOWLIST";

export function isDailyCallEnabled(): boolean {
  return process.env[DAILY_CALL_ENABLED_FLAG] === "true";
}

export function getDailyCallAllowlist(): Set<string> {
  return new Set(
    (process.env[DAILY_CALL_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export function isDailyCallUserAllowed(userId: string): boolean {
  const allowlist = getDailyCallAllowlist();
  return allowlist.size === 0 || allowlist.has(userId);
}
