/**
 * @jest-environment node
 */

// City intent pages (/tide/{city}, /water-temp/{city}, ...) are US-only and build
// every link from a two-letter state slug. Rendering one for Camalú, Baja
// California produced /baja california/camalu/... links that Google crawled as
// 404s, so an international city must leave for its own city hub instead.

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
  getCityIntentDataAvailability: jest.fn().mockResolvedValue("unknown"),
  getCityWaterTempHistory: jest.fn().mockResolvedValue(null),
  getIntentForecastSummary: jest.fn().mockResolvedValue(null),
  getCityWaterTempExpanded: jest.fn().mockResolvedValue(null),
  getCitySunTimesData: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/city/city-editorial-actions", () => ({
  getCityEditorialContent: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/beginner/beginner-actions", () => ({
  getBeginnerConditionsData: jest.fn(),
  getBeginnerBeachesWithEditorial: jest.fn().mockResolvedValue([]),
  getBeginnerCityEditorial: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  permanentRedirect: jest.fn(),
  notFound: jest.fn(),
}));

import IntentPage from "@/app/[intent]/[city]/page";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import type { CityMetadata } from "@/types/location";

const { notFound, permanentRedirect } = jest.requireMock("next/navigation") as {
  notFound: jest.Mock;
  permanentRedirect: jest.Mock;
};

const camalu: CityMetadata = {
  cityName: "Camalú",
  state: "Baja California",
  stateName: "Baja California",
  country: "Mexico",
  totalBeaches: 3,
  beginnerCount: 0,
  intermediateCount: 2,
  advancedCount: 1,
  beaches: [],
  centerLat: 30.84,
  centerLon: -116.07,
};

describe("intent city pages for international cities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["water-temp", "tide", "sunset", "dawn-patrol", "beginner"])(
    "sends /%s/camalu to the Camalú city hub",
    async (intent) => {
      (findCityBySlug as jest.Mock).mockResolvedValue({ success: true, data: camalu });

      await IntentPage({ params: Promise.resolve({ intent, city: "camalu" }) });

      expect(permanentRedirect).toHaveBeenCalledWith("/mexico/baja-california/camalu");
      expect(notFound).not.toHaveBeenCalled();
    },
  );

  it("404s when the city has no country to build a hub URL from", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: { ...camalu, country: null },
    });

    await IntentPage({ params: Promise.resolve({ intent: "tide", city: "camalu" }) });

    expect(notFound).toHaveBeenCalled();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});
