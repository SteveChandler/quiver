import {
  getWetsuitRecommendation,
  parseWaterTempF,
  formatWaterTemp,
  WetsuitRecommendation,
} from "@/lib/utils/wetsuit-utils";

describe("getWetsuitRecommendation", () => {
  describe("temperature boundary values", () => {
    it("returns boardshorts for 72°F and above", () => {
      const result72 = getWetsuitRecommendation(72);
      expect(result72.thickness).toBe("Boardshorts");
      expect(result72.extras).toHaveLength(0);

      const result80 = getWetsuitRecommendation(80);
      expect(result80.thickness).toBe("Boardshorts");
    });

    it("returns spring suit for 66-71°F", () => {
      const result66 = getWetsuitRecommendation(66);
      expect(result66.thickness).toBe("Spring suit (2mm)");
      expect(result66.extras).toHaveLength(0);

      const result71 = getWetsuitRecommendation(71);
      expect(result71.thickness).toBe("Spring suit (2mm)");
    });

    it("returns 3/2mm fullsuit for 62-65°F", () => {
      const result62 = getWetsuitRecommendation(62);
      expect(result62.thickness).toBe("3/2mm fullsuit");
      expect(result62.extras).toHaveLength(0);

      const result65 = getWetsuitRecommendation(65);
      expect(result65.thickness).toBe("3/2mm fullsuit");
    });

    it("returns 3/2mm sealed for 58-61°F", () => {
      const result58 = getWetsuitRecommendation(58);
      expect(result58.thickness).toBe("3/2mm sealed");
      expect(result58.extras).toContain("booties optional");

      const result61 = getWetsuitRecommendation(61);
      expect(result61.thickness).toBe("3/2mm sealed");
    });

    it("returns 4/3mm fullsuit for 54-57°F", () => {
      const result54 = getWetsuitRecommendation(54);
      expect(result54.thickness).toBe("4/3mm fullsuit");
      expect(result54.extras).toContain("booties recommended");

      const result57 = getWetsuitRecommendation(57);
      expect(result57.thickness).toBe("4/3mm fullsuit");
    });

    it("returns 5/4mm fullsuit for 48-53°F", () => {
      const result48 = getWetsuitRecommendation(48);
      expect(result48.thickness).toBe("5/4mm fullsuit");
      expect(result48.extras).toContain("booties");
      expect(result48.extras).toContain("gloves");

      const result53 = getWetsuitRecommendation(53);
      expect(result53.thickness).toBe("5/4mm fullsuit");
    });

    it("returns 6/5mm fullsuit for below 48°F", () => {
      const result47 = getWetsuitRecommendation(47);
      expect(result47.thickness).toBe("6/5mm fullsuit");
      expect(result47.extras).toContain("booties");
      expect(result47.extras).toContain("gloves");
      expect(result47.extras).toContain("hood");

      const result40 = getWetsuitRecommendation(40);
      expect(result40.thickness).toBe("6/5mm fullsuit");
    });
  });

  describe("recommendation structure", () => {
    it("always returns thickness and description", () => {
      const temps = [40, 50, 60, 70, 80];

      temps.forEach((temp) => {
        const result = getWetsuitRecommendation(temp);
        expect(result).toHaveProperty("thickness");
        expect(result).toHaveProperty("description");
        expect(result).toHaveProperty("extras");
        expect(typeof result.thickness).toBe("string");
        expect(typeof result.description).toBe("string");
        expect(Array.isArray(result.extras)).toBe(true);
      });
    });
  });
});

describe("parseWaterTempF", () => {
  describe("valid inputs", () => {
    it("parses temperature with degree symbol and F", () => {
      expect(parseWaterTempF("65°F")).toBe(65);
    });

    it("parses plain number string", () => {
      expect(parseWaterTempF("65")).toBe(65);
    });

    it("parses temperature with space before F", () => {
      expect(parseWaterTempF("65 F")).toBe(65);
    });

    it("parses decimal temperatures", () => {
      expect(parseWaterTempF("65.5°F")).toBe(65.5);
    });

    it("parses temperature with lowercase f", () => {
      expect(parseWaterTempF("65°f")).toBe(65);
    });

    it("handles extra whitespace", () => {
      expect(parseWaterTempF(" 65 °F ")).toBe(65);
    });
  });

  describe("null/undefined inputs", () => {
    it("returns null for null input", () => {
      expect(parseWaterTempF(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(parseWaterTempF(undefined)).toBeNull();
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(parseWaterTempF("")).toBeNull();
    });

    it("returns null for non-numeric string", () => {
      expect(parseWaterTempF("warm")).toBeNull();
    });

    it("returns null for temperature below 30°F (sanity check)", () => {
      expect(parseWaterTempF("20°F")).toBeNull();
    });

    it("returns null for temperature above 100°F (sanity check)", () => {
      expect(parseWaterTempF("120°F")).toBeNull();
    });

    it("accepts real Gulf Coast summer readings above 90°F", () => {
      // Observed at 10 TX and FL beaches in Aug 2026; the old 90°F ceiling
      // rejected these and flapped their water-temp pages into noindex.
      expect(parseWaterTempF("91°F")).toBe(91);
      expect(parseWaterTempF("92°F")).toBe(92);
    });
  });
});

describe("formatWaterTemp", () => {
  it("formats temperature with degree symbol", () => {
    expect(formatWaterTemp(65)).toBe("65°F");
  });

  it("rounds decimal temperatures", () => {
    expect(formatWaterTemp(65.4)).toBe("65°F");
    expect(formatWaterTemp(65.6)).toBe("66°F");
  });
});
