/**
 * @jest-environment node
 *
 * Tests for surf-spots.ts and surf-intents.ts
 *
 * After refactoring, city resolution is now database-driven via findCityBySlug.
 * SURF_SPOTS is preserved for SEO content merging (history, FAQs, advice).
 * SURF_INTENTS is now in a separate constants file.
 */

import {
  SURF_INTENTS,
  type SurfIntentSlug,
} from "@/lib/constants/surf-intents";
import {
  SURF_SPOTS,
  getSpotBySlug,
} from "@/lib/data/surf-spots";

describe("lib/constants/surf-intents", () => {
  test("SURF_INTENTS shape is well-formed", () => {
    const intentSlugs = Object.keys(SURF_INTENTS) as SurfIntentSlug[];
    expect(intentSlugs.length).toBeGreaterThan(0);

    for (const slug of intentSlugs) {
      const intent = SURF_INTENTS[slug];
      expect(intent).toBeDefined();
      expect(intent.slug).toBe(slug);
      expect(typeof intent.label).toBe("string");
      expect(intent.label.length).toBeGreaterThan(0);
      expect(typeof intent.titleTemplate).toBe("function");
      expect(typeof intent.heading).toBe("function");
      expect(typeof intent.metaDescription).toBe("function");
      expect(typeof intent.intro).toBe("function");
      expect(Array.isArray(intent.focusPoints)).toBe(true);
      expect(intent.focusPoints.length).toBeGreaterThan(0);
    }
  });

  test("all required intent slugs exist", () => {
    const expectedIntents: SurfIntentSlug[] = [
      "beginner",
      "least-crowded",
      "tide",
      "water-temp",
      "longboard",
      "dawn-patrol",
      "sunset",
    ];

    for (const intent of expectedIntents) {
      expect(SURF_INTENTS[intent]).toBeDefined();
    }
  });

  test("intent titleTemplate functions generate valid strings", () => {
    const intentSlugs = Object.keys(SURF_INTENTS) as SurfIntentSlug[];

    for (const slug of intentSlugs) {
      const intent = SURF_INTENTS[slug];
      const title = intent.titleTemplate({ cityName: "Test City" });
      expect(typeof title).toBe("string");
      expect(title.length).toBeGreaterThan(0);
    }
  });

  test("intent heading functions generate valid strings", () => {
    const intentSlugs = Object.keys(SURF_INTENTS) as SurfIntentSlug[];

    for (const slug of intentSlugs) {
      const intent = SURF_INTENTS[slug];
      const heading = intent.heading({ cityName: "Test City" });
      expect(typeof heading).toBe("string");
      expect(heading.length).toBeGreaterThan(0);
    }
  });
});

describe("lib/data/surf-spots", () => {
  test("SURF_SPOTS records are structurally valid for SEO content", () => {
    const spots = Object.values(SURF_SPOTS);
    expect(spots.length).toBeGreaterThan(0);

    const slugs = new Set<string>();
    const intentSlugs = new Set(Object.keys(SURF_INTENTS));

    for (const [key, spot] of Object.entries(SURF_SPOTS)) {
      // key should match slug for stable lookups
      expect(spot.slug).toBe(key);
      expect(typeof spot.name).toBe("string");
      expect(spot.name.length).toBeGreaterThan(0);

      // Uniqueness
      expect(slugs.has(spot.slug)).toBe(false);
      slugs.add(spot.slug);

      // Coordinates sanity
      expect(Number.isFinite(spot.coordinates.lat)).toBe(true);
      expect(Number.isFinite(spot.coordinates.lon)).toBe(true);
      expect(spot.coordinates.lat).toBeGreaterThanOrEqual(-90);
      expect(spot.coordinates.lat).toBeLessThanOrEqual(90);
      expect(spot.coordinates.lon).toBeGreaterThanOrEqual(-180);
      expect(spot.coordinates.lon).toBeLessThanOrEqual(180);

      // Core text fields should be non-empty (SEO content)
      expect(typeof spot.overview).toBe("string");
      expect(spot.overview.length).toBeGreaterThan(0);
      expect(typeof spot.parking).toBe("string");
      expect(spot.parking.length).toBeGreaterThan(0);

      // Collections should be arrays
      expect(Array.isArray(spot.hazards)).toBe(true);
      expect(Array.isArray(spot.intentTags)).toBe(true);
      expect(spot.intentTags.length).toBeGreaterThan(0);

      // Intent tags must be valid
      for (const tag of spot.intentTags) {
        expect(intentSlugs.has(tag)).toBe(true);
      }
    }
  });

  test("getSpotBySlug returns spot for valid slug", () => {
    // Get first spot slug from SURF_SPOTS
    const firstSlug = Object.keys(SURF_SPOTS)[0];
    const spot = getSpotBySlug(firstSlug);

    expect(spot).toBeDefined();
    expect(spot?.slug).toBe(firstSlug);
  });

  test("getSpotBySlug returns undefined for invalid slug", () => {
    const spot = getSpotBySlug("non-existent-spot-slug");
    expect(spot).toBeUndefined();
  });

  test("spots have SEO-relevant content fields", () => {
    const spots = Object.values(SURF_SPOTS);

    for (const spot of spots) {
      // Overview is required for SEO
      expect(spot.overview).toBeDefined();
      expect(spot.overview.length).toBeGreaterThan(50); // Should be substantial

      // Region should be defined for breadcrumbs
      expect(spot.region).toBeDefined();

      // speakableSummary is used for voice search optimization
      expect(spot.speakableSummary).toBeDefined();
      expect(spot.speakableSummary.length).toBeGreaterThan(0);
    }
  });

  test("spots have FAQ content for structured data", () => {
    const spots = Object.values(SURF_SPOTS);

    for (const spot of spots) {
      expect(Array.isArray(spot.faq)).toBe(true);
      // Most spots should have FAQs for SEO
      if (spot.faq.length > 0) {
        for (const faqItem of spot.faq) {
          expect(typeof faqItem.question).toBe("string");
          expect(typeof faqItem.answer).toBe("string");
          expect(faqItem.question.length).toBeGreaterThan(0);
          expect(faqItem.answer.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
