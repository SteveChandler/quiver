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
