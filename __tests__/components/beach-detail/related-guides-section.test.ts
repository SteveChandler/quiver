import { buildRelatedGuideLinks } from "@/components/beach-detail/related-guides-links";
import type { Beach } from "@/types/database";

function makeBeach(overrides: Partial<Beach>): Beach {
  return {
    id: "beach-1",
    name: "Alfonsos",
    slug: "alfonsos",
    city: "Rosarito",
    state: "Baja California",
    country: "Mexico",
    lat: 32.2,
    lon: -116.9,
    created_at: "2026-01-01T00:00:00Z",
    center_lat: 32.2,
    center_lng: -116.9,
    ...overrides,
  } as unknown as Beach;
}

describe("buildRelatedGuideLinks", () => {
  it("uses only crawlable international links for Mexico beaches", () => {
    const links = buildRelatedGuideLinks({
      beach: makeBeach({}),
      hasLeastCrowded: false,
    });

    expect(links).not.toBeNull();
    if (!links) throw new Error("Expected related links");
    expect(links.heading).toBe("Surf Guides for Rosarito");
    expect(links.primaryLink.href).toBe("/beaches/mexico/baja-california");
    expect(links.guides.map((guide) => guide.href)).toEqual([
      "/mexico/baja-california/rosarito/alfonsos/tides",
      "/mexico/baja-california/rosarito/alfonsos/water-temp",
      "/map",
      "/beaches/mexico",
    ]);
    expect(links.guides.map((guide) => guide.href).join(" ")).not.toContain("/beginner/rosarito");
  });

  it("keeps US intent guide links for valid US states", () => {
    const links = buildRelatedGuideLinks({
      beach: makeBeach({
        name: "3rd Avenue Jetty",
        slug: "3rd-avenue-jetty-belmar-nj",
        city: "Belmar",
        state: "NJ",
        country: "USA",
      }),
      hasLeastCrowded: false,
      hasWaterTemp: true,
      bestTimeToSurfUrl: "/best-time-to-surf/belmar",
    });

    expect(links).not.toBeNull();
    if (!links) throw new Error("Expected related links");
    expect(links.primaryLink.href).toBe("/nj/belmar");
    expect(links.guides.map((guide) => guide.href)).toEqual(expect.arrayContaining([
      "/tide/belmar",
      "/nj/belmar/3rd-avenue-jetty-belmar-nj/water-temp",
      "/best-time-to-surf/belmar",
    ]));
    expect(links.guides.map((guide) => guide.href)).not.toContain("/least-crowded/belmar");
  });

  it("omits the beach water-temperature link when the sub-page is not indexable", () => {
    const links = buildRelatedGuideLinks({
      beach: makeBeach({
        slug: "3rd-avenue-jetty-belmar-nj",
        city: "Belmar",
        state: "NJ",
        country: "USA",
      }),
      hasLeastCrowded: false,
      hasWaterTemp: false,
    });

    expect(links?.guides.map((guide) => guide.href)).not.toContain(
      "/nj/belmar/3rd-avenue-jetty-belmar-nj/water-temp",
    );
  });

  it("links the beach tide chart when the tides sub-page is indexable", () => {
    const links = buildRelatedGuideLinks({
      beach: makeBeach({
        slug: "3rd-avenue-jetty-belmar-nj",
        city: "Belmar",
        state: "NJ",
        country: "USA",
      }),
      hasLeastCrowded: false,
      hasTides: true,
    });

    const hrefs = links?.guides.map((guide) => guide.href) ?? [];
    expect(hrefs).toContain("/nj/belmar/3rd-avenue-jetty-belmar-nj/tides");
    // The city tide page keeps its link; the beach chart is added, not swapped.
    expect(hrefs).toContain("/tide/belmar");
    expect(hrefs.indexOf("/nj/belmar/3rd-avenue-jetty-belmar-nj/tides")).toBe(
      hrefs.indexOf("/tide/belmar") + 1,
    );
  });

  it("omits the beach tide chart link unless the sub-page is known indexable", () => {
    const beach = makeBeach({
      slug: "3rd-avenue-jetty-belmar-nj",
      city: "Belmar",
      state: "NJ",
      country: "USA",
    });

    for (const hasTides of [false, undefined]) {
      const links = buildRelatedGuideLinks({ beach, hasLeastCrowded: false, hasTides });
      expect(links?.guides.map((guide) => guide.href)).not.toContain(
        "/nj/belmar/3rd-avenue-jetty-belmar-nj/tides",
      );
    }
  });

  it("keeps the city water-temperature link when eligibility is not supplied", () => {
    const links = buildRelatedGuideLinks({
      beach: makeBeach({
        city: "Belmar",
        state: "NJ",
        country: "USA",
      }),
      hasLeastCrowded: false,
    });

    expect(links?.guides.map((guide) => guide.href)).toContain(
      "/water-temp/belmar",
    );
  });
});
