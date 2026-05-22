import { existsSync } from "fs";
import { join } from "path";

import {
  INDEXABLE_SEO_FUNNEL_PAGES,
  SEO_FUNNEL_PAGES,
  filterSeoCamBeaches,
  getIndexableSeoFunnelRoutes,
  getSeoFunnelInternalLinks,
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
  "/beginner/huntington-beach",
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

    expect(routes).toHaveLength(22);
    expect(routes).toEqual(expect.arrayContaining(REQUIRED_ROUTES));
    expect(routes).not.toContain("/surf-cams/santa-cruz");
  });

  it("keeps page metadata, H1s, images, FAQs, and internal links complete", () => {
    for (const page of INDEXABLE_SEO_FUNNEL_PAGES) {
      const internalLinks = getSeoFunnelInternalLinks(page);

      expect(page.title.length).toBeGreaterThan(0);
      expect(page.metaDescription.length).toBeGreaterThan(0);
      expect(page.h1.length).toBeGreaterThan(0);
      expect(page.heroImage).toBe(page.images[0]);
      expect(page.images.length).toBeGreaterThanOrEqual(3);
      expect(page.faqs.length).toBeGreaterThanOrEqual(3);
      expect(page.internalLinks.length).toBeGreaterThanOrEqual(3);
      expect(internalLinks.length).toBeGreaterThan(page.internalLinks.length);
      expect(page.nearbySpots.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("builds deterministic contextual links to canonical planning surfaces", () => {
    const page = getSeoFunnelPageByTypeAndSlug(
      "surf-report-today",
      "scripps-pier-today",
    );

    expect(page).not.toBeNull();

    const links = getSeoFunnelInternalLinks(page!);
    const hrefs = links.map((link) => link.href);
    const kinds = links.map((link) => link.kind);

    expect(hrefs).toEqual([...new Set(hrefs)]);
    expect(hrefs).not.toContain(page!.path);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/ca/la-jolla/la-jolla-shores",
        "/ca/la-jolla/la-jolla-shores/tides",
        "/ca/la-jolla/la-jolla-shores/water-temp",
        "/ca/la-jolla/blacks-beach",
        "/ca/la-jolla/blacks-beach/tides",
        "/ca/la-jolla/blacks-beach/water-temp",
        "/map?search=Scripps%20Pier",
        "/surf-cams/san-diego",
      ]),
    );
    expect(kinds).toEqual(
      expect.arrayContaining([
        "beach",
        "cam",
        "forecast",
        "map",
        "tide",
        "water-temp",
      ]),
    );
  });

  it("keeps contextual links on supported canonical route shapes only", () => {
    for (const page of INDEXABLE_SEO_FUNNEL_PAGES) {
      const links = getSeoFunnelInternalLinks(page);
      const hrefs = links.map((link) => link.href);

      expect(hrefs).toEqual([...new Set(hrefs)]);

      for (const link of links) {
        expect(link.href).not.toBe(page.path);
        expect(link.href).toMatch(
          /^\/(?:[a-z]{2}\/[^/?#]+\/[^/?#]+(?:\/(?:tides|water-temp))?|surf-report\/[^/?#]+|surf-cams\/[^/?#]+|beginner\/[^/?#]+|longboard\/[^/?#]+|best-time-to-surf(?:\/[^/?#]+)?|map(?:\?search=[^#]+)?)$/,
        );
      }
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

    expect(prompts).toHaveLength(66);
    for (const { image } of prompts) {
      expect(
        existsSync(join(process.cwd(), "public", image.src.slice(1))),
      ).toBe(true);
    }
  });

  it("resolves every nearby-spot background image file", () => {
    const spots = SEO_FUNNEL_PAGES.flatMap((page) =>
      page.nearbySpots.map((spot) => ({ page, spot })),
    );

    expect(spots.length).toBeGreaterThan(0);
    for (const { page, spot } of spots) {
      if (!spot.imageSrc || !spot.imageAlt) {
        throw new Error(
          `${page.path} is missing a background for ${spot.label}`,
        );
      }

      expect(spot.imageSrc).toMatch(/^\/images\/.+\.webp$/);
      expect(spot.imageSrc).not.toMatch(
        /aerial-ocean|open-ocean|scripps-clean-wave|scripps-tide-risk/,
      );
      expect(
        existsSync(join(process.cwd(), "public", spot.imageSrc.slice(1))),
      ).toBe(true);
      expect(page.path).toMatch(/^\//);
    }
  });

  it("stores image source instructions without mislabeling surf-cam photos", () => {
    const prompts = getSeoFunnelImagePrompts();
    const surfCamPrompts = prompts.filter(({ path }) =>
      path.startsWith("/surf-cams/"),
    );
    const photoPrompts = prompts.filter(
      ({ image }) => image.assetType === "photo",
    );
    const dioramaPrompts = prompts.filter(
      ({ image }) => image.assetType === "diorama",
    );

    expect(prompts).toHaveLength(66);
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
      "/beginner/santa-cruz",
    );
    expect(
      getSeoFunnelPageByIntentRoute("beginner", "huntington-beach")?.path,
    ).toBe("/beginner/huntington-beach");
    expect(getSeoFunnelPageByIntentRoute("longboard", "pr")?.path).toBe(
      "/longboard/pr",
    );
    expect(getSeoFunnelPageByIntentRoute("tide", "san-diego")).toBeNull();
  });

  it("keeps Huntington beginner coverage focused on researched learner zones", () => {
    const page = getSeoFunnelPageByTypeAndSlug("beginner", "huntington-beach");
    const localRead = page?.sections.find(
      (section) => section.heading === "Local read before you drive",
    )?.body;

    expect(page).not.toBeNull();
    expect(page!.nearbySpots.map((spot) => spot.href)).toEqual(
      expect.arrayContaining([
        "/ca/huntington-beach/bolsa-chica",
        "/ca/huntington-beach/huntington-state-beach",
        "/ca/huntington-beach/goldenwest",
        "/ca/newport-beach/blackies",
      ]),
    );
    expect(localRead).toContain("Newland");
    expect(localRead).toContain("Huntington St.");
    expect(localRead).toContain("Cliffs");
  });

  it("resolves surf report and cam configs by type and slug", () => {
    expect(
      getSeoFunnelPageByTypeAndSlug("surf-report-today", "scripps-pier-today")
        ?.decision?.primarySpotSlug,
    ).toBe("scripps");
    expect(
      getSeoFunnelPageByTypeAndSlug("surf-cams", "san-diego")?.camRegion
        ?.states,
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
