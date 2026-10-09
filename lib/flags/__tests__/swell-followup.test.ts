import { SWELL_ALERT_USER_ALLOWLIST_FLAG, isSwellAlertUserAllowed } from "@/lib/flags/swell-alert";
import {
  SWELL_FOLLOWUP_ENABLED_FLAG,
  isSwellFollowupEnabled,
  isSwellFollowupUserAllowed,
} from "@/lib/flags/swell-followup";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("swell follow-up flags", () => {
  it("uses the contract env name", () => {
    expect(SWELL_FOLLOWUP_ENABLED_FLAG).toBe("SWELL_FOLLOWUP_ENABLED");
  });

  it("defaults off and enables only for exact true", () => {
    delete process.env[SWELL_FOLLOWUP_ENABLED_FLAG];
    expect(isSwellFollowupEnabled()).toBe(false);

    process.env[SWELL_FOLLOWUP_ENABLED_FLAG] = "TRUE";
    expect(isSwellFollowupEnabled()).toBe(false);

    process.env[SWELL_FOLLOWUP_ENABLED_FLAG] = "1";
    expect(isSwellFollowupEnabled()).toBe(false);

    process.env[SWELL_FOLLOWUP_ENABLED_FLAG] = "true";
    expect(isSwellFollowupEnabled()).toBe(true);
  });

  it("reads the swell alert allowlist", () => {
    process.env[SWELL_ALERT_USER_ALLOWLIST_FLAG] = "a, b ,,c";
    expect(isSwellFollowupUserAllowed("b")).toBe(true);
    expect(isSwellFollowupUserAllowed("d")).toBe(false);
  });

  it("treats an empty allowlist as nobody, unlike first alerts", () => {
    for (const value of [undefined, "", " , "]) {
      if (value === undefined) delete process.env[SWELL_ALERT_USER_ALLOWLIST_FLAG];
      else process.env[SWELL_ALERT_USER_ALLOWLIST_FLAG] = value;
      expect(isSwellFollowupUserAllowed("any-user")).toBe(false);
      expect(isSwellAlertUserAllowed("any-user")).toBe(true);
    }
  });
});
