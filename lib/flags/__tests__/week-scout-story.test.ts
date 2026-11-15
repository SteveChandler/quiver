import {
  WEEK_SCOUT_STORY_ENABLED_FLAG,
  WEEK_SCOUT_STORY_USER_ALLOWLIST_FLAG,
  getWeekScoutStoryAllowlist,
  isWeekScoutStoryEnabled,
  isWeekScoutStoryUserAllowed,
} from "@/lib/flags/week-scout-story";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("week scout story flags", () => {
  it("uses the contract env names", () => {
    expect(WEEK_SCOUT_STORY_ENABLED_FLAG).toBe("WEEK_SCOUT_STORY_ENABLED");
    expect(WEEK_SCOUT_STORY_USER_ALLOWLIST_FLAG).toBe("WEEK_SCOUT_STORY_USER_ALLOWLIST");
  });

  it("enables only for exact true", () => {
    delete process.env[WEEK_SCOUT_STORY_ENABLED_FLAG];
    expect(isWeekScoutStoryEnabled()).toBe(false);
    process.env[WEEK_SCOUT_STORY_ENABLED_FLAG] = "TRUE";
    expect(isWeekScoutStoryEnabled()).toBe(false);
    process.env[WEEK_SCOUT_STORY_ENABLED_FLAG] = "true";
    expect(isWeekScoutStoryEnabled()).toBe(true);
  });

  it("lets everyone, signed out included, when the allowlist is unset or empty", () => {
    delete process.env[WEEK_SCOUT_STORY_USER_ALLOWLIST_FLAG];
    expect(isWeekScoutStoryUserAllowed("any-user")).toBe(true);
    expect(isWeekScoutStoryUserAllowed(null)).toBe(true);
    process.env[WEEK_SCOUT_STORY_USER_ALLOWLIST_FLAG] = " , ";
    expect(isWeekScoutStoryUserAllowed(undefined)).toBe(true);
  });

  it("trims a set allowlist and lets only its users, never a signed-out visitor", () => {
    process.env[WEEK_SCOUT_STORY_USER_ALLOWLIST_FLAG] = "a, b ,,c";
    expect(getWeekScoutStoryAllowlist()).toEqual(new Set(["a", "b", "c"]));
    expect(isWeekScoutStoryUserAllowed("b")).toBe(true);
    expect(isWeekScoutStoryUserAllowed("d")).toBe(false);
    expect(isWeekScoutStoryUserAllowed(null)).toBe(false);
    expect(isWeekScoutStoryUserAllowed(undefined)).toBe(false);
  });
});
