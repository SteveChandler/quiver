import {
  parseHiIslandCitySlug,
  getHiIslandDisplayName,
  buildHiCityUrlForBeach,
} from "@/lib/utils/beach-url-utils";

describe("HI island-specific city pages (Waimea)", () => {
  describe("parseHiIslandCitySlug", () => {
    it("parses waimea-kauai", () => {
      expect(parseHiIslandCitySlug("waimea-kauai")).toEqual({
        baseCitySlug: "waimea",
        islandSlug: "kauai",
      });
    });

    it("parses waimea-big-island", () => {
      expect(parseHiIslandCitySlug("waimea-big-island")).toEqual({
        baseCitySlug: "waimea",
        islandSlug: "big-island",
      });
    });

    it("does not treat non-ambiguous cities as island-suffixed", () => {
      expect(parseHiIslandCitySlug("haleiwa-kauai")).toEqual({
        baseCitySlug: "haleiwa-kauai",
        islandSlug: null,
      });
    });
  });

  describe("getHiIslandDisplayName", () => {
    it("returns the display name", () => {
      expect(getHiIslandDisplayName("kauai")).toBe("Kauai");
      expect(getHiIslandDisplayName("big-island")).toBe("Big Island");
    });
  });

  describe("buildHiCityUrlForBeach", () => {
    it("builds island-specific Waimea city URLs from region", () => {
      expect(
        buildHiCityUrlForBeach({
          state: "HI",
          city: "Waimea",
          region: "Kauai",
        })
      ).toBe("/hi/waimea-kauai");

      expect(
        buildHiCityUrlForBeach({
          state: "HI",
          city: "Waimea",
          region: "Big Island",
        })
      ).toBe("/hi/waimea-big-island");
    });

    it("falls back when island info is missing", () => {
      expect(
        buildHiCityUrlForBeach({
          state: "HI",
          city: "Waimea",
          region: null,
        })
      ).toBe("/hi/waimea");
    });

    it("falls back for non-ambiguous HI cities", () => {
      expect(
        buildHiCityUrlForBeach({
          state: "HI",
          city: "Haleiwa",
          region: "Oahu",
        })
      ).toBe("/hi/haleiwa");
    });

    it("falls back for non-HI states", () => {
      expect(
        buildHiCityUrlForBeach({
          state: "CA",
          city: "San Diego",
          region: "San Diego County",
        })
      ).toBe("/ca/san-diego");
    });
  });
});


