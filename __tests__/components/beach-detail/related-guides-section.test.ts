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
      bestTimeToSurfUrl: "/best-time-to-surf/belmar",
    });

    expect(links).not.toBeNull();
    if (!links) throw new Error("Expected related links");
    expect(links.primaryLink.href).toBe("/nj/belmar");
    expect(links.guides.map((guide) => guide.href)).toEqual(expect.arrayContaining([
      "/tide/belmar",
      "/water-temp/belmar",
      "/best-time-to-surf/belmar",
    ]));
    expect(links.guides.map((guide) => guide.href)).not.toContain("/least-crowded/belmar");
  });
});
