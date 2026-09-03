import {
  stateToSlug,
  cityToSlug,
  buildBeachUrl,
  buildBeachUrlWithTab,
  parseBeachUrl,
  buildStateUrl,
  buildCityUrl,
  buildInternationalCityUrl,
  buildInternationalBeachUrl,
  getBeachHrefSafe,
  getUsStateRootPathOrNull,
  getValidStateSlugs,
  isValidStateSlug,
} from "@/lib/utils/beach-url-utils";

describe("Beach URL Utils", () => {
  describe("stateToSlug", () => {
    it.each([
      ["DE", "Delaware", "de"],
      ["MD", "Maryland", "md"],
    ])("recognizes %s catalog beach routes", (code, name, slug) => {
      expect(stateToSlug(code)).toBe(slug);
      expect(stateToSlug(name)).toBe(slug);
      expect(isValidStateSlug(slug)).toBe(true);
      expect(getUsStateRootPathOrNull(code)).toBe(`/beaches/usa/${slug}`);
    });

    it("should convert CA to ca", () => {
      expect(stateToSlug("CA")).toBe("ca");
    });

    it("should convert OR to or", () => {
      expect(stateToSlug("OR")).toBe("or");
    });

    it("should convert Oregon to or", () => {
      expect(stateToSlug("Oregon")).toBe("or");
    });

    it("should convert WA to wa", () => {
      expect(stateToSlug("WA")).toBe("wa");
    });

    it("should convert Washington to wa", () => {
      expect(stateToSlug("Washington")).toBe("wa");
    });

    it("should convert HI to hi", () => {
      expect(stateToSlug("HI")).toBe("hi");
    });

    it("should convert Hawaii to hi", () => {
      expect(stateToSlug("Hawaii")).toBe("hi");
    });

    it("should slugify international regions (country handled separately)", () => {
      expect(stateToSlug("Baja California")).toBe("baja-california");
    });

    it("should handle null state", () => {
      expect(stateToSlug(null)).toBe("");
    });

    it("should handle undefined state", () => {
      expect(stateToSlug(undefined)).toBe("");
    });

    it("should map known state names to 2-letter codes", () => {
      expect(stateToSlug("New York")).toBe("ny");
      expect(stateToSlug("North Carolina")).toBe("nc");
    });

    it("should slugify truly unknown state names", () => {
      expect(stateToSlug("Unknown State")).toBe("unknown-state");
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

    it("should remove special characters and normalize diacritics", () => {
      expect(cityToSlug("O'ahu")).toBe("oahu");
      // Uses slugifyAscii to properly handle accented characters
      expect(cityToSlug("San José")).toBe("san-jose");
      expect(cityToSlug("Rincón")).toBe("rincon");
      expect(cityToSlug("São Paulo")).toBe("sao-paulo");
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

    it("should build hierarchical URL for Oregon beaches", () => {
      const beach = {
        slug: "agate-beach",
        city: "Newport",
        state: "OR",
      };
      expect(buildBeachUrl(beach)).toBe("/or/newport/agate-beach");
    });

    it("should build hierarchical URL for Washington beaches", () => {
      const beach = {
        slug: "westport-jetty",
        city: "Westport",
        state: "WA",
      };
      expect(buildBeachUrl(beach)).toBe("/wa/westport/westport-jetty");
    });

    it("should build hierarchical URL for Hawaii beaches", () => {
      const beach = {
        slug: "pipeline",
        city: "Haleiwa",
        state: "HI",
      };
      expect(buildBeachUrl(beach)).toBe("/hi/haleiwa/pipeline");
    });

    it("should build hierarchical URL for Baja California beaches", () => {
      const beach = {
        slug: "k38",
        city: "Ensenada",
        state: "Baja California",
        country: "Mexico",
      };
      expect(buildBeachUrl(beach)).toBe("/mexico/baja-california/ensenada/k38");
    });

    it.each([null, "", "   "])(
      "should never treat an explicitly unknown country (%j) as USA",
      (country) => {
        expect(
          buildBeachUrl({
            slug: "k-40-puerto-nuevo",
            city: "Puerto Nuevo",
            state: "Baja California",
            country,
          }),
        ).toBe("/beach/k-40-puerto-nuevo");
      },
    );

    it("keeps the legacy USA shape only when country is omitted", () => {
      expect(
        buildBeachUrl({
          slug: "ocean-beach",
          city: "San Diego",
          state: "CA",
        }),
      ).toBe("/ca/san-diego/ocean-beach");
      expect(
        buildBeachUrl({
          slug: "k-40-puerto-nuevo",
          city: "Puerto Nuevo",
          state: "Baja California",
          country: undefined,
        }),
      ).toBe("/beach/k-40-puerto-nuevo");
      expect(
        getBeachHrefSafe({
          slug: "k-40-puerto-nuevo",
          city: "Puerto Nuevo",
          state: "Baja California",
          country: undefined,
        }),
      ).toBe("/beach/k-40-puerto-nuevo");
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
        slug: "blacks",
        city: "San Diego",
        state: "CA",
      };
      expect(buildBeachUrl(beach)).toBe("/ca/san-diego/blacks");
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
      expect(buildStateUrl("Baja California")).toBe("/baja-california");
    });

    it("should use 2-letter codes for known states", () => {
      expect(buildStateUrl("New York")).toBe("/ny");
      expect(buildStateUrl("Oregon")).toBe("/or");
      expect(buildStateUrl("Hawaii")).toBe("/hi");
    });

    it("should slugify truly unknown states", () => {
      expect(buildStateUrl("Unknown State")).toBe("/unknown-state");
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

  describe("getUsStateRootPathOrNull", () => {
    it("should return a state listing URL path for valid US states", () => {
      expect(getUsStateRootPathOrNull("CA")).toBe("/beaches/usa/ca");
      expect(getUsStateRootPathOrNull("California")).toBe("/beaches/usa/ca");
      expect(getUsStateRootPathOrNull("NJ")).toBe("/beaches/usa/nj");
      expect(getUsStateRootPathOrNull("New Jersey")).toBe("/beaches/usa/nj");
    });

    it("should return null for international or non-US states", () => {
      expect(getUsStateRootPathOrNull("Baja California")).toBeNull();
      expect(getUsStateRootPathOrNull("mexico/baja-california")).toBeNull();
    });

    it("should return null for empty values", () => {
      expect(getUsStateRootPathOrNull("")).toBeNull();
      expect(getUsStateRootPathOrNull(null)).toBeNull();
      expect(getUsStateRootPathOrNull(undefined)).toBeNull();
    });
  });

  describe("buildCityUrl", () => {
    it("should build URL for California city", () => {
      expect(buildCityUrl("CA", "San Diego")).toBe("/ca/san-diego");
    });

    it("should build URL for Baja California city", () => {
      expect(buildCityUrl("Baja California", "Ensenada")).toBe(
        "/baja-california/ensenada"
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

    it("should use 2-letter codes for known states with city", () => {
      expect(buildCityUrl("New York", "New York City")).toBe(
        "/ny/new-york-city"
      );
      expect(buildCityUrl("Oregon", "Portland")).toBe("/or/portland");
    });

    it("should slugify truly unknown state and city", () => {
      expect(buildCityUrl("Unknown State", "Some City")).toBe(
        "/unknown-state/some-city"
      );
    });
  });

  describe("getValidStateSlugs", () => {
    it("should return an array of state slugs", () => {
      const slugs = getValidStateSlugs();
      expect(Array.isArray(slugs)).toBe(true);
      expect(slugs.length).toBeGreaterThan(0);
    });

    it("should include common US state slugs", () => {
      const slugs = getValidStateSlugs();
      expect(slugs).toContain("ca");
      expect(slugs).toContain("or");
      expect(slugs).toContain("wa");
      expect(slugs).toContain("hi");
      expect(slugs).toContain("fl");
      expect(slugs).toContain("va");
    });

    // International slugs are NOT considered "state slugs" for route disambiguation.

    it("should not contain duplicates", () => {
      const slugs = getValidStateSlugs();
      const uniqueSlugs = [...new Set(slugs)];
      expect(slugs.length).toBe(uniqueSlugs.length);
    });
  });

  describe("isValidStateSlug", () => {
    it("should return true for valid state slugs", () => {
      expect(isValidStateSlug("ca")).toBe(true);
      expect(isValidStateSlug("or")).toBe(true);
      expect(isValidStateSlug("wa")).toBe(true);
      expect(isValidStateSlug("hi")).toBe(true);
      expect(isValidStateSlug("va")).toBe(true);
    });

    it("should return true regardless of case", () => {
      expect(isValidStateSlug("CA")).toBe(true);
      expect(isValidStateSlug("Or")).toBe(true);
      expect(isValidStateSlug("WA")).toBe(true);
      expect(isValidStateSlug("Va")).toBe(true);
    });

    it("should return false for intent slugs", () => {
      expect(isValidStateSlug("surf-forecast")).toBe(false);
      expect(isValidStateSlug("surf-report")).toBe(false);
      expect(isValidStateSlug("beginner")).toBe(false);
      expect(isValidStateSlug("least-crowded")).toBe(false);
    });

    it("should return false for invalid slugs", () => {
      expect(isValidStateSlug("xx")).toBe(false);
      expect(isValidStateSlug("invalid")).toBe(false);
      expect(isValidStateSlug("")).toBe(false);
    });

    it("should return false for international location slugs", () => {
      expect(isValidStateSlug("mexico")).toBe(false);
      expect(isValidStateSlug("baja-california")).toBe(false);
      expect(isValidStateSlug("mexico/baja-california")).toBe(false);
    });
  });

  describe("getBeachHrefSafe", () => {
    it("should return hierarchical URL when city/state/slug exist", () => {
      expect(
        getBeachHrefSafe({
          slug: "ocean-beach",
          city: "San Diego",
          state: "CA",
        })
      ).toBe("/ca/san-diego/ocean-beach");
    });

    it("should fallback to /beach/{slug} when city/state missing", () => {
      expect(
        getBeachHrefSafe({
          slug: "test-beach",
          city: null,
          state: null,
        })
      ).toBe("/beach/test-beach");
    });

    it("should use a country-independent fallback when country is explicitly unknown", () => {
      expect(
        getBeachHrefSafe({
          slug: "k-40-puerto-nuevo",
          city: "Puerto Nuevo",
          state: "Baja California",
          country: null,
        }),
      ).toBe("/beach/k-40-puerto-nuevo");
    });

    it("should fallback to /beach/{id} when slug missing but id exists", () => {
      expect(
        getBeachHrefSafe({
          id: "00000000-0000-0000-0000-000000000000",
          slug: null,
          city: "San Diego",
          state: "CA",
        })
      ).toBe("/beach/00000000-0000-0000-0000-000000000000");
    });

    it("should return null when insufficient data exists (and never '#')", () => {
      expect(getBeachHrefSafe({ id: null, slug: null })).toBeNull();
    });
  });

  describe("International URL builders", () => {
    it("should build canonical international city URL", () => {
      expect(buildInternationalCityUrl("Mexico", "Baja California", "Rosarito")).toBe(
        "/mexico/baja-california/rosarito"
      );
    });

    it("should build canonical international beach URL", () => {
      expect(
        buildInternationalBeachUrl(
          "Mexico",
          "Baja California",
          "Rosarito",
          "teresas"
        )
      ).toBe("/mexico/baja-california/rosarito/teresas");
    });
  });

  describe("Integration tests", () => {
    it("should handle complete workflow for California beach", () => {
      const beach = {
        slug: "blacks",
        city: "San Diego",
        state: "CA",
      };

      const url = buildBeachUrl(beach);
      expect(url).toBe("/ca/san-diego/blacks");

      const parsed = parseBeachUrl(url);
      expect(parsed).toEqual({
        stateSlug: "ca",
        citySlug: "san-diego",
        beachSlug: "blacks",
      });
    });

    it("should handle complete workflow for Oregon beach", () => {
      const beach = {
        slug: "agate-beach",
        city: "Newport",
        state: "OR",
      };

      const url = buildBeachUrl(beach);
      expect(url).toBe("/or/newport/agate-beach");

      const parsed = parseBeachUrl(url);
      expect(parsed).toEqual({
        stateSlug: "or",
        citySlug: "newport",
        beachSlug: "agate-beach",
      });
    });

    it("should handle complete workflow for Hawaii beach", () => {
      const beach = {
        slug: "pipeline",
        city: "Haleiwa",
        state: "HI",
      };

      const url = buildBeachUrl(beach);
      expect(url).toBe("/hi/haleiwa/pipeline");

      const parsed = parseBeachUrl(url);
      expect(parsed).toEqual({
        stateSlug: "hi",
        citySlug: "haleiwa",
        beachSlug: "pipeline",
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

    it("should handle Oregon city and state URLs", () => {
      const stateUrl = buildStateUrl("OR");
      expect(stateUrl).toBe("/or");

      const cityUrl = buildCityUrl("OR", "Newport");
      expect(cityUrl).toBe("/or/newport");
    });
  });
});
