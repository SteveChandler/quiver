/**
 * @jest-environment node
 */

import { generateBeachSubPageMetadata } from "@/lib/utils/beach-sub-page-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import { isGscPerformanceProtected } from "@/lib/seo/gsc-performance-protection";
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

jest.mock("@/lib/seo/gsc-performance-protection", () => ({
  ...jest.requireActual("@/lib/seo/gsc-performance-protection"),
  isGscPerformanceProtected: jest.fn(
    jest.requireActual("@/lib/seo/gsc-performance-protection").isGscPerformanceProtected,
  ),
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

const PROTECTED_BEACH = {
  ...UNREVIEWED_BEACH,
  slug: "huntington-state-beach",
  name: "Huntington State Beach",
  city: "Huntington Beach",
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
    jest.mocked(isGscPerformanceProtected).mockImplementation(
      jest.requireActual("@/lib/seo/gsc-performance-protection").isGscPerformanceProtected,
    );
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(UNREVIEWED_BEACH);
    (getWaterTempMetaData as jest.Mock).mockResolvedValue({
      tempF: null,
      wetsuitRec: null,
    });
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(
      new Map([[UNREVIEWED_BEACH.id, FRESH_SNAPSHOT]]),
    );
  });

  it.each([true, false])("uses existing snapshot protection (%s) before missing water temperature data", async (protectedPage) => {
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(PROTECTED_BEACH);
    const beachPath = "/ca/huntington-beach/huntington-state-beach";
    expect(isGscPerformanceProtected(`${beachPath}/water-temp`)).toBe(true);
    if (!protectedPage) jest.mocked(isGscPerformanceProtected).mockReturnValue(false);

    const metadata = await generateBeachSubPageMetadata({ beachSlug: PROTECTED_BEACH.slug, pageType: "water-temp", beachPath });

    expect(metadata.robots).toMatchObject({ index: protectedPage, follow: true });
  });

  it("leaves metadata unchanged for a protected water temperature page with a reading", async () => {
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(PROTECTED_BEACH);
    (getWaterTempMetaData as jest.Mock).mockResolvedValue({ tempF: 67, wetsuitRec: "3/2mm fullsuit" });
    const args = { beachSlug: PROTECTED_BEACH.slug, pageType: "water-temp" as const, beachPath: "/ca/huntington-beach/huntington-state-beach" };
    const protectedMetadata = await generateBeachSubPageMetadata(args);
    jest.mocked(isGscPerformanceProtected).mockReturnValue(false);
    const baselineMetadata = await generateBeachSubPageMetadata(args);

    expect(protectedMetadata).toEqual(baselineMetadata);
    expect(protectedMetadata.robots).toMatchObject({ index: true, follow: true });
    expect(String(protectedMetadata.description)).toContain("67°F");
  });

  it("retains the forecast gate for a protected page without temperature data", async () => {
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(PROTECTED_BEACH);
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(new Map([[UNREVIEWED_BEACH.id, { ...FRESH_SNAPSHOT, forecastFresh: false }]]));

    const metadata = await generateBeachSubPageMetadata({ beachSlug: PROTECTED_BEACH.slug, pageType: "water-temp", beachPath: "/ca/huntington-beach/huntington-state-beach" });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
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
