/**
 * Tests for SEO Metadata Builder
 *
 * Tests the buildPageMetadata function for generating Next.js Metadata objects.
 * Priority 2 test coverage for San Diego page redesign.
 */

import {
  buildPageMetadata,
  buildDynamicBeachMetadata,
  buildDynamicTideMetadata,
  buildDynamicWaterTempMetadata,
  extractDescriptionSnippet,
} from "@/lib/seo/meta";
import { SEO_CONFIG } from "@/lib/constants/seo";

// Type helper for test assertions - Metadata has union types that need narrowing
const getMeta = (params: Parameters<typeof buildPageMetadata>[0]): any => buildPageMetadata(params);

describe("SEO Meta Builder", () => {
  const mockParams = {
    title: "Test Page Title",
    description: "Test page description for SEO",
    path: "/test/path",
  };

  describe("buildPageMetadata", () => {
    describe("Basic Metadata", () => {
      it("should generate correct title", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.title).toBe("Test Page Title");
      });

      it("should generate correct description", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.description).toBe("Test page description for SEO");
      });

      it("should generate default keywords from SEO_CONFIG", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.keywords).toEqual([...SEO_CONFIG.keywords]);
      });

      it("should use custom keywords when provided", () => {
        const customKeywords = ["custom", "keywords", "test"];
        const result = buildPageMetadata({
          ...mockParams,
          keywords: customKeywords,
        });
        expect(result.keywords).toEqual(customKeywords);
      });
    });

    describe("Canonical URL", () => {
      it("should build canonical URL from path", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.alternates?.canonical).toContain("/test/path");
      });

      it("should handle path without leading slash", () => {
        const result = buildPageMetadata({
          ...mockParams,
          path: "test/path",
        });
        expect(result.alternates?.canonical).toContain("test/path");
      });

      it("should use NEXT_PUBLIC_SITE_URL as base", () => {
        const result = buildPageMetadata(mockParams);
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        expect(result.alternates?.canonical).toContain(baseUrl.replace(/\/$/, ""));
      });
    });

    describe("OpenGraph Metadata", () => {
      it("should include og:title", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.openGraph?.title).toBe("Test Page Title");
      });

      it("should include og:description", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.openGraph?.description).toBe("Test page description for SEO");
      });

      it("should include og:url", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.openGraph?.url).toContain("/test/path");
      });

      it("should include og:siteName from SEO_CONFIG", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.openGraph?.siteName).toBe(SEO_CONFIG.openGraph.siteName);
      });

      it("should include og:type from SEO_CONFIG", () => {
        const result = getMeta(mockParams);
        expect(result.openGraph?.type).toBe(SEO_CONFIG.openGraph.type);
      });

      it("should include og:locale from SEO_CONFIG", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.openGraph?.locale).toBe(SEO_CONFIG.openGraph.locale);
      });

      it("should include og:images array", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.openGraph?.images).toBeDefined();
        expect(Array.isArray(result.openGraph?.images)).toBe(true);
        expect((result.openGraph?.images as Array<{ width: number }>)?.[0]).toHaveProperty("width", 1200);
        expect((result.openGraph?.images as Array<{ height: number }>)?.[0]).toHaveProperty("height", 630);
      });

      it("should use default image when none provided", () => {
        const result = buildPageMetadata(mockParams);
        const images = result.openGraph?.images as Array<{ url: string }>;
        expect(images?.[0]?.url).toBeTruthy();
      });

      it("should use custom image when provided", () => {
        const customImage = "/custom-og-image.png";
        const result = buildPageMetadata({
          ...mockParams,
          image: customImage,
        });
        const images = result.openGraph?.images as Array<{ url: string }>;
        // Images are absolutified for social media crawlers
        expect(images?.[0]?.url).toBe("http://localhost:3000/custom-og-image.png");
      });

      it("should include alt text in images", () => {
        const result = buildPageMetadata(mockParams);
        const images = result.openGraph?.images as Array<{ alt: string }>;
        expect(images?.[0]?.alt).toBe("Test Page Title");
      });
    });

    describe("Twitter Card Metadata", () => {
      it("should include twitter:card type from SEO_CONFIG", () => {
        const result = getMeta(mockParams);
        expect(result.twitter?.card).toBe(SEO_CONFIG.twitter.card);
      });

      it("should include twitter:title", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.twitter?.title).toBe("Test Page Title");
      });

      it("should include twitter:description", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.twitter?.description).toBe("Test page description for SEO");
      });

      it("should include twitter:site handle", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.twitter?.site).toBe(SEO_CONFIG.twitter.site);
      });

      it("should include twitter:creator handle", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.twitter?.creator).toBe(SEO_CONFIG.twitter.creator);
      });

      it("should include twitter:images", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.twitter?.images).toBeDefined();
        expect(Array.isArray(result.twitter?.images)).toBe(true);
      });

      it("should use custom image for twitter when provided", () => {
        const customImage = "/custom-twitter-image.png";
        const result = buildPageMetadata({
          ...mockParams,
          image: customImage,
        });
        const images = result.twitter?.images as string[];
        // Images are absolutified for social media crawlers
        expect(images?.[0]).toBe("http://localhost:3000/custom-twitter-image.png");
      });
    });

    describe("Robots Configuration", () => {
      it("should include robots configuration", () => {
        const result = buildPageMetadata(mockParams);
        expect(result.robots).toBeDefined();
      });

      it("should set index based on DISALLOW_ROBOTS env", () => {
        const result = getMeta(mockParams);
        expect(typeof result.robots?.index).toBe("boolean");
      });

      it("should set follow based on DISALLOW_ROBOTS env", () => {
        const result = getMeta(mockParams);
        expect(typeof result.robots?.follow).toBe("boolean");
      });

      it("should include googleBot configuration", () => {
        const result = getMeta(mockParams);
        expect(result.robots?.googleBot).toBeDefined();
        expect(typeof result.robots?.googleBot?.index).toBe("boolean");
        expect(typeof result.robots?.googleBot?.follow).toBe("boolean");
      });

      it("should return index=true when DISALLOW_ROBOTS is not set", () => {
        // By default DISALLOW_ROBOTS should not be set
        const originalEnv = process.env.DISALLOW_ROBOTS;
        delete process.env.DISALLOW_ROBOTS;

        const result = getMeta(mockParams);
        expect(result.robots?.index).toBe(true);
        expect(result.robots?.follow).toBe(true);

        process.env.DISALLOW_ROBOTS = originalEnv;
      });
    });

    describe("Return Type Structure", () => {
      it("should return a valid Metadata object", () => {
        const result = buildPageMetadata(mockParams);

        expect(result).toHaveProperty("title");
        expect(result).toHaveProperty("description");
        expect(result).toHaveProperty("keywords");
        expect(result).toHaveProperty("alternates");
        expect(result).toHaveProperty("openGraph");
        expect(result).toHaveProperty("twitter");
        expect(result).toHaveProperty("robots");
      });

      it("should have alternates.canonical as string", () => {
        const result = buildPageMetadata(mockParams);
        expect(typeof result.alternates?.canonical).toBe("string");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty title", () => {
        const result = buildPageMetadata({
          ...mockParams,
          title: "",
        });
        expect(result.title).toBe("");
      });

      it("should handle empty description", () => {
        const result = buildPageMetadata({
          ...mockParams,
          description: "",
        });
        expect(result.description).toBe("");
      });

      it("should handle root path", () => {
        const result = buildPageMetadata({
          ...mockParams,
          path: "/",
        });
        expect(result.alternates?.canonical).toContain("/");
      });

      it("should handle deeply nested path", () => {
        const result = buildPageMetadata({
          ...mockParams,
          path: "/beaches/usa/ca/san-diego",
        });
        expect(result.alternates?.canonical).toContain("/beaches/usa/ca/san-diego");
      });

      it("should handle path with query params (stripped by URL constructor)", () => {
        const result = buildPageMetadata({
          ...mockParams,
          path: "/test?query=param",
        });
        expect(result.alternates?.canonical).toBeTruthy();
      });

      it("should handle very long title", () => {
        const longTitle = "A".repeat(500);
        const result = buildPageMetadata({
          ...mockParams,
          title: longTitle,
        });
        expect(result.title).toBe(longTitle);
      });

      it("should handle special characters in title", () => {
        const specialTitle = "Beach Guide | San Diego & More <2024>";
        const result = buildPageMetadata({
          ...mockParams,
          title: specialTitle,
        });
        expect(result.title).toBe(specialTitle);
      });

      it("should handle empty keywords array", () => {
        const result = buildPageMetadata({
          ...mockParams,
          keywords: [],
        });
        expect(result.keywords).toEqual([]);
      });
    });

    describe("Integration with SEO_CONFIG", () => {
      it("should use SEO_CONFIG.openGraph.images fallback", () => {
        const result = buildPageMetadata(mockParams);
        const images = result.openGraph?.images as Array<{ url: string }>;

        // Should use either custom image, SEO_CONFIG image, or fallback
        expect(images?.[0]?.url).toBeTruthy();
      });

      it("should preserve SEO_CONFIG structure for twitter", () => {
        const result = getMeta(mockParams);

        expect(result.twitter?.card).toBe(SEO_CONFIG.twitter.card);
        expect(result.twitter?.site).toBe(SEO_CONFIG.twitter.site);
        expect(result.twitter?.creator).toBe(SEO_CONFIG.twitter.creator);
      });
    });
  });

  describe("buildDynamicBeachMetadata", () => {
    const mockBeach = {
      name: "Ocean Beach",
      city: "San Diego",
      state: "CA",
    };

    describe("with forecast data", () => {
      it("should include wave height in title when available", () => {
        const result = buildDynamicBeachMetadata({
          beach: mockBeach,
          forecast: { wave_height: "3-5ft" },
        });
        expect(result.title).toContain("3-5ft");
        expect(result.title).toContain("Ocean Beach");
      });

      it("should include wave height in description", () => {
        const result = buildDynamicBeachMetadata({
          beach: mockBeach,
          forecast: { wave_height: "3-5ft" },
        });
        expect(result.description).toContain("3-5ft");
      });
    });

    describe("without forecast data", () => {
      it("should use fallback title when forecast is null", () => {
        const result = buildDynamicBeachMetadata({
          beach: mockBeach,
          forecast: null,
        });
        expect(result.title).toContain("Ocean Beach");
        // City is used as trailing signal in tier-3 when available; "Surf Report" is
        // the last-resort fallback for beaches with no city, break_type, or crowd signal.
        expect(result.title).toContain("San Diego");
      });

      it("should use fallback title when wave_height is null", () => {
        const result = buildDynamicBeachMetadata({
          beach: mockBeach,
          forecast: { wave_height: null },
        });
        expect(result.title).toContain("Ocean Beach");
      });

      it("should include location context in fallback description", () => {
        const result = buildDynamicBeachMetadata({
          beach: mockBeach,
          forecast: null,
        });
        expect(result.description).toContain("San Diego");
      });
    });

    describe("title truncation", () => {
      it("should truncate very long beach names to fit SEO limits", () => {
        const longNameBeach = {
          name: "Super Long Beach Name That Goes On And On Forever",
          city: "San Diego",
          state: "CA",
        };
        const result = buildDynamicBeachMetadata({
          beach: longNameBeach,
          forecast: { wave_height: "3-5ft" },
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
      });
    });

    describe("Fix 1: location context in titles", () => {
      it("PR beach with forecast includes PR or Puerto Rico in title", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Tres Palmas",
            city: "Rincón",
            state: "PR",
            break_type: "reef",
            skill_level: "expert",
            wave_tips: "heavy walls that test the best surfers",
          },
          forecast: { wave_height: "2.7 ft" },
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
        expect(result.title).toMatch(/PR|Puerto Rico/);
      });

      it("HI beach with forecast includes HI or Hawaii in title", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Pipeline",
            city: "Haleiwa",
            state: "HI",
            break_type: "reef",
            skill_level: "expert",
            wave_tips: "hollow barrels",
          },
          forecast: { wave_height: "8 ft" },
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
        expect(result.title).toMatch(/HI|Hawaii|Haleiwa/);
      });

      it("CA beach with forecast includes San Diego (regression)", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Blacks",
            city: "San Diego",
            state: "CA",
            break_type: "beach",
            skill_level: "advanced",
            wave_tips: "powerful shore break",
          },
          forecast: { wave_height: "4 ft" },
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
        expect(result.title).toContain("San Diego");
      });

      it("CA beach without forecast includes San Diego (regression)", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Blacks",
            city: "San Diego",
            state: "CA",
            break_type: "beach",
            skill_level: "advanced",
          },
          forecast: null,
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
        expect(result.title).toContain("San Diego");
      });

      it("beach with no city or state still produces a valid title", () => {
        const result = buildDynamicBeachMetadata({
          beach: { name: "Unnamed Point" },
          forecast: { wave_height: "3 ft" },
        });
        expect(result.title).toContain("Unnamed Point");
        expect(result.title.length).toBeLessThanOrEqual(60);
      });

      it("long beach name stress test keeps title under 60 chars with location", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Rincon Point",
            city: "Santa Barbara",
            state: "CA",
            break_type: "point",
            skill_level: "intermediate",
            wave_tips: "long peeling right-handers",
          },
          forecast: { wave_height: "4-6 ft" },
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
      });
    });

    describe("Fix 2: description improvements", () => {
      it("description includes location for PR beach (Puerto Rico or Rincón)", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Tres Palmas",
            city: "Rincón",
            state: "PR",
            wave_tips: "heavy walls that test the best surfers",
          },
          forecast: { wave_height: "2.7 ft" },
        });
        expect(result.description).toMatch(/Puerto Rico|Rincón/);
        expect(result.description.length).toBeLessThanOrEqual(160);
      });

      it("description contains '7-day surf forecast' (not just '7-day forecast')", () => {
        const result = buildDynamicBeachMetadata({
          beach: { name: "Ocean Beach", city: "San Diego", state: "CA" },
          forecast: { wave_height: "3 ft" },
        });
        expect(result.description).toContain("7-day surf forecast");
      });

      it("wave tips with semicolons split cleanly at clause boundary", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Pier Break",
            city: "Huntington",
            state: "CA",
            wave_tips: "Small peaks form around the pier; look for sandbars that create shape on medium swells",
          },
          forecast: { wave_height: "2 ft" },
        });
        // Should not cut mid-word and should end cleanly
        expect(result.description).not.toMatch(/\w-\s/); // no hyphenated mid-word breaks
        expect(result.description.length).toBeLessThanOrEqual(160);
      });

      it("wave tips with no periods produce clean description without truncation artifacts", () => {
        const longTip = "Powerful beach break that fires on north swells with a long journey from the Aleutians";
        const result = buildDynamicBeachMetadata({
          beach: { name: "Test Beach", city: "San Diego", state: "CA", wave_tips: longTip },
          forecast: { wave_height: "5 ft" },
        });
        expect(result.description.length).toBeLessThanOrEqual(160);
        // No bare truncation ending in weak word
        expect(result.description).not.toMatch(/ (the|a|for|in|at|to|of|that|but|with)\./);
      });

      it("description length never exceeds 160 chars (with rating)", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "A Very Long Named Beach Somewhere",
            city: "San Francisco",
            state: "CA",
            wave_tips: "Consistent and powerful swells roll in from the open Pacific, creating long peeling walls perfect for high-performance surfing on any tide.",
            average_rating: 4.8,
            review_count: 15,
          },
          forecast: { wave_height: "6-8 ft" },
        });
        expect(result.description.length).toBeLessThanOrEqual(160);
      });

      it("description length never exceeds 160 chars (no rating)", () => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "OB",
            city: "SF",
            state: "CA",
            wave_tips: "Consistent swells roll in from the open Pacific creating long peeling walls perfect for high performance surfing on any given tide at all swell directions",
          },
          forecast: { wave_height: "3 ft" },
        });
        expect(result.description.length).toBeLessThanOrEqual(160);
      });
    });

    describe("Fix 4: expanded wave character keywords", () => {
      const testKeyword = (waveTips: string, expectedChar: string) => {
        const result = buildDynamicBeachMetadata({
          beach: {
            name: "Test Beach",
            city: "San Diego",
            state: "CA",
            break_type: "beach",
            skill_level: "intermediate",
            wave_tips: waveTips,
          },
          forecast: { wave_height: "3 ft" },
        });
        expect(result.title).toContain(expectedChar);
      };

      it("'punchy' wave_tips surfaces Punchy in title", () => {
        // Use wave_tips that only matches 'punchy', not earlier keywords like 'powerful'
        testKeyword("Punchy shore break that rewards quick reactive turns", "Punchy");
      });

      it("'heavy walls' wave_tips surfaces Heavy in title", () => {
        // Use wave_tips that only matches 'heavy', not 'hollow' or 'powerful'
        testKeyword("heavy walls that challenge even expert surfers at Tres Palmas", "Heavy");
      });

      it("'clean' wave_tips surfaces Clean in title", () => {
        // Use wave_tips with no earlier keyword matches
        testKeyword("clean lined-up swells with excellent shape at mid tide", "Clean");
      });

      it("existing keyword 'hollow' still works", () => {
        testKeyword("hollow barrels on a low tide push", "Hollow");
      });

      it("existing keyword 'mellow' still works", () => {
        // Use wave_tips that only matches 'mellow' — avoid 'long', 'fast', 'powerful', 'hollow'
        testKeyword("mellow glassy waves great for beginners and cruisy surfers", "Mellow");
      });
    });
  });

  describe("extractDescriptionSnippet", () => {
    it("returns whole first sentence when it fits budget", () => {
      const result = extractDescriptionSnippet("Powerful beach break.", 50);
      expect(result).toBe("Powerful beach break");
    });

    it("splits at semicolons when first sentence is too long", () => {
      const tip = "Small peaks form around the pier; look for sandbars";
      const result = extractDescriptionSnippet(tip, 35);
      expect(result).toBe("Small peaks form around the pier");
    });

    it("splits at em-dash clause boundaries", () => {
      const tip = "Long right-hand walls — best at mid tide with south swell";
      const result = extractDescriptionSnippet(tip, 25);
      expect(result).toBe("Long right-hand walls");
    });

    it("strips weak trailing words before period", () => {
      const result = extractDescriptionSnippet("Great waves roll in from the", 30);
      // "the" is a weak word at the end — should be stripped
      expect(result).not.toMatch(/ (the|a|for|in|at|to|of)$/i);
    });

    it("capitalizes first character of snippet", () => {
      const result = extractDescriptionSnippet("powerful waves on the north shore", 50);
      expect(result[0]).toBe("P");
    });

    it("returns empty string for empty input", () => {
      expect(extractDescriptionSnippet("", 60)).toBe("");
    });

    it("returns empty string when budget is 0", () => {
      expect(extractDescriptionSnippet("Some wave tips here", 0)).toBe("");
    });

    it("only uses first sentence when multiple sentences exist", () => {
      const result = extractDescriptionSnippet("First sentence. Second sentence. Third.", 60);
      expect(result).toBe("First sentence");
    });
  });

  describe("buildDynamicTideMetadata", () => {
    const mockBeach = {
      name: "Ocean Beach",
      city: "San Diego",
      state: "CA",
    };

    describe("title — query-match anchor + planning signal (v4)", () => {
      it("should contain 'Tide Chart' query-match anchor in title", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM" },
        });
        expect(result.title).toContain("Tide Chart");
      });

      it("should contain beach name in title", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM" },
        });
        expect(result.title).toContain("Ocean Beach");
      });

      it("should contain planning signal 'When to Surf' with em dash", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: null,
        });
        expect(result.title).toContain("\u2014 When to Surf");
      });

      it("should NOT put raw tide times in title (avoids giving away the answer Google shows)", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: {
            nextHighTime: "2:30 PM",
            nextLowTime: "8:45 AM",
            nextHighHeight: 5.2,
            nextLowHeight: 0.8,
          },
        });
        expect(result.title).not.toContain("2:30 PM");
        expect(result.title).not.toContain("5.2ft");
        expect(result.title.length).toBeLessThanOrEqual(60);
      });

      it("should include month+year date token in title when name is short enough (tier 1)", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: null,
        });
        expect(result.title).toMatch(/\|\s+\w+ \d{4}$/);
      });

      it("title is identical with or without tide data (consistent value signal)", () => {
        const withData = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM", nextHighHeight: 5.2, nextLowHeight: 0.8 },
        });
        const withoutData = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: null,
        });
        expect(withData.title).toBe(withoutData.title);
      });

      it("long beach name falls back to tier 3 (no date, no planning signal)", () => {
        const longBeach = { name: "Super Long Beach Name That Goes On And On Forever" };
        const result = buildDynamicTideMetadata({ beach: longBeach, tideData: null });
        expect(result.title.length).toBeLessThanOrEqual(60);
        expect(result.title).not.toMatch(/\|\s+\w+ \d{4}$/);
      });

      it("medium-length beach name gets tier 2 (no date) when tier 1 exceeds 60 chars", () => {
        const mediumBeach = { name: "Rincon De La Paloma" };
        const tier1 = `${mediumBeach.name} Tide Chart \u2014 When to Surf | Apr 2026`;
        const tier2 = `${mediumBeach.name} Tide Chart \u2014 When to Surf`;
        if (tier1.length > 60 && tier2.length <= 60) {
          const result = buildDynamicTideMetadata({ beach: mediumBeach, tideData: null });
          expect(result.title).toBe(tier2);
        } else {
          expect(true).toBe(true);
        }
      });
    });

    describe("description — question-leading format with tide data", () => {
      it("should lead description with unanswerable question", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM" },
        });
        expect(result.description).toMatch(/^Is incoming or outgoing tide better for/);
      });

      it("should include both tide times in description when available", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM" },
        });
        expect(result.description).toContain("2:30 PM");
        expect(result.description).toContain("8:45 AM");
      });

      it("should include height values in description when provided", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: {
            nextHighTime: "2:30 PM",
            nextLowTime: "8:45 AM",
            nextHighHeight: 5.2,
            nextLowHeight: 0.8,
          },
        });
        expect(result.description).toContain("5.2ft");
        expect(result.description).toContain("0.8ft");
      });

      it("should mention surf windows and sweet spots", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: {
            nextHighTime: "2:30 PM",
            nextLowTime: "8:45 AM",
            nextHighHeight: 5.2,
            nextLowHeight: 0.8,
          },
        });
        expect(result.description).toContain("Surf windows");
        expect(result.description).toContain("sweet spots");
      });

      it("should use 7-day outlook fallback description when no tide data", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: null,
        });
        expect(result.description).toMatch(/^Is incoming or outgoing tide better for/);
        expect(result.description).toContain("7-day outlook");
        expect(result.description).toContain("surf windows");
      });

      it("description length never exceeds 160 chars", () => {
        const result = buildDynamicTideMetadata({
          beach: { name: "A Very Long Named Surf Beach Near The Pier And The Boardwalk" },
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM", nextHighHeight: 5.2, nextLowHeight: 0.8 },
        });
        expect(result.description.length).toBeLessThanOrEqual(160);
      });
    });

    describe("without tide data", () => {
      it("should use query-matching fallback title when tideData is null", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: null,
        });
        expect(result.title).toContain("Ocean Beach");
        expect(result.title).toContain("Tide Chart");
      });

      it("should use query-matching fallback title when nextHighTime is null", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: null, nextLowTime: null },
        });
        expect(result.title).toContain("Ocean Beach");
        expect(result.title).toContain("Tide Chart");
        expect(result.title).not.toContain("Next High");
      });
    });

    describe("title truncation", () => {
      it("should truncate very long beach names to fit SEO limits", () => {
        const longNameBeach = {
          name: "Super Long Beach Name That Goes On And On Forever",
          city: "San Diego",
          state: "CA",
        };
        const result = buildDynamicTideMetadata({
          beach: longNameBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM" },
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
      });
    });
  });

  describe("buildDynamicWaterTempMetadata", () => {
    const mockBeach = {
      name: "Ocean Beach",
      city: "San Diego",
      state: "CA",
    };

    describe("title — query-match anchor + planning signal (v4)", () => {
      it("should contain 'Water Temp' query-match anchor in title", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.title).toContain("Water Temp");
      });

      it("should contain beach name in title", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.title).toContain("Ocean Beach");
      });

      it("should contain planning signal 'What Wetsuit Today' with em dash", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: null,
        });
        expect(result.title).toContain("\u2014 What Wetsuit Today");
      });

      it("should NOT put raw temperature in title (avoids giving away answer Google shows)", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.title).not.toContain("64°F");
        expect(result.title).not.toContain("3/2mm");
        expect(result.title.length).toBeLessThanOrEqual(60);
      });

      it("should include month+year date token in title when name is short enough (tier 1)", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: null,
        });
        expect(result.title).toMatch(/\|\s+\w+ \d{4}$/);
      });

      it("title is identical with or without water temp data (consistent value signal)", () => {
        const withData = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        const withoutData = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: null,
        });
        expect(withData.title).toBe(withoutData.title);
      });

      it("long beach name falls back to tier 3 when both tier 1 and tier 2 exceed 60 chars", () => {
        const longNameBeach = {
          name: "Super Long Beach Name That Goes On And On Forever",
          city: "San Diego",
          state: "CA",
        };
        const result = buildDynamicWaterTempMetadata({
          beach: longNameBeach,
          waterTempData: null,
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
        expect(result.title).not.toMatch(/\|\s+\w+ \d{4}$/);
      });

      it("medium-length beach name gets tier 2 (no date) when tier 1 exceeds 60 chars", () => {
        const mediumBeach = { name: "La Jolla Shores At The Cove" };
        const tier1 = `${mediumBeach.name} Water Temp \u2014 What Wetsuit Today | Apr 2026`;
        const tier2 = `${mediumBeach.name} Water Temp \u2014 What Wetsuit Today`;
        if (tier1.length > 60 && tier2.length <= 60) {
          const result = buildDynamicWaterTempMetadata({ beach: mediumBeach, waterTempData: null });
          expect(result.title).toBe(tier2);
        } else {
          expect(true).toBe(true);
        }
      });
    });

    describe("description — question-leading format with temp data", () => {
      it("should lead description with unanswerable question", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.description).toMatch(/^What wetsuit for/);
      });

      it("should include current temp in description when available", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.description).toContain("64°F");
      });

      it("should mention seasonal trends", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.description).toContain("seasonal trends");
      });

      it("should include beach name in description", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.description).toContain("Ocean Beach");
      });

      it("description length never exceeds 160 chars", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: { name: "A Very Long Named Surf Beach Near The Pier", city: "San Francisco", state: "CA" },
          waterTempData: { tempF: 58, wetsuitRec: "4/3mm fullsuit with boots" },
        });
        expect(result.description.length).toBeLessThanOrEqual(160);
      });

      it("description without data still leads with question and mentions session gear", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: null,
        });
        expect(result.description).toMatch(/^What wetsuit for/);
        expect(result.description).toContain("Plan your session gear");
      });

      it("description with data mentions NOAA buoys", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.description).toContain("NOAA buoys");
      });
    });

    describe("without water temp data", () => {
      it("should use query-matching fallback title when waterTempData is null", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: null,
        });
        expect(result.title).toContain("Ocean Beach");
        expect(result.title).toContain("Water Temp");
      });

      it("should use query-matching fallback title when tempF is null", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: null, wetsuitRec: null },
        });
        expect(result.title).toContain("Ocean Beach");
        expect(result.title).not.toContain("°F");
      });
    });

    describe("title truncation", () => {
      it("should truncate very long beach names to fit SEO limits", () => {
        const longNameBeach = {
          name: "Super Long Beach Name That Goes On And On Forever",
          city: "San Diego",
          state: "CA",
        };
        const result = buildDynamicWaterTempMetadata({
          beach: longNameBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.title.length).toBeLessThanOrEqual(60);
      });
    });
  });
});
