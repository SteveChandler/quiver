/**
 * @jest-environment node
 */

import {
  SURF_CITIES,
  SURF_INTENTS,
  SURF_SPOTS,
  getCityBySlug,
  getSpotsForCity,
  getSpotsForIntent,
} from "@/lib/data/surf-spots";

describe("lib/data/surf-spots invariants", () => {
  test("SURF_INTENTS shape is well-formed", () => {
    const intentSlugs = Object.keys(SURF_INTENTS);
    expect(intentSlugs.length).toBeGreaterThan(0);

    for (const slug of intentSlugs) {
      const intent = (SURF_INTENTS as any)[slug];
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

  test("SURF_CITIES have required fields and stable quick link for session templates", () => {
    const citySlugs = Object.keys(SURF_CITIES);
    expect(citySlugs.length).toBeGreaterThan(0);

    for (const citySlug of citySlugs) {
      const city = (SURF_CITIES as any)[citySlug];
      expect(city.slug).toBe(citySlug);
      expect(typeof city.name).toBe("string");
      expect(city.name.length).toBeGreaterThan(0);
      expect(Array.isArray(city.topSpots)).toBe(true);
      expect(Array.isArray(city.quickLinks)).toBe(true);
    }

    const sanDiego = SURF_CITIES["san-diego"];
    const sessionTemplatesLink = sanDiego.quickLinks.find((l) =>
      l.label.toLowerCase().includes("session log templates")
    );
    expect(sessionTemplatesLink?.href).toBe("/features");
  });

  test("SURF_SPOTS records are structurally valid and internally consistent", () => {
    const spots = Object.values(SURF_SPOTS);
    expect(spots.length).toBeGreaterThan(0);

    const slugs = new Set<string>();
    const citySlugs = new Set(Object.keys(SURF_CITIES));
    const intentSlugs = new Set(Object.keys(SURF_INTENTS));

    for (const [key, spot] of Object.entries(SURF_SPOTS)) {
      // key should match slug for stable lookups
      expect(spot.slug).toBe(key);
      expect(typeof spot.name).toBe("string");
      expect(spot.name.length).toBeGreaterThan(0);

      // Uniqueness
      expect(slugs.has(spot.slug)).toBe(false);
      slugs.add(spot.slug);

      // City linkage
      expect(citySlugs.has(spot.citySlug)).toBe(true);

      // Coordinates sanity
      expect(Number.isFinite(spot.coordinates.lat)).toBe(true);
      expect(Number.isFinite(spot.coordinates.lng)).toBe(true);
      expect(spot.coordinates.lat).toBeGreaterThanOrEqual(-90);
      expect(spot.coordinates.lat).toBeLessThanOrEqual(90);
      expect(spot.coordinates.lng).toBeGreaterThanOrEqual(-180);
      expect(spot.coordinates.lng).toBeLessThanOrEqual(180);

      // Core text fields should be non-empty
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

  test("helpers return expected results for basic cases", () => {
    expect(getCityBySlug("san-diego")?.slug).toBe("san-diego");

    const sdSpots = getSpotsForCity("san-diego");
    expect(sdSpots.length).toBeGreaterThan(0);
    expect(sdSpots.every((s) => s.citySlug === "san-diego")).toBe(true);

    const beginnerSd = getSpotsForIntent("san-diego", "beginner");
    expect(beginnerSd.every((s) => s.intentTags.includes("beginner"))).toBe(true);
  });
});



