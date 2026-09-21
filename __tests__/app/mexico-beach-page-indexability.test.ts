/**
 * @jest-environment node
 */

import { generateMetadata } from "@/app/mexico/[region]/[city]/[beachSlug]/page";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getCachedForecastIndexabilitySnapshots } from "@/lib/seo/forecast-indexability-cache";
import type { ForecastIndexabilitySnapshot } from "@/lib/seo/forecast-indexability";

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: jest.fn(),
}));

jest.mock("@/lib/seo/forecast-indexability-cache", () => ({
  getCachedForecastIndexabilitySnapshots: jest.fn(),
}));

const beach = {
  id: "alfonsos-id",
  name: "Alfonsos",
  slug: "alfonsos",
  city: "Popotla",
  state: "Baja California",
  country: "Mexico",
  timezone: "America/Tijuana",
};

const FRESH_SNAPSHOT: ForecastIndexabilitySnapshot = {
  forecastAvailable: true,
  selectedStateComplete: true,
  forecastFresh: true,
  forecastValidAt: "2026-09-02T18:00:00.000Z",
  sourceDataUpdatedAt: "2026-09-02T17:00:00.000Z",
  primaryDataSource: "NOAA",
  isStale: false,
};

describe("Mexico beach metadata indexability", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(beach);
  });

  it("uses the sitemap's fresh-forecast decision for the canonical beach URL", async () => {
    (getCachedForecastIndexabilitySnapshots as jest.Mock).mockResolvedValue(
      new Map([[beach.id, FRESH_SNAPSHOT]]),
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({
        region: "baja-california",
        city: "popotla",
        beachSlug: "alfonsos",
      }),
    });

    expect(metadata.robots).toEqual({
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    });
  });

  it.each([
    "Bahia Tortugas (Turtle Bay)",
    "Acapulquito (Costa Azul)",
    "California Trailer Park",
  ])("keeps %s within the title budget including the site suffix", async (name) => {
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue({ ...beach, name });
    (getCachedForecastIndexabilitySnapshots as jest.Mock).mockResolvedValue(
      new Map([[beach.id, FRESH_SNAPSHOT]]),
    );
    const metadata = await generateMetadata({
      params: Promise.resolve({ region: "baja-california", city: "popotla", beachSlug: "alfonsos" }),
    });
    expect(typeof metadata.title).toBe("string");
    expect(`${metadata.title} | Quiver`.length).toBeLessThanOrEqual(60);
    expect(metadata.title).toContain("Surf Report");
    expect(metadata.title).not.toContain("Updated Daily");
    expect(metadata.openGraph?.title).toBe(metadata.title);
  });

  it("uses hand-written SEO fields across page, Open Graph, and Twitter metadata", async () => {
    const seoTitle = "Alfonsos Surf Guide for Baja California";
    const seoDescription =
      "A locally written guide to Alfonsos surf conditions, access, and the best windows to paddle out near Popotla.";
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue({
      ...beach,
      seo_title: seoTitle,
      seo_description: seoDescription,
    });
    (getCachedForecastIndexabilitySnapshots as jest.Mock).mockResolvedValue(
      new Map([[beach.id, FRESH_SNAPSHOT]]),
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({
        region: "baja-california",
        city: "popotla",
        beachSlug: "alfonsos",
      }),
    });

    expect(metadata.title).toBe(seoTitle);
    expect(metadata.description).toBe(seoDescription);
    expect(metadata.openGraph).toMatchObject({
      title: seoTitle,
      description: seoDescription,
    });
    expect(metadata.twitter).toMatchObject({
      title: seoTitle,
      description: seoDescription,
    });
  });

  it("falls back to the generated title and description when SEO fields are blank", async () => {
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue({
      ...beach,
      seo_title: "  ",
      seo_description: "",
    });
    (getCachedForecastIndexabilitySnapshots as jest.Mock).mockResolvedValue(
      new Map([[beach.id, FRESH_SNAPSHOT]]),
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({
        region: "baja-california",
        city: "popotla",
        beachSlug: "alfonsos",
      }),
    });

    expect(metadata.title).toContain("Surf Report");
    expect(metadata.description).toContain("Alfonsos surf report");
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.title).toBe(metadata.title);
    expect(metadata.twitter?.description).toBe(metadata.description);
  });

  it("keeps a non-canonical route out of the index even with a fresh forecast", async () => {
    (getCachedForecastIndexabilitySnapshots as jest.Mock).mockResolvedValue(
      new Map([[beach.id, FRESH_SNAPSHOT]]),
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({
        region: "baja-california",
        city: "rosarito",
        beachSlug: "alfonsos",
      }),
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
  });
});
