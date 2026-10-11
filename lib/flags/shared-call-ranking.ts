export const CALL_SHARED_RANKING_ENABLED_FLAG = "CALL_SHARED_RANKING_ENABLED";
export const CALL_SHARED_RANKING_USER_ALLOWLIST_FLAG = "CALL_SHARED_RANKING_USER_ALLOWLIST";

export function isSharedCallRankingEnabled(): boolean {
  return process.env[CALL_SHARED_RANKING_ENABLED_FLAG] === "true";
}

function getSharedCallRankingAllowlist(): Set<string> {
  return new Set(
    (process.env[CALL_SHARED_RANKING_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export function isSharedCallRankingUserAllowed(userId: string): boolean {
  const allowlist = getSharedCallRankingAllowlist();
  return allowlist.size === 0 || allowlist.has(userId);
}
