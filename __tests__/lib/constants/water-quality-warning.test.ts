import { waterQualityWarning } from "@/lib/constants/water-quality";

describe("waterQualityWarning", () => {
  it("names a County general advisory as rain runoff", () => {
    const warning = waterQualityWarning("advisory", "general");
    expect(warning).toBe("County rain advisory — runoff after rain");
    expect(warning).not.toMatch(/elevated bacteria/);
  });

  it.each([undefined, "site"] as const)("keeps the sampled advisory wording (kind %s)", (kind) => {
    expect(waterQualityWarning("advisory", kind)).toBe("Water quality advisory — elevated bacteria levels");
  });

  it("uses the rainfall wording only where no County status exists", () => {
    expect(waterQualityWarning("advisory", undefined, true)).toBe("Rain runoff advisory — avoid storm drains and river mouths until 72 hours after rain stops");
    expect(waterQualityWarning("advisory", "general", true)).toMatch(/^County rain advisory/);
    expect(waterQualityWarning("advisory", "site", true)).toBe("Water quality advisory — elevated bacteria levels");
  });

  it("keeps the closure wording", () => {
    expect(waterQualityWarning("closure", "site")).toBe("Water quality closure — health advisory active");
  });

  it.each(["good", "unknown", undefined])("has no warning for %s", (status) => {
    expect(waterQualityWarning(status, undefined)).toBeNull();
  });
});
