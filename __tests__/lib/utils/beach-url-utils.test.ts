import {
  stateToSlug,
  cityToSlug,
  buildBeachUrl,
  buildBeachUrlWithTab,
  parseBeachUrl,
  buildStateUrl,
  buildCityUrl,
} from "@/lib/utils/beach-url-utils";

describe("Beach URL Utils", () => {
  describe("stateToSlug", () => {
    it("should convert CA to ca", () => {
      expect(stateToSlug("CA")).toBe("ca");
    });

    it("should convert Baja California to mexico/baja-california", () => {
      expect(stateToSlug("Baja California")).toBe("mexico/baja-california");
    });

    it("should handle null state", () => {
      expect(stateToSlug(null)).toBe("");
    });

    it("should handle undefined state", () => {
      expect(stateToSlug(undefined)).toBe("");
    });

    it("should slugify unknown state names", () => {
      expect(stateToSlug("New York")).toBe("new-york");
      expect(stateToSlug("North Carolina")).toBe("north-carolina");
    });

    it("should lowercase all slugs", () => {
      expect(stateToSlug("CALIFORNIA")).toBe("california");
    });

    it("should remove special characters", () => {
      expect(stateToSlug("Hawai'i")).toBe("hawaii");
    });
  });

  describe("cityToSlug", () => {
    it("should convert city names to lowercase slugs", () => {
      expect(cityToSlug("San Diego")).toBe("san-diego");
      expect(cityToSlug("Huntington Beach")).toBe("huntington-beach");
    });

    it("should handle null city", () => {
      expect(cityToSlug(null)).toBe("");
    });

    it("should handle undefined city", () => {
      expect(cityToSlug(undefined)).toBe("");
    });

    it("should remove special characters", () => {
      expect(cityToSlug("O'ahu")).toBe("oahu");
      expect(cityToSlug("San José")).toBe("san-jos");
    });

    it("should handle multiple spaces", () => {
      expect(cityToSlug("Santa  Barbara")).toBe("santa-barbara");
    });

    it("should trim leading and trailing spaces", () => {
      expect(cityToSlug("  Santa Cruz  ")).toBe("santa-cruz");
    });
  });

  describe("buildBeachUrl", () => {
    it("should build hierarchical URL for California beaches", () => {
      const beach = {
        slug: "ocean-beach",
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrl(beach)).toBe("/ca/san-diego/ocean-beach");
    });

    it("should build hierarchical URL for Baja California beaches", () => {
      const beach = {
        slug: "k38",
        city: "Ensenada",
        state: "Baja California",
      };
      expect(buildBeachUrl(beach)).toBe("/mexico/baja-california/ensenada/k38");
    });

    it("should handle cities with spaces", () => {
      const beach = {
        slug: "pier",
        city: "Huntington Beach",
        state: "CA",
      };
      expect(buildBeachUrl(beach)).toBe("/ca/huntington-beach/pier");
    });

    it("should fallback to /beach/{slug} when state missing", () => {
      const beach = {
        slug: "test-beach",
        city: "San Diego",
        state: null,
      };
      expect(buildBeachUrl(beach)).toBe("/beach/test-beach");
    });

    it("should fallback to /beach/{slug} when city missing", () => {
      const beach = {
        slug: "test-beach",
        city: null,
        state: "CA",
      };
      expect(buildBeachUrl(beach)).toBe("/beach/test-beach");
    });

    it("should fallback to /beach/{slug} when slug missing", () => {
      const beach = {
        slug: null,
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrl(beach)).toBe("/beach/unknown");
    });

    it("should fallback when all fields missing", () => {
      const beach = {
        slug: null,
        city: null,
        state: null,
      };
      expect(buildBeachUrl(beach)).toBe("/beach/unknown");
    });

    it("should handle beach slugs with hyphens", () => {
      const beach = {
        slug: "blacks-beach",
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrl(beach)).toBe("/ca/san-diego/blacks-beach");
    });
  });

  describe("buildBeachUrlWithTab", () => {
    it("should build URL with reviews tab", () => {
      const beach = {
        slug: "ocean-beach",
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrlWithTab(beach, "reviews")).toBe(
        "/ca/san-diego/ocean-beach?tab=reviews"
      );
    });

    it("should build URL with info tab", () => {
      const beach = {
        slug: "ocean-beach",
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrlWithTab(beach, "info")).toBe(
        "/ca/san-diego/ocean-beach?tab=info"
      );
    });

    it("should build URL with gallery tab", () => {
      const beach = {
        slug: "ocean-beach",
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrlWithTab(beach, "gallery")).toBe(
        "/ca/san-diego/ocean-beach?tab=gallery"
      );
    });

    it("should handle custom tab names", () => {
      const beach = {
        slug: "ocean-beach",
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrlWithTab(beach, "custom-tab")).toBe(
        "/ca/san-diego/ocean-beach?tab=custom-tab"
      );
    });

    it("should fallback to /beach/{slug} with tab when data incomplete", () => {
      const beach = {
        slug: "test-beach",
        city: null,
        state: null,
      };
      expect(buildBeachUrlWithTab(beach, "reviews")).toBe(
        "/beach/test-beach?tab=reviews"
      );
    });
  });

  describe("parseBeachUrl", () => {
    it("should parse hierarchical California URL", () => {
      const result = parseBeachUrl("/ca/san-diego/ocean-beach");
      expect(result).toEqual({
        stateSlug: "ca",
        citySlug: "san-diego",
        beachSlug: "ocean-beach",
      });
    });

    it("should parse Baja California URL", () => {
      const result = parseBeachUrl("/mexico/baja-california/ensenada/k38");
      expect(result).toBeNull(); // 4 parts, not 3
    });

    it("should parse URL with query parameters", () => {
      const result = parseBeachUrl("/ca/san-diego/ocean-beach?tab=reviews");
      expect(result).toEqual({
        stateSlug: "ca",
        citySlug: "san-diego",
        beachSlug: "ocean-beach",
      });
    });

    it("should handle URL without leading slash", () => {
      const result = parseBeachUrl("ca/san-diego/ocean-beach");
      expect(result).toEqual({
        stateSlug: "ca",
        citySlug: "san-diego",
        beachSlug: "ocean-beach",
      });
    });

    it("should return null for URL with wrong number of parts", () => {
      expect(parseBeachUrl("/ca/san-diego")).toBeNull();
      expect(parseBeachUrl("/ca")).toBeNull();
      expect(parseBeachUrl("/ca/san-diego/ocean-beach/extra")).toBeNull();
    });

    it("should return null for empty URL", () => {
      expect(parseBeachUrl("")).toBeNull();
      expect(parseBeachUrl("/")).toBeNull();
    });

    it("should handle URLs with hyphens in all parts", () => {
      const result = parseBeachUrl("/new-york/long-island/fire-island");
      expect(result).toEqual({
        stateSlug: "new-york",
        citySlug: "long-island",
        beachSlug: "fire-island",
      });
    });
  });

  describe("buildStateUrl", () => {
    it("should build URL for California", () => {
      expect(buildStateUrl("CA")).toBe("/ca");
    });

    it("should build URL for Baja California", () => {
      expect(buildStateUrl("Baja California")).toBe("/mexico/baja-california");
    });

    it("should slugify unknown states", () => {
      expect(buildStateUrl("New York")).toBe("/new-york");
    });

    it("should return / for null state", () => {
      expect(buildStateUrl(null)).toBe("/");
    });

    it("should return / for undefined state", () => {
      expect(buildStateUrl(undefined)).toBe("/");
    });

    it("should return / for empty string", () => {
      expect(buildStateUrl("")).toBe("/");
    });
  });

  describe("buildCityUrl", () => {
    it("should build URL for California city", () => {
      expect(buildCityUrl("CA", "San Diego")).toBe("/ca/san-diego");
    });

    it("should build URL for Baja California city", () => {
      expect(buildCityUrl("Baja California", "Ensenada")).toBe(
        "/mexico/baja-california/ensenada"
      );
    });

    it("should handle cities with multiple words", () => {
      expect(buildCityUrl("CA", "Huntington Beach")).toBe(
        "/ca/huntington-beach"
      );
    });

    it("should return / when state is null", () => {
      expect(buildCityUrl(null, "San Diego")).toBe("/");
    });

    it("should return / when city is null", () => {
      expect(buildCityUrl("CA", null)).toBe("/");
    });

    it("should return / when both are null", () => {
      expect(buildCityUrl(null, null)).toBe("/");
    });

    it("should return / when state is undefined", () => {
      expect(buildCityUrl(undefined, "San Diego")).toBe("/");
    });

    it("should return / when city is undefined", () => {
      expect(buildCityUrl("CA", undefined)).toBe("/");
    });

    it("should slugify unknown state and city", () => {
      expect(buildCityUrl("New York", "New York City")).toBe(
        "/new-york/new-york-city"
      );
    });
  });

  describe("Integration tests", () => {
    it("should handle complete workflow for California beach", () => {
      const beach = {
        slug: "blacks-beach",
        city: "San Diego",
        state: "CA",
      };

      const url = buildBeachUrl(beach);
      expect(url).toBe("/ca/san-diego/blacks-beach");

      const parsed = parseBeachUrl(url);
      expect(parsed).toEqual({
        stateSlug: "ca",
        citySlug: "san-diego",
        beachSlug: "blacks-beach",
      });
    });

    it("should handle complete workflow with tabs", () => {
      const beach = {
        slug: "ocean-beach",
        city: "San Diego",
        state: "CA",
      };

      const reviewsUrl = buildBeachUrlWithTab(beach, "reviews");
      expect(reviewsUrl).toBe("/ca/san-diego/ocean-beach?tab=reviews");

      const parsed = parseBeachUrl(reviewsUrl);
      expect(parsed).toEqual({
        stateSlug: "ca",
        citySlug: "san-diego",
        beachSlug: "ocean-beach",
      });
    });

    it("should handle city and state URLs", () => {
      const stateUrl = buildStateUrl("CA");
      expect(stateUrl).toBe("/ca");

      const cityUrl = buildCityUrl("CA", "San Diego");
      expect(cityUrl).toBe("/ca/san-diego");
    });
  });
});
