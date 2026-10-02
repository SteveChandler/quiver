import {
  isSessionConditionsEnrichEnabled,
  SESSION_CONDITIONS_ENRICH_ENABLED_FLAG,
} from "@/lib/flags/session-conditions-enrich";

describe("isSessionConditionsEnrichEnabled", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it("is off unless the flag is exactly true", () => {
    delete process.env[SESSION_CONDITIONS_ENRICH_ENABLED_FLAG];
    expect(isSessionConditionsEnrichEnabled()).toBe(false);
    process.env[SESSION_CONDITIONS_ENRICH_ENABLED_FLAG] = "1";
    expect(isSessionConditionsEnrichEnabled()).toBe(false);
    process.env[SESSION_CONDITIONS_ENRICH_ENABLED_FLAG] = "true";
    expect(isSessionConditionsEnrichEnabled()).toBe(true);
  });
});
