import { existsSync } from "fs";
import { join } from "path";

import {
  INDEXABLE_SEO_FUNNEL_PAGES,
  SEO_FUNNEL_PAGES,
  filterSeoCamBeaches,
  getIndexableSeoFunnelRoutes,
  getSeoFunnelImagePrompts,
  getSeoFunnelPageByIntentRoute,
  getSeoFunnelPageByTypeAndSlug,
} from "@/lib/seo/funnel-pages";

const REQUIRED_ROUTES = [
  "/longboard/encinitas",
  "/longboard/la-jolla",
  "/longboard/ventura",
  "/longboard/santa-barbara",
  "/longboard/honolulu",
  "/longboard/pr",
  "/longboard/fl",
  "/beginner/san-diego",
  "/beginner/santa-cruz",
  "/beginner/orange-county",
  "/beginner/honolulu",
  "/beginner/cocoa-beach",
  "/beginner/san-onofre",
  "/surf-report/scripps-pier-today",
  "/surf-report/belmar-today",
  "/surf-report/tourmaline-today",
  "/surf-report/malibu-today",
  "/surf-cams/san-diego",
  "/surf-cams/orange-county",
  "/surf-cams/hawaii",
  "/surf-cams/florida",
];

describe("SEO funnel pages", () => {
  it("defines the requested indexable routes and excludes Santa Cruz cams", () => {
    const routes = getIndexableSeoFunnelRoutes();

    expect(routes).toHaveLength(21);
    expect(routes).toEqual(expect.arrayContaining(REQUIRED_ROUTES));
    expect(routes).not.toContain("/surf-cams/santa-cruz");
  });

  it("keeps page metadata, H1s, images, FAQs, and internal links complete", () => {
    for (const page of INDEXABLE_SEO_FUNNEL_PAGES) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.metaDescription.length).toBeGreaterThan(0);
      expect(page.h1.length).toBeGreaterThan(0);
      expect(page.heroImage).toBe(page.images[0]);
      expect(page.images.length).toBeGreaterThanOrEqual(3);
      expect(page.faqs.length).toBeGreaterThanOrEqual(3);
      expect(page.internalLinks.length).toBeGreaterThanOrEqual(3);
      expect(page.nearbySpots.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses unique route, title, description, and image IDs", () => {
    const routes = new Set<string>();
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const imageIds = new Set<string>();

    for (const page of SEO_FUNNEL_PAGES) {
      expect(routes.has(page.path)).toBe(false);
      expect(titles.has(page.title)).toBe(false);
      expect(descriptions.has(page.metaDescription)).toBe(false);
      routes.add(page.path);
      titles.add(page.title);
      descriptions.add(page.metaDescription);

      for (const image of page.images) {
        expect(imageIds.has(image.id)).toBe(false);
        expect(["diorama", "photo"]).toContain(image.assetType);
        expect(image.src).toMatch(/^\/images\/seo-dioramas\/.+\.webp$/);
        imageIds.add(image.id);
      }
    }
  });

  it("resolves every configured SEO image file", () => {
    const prompts = getSeoFunnelImagePrompts();

    expect(prompts).toHaveLength(63);
    for (const { image } of prompts) {
      expect(
        existsSync(join(process.cwd(), "public", image.src.slice(1)))
      ).toBe(true);
    }
  });

  it("resolves every nearby-spot background image file", () => {
    const spots = SEO_FUNNEL_PAGES.flatMap((page) =>
      page.nearbySpots.map((spot) => ({ page, spot }))
    );

    expect(spots.length).toBeGreaterThan(0);
    for (const { page, spot } of spots) {
      if (!spot.imageSrc || !spot.imageAlt) {
        throw new Error(`${page.path} is missing a background for ${spot.label}`);
      }

      expect(spot.imageSrc).toMatch(/^\/images\/.+\.webp$/);
      expect(spot.imageSrc).not.toMatch(
        /aerial-ocean|open-ocean|scripps-clean-wave|scripps-tide-risk/
      );
      expect(
        existsSync(join(process.cwd(), "public", spot.imageSrc.slice(1)))
      ).toBe(true);
      expect(page.path).toMatch(/^\//);
    }
  });

  it("stores image source instructions without mislabeling surf-cam photos", () => {
    const prompts = getSeoFunnelImagePrompts();
    const surfCamPrompts = prompts.filter(({ path }) =>
      path.startsWith("/surf-cams/")
    );
    const photoPrompts = prompts.filter(
      ({ image }) => image.assetType === "photo"
    );
    const dioramaPrompts = prompts.filter(
      ({ image }) => image.assetType === "diorama"
    );

    expect(prompts).toHaveLength(63);
    for (const { image } of prompts) {
      expect(image.prompt).toContain("Use case: ads-marketing");
      expect(image.prompt).toContain("no text");
      expect(image.prompt).toContain("no logos");
    }

    expect(surfCamPrompts).toHaveLength(12);
    for (const { image } of surfCamPrompts) {
      expect(image.assetType).toBe("photo");
      expect(image.prompt).toContain("real photo image");
      expect(image.prompt).not.toMatch(/diorama/i);
      expect(image.alt).not.toMatch(/diorama/i);
      expect(image.caption).not.toMatch(/diorama/i);
    }

    for (const { image } of photoPrompts) {
      expect(image.prompt).toContain("real photo image");
    }

    for (const { image } of dioramaPrompts) {
      expect(image.prompt).toContain("Original composition");
    }
  });

  it("resolves exact beginner and longboard route overrides", () => {
    expect(getSeoFunnelPageByIntentRoute("beginner", "santa-cruz")?.path).toBe(
      "/beginner/santa-cruz"
    );
    expect(getSeoFunnelPageByIntentRoute("longboard", "pr")?.path).toBe(
      "/longboard/pr"
    );
    expect(getSeoFunnelPageByIntentRoute("tide", "san-diego")).toBeNull();
  });

  it("resolves surf report and cam configs by type and slug", () => {
    expect(
      getSeoFunnelPageByTypeAndSlug("surf-report-today", "scripps-pier-today")
        ?.decision?.primarySpotSlug
    ).toBe("scripps");
    expect(
      getSeoFunnelPageByTypeAndSlug("surf-cams", "san-diego")?.camRegion
        ?.states
    ).toContain("CA");
    expect(getSeoFunnelPageByTypeAndSlug("surf-cams", "santa-cruz")).toBeNull();
  });

  it("filters SEO cam regions without pulling unsupported Santa Cruz cams", () => {
    const page = getSeoFunnelPageByTypeAndSlug("surf-cams", "san-diego");
    expect(page).not.toBeNull();

    const beaches = [
      { state: "CA", city: "San Diego", regionSlug: "southern-california" },
      { state: "CA", city: "Santa Cruz", regionSlug: "central-california" },
      { state: "FL", city: "Cocoa Beach", regionSlug: "florida" },
    ];

    expect(filterSeoCamBeaches(page!, beaches)).toEqual([
      { state: "CA", city: "San Diego", regionSlug: "southern-california" },
    ]);
  });
});
