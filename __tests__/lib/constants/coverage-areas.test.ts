import { COVERED_REGIONS } from "@/lib/constants/coverage-areas";

describe("COVERED_REGIONS", () => {
    it("should include key coverage areas", () => {
      // West Coast
      expect(COVERED_REGIONS).toContain("San Diego County, CA");
      expect(COVERED_REGIONS).toContain("Orange County, CA");
      expect(COVERED_REGIONS).toContain("Oregon Coast");
      expect(COVERED_REGIONS).toContain("Washington Coast");

      // East Coast
      expect(COVERED_REGIONS).toContain("New Jersey Coast");
      expect(COVERED_REGIONS).toContain("New York Coast");
      expect(COVERED_REGIONS).toContain("Florida Coast");

      // Islands & International
      expect(COVERED_REGIONS).toContain("Hawaii");
      expect(COVERED_REGIONS).toContain("Puerto Rico");
      expect(COVERED_REGIONS).toContain("Baja California, Mexico");
    });

    it("should be an array of strings", () => {
      expect(Array.isArray(COVERED_REGIONS)).toBe(true);
      COVERED_REGIONS.forEach(region => {
        expect(typeof region).toBe("string");
      });
    });
});
