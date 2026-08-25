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
  "/beginner/los-angeles",
  "/beginner/ventura",
  "/beginner/santa-barbara",
  "/beginner/honolulu",
  "/beginner/cocoa-beach",
  "/beginner/long-island",
  "/beginner/san-onofre",
  "/surf-report/scripps-pier-today",
  "/surf-report/la-jolla-today",
  "/surf-report/belmar-today",
  "/surf-report/tourmaline-today",
  "/surf-report/newport-beach-today",
  "/surf-report/malibu-today",
  "/surf-cams/san-diego",
  "/surf-cams/orange-county",
  "/surf-cams/hawaii",
  "/surf-cams/florida",
];

const REJECTED_SEO_IMAGE_SRCS = [
  "/images/seo-dioramas/longboard/la-jolla/la-jolla-cove-cliffs-diorama.webp",
  "/images/seo-dioramas/longboard/la-jolla/tourmaline-lineup-diorama.webp",
  "/images/seo-dioramas/longboard/la-jolla/windansea-mellow-reef-diorama.webp",
  "/images/seo-dioramas/surf-cams/orange-county/orange-county-aerial-shore-photo.webp",
  "/images/seo-dioramas/surf-cams/orange-county/orange-county-open-wave-photo.webp",
  "/images/seo-dioramas/surf-cams/orange-county/orange-county-sunset-beach-photo.webp",
  "/images/seo-dioramas/surf-report/scripps-pier-today/scripps-board-choice-diorama.webp",
  "/images/seo-dioramas/surf-report/scripps-pier-today/scripps-pier-surf-check-diorama.webp",
];

describe("SEO funnel pages", () => {
  it("defines the requested indexable routes and excludes Santa Cruz cams", () => {
    const routes = getIndexableSeoFunnelRoutes();

    expect(routes).toHaveLength(28);
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

  it("keeps indexable funnel metadata inside SEO quality gates", () => {
    for (const page of INDEXABLE_SEO_FUNNEL_PAGES) {
      expect(page.title.length).toBeGreaterThanOrEqual(30);
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.metaDescription.length).toBeGreaterThanOrEqual(120);
      expect(page.metaDescription.length).toBeLessThanOrEqual(160);
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

  it("links Cocoa Beach Pier cards to the database-backed canonical surface", () => {
    const cocoaBeachPages = [
      getSeoFunnelPageByTypeAndSlug("longboard", "fl"),
      getSeoFunnelPageByTypeAndSlug("beginner", "cocoa-beach"),
      getSeoFunnelPageByTypeAndSlug("surf-cams", "florida"),
    ];

    for (const page of cocoaBeachPages) {
      expect(page?.nearbySpots).toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: "Cocoa Beach Pier",
          href: "/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl",
        }),
      ]));
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

    expect(prompts).toHaveLength(84);
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

  it("keeps rejected SEO assets out of active page and nearby spot images", () => {
    const activeImageSrcs = SEO_FUNNEL_PAGES.flatMap((page) => [
      page.heroImage.src,
      ...page.images.map((image) => image.src),
      ...page.nearbySpots
        .map((spot) => spot.imageSrc)
        .filter((src): src is string => Boolean(src)),
    ]);
    const scripps = getSeoFunnelPageByTypeAndSlug(
      "surf-report-today",
      "scripps-pier-today",
    );
    const newport = getSeoFunnelPageByTypeAndSlug(
      "surf-report-today",
      "newport-beach-today",
    );
    const laJollaLongboard = getSeoFunnelPageByTypeAndSlug(
      "longboard",
      "la-jolla",
    );

    for (const rejectedSrc of REJECTED_SEO_IMAGE_SRCS) {
      expect(activeImageSrcs).not.toContain(rejectedSrc);
    }

    expect(scripps?.heroImage.src).toBe(
      "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
    );
    expect(newport?.images.map((image) => image.src)).toEqual([
      "/images/seo-dioramas/beginner/socal/blackies-photo.webp",
      "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
      "/images/seo-dioramas/beginner/socal/doheny-beach-photo.webp",
    ]);
    expect(laJollaLongboard?.images.map((image) => image.src)).toEqual([
      "/images/seo-dioramas/spot-backgrounds/tourmaline-photo.webp",
      "/images/seo-dioramas/spot-backgrounds/la-jolla-shores-photo.webp",
      "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
    ]);
  });

  it("uses approved beach-specific photos on SoCal beginner pages where available", () => {
    const sanDiego = getSeoFunnelPageByTypeAndSlug("beginner", "san-diego");
    const orangeCounty = getSeoFunnelPageByTypeAndSlug(
      "beginner",
      "orange-county",
    );
    const huntington = getSeoFunnelPageByTypeAndSlug(
      "beginner",
      "huntington-beach",
    );
    const losAngeles = getSeoFunnelPageByTypeAndSlug(
      "beginner",
      "los-angeles",
    );
    const santaBarbara = getSeoFunnelPageByTypeAndSlug(
      "beginner",
      "santa-barbara",
    );
    const sanOnofre = getSeoFunnelPageByTypeAndSlug(
      "beginner",
      "san-onofre",
    );

    expect(sanDiego?.images.map((image) => image.src)).toEqual(
      expect.arrayContaining([
        "/images/seo-dioramas/beginner/socal/la-jolla-shores-photo.webp",
        "/images/seo-dioramas/beginner/socal/tourmaline-surf-park-photo.webp",
      ]),
    );
    expect(orangeCounty?.images.map((image) => image.src)).toEqual(
      expect.arrayContaining([
        "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
        "/images/seo-dioramas/beginner/socal/doheny-beach-photo.webp",
        "/images/seo-dioramas/beginner/socal/san-onofre-state-beach-photo.webp",
      ]),
    );
    expect(huntington?.images.map((image) => image.src)).toEqual(
      expect.arrayContaining([
        "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
        "/images/seo-dioramas/beginner/socal/huntington-state-beach-photo.webp",
      ]),
    );
    expect(losAngeles?.images.map((image) => image.src)).toEqual([
      "/images/seo-dioramas/beginner/socal/santa-monica-beach-santa-monica-ca-photo.webp",
      "/images/seo-dioramas/beginner/socal/will-rogers-state-beach-santa-monica-ca-photo.webp",
      "/images/seo-dioramas/beginner/socal/dockweiler-state-beach-playa-del-rey-ca-photo.webp",
    ]);
    expect(santaBarbara?.images[0].src).toBe(
      "/images/seo-dioramas/beginner/socal/refugio-state-beach-goleta-ca-photo.webp",
    );
    expect(sanOnofre?.images[0].src).toBe(
      "/images/seo-dioramas/beginner/socal/san-onofre-state-beach-photo.webp",
    );

    expect(losAngeles?.images.map((image) => image.caption).join(" ")).toContain(
      "CC BY",
    );
    expect(losAngeles?.images.map((image) => image.src).join(" ")).not.toContain(
      "surf-cams/orange-county",
    );

    const losAngelesSpotImages = new Map(
      losAngeles?.nearbySpots.map((spot) => [spot.label, spot.imageSrc]) ?? [],
    );
    expect(losAngelesSpotImages.get("Venice Beach")).toBe(
      "/images/seo-dioramas/beginner/socal/venice-beach-venice-ca-photo.webp",
    );
    expect(losAngelesSpotImages.get("Torrance/RAT Beach")).toBe(
      "/images/seo-dioramas/beginner/socal/torrance-beach-rat-beach-torrance-ca-photo.webp",
    );
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

    expect(prompts).toHaveLength(84);
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
    expect(
      getSeoFunnelPageByIntentRoute("beginner", "los-angeles")?.path,
    ).toBe("/beginner/los-angeles");
    expect(getSeoFunnelPageByIntentRoute("beginner", "ventura")?.path).toBe(
      "/beginner/ventura",
    );
    expect(getSeoFunnelPageByIntentRoute("beginner", "long-island")?.path).toBe(
      "/beginner/long-island",
    );
    expect(
      getSeoFunnelPageByIntentRoute("beginner", "santa-barbara")?.path,
    ).toBe("/beginner/santa-barbara");
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

  it("connects the SoCal beginner pages without blanket-promoting conditional spots", () => {
    const losAngeles = getSeoFunnelPageByTypeAndSlug(
      "beginner",
      "los-angeles",
    );
    const ventura = getSeoFunnelPageByTypeAndSlug("beginner", "ventura");
    const santaBarbara = getSeoFunnelPageByTypeAndSlug(
      "beginner",
      "santa-barbara",
    );

    expect(losAngeles).not.toBeNull();
    expect(ventura).not.toBeNull();
    expect(santaBarbara).not.toBeNull();

    expect(losAngeles!.internalLinks.map((link) => link.href)).toEqual(
      expect.arrayContaining([
        "/beginner/orange-county",
        "/beginner/san-diego",
        "/beginner/ventura",
        "/beginner/santa-barbara",
      ]),
    );
    expect(
      losAngeles!.sections.find(
        (section) => section.heading === "Local read before you drive",
      )?.body,
    ).toContain("El Porto, Zuma, and Leo Carrillo are small-day conditional");

    expect(ventura!.nearbySpots.map((spot) => spot.href)).toEqual(
      expect.arrayContaining([
        "/ca/ventura/mondos-beach-ventura-ca",
        "/beginner/santa-barbara",
      ]),
    );
    expect(
      ventura!.sections.find(
        (section) => section.heading === "Local read before you drive",
      )?.body,
    ).toContain("Solimar-style reef rows should not inherit beginner");

    expect(santaBarbara!.nearbySpots.map((spot) => spot.href)).toEqual(
      expect.arrayContaining([
        "/ca/goleta/refugio-state-beach-goleta-ca",
        "/ca/ventura/mondos-beach-ventura-ca",
      ]),
    );
    expect(
      santaBarbara!.sections.find(
        (section) => section.heading === "Local read before you drive",
      )?.body,
    ).toContain("Refugio is conditional");
  });

  it("keeps Long Island beginner coverage centered on small-day learner zones", () => {
    const page = getSeoFunnelPageByTypeAndSlug("beginner", "long-island");

    expect(page).not.toBeNull();
    expect(page!.images.map((image) => image.src)).toEqual([
      "/images/seo-dioramas/beginner/long-island/robert-moses-state-park-ny-photo.webp",
      "/images/seo-dioramas/beginner/long-island/rockaway-beach-90th-st-queens-ny-photo.webp",
      "/images/seo-dioramas/beginner/long-island/long-beach-long-beach-ny-photo.webp",
    ]);
    expect(page!.nearbySpots.map((spot) => spot.href)).toEqual(
      expect.arrayContaining([
        "/ny/long-beach/long-beach-long-beach-ny",
        "/ny/babylon/robert-moses-state-park-babylon-ny",
        "/ny/shirley/smith-point-county-park-shirley-ny",
        "/ny/montauk/ditch-plains-montauk-ny",
      ]),
    );
    expect(
      page!.nearbySpots.find((spot) => spot.label === "Long Beach")
        ?.description,
    ).toContain("Best first call for lessons");
    expect(
      page!.nearbySpots.find((spot) => spot.label === "Robert Moses State Park")
        ?.description,
    ).toContain("Cleaner self-practice backup");
    expect(
      page!.nearbySpots.find((spot) => spot.label === "Smith Point County Park")
        ?.description,
    ).toContain("Closest-ocean option for some surfers");
    expect(
      page!.nearbySpots.find((spot) => spot.label === "Ditch Plains")
        ?.description,
    ).toContain("Save this for later progression trips");
    expect(
      page!.sections.find(
        (section) => section.heading === "Local read before you drive",
      )?.body,
    ).toContain("Turtle Cove should stay out of learner guidance entirely");
    expect(
      page!.sections.find(
        (section) => section.heading === "Where Long Island works best",
      )?.body,
    ).toContain("Robert Moses deserves more weight than a footnote");
    expect(
      page!.sections.find(
        (section) => section.heading === "Board and safety call",
      )?.body,
    ).toContain("Body surfing and boogie boarding first are legitimate prep");
    expect(
      page!.sections.find(
        (section) => section.heading === "Local read before you drive",
      )?.body,
    ).toContain("book an adult lesson");
  });

  it("keeps existing longboard hubs connected to live spot reports before adding inventory", () => {
    const laJolla = getSeoFunnelPageByTypeAndSlug("longboard", "la-jolla");
    const honolulu = getSeoFunnelPageByTypeAndSlug("longboard", "honolulu");
    const santaBarbara = getSeoFunnelPageByTypeAndSlug(
      "longboard",
      "santa-barbara",
    );

    expect(laJolla).not.toBeNull();
    expect(honolulu).not.toBeNull();
    expect(santaBarbara).not.toBeNull();

    expect(getSeoFunnelInternalLinks(laJolla!).map((link) => link.href)).toEqual(
      expect.arrayContaining([
        "/surf-report/tourmaline-today",
        "/surf-report/scripps-pier-today",
        "/ca/san-diego/tourmaline-surf-park",
        "/ca/la-jolla/la-jolla-shores",
      ]),
    );
    expect(getSeoFunnelInternalLinks(honolulu!).map((link) => link.href)).toEqual(
      expect.arrayContaining([
        "/hi/honolulu/waikiki-beach",
        "/hi/honolulu/waikiki-canoes",
        "/best-time-to-surf/honolulu",
      ]),
    );
    expect(
      getSeoFunnelInternalLinks(santaBarbara!).map((link) => link.href),
    ).toEqual(
      expect.arrayContaining([
        "/ca/santa-barbara/leadbetter",
        "/longboard/ventura",
        "/surf-report/malibu-today",
        "/best-time-to-surf/santa-barbara",
      ]),
    );
  });

  it("frames today surf reports as condition pages, not thin decision stubs", () => {
    const expectedTitles = new Map([
      [
        "scripps-pier-today",
        "Scripps Pier Surf Report Today: Waves, Tide & Wind",
      ],
      [
        "la-jolla-today",
        "La Jolla Surf Report Today: Waves, Tide & Wind",
      ],
      ["belmar-today", "Belmar NJ Surf Report Today: Waves, Wind & Tide"],
      [
        "tourmaline-today",
        "Tourmaline Surf Report Today: Longboard Window & Wind",
      ],
      [
        "newport-beach-today",
        "Newport Beach Surf Report Today: Waves & Wind",
      ],
      ["malibu-today", "Malibu Surf Report Today: Waves, Tide & Wind"],
    ]);
    const todayPages = Array.from(expectedTitles.keys()).map((slug) => ({
      slug,
      page: getSeoFunnelPageByTypeAndSlug("surf-report-today", slug),
    }));

    for (const { slug, page } of todayPages) {
      expect(page).not.toBeNull();
      expect(page!.title).toBe(expectedTitles.get(slug));
      expect(page!.metaDescription).toMatch(/wave height/i);
      expect(page!.metaDescription).toMatch(/wind/i);
      expect(page!.metaDescription).toMatch(/tide/i);
      expect(page!.metaDescription).toMatch(/board/i);
      expect(page!.metaDescription).toMatch(/backup/i);
      expect(page!.decision).toMatchObject({
        boardCall: expect.any(String),
        windRisk: expect.any(String),
        tideRisk: expect.any(String),
      });
      expect(page!.sections.map((section) => section.heading)).toEqual(
        expect.arrayContaining([
          `${page!.locationName} conditions right now`,
          "Should you surf today?",
          "When this spot is worth it",
          "Backup plan",
        ]),
      );
    }

    const malibu = getSeoFunnelPageByTypeAndSlug(
      "surf-report-today",
      "malibu-today",
    );
    const newport = getSeoFunnelPageByTypeAndSlug(
      "surf-report-today",
      "newport-beach-today",
    );

    expect(newport?.h1).toBe("Newport Beach Surf Report Today");
    expect(newport?.decision?.primarySpotSlug).toBe("blackies");
    expect(newport?.internalLinks.map((link) => link.href)).toEqual(
      expect.arrayContaining([
        "/best-time-to-surf/newport-beach",
        "/surf-cams/orange-county",
        "/beginner/orange-county",
      ]),
    );
    expect(newport?.nearbySpots.map((spot) => spot.href)).toEqual(
      expect.arrayContaining([
        "/ca/newport-beach/blackies",
        "/ca/newport-beach/newport-56th-st",
        "/ca/huntington-beach/bolsa-chica",
      ]),
    );
    expect(malibu?.h1).toBe("Malibu Surf Report Today");
    expect(malibu?.metaDescription).toBe(
      "Malibu surf report today with live wave height, tide, wind, best window, board call, crowd notes, and First Point backups before you drive.",
    );
  });

  it("defines the indexable La Jolla today owner with protected metadata limits", () => {
    const page = getSeoFunnelPageByTypeAndSlug(
      "surf-report-today",
      "la-jolla-today",
    );

    expect(page).not.toBeNull();
    expect(page).toMatchObject({
      path: "/surf-report/la-jolla-today",
      title: "La Jolla Surf Report Today: Waves, Tide & Wind",
      metaDescription:
        "La Jolla surf report today with live wave height, tide, wind, and board call for La Jolla Shores, Windansea, and Scripps, plus nearby backups.",
      h1: "La Jolla Surf Report Today",
      indexable: true,
    });
    expect(`${page!.title} | Quiver`).toHaveLength(55);
    expect(page!.metaDescription).toHaveLength(142);
  });

  it("keeps every La Jolla today route, beach slug, and image on a verified owner", () => {
    const page = getSeoFunnelPageByTypeAndSlug(
      "surf-report-today",
      "la-jolla-today",
    );
    const validLaJollaSlugs = new Set([
      "la-jolla-shores",
      "windansea",
      "scripps",
      "birdrock",
      "horseshoe",
      "big-rock-la-jolla-ca",
    ]);
    const expectedHrefs = [
      "/best-time-to-surf/la-jolla",
      "/surf-report/scripps-pier-today",
      "/surf-report/tourmaline-today",
      "/surf-cams/san-diego",
      "/beginner/san-diego",
      "/ca/la-jolla/la-jolla-shores",
      "/ca/la-jolla/windansea",
      "/ca/la-jolla/scripps",
    ];
    const expectedImages = [
      "/images/seo-dioramas/spot-backgrounds/la-jolla-shores-photo.webp",
      "/images/seo-dioramas/surf-cams/san-diego/san-diego-la-jolla-shores-photo.webp",
      "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
    ];

    expect(page).not.toBeNull();
    expect([
      ...page!.internalLinks.map((link) => link.href),
      ...page!.nearbySpots.map((spot) => spot.href),
    ]).toEqual(expectedHrefs);
    expect(page!.nearbySpots.map((spot) => spot.beachSlug)).toEqual([
      "la-jolla-shores",
      "windansea",
      "scripps",
    ]);
    expect(page!.relatedSpotIds).toEqual([
      "la-jolla-shores",
      "windansea",
      "scripps",
      "birdrock",
    ]);

    for (const spot of page!.nearbySpots) {
      expect(validLaJollaSlugs.has(spot.beachSlug!)).toBe(true);
      expect(
        existsSync(
          join(
            process.cwd(),
            spot.href.startsWith("/surf-report/")
              ? "app/surf-report/[slug]/page.tsx"
              : "app/[intent]/[city]/[beachSlug]/page.tsx",
          ),
        ),
      ).toBe(true);
    }

    for (const link of page!.internalLinks) {
      if (link.href === "/best-time-to-surf/la-jolla") {
        expect(
          existsSync(
            join(process.cwd(), "app/best-time-to-surf/[city]/page.tsx"),
          ),
        ).toBe(true);
        continue;
      }

      expect(SEO_FUNNEL_PAGES.some((candidate) => candidate.path === link.href)).toBe(
        true,
      );
    }

    expect(page!.images.map((image) => image.src)).toEqual(expectedImages);
    for (const src of expectedImages) {
      expect(existsSync(join(process.cwd(), "public", src.slice(1)))).toBe(
        true,
      );
    }
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
