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
  getCityIntentDataAvailability: jest.fn().mockResolvedValue("unknown"),
  getCityWaterTempHistory: jest.fn().mockResolvedValue(null),
  getIntentForecastSummary: jest.fn().mockResolvedValue(null),
  getCityWaterTempExpanded: jest.fn().mockResolvedValue(null),
  getCitySunTimesData: jest.fn().mockResolvedValue(null),
}));

import IntentPage, { generateMetadata } from "@/app/[intent]/[city]/page";
import {
  findCitiesMatchingPattern,
  findCityBySlug,
  getCityExcludeIntents,
} from "@/actions/city/city-metadata-actions";
import {
  getCityIntentDataAvailability,
  getCityTideData,
  getCityWaterTempHistory,
} from "@/actions/forecast/intent-forecast-actions";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

describe("legacy state/city URLs", () => {
  const cityMetadata = {
    cityName: "Test Harbor",
    state: "CA",
    stateName: "California",
    totalBeaches: 2,
    beginnerCount: 0,
    intermediateCount: 2,
    advancedCount: 0,
    beaches: [],
    centerLat: 33.6,
    centerLon: -117.9,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
    (findCitiesMatchingPattern as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (getCityExcludeIntents as jest.Mock).mockResolvedValue([]);
    (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("unknown");
    (getCityTideData as jest.Mock).mockResolvedValue(null);
    (getCityWaterTempHistory as jest.Mock).mockResolvedValue(null);
  });

  test("redirects /ca/:city to map with search filter", async () => {
    const { redirect } = require("next/navigation") as { redirect: jest.Mock };

    await IntentPage({ params: Promise.resolve({ intent: "ca", city: "encinitas" }) });

    expect(redirect).toHaveBeenCalledWith("/map?search=Encinitas");
  });

  test("does not redirect normal intent pages (non-state intent)", async () => {
    const { redirect, notFound } = require("next/navigation") as {
      redirect: jest.Mock;
      notFound: jest.Mock;
    };

    await IntentPage({ params: Promise.resolve({ intent: "surf-forecast", city: "encinitas" }) });

    expect(redirect).not.toHaveBeenCalled();
    // We don't assert rendering details here; for unknown intent/city combos this route may 404.
    expect(notFound).toHaveBeenCalled();
  });

  test("returns explicit not-found metadata for missing intent cities", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
    (findCitiesMatchingPattern as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        intent: "beginner",
        city: "long-island-does-not-exist",
      }),
    });

    expect(metadata.title).toBe("Page Not Found");
    expect(metadata.description).toBe("This page could not be found.");
    expect(metadata.alternates?.canonical).toContain(
      "/beginner/long-island-does-not-exist",
    );
    expect((metadata.robots as any)?.index).toBe(false);
    expect((metadata.robots as any)?.follow).toBe(true);
  });

  test("noindexes filtered city intent pages when shared eligibility excludes them", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: cityMetadata,
    });
    (getCityExcludeIntents as jest.Mock).mockResolvedValue([
      "beginner",
      "longboard",
      "least-crowded",
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        intent: "beginner",
        city: "test-harbor",
      }),
    });

    expect((metadata.robots as any)?.index).toBe(false);
    expect((metadata.robots as any)?.follow).toBe(true);
  });

  test.each(["tide", "water-temp", "dawn-patrol", "sunset"])(
    "does not noindex %s city pages from filtered-intent exclusions",
    async (intent) => {
      (findCityBySlug as jest.Mock).mockResolvedValue({
        success: true,
        data: cityMetadata,
      });
      (getCityExcludeIntents as jest.Mock).mockResolvedValue([
        "beginner",
        "longboard",
        "least-crowded",
      ]);

      const metadata = await generateMetadata({
        params: Promise.resolve({
          intent,
          city: `${intent}-test-harbor`,
        }),
      });

      expect((metadata.robots as any)?.index).not.toBe(false);
      expect(getCityExcludeIntents).not.toHaveBeenCalled();
    }
  );

  test.each([
    ["tide", getCityTideData],
    ["water-temp", getCityWaterTempHistory],
  ])(
    "noindexes %s city pages only when live data is confirmed missing",
    async (intent, dataLoader) => {
      (findCityBySlug as jest.Mock).mockResolvedValue({
        success: true,
        data: cityMetadata,
      });
      (dataLoader as jest.Mock).mockResolvedValue(null);
      (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("missing");

      const metadata = await generateMetadata({
        params: Promise.resolve({
          intent,
          city: `${intent}-test-harbor`,
        }),
      });

      expect((metadata.robots as any)?.index).toBe(false);
      expect((metadata.robots as any)?.follow).toBe(true);
      expect(getCityIntentDataAvailability).toHaveBeenCalledWith(
        intent,
        "Test Harbor",
        "CA",
      );
    }
  );

  test.each([
    ["tide", getCityTideData],
    ["water-temp", getCityWaterTempHistory],
  ])(
    "keeps %s city pages indexable when data availability is unknown",
    async (intent, dataLoader) => {
      (findCityBySlug as jest.Mock).mockResolvedValue({
        success: true,
        data: cityMetadata,
      });
      (dataLoader as jest.Mock).mockResolvedValue(null);
      (getCityIntentDataAvailability as jest.Mock).mockResolvedValue("unknown");

      const metadata = await generateMetadata({
        params: Promise.resolve({
          intent,
          city: `${intent}-test-harbor`,
        }),
      });

      expect((metadata.robots as any)?.index).not.toBe(false);
    }
  );
});
