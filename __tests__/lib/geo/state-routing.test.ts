import { getStateDisplayNameFromSlug } from "@/lib/geo/state-routing";

describe("state-routing", () => {
  describe("getStateDisplayNameFromSlug", () => {
    it("returns a friendly state name for known state slugs", () => {
      expect(getStateDisplayNameFromSlug("sc")).toBe("South Carolina");
      expect(getStateDisplayNameFromSlug("pr")).toBe("Puerto Rico");
      expect(getStateDisplayNameFromSlug("ca")).toBe("California");
    });

    it("uppercases unknown slugs as a safe fallback", () => {
      expect(getStateDisplayNameFromSlug("zz")).toBe("ZZ");
    });
  });
});



