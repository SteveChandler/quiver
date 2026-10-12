import { waterQualityWarning } from "@/lib/constants/water-quality";

describe("waterQualityWarning", () => {
  it("names a County general advisory as rain runoff", () => {
    const warning = waterQualityWarning("advisory", "general");
    expect(warning).toMatch(/rain/i);
    expect(warning).toMatch(/storm drains and river mouths/);
    expect(warning).toMatch(/72 hours/);
    expect(warning).not.toMatch(/elevated bacteria/);
  });

  it.each([undefined, "site"] as const)("keeps the sampled advisory wording (kind %s)", (kind) => {
    expect(waterQualityWarning("advisory", kind)).toBe("Water quality advisory — elevated bacteria levels");
  });

  it("keeps the closure wording", () => {
    expect(waterQualityWarning("closure", "site")).toBe("Water quality closure — health advisory active");
  });

  it.each(["good", "unknown", undefined])("has no warning for %s", (status) => {
    expect(waterQualityWarning(status, undefined)).toBeNull();
  });
});
