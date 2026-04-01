import { getUserEntitlement, canCreateRule, CAPS } from "@/lib/alerts/entitlements";

describe("getUserEntitlement", () => {
  const origEnv = process.env.ALERT_PREVIEW_MODE;
  afterEach(() => { process.env.ALERT_PREVIEW_MODE = origEnv; });

  it("returns premium when preview mode is on", () => {
    process.env.ALERT_PREVIEW_MODE = "true";
    expect(getUserEntitlement("any-user")).toBe("premium");
  });

  it("returns free when preview mode is off", () => {
    process.env.ALERT_PREVIEW_MODE = "false";
    expect(getUserEntitlement("any-user")).toBe("free");
  });

  it("returns free when preview mode is undefined", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    expect(getUserEntitlement("any-user")).toBe("free");
  });
});

describe("canCreateRule", () => {
  it("allows free user on home beach within cap", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 2, existingBeachCount: 1, isExistingBeach: true, presetType: "mellow_session" });
    expect(result.allowed).toBe(true);
  });

  it("rejects free user on non-home beach", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-2", existingRuleCount: 0, existingBeachCount: 1, isExistingBeach: false, presetType: null });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("home beach");
  });

  it("rejects free user exceeding rule cap", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 3, existingBeachCount: 1, isExistingBeach: true, presetType: null });
    expect(result.allowed).toBe(false);
  });

  it("rejects free user using premium preset", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 0, existingBeachCount: 1, isExistingBeach: true, presetType: "glass_off" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("premium");
  });

  it("allows premium user on any beach within caps", () => {
    const result = canCreateRule({ tier: "premium", homeBeachId: "beach-1", targetBeachId: "beach-5", existingRuleCount: 10, existingBeachCount: 5, isExistingBeach: false, presetType: "epic_conditions" });
    expect(result.allowed).toBe(true);
  });

  it("rejects premium user exceeding beach cap with new beach", () => {
    const result = canCreateRule({ tier: "premium", homeBeachId: "beach-1", targetBeachId: "new-beach", existingRuleCount: 0, existingBeachCount: 10, isExistingBeach: false, presetType: null });
    expect(result.allowed).toBe(false);
  });

  it("allows premium user at beach cap on existing beach", () => {
    const result = canCreateRule({ tier: "premium", homeBeachId: "beach-1", targetBeachId: "beach-5", existingRuleCount: 10, existingBeachCount: 10, isExistingBeach: true, presetType: null });
    expect(result.allowed).toBe(true);
  });
});
