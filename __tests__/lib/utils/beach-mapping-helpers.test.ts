import {
  mapSkillLevel,
  mapCrowdFactor,
  inferCitySlug,
  inferCitySlugForSurfSpot,
} from "@/lib/utils/beach-mapping-helpers";

describe("beach-mapping-helpers", () => {
  // ---------------------------------------------------------------------------
  // mapSkillLevel
  // ---------------------------------------------------------------------------
  describe("mapSkillLevel", () => {
    it("returns 'Beginner friendly' for beginner", () => {
      expect(mapSkillLevel("Beginner")).toBe("Beginner friendly");
    });

    it("returns 'Beginner friendly' case-insensitively", () => {
      expect(mapSkillLevel("BEGINNER")).toBe("Beginner friendly");
    });

    it("returns 'Beginner friendly' for partial match 'Beginner to Intermediate'", () => {
      expect(mapSkillLevel("Beginner to Intermediate")).toBe("Beginner friendly");
    });

    it("returns 'Longboard friendly' for longboard", () => {
      expect(mapSkillLevel("Longboard")).toBe("Longboard friendly");
    });

    it("returns 'Longboard friendly' case-insensitively", () => {
      expect(mapSkillLevel("LONGBOARD friendly")).toBe("Longboard friendly");
    });

    it("returns 'Advanced' for advanced", () => {
      expect(mapSkillLevel("Advanced")).toBe("Advanced");
    });

    it("returns 'Advanced' case-insensitively", () => {
      expect(mapSkillLevel("advanced surfers only")).toBe("Advanced");
    });

    it("returns 'Intermediate to expert' for expert", () => {
      expect(mapSkillLevel("Expert")).toBe("Intermediate to expert");
    });

    it("returns 'Intermediate to expert' for partial expert match", () => {
      expect(mapSkillLevel("expert only")).toBe("Intermediate to expert");
    });

    it("returns 'Intermediate' for intermediate", () => {
      expect(mapSkillLevel("Intermediate")).toBe("Intermediate");
    });

    it("returns 'Intermediate' for null", () => {
      expect(mapSkillLevel(null)).toBe("Intermediate");
    });

    it("returns 'Intermediate' for empty string", () => {
      expect(mapSkillLevel("")).toBe("Intermediate");
    });

    it("returns 'Intermediate' for unrecognized value", () => {
      expect(mapSkillLevel("all levels")).toBe("Intermediate");
    });
  });

  // ---------------------------------------------------------------------------
  // mapCrowdFactor
  // ---------------------------------------------------------------------------
  describe("mapCrowdFactor", () => {
    it("returns 'Light' for light", () => {
      expect(mapCrowdFactor("Light")).toBe("Light");
    });

    it("returns 'Light' for low", () => {
      expect(mapCrowdFactor("Low")).toBe("Light");
    });

    it("returns 'Light' case-insensitively for LIGHT", () => {
      expect(mapCrowdFactor("LIGHT")).toBe("Light");
    });

    it("returns 'Heavy' for heavy", () => {
      expect(mapCrowdFactor("Heavy")).toBe("Heavy");
    });

    it("returns 'Heavy' for high", () => {
      expect(mapCrowdFactor("High")).toBe("Heavy");
    });

    it("returns 'Heavy' case-insensitively for HEAVY", () => {
      expect(mapCrowdFactor("HEAVY")).toBe("Heavy");
    });

    it("returns 'Moderate' for moderate", () => {
      expect(mapCrowdFactor("Moderate")).toBe("Moderate");
    });

    it("returns 'Moderate' for null", () => {
      expect(mapCrowdFactor(null)).toBe("Moderate");
    });

    it("returns 'Moderate' for empty string", () => {
      expect(mapCrowdFactor("")).toBe("Moderate");
    });

    it("returns 'Moderate' for unrecognized value", () => {
      expect(mapCrowdFactor("variable")).toBe("Moderate");
    });
  });

  // ---------------------------------------------------------------------------
  // inferCitySlug
  // ---------------------------------------------------------------------------
  describe("inferCitySlug", () => {
    it("returns null for null city", () => {
      expect(inferCitySlug(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(inferCitySlug("")).toBeNull();
    });

    it("returns 'san-diego' for San Diego", () => {
      expect(inferCitySlug("San Diego")).toBe("san-diego");
    });

    it("returns 'san-diego' for san diego (lowercase)", () => {
      expect(inferCitySlug("san diego")).toBe("san-diego");
    });

    it("returns 'san-diego' for La Jolla", () => {
      expect(inferCitySlug("La Jolla")).toBe("san-diego");
    });

    it("returns 'san-diego' for Ocean Beach", () => {
      expect(inferCitySlug("Ocean Beach")).toBe("san-diego");
    });

    it("returns 'san-diego' for Pacific Beach", () => {
      expect(inferCitySlug("Pacific Beach")).toBe("san-diego");
    });

    it("returns 'san-diego' for Mission Beach", () => {
      expect(inferCitySlug("Mission Beach")).toBe("san-diego");
    });

    it("returns 'san-diego' for Del Mar", () => {
      expect(inferCitySlug("Del Mar")).toBe("san-diego");
    });

    it("returns 'san-diego' for Coronado", () => {
      expect(inferCitySlug("Coronado")).toBe("san-diego");
    });

    it("returns 'san-diego' for Encinitas", () => {
      expect(inferCitySlug("Encinitas")).toBe("san-diego");
    });

    it("returns 'san-diego' for Carlsbad", () => {
      expect(inferCitySlug("Carlsbad")).toBe("san-diego");
    });

    it("returns null for Orange County (no county-level intent page)", () => {
      expect(inferCitySlug("Orange County")).toBeNull();
    });

    it("returns 'huntington-beach' for Huntington Beach (slugified)", () => {
      expect(inferCitySlug("Huntington Beach")).toBe("huntington-beach");
    });

    it("returns 'santa-cruz' for Santa Cruz (slugified)", () => {
      expect(inferCitySlug("Santa Cruz")).toBe("santa-cruz");
    });

    it("returns 'malibu' for Malibu (slugified)", () => {
      expect(inferCitySlug("Malibu")).toBe("malibu");
    });

    it("is case-insensitive for San Diego neighborhoods", () => {
      expect(inferCitySlug("LA JOLLA")).toBe("san-diego");
    });

    it("trims whitespace before matching", () => {
      expect(inferCitySlug("  san diego  ")).toBe("san-diego");
    });
  });

  // ---------------------------------------------------------------------------
  // inferCitySlugForSurfSpot
  // ---------------------------------------------------------------------------
  describe("inferCitySlugForSurfSpot", () => {
    it("returns 'san-diego' for null city (non-nullable fallback)", () => {
      expect(inferCitySlugForSurfSpot(null)).toBe("san-diego");
    });

    it("returns 'san-diego' for empty string", () => {
      expect(inferCitySlugForSurfSpot("")).toBe("san-diego");
    });

    it("returns 'san-diego' for San Diego", () => {
      expect(inferCitySlugForSurfSpot("San Diego")).toBe("san-diego");
    });

    it("returns 'san-diego' for La Jolla", () => {
      expect(inferCitySlugForSurfSpot("La Jolla")).toBe("san-diego");
    });

    it("returns 'san-diego' for Coronado", () => {
      expect(inferCitySlugForSurfSpot("Coronado")).toBe("san-diego");
    });

    it("returns 'orange-county' for Orange County", () => {
      expect(inferCitySlugForSurfSpot("Orange County")).toBe("orange-county");
    });

    it("returns 'san-diego' for unrecognized city (backward compat fallback)", () => {
      expect(inferCitySlugForSurfSpot("Unknown City")).toBe("san-diego");
    });

    it("returns 'san-diego' for arbitrary unrecognized city", () => {
      expect(inferCitySlugForSurfSpot("Some Other City")).toBe("san-diego");
    });
  });
});
