/**
 * @jest-environment node
 */

jest.mock("@/actions/city/city-metadata-actions", () => ({
  findCityBySlug: jest.fn(),
  findCitiesMatchingPattern: jest.fn(),
  getCityMetadata: jest.fn(),
  getCityBeachEditorialData: jest.fn(),
  getCityExcludeIntents: jest.fn(),
}));

jest.mock("@/actions/forecast/intent-forecast-actions", () => ({
  getCityTideData: jest.fn().mockResolvedValue(null),
  getCityTideDataExpanded: jest.fn().mockResolvedValue(null),
  getCityIntentDataAvailability: jest.fn().mockResolvedValue("available"),
  getCityWaterTempHistory: jest.fn(),
  getIntentForecastSummary: jest.fn().mockResolvedValue(null),
  getCityWaterTempExpanded: jest.fn().mockResolvedValue(null),
  getCitySunTimesData: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/city/city-editorial-actions", () => ({
  getCityEditorialContent: jest.fn(),
}));

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachesByIntentAndCity: jest.fn(),
}));

jest.mock("@/actions/beginner/beginner-actions", () => ({
  getBeginnerConditionsData: jest.fn(),
  getBeginnerBeachesWithEditorial: jest.fn().mockResolvedValue([]),
  getBeginnerCityEditorial: jest.fn(),
}));

jest.mock("@/lib/utils/best-time-to-surf-utils", () => ({
  getBestTimeToSurfUrl: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/seo/gsc-performance-protection", () => ({
  ...jest.requireActual("@/lib/seo/gsc-performance-protection"),
  isGscPerformanceProtected: jest.fn(
    jest.requireActual("@/lib/seo/gsc-performance-protection").isGscPerformanceProtected,
  ),
}));

import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import IntentPage, { generateMetadata } from "@/app/[intent]/[city]/page";
import {
  findCityBySlug,
  getCityBeachEditorialData,
  getCityExcludeIntents,
} from "@/actions/city/city-metadata-actions";
import { getBeachesByIntentAndCity } from "@/actions/beach/beach-query-actions";
import {
  getCityIntentDataAvailability,
  getCityWaterTempHistory,
} from "@/actions/forecast/intent-forecast-actions";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { getBeginnerBeachesWithEditorial } from "@/actions/beginner/beginner-actions";
import { isGscPerformanceProtected } from "@/lib/seo/gsc-performance-protection";
import { WaterTempOverviewSection } from "@/components/intent/water-temp-overview-section";

type OverviewElement = ReactElement<ComponentProps<typeof WaterTempOverviewSection>>;

function findOverview(node: ReactNode): OverviewElement | undefined {
  if (Array.isArray(node)) {
    return node.map(findOverview).find((child) => child !== undefined);
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === WaterTempOverviewSection) return node as OverviewElement;
  return findOverview(node.props.children);
}

const playaParams = { intent: "water-temp", city: "playa-del-rey" };
const noReadingLine = "No live water temperature reading right now. Check back for the next update.";

describe("city intent indexability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isGscPerformanceProtected).mockImplementation(
      jest.requireActual("@/lib/seo/gsc-performance-protection").isGscPerformanceProtected,
    );
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        cityName: "Corolla",
        state: "NC",
        stateName: "North Carolina",
        totalBeaches: 3,
        beginnerCount: 1,
        intermediateCount: 2,
        advancedCount: 0,
        beaches: [],
        centerLat: 36.38,
        centerLon: -75.83,
      },
    });
    (getCityExcludeIntents as jest.Mock).mockResolvedValue([]);
    (getCityBeachEditorialData as jest.Mock).mockResolvedValue([]);
    (getBeachesByIntentAndCity as jest.Mock).mockResolvedValue({
      success: true,
      data: [{ id: "dockweiler", name: "Dockweiler", slug: "dockweiler", city: "Playa Del Rey", state: "CA", country: "USA", lat: 33.94, lon: -118.44 }],
    });
    (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("available");
    (getCityWaterTempHistory as jest.Mock).mockResolvedValue({ currentTemp: 76, points: [{ date: "2026-10-11", tempF: 76 }], beachName: "Dockweiler" });
    (getCityEditorialContent as jest.Mock).mockResolvedValue(null);
  });

  it("indexes /water-temp/{city} with a live reading and no editorial row", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "water-temp", city: "corolla" }),
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("keeps the GSC-protected Huntington Beach city route indexable and self-canonical", async () => {
    const citySlug = "huntington-beach";
    expect(isGscPerformanceProtected(`/water-temp/${citySlug}`)).toBe(true);

    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        cityName: "Huntington Beach",
        state: "CA",
        stateName: "California",
        totalBeaches: 3,
        beginnerCount: 1,
        intermediateCount: 2,
        advancedCount: 0,
        beaches: [],
        centerLat: 36.38,
        centerLon: -75.83,
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "water-temp", city: citySlug }),
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toContain(`/water-temp/${citySlug}`);
    expect(metadata.title).toBe("Huntington Beach Water Temperature Today: 76°F");
    expect(String(metadata.description)).toContain(
      "Huntington Beach water temperature today is 76°F",
    );
    expect(String(metadata.description)).toContain("Wetsuit guide");
    expect(String(metadata.title).length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
  });

  it("keeps the state-qualified Ocean City longboard route indexable", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        cityName: "Ocean City",
        state: "NJ",
        stateName: "New Jersey",
        totalBeaches: 3,
        beginnerCount: 1,
        intermediateCount: 2,
        advancedCount: 0,
        beaches: [],
        centerLat: 39.28,
        centerLon: -74.57,
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "longboard", city: "ocean-city-nj" }),
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toContain(
      "/longboard/ocean-city-nj",
    );
  });

  it("titles /beginner/{city} from the beaches the page lists", async () => {
    (getBeginnerBeachesWithEditorial as jest.Mock).mockResolvedValueOnce([{ name: "Corolla Beach Access 4" }]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "beginner", city: "corolla" }),
    });

    expect(String(metadata.title)).toContain("Beginner Surf in Corolla: Corolla Beach Access 4");
    expect(String(metadata.description)).toMatch(/^1 beginner-friendly surf spot in Corolla/);
  });

  it("keeps /beginner/{city} noindexed without an approved editorial row", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "beginner", city: "corolla" }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it("noindexes /water-temp/{city} when no reading resolves", async () => {
    (getCityWaterTempHistory as jest.Mock).mockResolvedValue(null);
    (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("missing");

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "water-temp", city: "ma" }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  describe("/water-temp/playa-del-rey", () => {
    beforeEach(() => {
      (findCityBySlug as jest.Mock).mockResolvedValue({
        success: true,
        data: { cityName: "Playa Del Rey", state: "CA", stateName: "California", totalBeaches: 1, beginnerCount: 1, intermediateCount: 0, advancedCount: 0, beaches: [], centerLat: 33.94, centerLon: -118.44 },
      });
    });

    it("keeps snapshot protection ahead of missing-reading noindex and renders the honest state", async () => {
      expect(isGscPerformanceProtected("/water-temp/playa-del-rey")).toBe(true);
      (getCityWaterTempHistory as jest.Mock).mockResolvedValue(null);
      (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("missing");

      const metadata = await generateMetadata({ params: Promise.resolve(playaParams) });
      const overview = findOverview(await IntentPage({ params: Promise.resolve(playaParams) }));

      expect(metadata.robots).toMatchObject({ index: true, follow: true });
      expect(metadata.alternates?.canonical).toContain("/water-temp/playa-del-rey");
      if (!overview) throw new Error("Expected water temperature overview");
      expect(renderToStaticMarkup(overview)).toContain(noReadingLine);
    });

    it("retains missing-reading noindex and body output without protection", async () => {
      jest.mocked(isGscPerformanceProtected).mockReturnValue(false);
      (getCityWaterTempHistory as jest.Mock).mockResolvedValue(null);
      (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("missing");

      const metadata = await generateMetadata({ params: Promise.resolve(playaParams) });
      const overview = findOverview(await IntentPage({ params: Promise.resolve(playaParams) }));

      expect(metadata.robots).toMatchObject({ index: false, follow: true });
      if (!overview) throw new Error("Expected water temperature overview");
      expect(renderToStaticMarkup(overview)).toBe("");
    });

    it("keeps explicit editorial rejection ahead of protection when the reading is missing", async () => {
      (getCityWaterTempHistory as jest.Mock).mockResolvedValue(null);
      (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("missing");
      (getCityEditorialContent as jest.Mock).mockResolvedValue({ seo_indexable: false, editorial_reviewed_at: "2026-10-11T00:00:00Z" });

      const metadata = await generateMetadata({ params: Promise.resolve(playaParams) });

      expect(metadata.robots).toMatchObject({ index: false, follow: true });
    });

    it("renders the protected no-reading overview when the beach query is empty", async () => {
      (getCityWaterTempHistory as jest.Mock).mockResolvedValue(null);
      (getBeachesByIntentAndCity as jest.Mock).mockResolvedValue({ success: true, data: [] });

      const overview = findOverview(await IntentPage({ params: Promise.resolve(playaParams) }));

      if (!overview) throw new Error("Expected water temperature overview");
      expect(renderToStaticMarkup(overview)).toContain(noReadingLine);
    });

    it("leaves protected metadata and overview output unchanged with a reading", async () => {
      const protectedMetadata = await generateMetadata({ params: Promise.resolve(playaParams) });
      const protectedOverview = findOverview(await IntentPage({ params: Promise.resolve(playaParams) }));
      jest.mocked(isGscPerformanceProtected).mockReturnValue(false);
      const baselineMetadata = await generateMetadata({ params: Promise.resolve(playaParams) });
      const baselineOverview = findOverview(await IntentPage({ params: Promise.resolve(playaParams) }));

      expect(protectedMetadata).toEqual(baselineMetadata);
      expect(protectedMetadata.robots).toMatchObject({ index: true, follow: true });
      expect(protectedMetadata.title).toBe("Playa Del Rey Water Temperature Today: 76°F");
      if (!protectedOverview || !baselineOverview) throw new Error("Expected water temperature overview");
      const markup = renderToStaticMarkup(protectedOverview);
      expect(markup).toBe(renderToStaticMarkup(baselineOverview));
      expect(markup).toContain("Data from Dockweiler");
      expect(markup).not.toContain(noReadingLine);
    });
  });
});
