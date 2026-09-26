import {
  WEEK_SCOUT_SWELLS_ENABLED_FLAG,
  WEEK_SCOUT_SWELLS_USER_ALLOWLIST_FLAG,
  getWeekScoutSwellsAllowlist,
  isWeekScoutSwellsEnabled,
  isWeekScoutSwellsUserAllowed,
} from "@/lib/flags/week-scout-swells";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("week scout swells flags", () => {
  it("uses the contract env names", () => {
    expect(WEEK_SCOUT_SWELLS_ENABLED_FLAG).toBe("WEEK_SCOUT_SWELLS_ENABLED");
    expect(WEEK_SCOUT_SWELLS_USER_ALLOWLIST_FLAG).toBe("WEEK_SCOUT_SWELLS_USER_ALLOWLIST");
  });

  it("defaults off and enables only for exact true", () => {
    delete process.env[WEEK_SCOUT_SWELLS_ENABLED_FLAG];
    expect(isWeekScoutSwellsEnabled()).toBe(false);

    process.env[WEEK_SCOUT_SWELLS_ENABLED_FLAG] = "TRUE";
    expect(isWeekScoutSwellsEnabled()).toBe(false);

    process.env[WEEK_SCOUT_SWELLS_ENABLED_FLAG] = "true";
    expect(isWeekScoutSwellsEnabled()).toBe(true);
  });

  it("trims the allowlist and treats empty as everyone", () => {
    process.env[WEEK_SCOUT_SWELLS_USER_ALLOWLIST_FLAG] = "a, b ,,c";
    expect(getWeekScoutSwellsAllowlist()).toEqual(new Set(["a", "b", "c"]));
    expect(isWeekScoutSwellsUserAllowed("b")).toBe(true);
    expect(isWeekScoutSwellsUserAllowed("d")).toBe(false);

    process.env[WEEK_SCOUT_SWELLS_USER_ALLOWLIST_FLAG] = "";
    expect(isWeekScoutSwellsUserAllowed("any-user")).toBe(true);
  });
});
