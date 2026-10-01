import {
  ALERT_HOURLY_WINDOWS_ENABLED_FLAG,
  ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG,
  isAlertHourlyWindowsEnabledFor,
} from "@/lib/flags/alert-hourly-windows";

describe("isAlertHourlyWindowsEnabledFor", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it("is off when the flag is unset", () => {
    delete process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG];
    expect(isAlertHourlyWindowsEnabledFor("user-a")).toBe(false);
  });

  it("is on for everyone when enabled with an empty allowlist", () => {
    process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG] = "true";
    process.env[ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG] = "";
    expect(isAlertHourlyWindowsEnabledFor("user-a")).toBe(true);
  });

  it("is on only for allowlisted users when an allowlist is set", () => {
    process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG] = "true";
    process.env[ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG] = " user-a ,user-b";
    expect(isAlertHourlyWindowsEnabledFor("user-a")).toBe(true);
    expect(isAlertHourlyWindowsEnabledFor("user-c")).toBe(false);
  });
});
