export function isWeekScoutStoryEnabled(): boolean {
  return process.env.WEEK_SCOUT_STORY_ENABLED === "true";
}

/** Uses the same Bearer contract as the briefing worker, with a regional-only credential. */
export function getWeekScoutStoryPublisherToken(): string | null {
  const token = process.env.WEEK_SCOUT_STORY_PUBLISHER_TOKEN?.trim();
  return token && token.length >= 32 ? token : null;
}
