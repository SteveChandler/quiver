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

import { generateMetadata } from "@/app/[intent]/[city]/page";
import {
  findCityBySlug,
  getCityExcludeIntents,
} from "@/actions/city/city-metadata-actions";
import {
  getCityIntentDataAvailability,
  getCityWaterTempHistory,
} from "@/actions/forecast/intent-forecast-actions";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { isGscPerformanceProtected } from "@/lib/seo/gsc-performance-protection";

describe("city intent indexability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("available");
    (getCityWaterTempHistory as jest.Mock).mockResolvedValue({ currentTemp: 76 });
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
});
