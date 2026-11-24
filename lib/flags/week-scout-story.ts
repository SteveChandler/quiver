export const WEEK_SCOUT_STORY_ENABLED_FLAG = "WEEK_SCOUT_STORY_ENABLED";
export const WEEK_SCOUT_STORY_USER_ALLOWLIST_FLAG = "WEEK_SCOUT_STORY_USER_ALLOWLIST";

export function isWeekScoutStoryEnabled(): boolean {
  return process.env[WEEK_SCOUT_STORY_ENABLED_FLAG] === "true";
}

export function getWeekScoutStoryAllowlist(): Set<string> {
  return new Set(
    (process.env[WEEK_SCOUT_STORY_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

/**
 * Who may read the PC worker's written sentences (Week Scout story and swell card lines).
 * An empty allowlist lets everyone; a set one lets only those users, never a signed-out visitor.
 */
export function isWeekScoutStoryUserAllowed(userId: string | null | undefined): boolean {
  const allowlist = getWeekScoutStoryAllowlist();
  if (allowlist.size === 0) return true;
  return typeof userId === "string" && allowlist.has(userId);
}

/** Uses the same Bearer contract as the briefing worker, with a regional-only credential. */
export function getWeekScoutStoryPublisherToken(): string | null {
  const token = process.env.WEEK_SCOUT_STORY_PUBLISHER_TOKEN?.trim();
  return token && token.length >= 32 ? token : null;
}
