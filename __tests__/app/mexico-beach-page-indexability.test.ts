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
