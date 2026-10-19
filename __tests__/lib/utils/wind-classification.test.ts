/**
 * Tests for Wind Classification Utilities
 */

import { classifyWindDirection, LIGHT_WIND_KEYWORDS, WIND_SCORE } from "@/lib/utils/wind-classification";

describe("classifyWindDirection", () => {
  describe("without a beach orientation", () => {
    it.each(["E", "NE", "SE", "ENE", "e", "offshore", "E (offshore)", "W", "SW", "Onshore", "W (onshore)", ""])(
      'returns unknown for "%s" (no California fallback, no default onshore)',
      (dir) => {
        expect(classifyWindDirection(dir)).toBe("unknown");
        expect(classifyWindDirection(dir, null)).toBe("unknown");
        expect(classifyWindDirection(dir, undefined)).toBe("unknown");
        expect(classifyWindDirection(dir, Number.NaN)).toBe("unknown");
      }
    );
  });

  describe("east-facing beach (aspect 90 -> offshore 270)", () => {
    it("west wind is offshore and east wind is onshore", () => {
      expect(classifyWindDirection("W", 270)).toBe("offshore");
      expect(classifyWindDirection("E", 270)).toBe("onshore");
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

    it("returns unknown for an unparseable direction even with windOffshoreDeg", () => {
      expect(classifyWindDirection("unknown", 270)).toBe("unknown");
    });

    it("keeps an explicit onshore keyword when the direction has no cardinal", () => {
      expect(classifyWindDirection("onshore", 270)).toBe("onshore");
    });
  });

  describe("edge cases", () => {
    it("classifies an empty string as unknown, not onshore", () => {
      expect(classifyWindDirection("", 270)).toBe("unknown");
    });

    it("does not read 'west' or 'severe' as a cardinal", () => {
      expect(classifyWindDirection("west", 270)).toBe("unknown");
      expect(classifyWindDirection("severe", 270)).toBe("unknown");
    });

    it("does not read 'northeast' as an exact NE", () => {
      expect(classifyWindDirection("northeast", 270)).toBe("unknown");
    });
  });
});

describe("constants", () => {
  it("LIGHT_WIND_KEYWORDS should include glassy", () => {
    expect(LIGHT_WIND_KEYWORDS).toContain("glassy");
  });

  it("WIND_SCORE values should be consistent", () => {
    expect(WIND_SCORE.OFFSHORE).toBe(25);
    expect(WIND_SCORE.LIGHT).toBe(15);
    expect(WIND_SCORE.ONSHORE).toBe(0);
  });
});
