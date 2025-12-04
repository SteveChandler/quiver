import {
  getDistanceFromPoint,
  isLikelyOutOfAreaSearch,
  COVERAGE_MESSAGES,
  OUT_OF_AREA_EXAMPLES,
  DEFAULT_MAP_CENTER,
  COVERED_REGIONS,
} from "@/lib/constants/coverage-areas";

describe("Coverage Areas", () => {
  describe("getDistanceFromPoint", () => {
    it("should calculate distance from Ocean Beach to itself as ~0", () => {
      const distance = getDistanceFromPoint(32.7503, -117.2534);
      expect(distance).toBeLessThan(1);
    });

    it("should calculate reasonable distance to Los Angeles", () => {
      const distance = getDistanceFromPoint(34.0522, -118.2437);
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(150);
    });

    it("should calculate reasonable distance to San Francisco", () => {
      const distance = getDistanceFromPoint(37.7749, -122.4194);
      expect(distance).toBeGreaterThan(450);
      expect(distance).toBeLessThan(550);
    });

    it("should calculate distance from custom reference point", () => {
      // Distance from LA to San Francisco
      const distance = getDistanceFromPoint(37.7749, -122.4194, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(340);
      expect(distance).toBeLessThan(400);
    });
  });

  describe("isLikelyOutOfAreaSearch", () => {
    it("should identify clearly out-of-area locations", () => {
      expect(isLikelyOutOfAreaSearch("tampico")).toBe(true);
      expect(isLikelyOutOfAreaSearch("Tampico")).toBe(true);
      expect(isLikelyOutOfAreaSearch("florida")).toBe(true);
      expect(isLikelyOutOfAreaSearch("miami")).toBe(true);
      expect(isLikelyOutOfAreaSearch("australia")).toBe(true);
      expect(isLikelyOutOfAreaSearch("bali")).toBe(true);
    });

    it("should NOT flag covered regions as out-of-area", () => {
      // Hawaii is covered
      expect(isLikelyOutOfAreaSearch("hawaii")).toBe(false);
      expect(isLikelyOutOfAreaSearch("waikiki")).toBe(false);
      expect(isLikelyOutOfAreaSearch("pipeline")).toBe(false);
      
      // California beaches are covered
      expect(isLikelyOutOfAreaSearch("malibu")).toBe(false);
      expect(isLikelyOutOfAreaSearch("huntington beach")).toBe(false);
      expect(isLikelyOutOfAreaSearch("santa monica")).toBe(false);
      expect(isLikelyOutOfAreaSearch("newport")).toBe(false);
      expect(isLikelyOutOfAreaSearch("los angeles")).toBe(false);
      
      // San Diego beaches
      expect(isLikelyOutOfAreaSearch("ocean beach")).toBe(false);
      expect(isLikelyOutOfAreaSearch("la jolla")).toBe(false);
      expect(isLikelyOutOfAreaSearch("pacific beach")).toBe(false);
      
      // Oregon/Washington
      expect(isLikelyOutOfAreaSearch("cannon beach")).toBe(false);
      expect(isLikelyOutOfAreaSearch("westport")).toBe(false);
      
      // Baja (covered)
      expect(isLikelyOutOfAreaSearch("rosarito")).toBe(false);
      expect(isLikelyOutOfAreaSearch("k-38")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isLikelyOutOfAreaSearch("")).toBe(false);
      expect(isLikelyOutOfAreaSearch("   ")).toBe(false);
      expect(isLikelyOutOfAreaSearch("xyz123")).toBe(false);
    });
  });

  describe("COVERAGE_MESSAGES", () => {
    it("should have required message properties", () => {
      expect(COVERAGE_MESSAGES.OUT_OF_AREA_TITLE).toBeDefined();
      expect(COVERAGE_MESSAGES.OUT_OF_AREA_EXPLANATION).toBeDefined();
      expect(COVERAGE_MESSAGES.COVERAGE_AREA_INFO).toBeDefined();
    });

    it("should generate appropriate out-of-area messages for known locations", () => {
      const message = COVERAGE_MESSAGES.getOutOfAreaMessage("tampico");
      expect(message).toContain("Tampico, Mexico");
      expect(message).toContain("coverage area");
    });

    it("should generate generic messages for unknown locations", () => {
      const message = COVERAGE_MESSAGES.getOutOfAreaMessage("unknown beach");
      expect(message).toContain("unknown beach");
      expect(message).toContain("coverage area");
    });

    it("should generate suggestion messages", () => {
      const message = COVERAGE_MESSAGES.getSuggestionMessage("Ocean Beach");
      expect(message).toContain("Ocean Beach");
    });

    it("should generate coverage expansion messages", () => {
      const message = COVERAGE_MESSAGES.getCoverageExpansionMessage();
      expect(message).toContain("add beaches");
    });

    it("should reflect broader West Coast coverage in info message", () => {
      expect(COVERAGE_MESSAGES.COVERAGE_AREA_INFO).toContain("California");
      expect(COVERAGE_MESSAGES.COVERAGE_AREA_INFO).toContain("Hawaii");
    });
  });

  describe("OUT_OF_AREA_EXAMPLES", () => {
    it("should contain expected out-of-coverage locations", () => {
      expect(OUT_OF_AREA_EXAMPLES.tampico).toBeDefined();
      expect(OUT_OF_AREA_EXAMPLES.florida).toBeDefined();
      expect(OUT_OF_AREA_EXAMPLES.australia).toBeDefined();
    });

    it("should NOT contain covered regions", () => {
      // These should not be in OUT_OF_AREA_EXAMPLES anymore
      expect((OUT_OF_AREA_EXAMPLES as any).hawaii).toBeUndefined();
      expect((OUT_OF_AREA_EXAMPLES as any).malibu).toBeUndefined();
      expect((OUT_OF_AREA_EXAMPLES as any)["huntington beach"]).toBeUndefined();
    });

    it("should have proper structure for examples", () => {
      const tampico = OUT_OF_AREA_EXAMPLES.tampico;
      expect(tampico.location).toBe("Tampico, Mexico");
      expect(tampico.distance_miles).toBe(1200);
      expect(tampico.country).toBe("Mexico");
    });
  });

  describe("DEFAULT_MAP_CENTER", () => {
    it("should have proper structure", () => {
      expect(DEFAULT_MAP_CENTER.name).toBe("San Diego");
      expect(DEFAULT_MAP_CENTER.center).toBeDefined();
      expect(DEFAULT_MAP_CENTER.center.lat).toBeCloseTo(32.75, 1);
      expect(DEFAULT_MAP_CENTER.center.lng).toBeCloseTo(-117.25, 1);
    });
  });

  describe("COVERED_REGIONS", () => {
    it("should include key coverage areas", () => {
      expect(COVERED_REGIONS).toContain("San Diego County, CA");
      expect(COVERED_REGIONS).toContain("Orange County, CA");
      expect(COVERED_REGIONS).toContain("Hawaii");
      expect(COVERED_REGIONS).toContain("Oregon Coast");
      expect(COVERED_REGIONS).toContain("Washington Coast");
      expect(COVERED_REGIONS).toContain("Baja California, Mexico");
    });

    it("should be an array of strings", () => {
      expect(Array.isArray(COVERED_REGIONS)).toBe(true);
      COVERED_REGIONS.forEach(region => {
        expect(typeof region).toBe("string");
      });
    });
  });
});
