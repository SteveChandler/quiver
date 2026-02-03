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
        expect(result.title).toContain("Surf Report");
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
  });

  describe("buildDynamicTideMetadata", () => {
    const mockBeach = {
      name: "Ocean Beach",
      city: "San Diego",
      state: "CA",
    };

    describe("with tide data", () => {
      it("should include next high time in title", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM" },
        });
        expect(result.title).toContain("2:30 PM");
        expect(result.title).toContain("Ocean Beach");
      });

      it("should include both tide times in description", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: "2:30 PM", nextLowTime: "8:45 AM" },
        });
        expect(result.description).toContain("2:30 PM");
        expect(result.description).toContain("8:45 AM");
      });
    });

    describe("without tide data", () => {
      it("should use fallback title when tideData is null", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: null,
        });
        expect(result.title).toContain("Ocean Beach");
        expect(result.title).toContain("Tide Chart");
      });

      it("should use fallback title when nextHighTime is null", () => {
        const result = buildDynamicTideMetadata({
          beach: mockBeach,
          tideData: { nextHighTime: null, nextLowTime: null },
        });
        expect(result.title).toContain("Ocean Beach");
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

    describe("with water temp data", () => {
      it("should include temperature in title", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.title).toContain("64°F");
        expect(result.title).toContain("Ocean Beach");
      });

      it("should include temperature and wetsuit rec in description", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: { tempF: 64, wetsuitRec: "3/2mm fullsuit" },
        });
        expect(result.description).toContain("64°F");
        expect(result.description).toContain("3/2mm fullsuit");
      });
    });

    describe("without water temp data", () => {
      it("should use fallback title when waterTempData is null", () => {
        const result = buildDynamicWaterTempMetadata({
          beach: mockBeach,
          waterTempData: null,
        });
        expect(result.title).toContain("Ocean Beach");
        expect(result.title).toContain("Water Temperature");
      });

      it("should use fallback title when tempF is null", () => {
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
