import {
  isGarminWatchEnabled,
  isGarminWatchUserAllowed,
} from "@/lib/flags/garmin-watch";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("garmin watch flag", () => {
  it("allows nobody with an empty allowlist", () => {
    process.env.GARMIN_WATCH_ENABLED = "true";
    delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
    expect(isGarminWatchUserAllowed("surfer-1")).toBe(false);
    process.env.GARMIN_WATCH_USER_ALLOWLIST = " , ";
    expect(isGarminWatchUserAllowed("surfer-1")).toBe(false);
  });

  it("allows only listed IDs when enabled", () => {
    process.env.GARMIN_WATCH_ENABLED = "true";
    process.env.GARMIN_WATCH_USER_ALLOWLIST = "surfer-1, surfer-2";
    expect(isGarminWatchEnabled()).toBe(true);
    expect(isGarminWatchUserAllowed("surfer-2")).toBe(true);
    expect(isGarminWatchUserAllowed("surfer-3")).toBe(false);
  });

  it("allows nobody when the flag is off", () => {
    process.env.GARMIN_WATCH_ENABLED = "false";
    process.env.GARMIN_WATCH_USER_ALLOWLIST = "surfer-1";
    expect(isGarminWatchEnabled()).toBe(false);
    expect(isGarminWatchUserAllowed("surfer-1")).toBe(false);
  });
});
