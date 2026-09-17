import {
  DAILY_CALL_ENABLED_FLAG,
  DAILY_CALL_USER_ALLOWLIST_FLAG,
  getDailyCallAllowlist,
  isDailyCallEnabled,
  isDailyCallUserAllowed,
} from "@/lib/flags/daily-call";
import {
  SWELL_ALERT_ENABLED_FLAG,
  SWELL_ALERT_USER_ALLOWLIST_FLAG,
  getSwellAlertAllowlist,
  isSwellAlertEnabled,
  isSwellAlertUserAllowed,
} from "@/lib/flags/swell-alert";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe.each([
  {
    name: "daily call",
    enabledFlag: DAILY_CALL_ENABLED_FLAG,
    allowlistFlag: DAILY_CALL_USER_ALLOWLIST_FLAG,
    isEnabled: isDailyCallEnabled,
    getAllowlist: getDailyCallAllowlist,
    isUserAllowed: isDailyCallUserAllowed,
  },
  {
    name: "swell alert",
    enabledFlag: SWELL_ALERT_ENABLED_FLAG,
    allowlistFlag: SWELL_ALERT_USER_ALLOWLIST_FLAG,
    isEnabled: isSwellAlertEnabled,
    getAllowlist: getSwellAlertAllowlist,
    isUserAllowed: isSwellAlertUserAllowed,
  },
])("$name flags", ({
  enabledFlag,
  allowlistFlag,
  isEnabled,
  getAllowlist,
  isUserAllowed,
}) => {
  it("defaults off and enables only for exact true", () => {
    delete process.env[enabledFlag];
    expect(isEnabled()).toBe(false);

    process.env[enabledFlag] = "TRUE";
    expect(isEnabled()).toBe(false);

    process.env[enabledFlag] = "true";
    expect(isEnabled()).toBe(true);
  });

  it("trims and removes empty allowlist entries", () => {
    process.env[allowlistFlag] = "a, b ,,c";

    expect(getAllowlist()).toEqual(new Set(["a", "b", "c"]));
  });

  it("allows every user when the allowlist is empty", () => {
    process.env[allowlistFlag] = "";

    expect(isUserAllowed("any-user")).toBe(true);
  });

  it("rejects users missing from a non-empty allowlist", () => {
    process.env[allowlistFlag] = "allowed-user";

    expect(isUserAllowed("absent-user")).toBe(false);
  });
});
