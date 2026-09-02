/**
 * @jest-environment node
 */

import { generateBeachSubPageMetadata } from "@/lib/utils/beach-sub-page-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import {
  getForecastIndexabilityForBeaches,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";

// The sub-page metadata reads the coverage snapshot through unstable_cache so it
// shares the sitemap's clock; outside a Next request there is no cache to hit.
jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: unknown) => fn),
}));

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: jest.fn(),
}));

jest.mock("@/lib/seo/tide-meta-data", () => ({
  getTideMetaData: jest.fn(),
}));

jest.mock("@/lib/seo/water-temp-meta-data", () => ({
  getWaterTempMetaData: jest.fn(),
}));

jest.mock("@/lib/seo/forecast-indexability", () => ({
  ...jest.requireActual("@/lib/seo/forecast-indexability"),
  getForecastIndexabilityForBeaches: jest.fn(),
}));

const UNREVIEWED_BEACH = {
  id: "beach-1",
  slug: "windansea",
  name: "Windansea",
  city: "La Jolla",
  state: "California",
  country: "USA",
  timezone: "America/Los_Angeles",
  lat: 32.83,
  lon: -117.28,
  description: "A reef break in La Jolla.",
  wave_tips: "Best on a west swell.",
  crowd_tips: null,
  best_conditions_prose: null,
  seo_indexable: false,
  editorial_reviewed_at: null,
  editorial_sources: null,
};

const FRESH_SNAPSHOT: ForecastIndexabilitySnapshot = {
  forecastAvailable: true,
  selectedStateComplete: true,
  forecastFresh: true,
  forecastValidAt: "2026-08-09T18:00:00.000Z",
  sourceDataUpdatedAt: "2026-08-09T16:00:00.000Z",
  primaryDataSource: "NOAA_NWS",
  isStale: false,
};

describe("beach sub-page metadata indexability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(UNREVIEWED_BEACH);
    (getWaterTempMetaData as jest.Mock).mockResolvedValue({
      tempF: null,
      wetsuitRec: null,
    });
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(
      new Map([[UNREVIEWED_BEACH.id, FRESH_SNAPSHOT]]),
    );
  });

  it("indexes an unreviewed beach's tides page when the forecast contract passes", async () => {
    (getTideMetaData as jest.Mock).mockResolvedValue({
      nextHighTime: "2:30 PM",
      nextLowTime: "8:45 AM",
      nextHighHeight: 4.2,
      nextLowHeight: 0.4,
    });

    const meta = await generateBeachSubPageMetadata({
      beachSlug: "windansea",
      pageType: "tides",
      beachPath: "/ca/la-jolla/windansea",
    });

    expect(meta.robots).toMatchObject({ index: true, follow: true });
  });

  it("noindexes when the beach has no tide data", async () => {
    (getTideMetaData as jest.Mock).mockResolvedValue({
      nextHighTime: null,
      nextLowTime: null,
      nextHighHeight: null,
      nextLowHeight: null,
    });

    const meta = await generateBeachSubPageMetadata({
      beachSlug: "windansea",
      pageType: "tides",
      beachPath: "/ca/la-jolla/windansea",
    });

    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });
});
