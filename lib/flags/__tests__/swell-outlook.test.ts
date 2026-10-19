// lib/flags/__tests__/swell-outlook.test.ts
import {
  SWELL_OUTLOOK_ENABLED_FLAG,
  SWELL_OUTLOOK_USER_ALLOWLIST_FLAG,
  getSwellOutlookAllowlist,
  isSwellOutlookEnabled,
  isSwellOutlookUserAllowed,
} from "@/lib/flags/swell-outlook";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("swell outlook flags", () => {
  it("uses the contract env names", () => {
    expect(SWELL_OUTLOOK_ENABLED_FLAG).toBe("SWELL_OUTLOOK_ENABLED");
    expect(SWELL_OUTLOOK_USER_ALLOWLIST_FLAG).toBe("SWELL_OUTLOOK_USER_ALLOWLIST");
  });

  it("defaults off and enables only for exact true", () => {
    delete process.env[SWELL_OUTLOOK_ENABLED_FLAG];
    expect(isSwellOutlookEnabled()).toBe(false);
    process.env[SWELL_OUTLOOK_ENABLED_FLAG] = "TRUE";
    expect(isSwellOutlookEnabled()).toBe(false);
    process.env[SWELL_OUTLOOK_ENABLED_FLAG] = "true";
    expect(isSwellOutlookEnabled()).toBe(true);
  });

  it("allows nobody when the allowlist is empty or unset", () => {
    delete process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG];
    expect(isSwellOutlookUserAllowed("any-user")).toBe(false);
    process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG] = " , ";
    expect(isSwellOutlookUserAllowed("any-user")).toBe(false);
  });

  it("trims the allowlist and allows only listed users", () => {
    process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG] = "a, b ,,c";
    expect(getSwellOutlookAllowlist()).toEqual(new Set(["a", "b", "c"]));
    expect(isSwellOutlookUserAllowed("b")).toBe(true);
    expect(isSwellOutlookUserAllowed("d")).toBe(false);
  });
});
