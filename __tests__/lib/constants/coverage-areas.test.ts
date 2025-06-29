import {
  isWithinSanDiegoCoverage,
  getDistanceFromSanDiego,
  isLikelyOutOfAreaSearch,
  COVERAGE_MESSAGES,
  OUT_OF_AREA_EXAMPLES,
  SAN_DIEGO_COVERAGE,
} from "@/lib/constants/coverage-areas";

describe("Coverage Areas", () => {
  describe("isWithinSanDiegoCoverage", () => {
    it("should identify Ocean Beach as within San Diego coverage", () => {
      // Ocean Beach coordinates
      expect(isWithinSanDiegoCoverage(32.7503, -117.2534)).toBe(true);
    });

    it("should identify La Jolla as within San Diego coverage", () => {
      // La Jolla coordinates
      expect(isWithinSanDiegoCoverage(32.8559, -117.2423)).toBe(true);
    });

    it("should identify Imperial Beach as within San Diego coverage", () => {
      // Imperial Beach coordinates (near border)
      expect(isWithinSanDiegoCoverage(32.5836, -117.1136)).toBe(true);
    });

    it("should identify Los Angeles as outside San Diego coverage", () => {
      // Los Angeles coordinates
      expect(isWithinSanDiegoCoverage(34.0522, -118.2437)).toBe(false);
    });

    it("should identify Tijuana as outside San Diego coverage", () => {
      // Tijuana coordinates (south of border)
      expect(isWithinSanDiegoCoverage(32.5027, -117.0083)).toBe(false);
    });
  });

  describe("getDistanceFromSanDiego", () => {
    it("should calculate distance from Ocean Beach to itself as ~0", () => {
      const distance = getDistanceFromSanDiego(32.7503, -117.2534);
      expect(distance).toBeLessThan(1);
    });

    it("should calculate reasonable distance to Los Angeles", () => {
      const distance = getDistanceFromSanDiego(34.0522, -118.2437);
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(150);
    });

    it("should calculate reasonable distance to San Francisco", () => {
      const distance = getDistanceFromSanDiego(37.7749, -122.4194);
      expect(distance).toBeGreaterThan(450);
      expect(distance).toBeLessThan(550);
    });
  });

  describe("isLikelyOutOfAreaSearch", () => {
    it("should identify known out-of-area examples", () => {
      expect(isLikelyOutOfAreaSearch("tampico")).toBe(true);
      expect(isLikelyOutOfAreaSearch("Tampico")).toBe(true);
      expect(isLikelyOutOfAreaSearch("malibu")).toBe(true);
      expect(isLikelyOutOfAreaSearch("hawaii")).toBe(true);
      expect(isLikelyOutOfAreaSearch("huntington beach")).toBe(true);
    });

    it("should identify pattern-based out-of-area searches", () => {
      expect(isLikelyOutOfAreaSearch("los angeles")).toBe(true);
      expect(isLikelyOutOfAreaSearch("santa monica")).toBe(true);
      expect(isLikelyOutOfAreaSearch("san francisco")).toBe(true);
      expect(isLikelyOutOfAreaSearch("mexico")).toBe(true);
      expect(isLikelyOutOfAreaSearch("florida")).toBe(true);
    });

    it("should not identify San Diego area searches as out-of-area", () => {
      expect(isLikelyOutOfAreaSearch("ocean beach")).toBe(false);
      expect(isLikelyOutOfAreaSearch("la jolla")).toBe(false);
      expect(isLikelyOutOfAreaSearch("pacific beach")).toBe(false);
      expect(isLikelyOutOfAreaSearch("mission beach")).toBe(false);
      expect(isLikelyOutOfAreaSearch("del mar")).toBe(false);
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
      expect(message).toContain("1200 miles");
      expect(message).toContain("San Diego");
    });

    it("should generate generic messages for unknown locations", () => {
      const message = COVERAGE_MESSAGES.getOutOfAreaMessage("unknown beach");
      expect(message).toContain("unknown beach");
      expect(message).toContain("San Diego coverage area");
    });

    it("should generate suggestion messages", () => {
      const message = COVERAGE_MESSAGES.getSuggestionMessage("Ocean Beach");
      expect(message).toContain("Ocean Beach");
      expect(message).toContain("San Diego beaches");
    });

    it("should generate coverage expansion messages", () => {
      const message = COVERAGE_MESSAGES.getCoverageExpansionMessage();
      expect(message).toContain("add beaches");
      expect(message).toContain("area");
    });
  });

  describe("OUT_OF_AREA_EXAMPLES", () => {
    it("should contain expected locations", () => {
      expect(OUT_OF_AREA_EXAMPLES.tampico).toBeDefined();
      expect(OUT_OF_AREA_EXAMPLES.malibu).toBeDefined();
      expect(OUT_OF_AREA_EXAMPLES.hawaii).toBeDefined();
    });

    it("should have proper structure for examples", () => {
      const tampico = OUT_OF_AREA_EXAMPLES.tampico;
      expect(tampico.location).toBe("Tampico, Mexico");
      expect(tampico.distance_miles).toBe(1200);
      expect(tampico.country).toBe("Mexico");
    });
  });

  describe("SAN_DIEGO_COVERAGE", () => {
    it("should have proper structure", () => {
      expect(SAN_DIEGO_COVERAGE.name).toBe("San Diego County");
      expect(SAN_DIEGO_COVERAGE.bounds).toBeDefined();
      expect(SAN_DIEGO_COVERAGE.center).toBeDefined();
      expect(SAN_DIEGO_COVERAGE.radius_miles).toBe(50);
    });

    it("should have reasonable bounds", () => {
      const { bounds } = SAN_DIEGO_COVERAGE;
      expect(bounds.north).toBeGreaterThan(bounds.south);
      expect(bounds.east).toBeGreaterThan(bounds.west);
      expect(bounds.north).toBeLessThan(34); // North of LA
      expect(bounds.south).toBeGreaterThan(32); // North of Tijuana
    });
  });
});
