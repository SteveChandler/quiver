/**
 * Tests for Wind Classification Utilities
 */

import {
  classifyWindDirection,
  getWindScore,
  OFFSHORE_DIRECTIONS,
  LIGHT_WIND_KEYWORDS,
  WIND_SCORE,
} from "@/lib/utils/wind-classification";

describe("classifyWindDirection", () => {
  describe("offshore directions", () => {
    it.each(["E", "NE", "SE", "ENE", "ESE", "offshore"])(
      'should classify "%s" as offshore',
      (dir) => {
        expect(classifyWindDirection(dir)).toBe("offshore");
      }
    );

    it.each(["e", "ne", "se", "ene", "ese"])(
      'should be case-insensitive for "%s"',
      (dir) => {
        expect(classifyWindDirection(dir)).toBe("offshore");
      }
    );

    it.each(["E (offshore)", "NE (offshore)", "Strong offshore"])(
      'should classify composite label "%s" as offshore',
      (dir) => {
        expect(classifyWindDirection(dir)).toBe("offshore");
      }
    );

    it("should handle leading/trailing whitespace", () => {
      expect(classifyWindDirection("  E  ")).toBe("offshore");
      expect(classifyWindDirection(" NE ")).toBe("offshore");
    });
  });

  describe("light wind conditions", () => {
    it.each(["Light", "Calm", "Variable", "Glassy"])(
      'should classify "%s" as light',
      (dir) => {
        expect(classifyWindDirection(dir)).toBe("light");
      }
    );

    it.each(["Light and Variable", "light winds", "calm morning"])(
      'should classify composite label "%s" as light',
      (dir) => {
        expect(classifyWindDirection(dir)).toBe("light");
      }
    );
  });

  describe("onshore directions", () => {
    it.each(["W", "SW", "S", "NW", "WNW", "SSW", "W (onshore)", "Onshore"])(
      'should classify "%s" as onshore',
      (dir) => {
        expect(classifyWindDirection(dir)).toBe("onshore");
      }
    );
  });

  describe("beach-aware classification with windOffshoreDeg", () => {
    it("classifies E wind as onshore for east-facing Hawaii beach (windOffshoreDeg=270)", () => {
      expect(classifyWindDirection("E", 270)).toBe("onshore");
    });

    it("classifies W wind as offshore for east-facing Hawaii beach (windOffshoreDeg=270)", () => {
      expect(classifyWindDirection("W", 270)).toBe("offshore");
    });

    it("classifies E wind as offshore for west-facing CA beach (windOffshoreDeg=90)", () => {
      expect(classifyWindDirection("E", 90)).toBe("offshore");
    });

    it("classifies W wind as onshore for west-facing CA beach (windOffshoreDeg=90)", () => {
      expect(classifyWindDirection("W", 90)).toBe("onshore");
    });

    it("classifies NE wind as offshore when windOffshoreDeg=45", () => {
      expect(classifyWindDirection("NE", 45)).toBe("offshore");
    });

    it("classifies SW wind as onshore when windOffshoreDeg=45", () => {
      expect(classifyWindDirection("SW", 45)).toBe("onshore");
    });

    it("classifies cross-shore wind as onshore (conservative)", () => {
      // N wind with windOffshoreDeg=90 (E offshore) — N is cross-shore
      expect(classifyWindDirection("N", 90)).toBe("onshore");
    });

    it("still returns light for light/variable keywords regardless of windOffshoreDeg", () => {
      expect(classifyWindDirection("Light", 270)).toBe("light");
      expect(classifyWindDirection("Calm", 90)).toBe("light");
      expect(classifyWindDirection("Variable", 180)).toBe("light");
    });

    it("parses composite labels like 'E (offshore)' using cardinal prefix", () => {
      // E (offshore) on east-facing HI beach — E is onshore, not offshore
      expect(classifyWindDirection("E (offshore)", 270)).toBe("onshore");
      // NE (offshore) on west-facing CA beach — NE is near-offshore
      expect(classifyWindDirection("NE (offshore)", 90)).toBe("offshore");
    });

    it("parses composite labels like 'W (onshore)' using cardinal prefix", () => {
      expect(classifyWindDirection("W (onshore)", 270)).toBe("offshore");
    });

    it("handles explicit offshore label with windOffshoreDeg", () => {
      expect(classifyWindDirection("offshore", 270)).toBe("offshore");
    });

    it("falls back to onshore for unparseable direction with windOffshoreDeg", () => {
      expect(classifyWindDirection("unknown", 270)).toBe("onshore");
    });

    it("without windOffshoreDeg uses legacy CA-centric logic", () => {
      // E is offshore in legacy mode (California assumption)
      expect(classifyWindDirection("E")).toBe("offshore");
      // E is offshore when windOffshoreDeg is null
      expect(classifyWindDirection("E", null)).toBe("offshore");
      // E is offshore when windOffshoreDeg is undefined
      expect(classifyWindDirection("E", undefined)).toBe("offshore");
    });
  });

  describe("edge cases", () => {
    it("should classify empty string as onshore", () => {
      expect(classifyWindDirection("")).toBe("onshore");
    });

    it("should not false-positive on 'onshore' containing 'e'", () => {
      // This was the original bug — includes("e") matched "onshore"
      expect(classifyWindDirection("onshore")).toBe("onshore");
    });

    it("should not false-positive on 'west' containing 'e'", () => {
      expect(classifyWindDirection("west")).toBe("onshore");
    });

    it("should not false-positive on 'severe' containing 'e'", () => {
      expect(classifyWindDirection("severe")).toBe("onshore");
    });

    it("should not false-positive on 'northeast' as offshore", () => {
      // "northeast" contains "e" but is not an exact match for "e", "ne", etc.
      // However it does NOT contain "offshore" — should be onshore
      expect(classifyWindDirection("northeast")).toBe("onshore");
    });
  });
});

describe("getWindScore", () => {
  it("should return 25 for offshore", () => {
    expect(getWindScore("offshore")).toBe(25);
  });

  it("should return 15 for light", () => {
    expect(getWindScore("light")).toBe(15);
  });

  it("should return 0 for onshore", () => {
    expect(getWindScore("onshore")).toBe(0);
  });
});

describe("constants", () => {
  it("OFFSHORE_DIRECTIONS should include se", () => {
    expect(OFFSHORE_DIRECTIONS.has("se")).toBe(true);
  });

  it("LIGHT_WIND_KEYWORDS should include glassy", () => {
    expect(LIGHT_WIND_KEYWORDS).toContain("glassy");
  });

  it("WIND_SCORE values should be consistent", () => {
    expect(WIND_SCORE.OFFSHORE).toBe(25);
    expect(WIND_SCORE.LIGHT).toBe(15);
    expect(WIND_SCORE.ONSHORE).toBe(0);
  });
});
