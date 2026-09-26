/**
 * @jest-environment node
 */

// Next.js lowers an ISR page's revalidate to the shortest `unstable_cache`
// revalidate read during the render. Record every window a render reads so the
// effective page window can be computed the same way.
const mockCacheWindowsRead: number[] = [];

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn(
    (
      fn: (...args: unknown[]) => Promise<unknown>,
      _keyParts?: string[],
      options?: { revalidate?: number | false },
    ) =>
      async (...args: unknown[]) => {
        if (typeof options?.revalidate === "number") {
          mockCacheWindowsRead.push(options.revalidate);
        }
        return fn(...args);
      },
  ),
}));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(),
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: jest.fn(async (beaches: unknown[]) => beaches),
}));

jest.mock("@/actions/city/city-metadata-actions", () => ({
  findCityBySlug: jest.fn(),
  findCitiesMatchingPattern: jest.fn(),
  getCityMetadata: jest.fn(),
  getCityBeachEditorialData: jest.fn().mockResolvedValue([]),
  getCityExcludeIntents: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/actions/forecast/intent-forecast-actions", () => ({
  getCityTideData: jest.fn().mockResolvedValue(null),
  getCityTideDataExpanded: jest.fn().mockResolvedValue(null),
  getCityIntentDataAvailability: jest.fn().mockResolvedValue("available"),
  getCityWaterTempHistory: jest.fn().mockResolvedValue(null),
  getIntentForecastSummary: jest.fn().mockResolvedValue(null),
  getCityWaterTempExpanded: jest.fn().mockResolvedValue(null),
  getCitySunTimesData: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/city/city-editorial-actions", () => ({
  getCityEditorialContent: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/beach/beach-location-actions", () => ({
  getTopCitiesInState: jest.fn().mockResolvedValue([]),
  getTopCitiesInStateForIntent: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/actions/beginner/beginner-actions", () => ({
  getBeginnerConditionsData: jest
    .fn()
    .mockResolvedValue({ badge: null, rightNow: null }),
  getBeginnerBeachesWithEditorial: jest.fn().mockResolvedValue([]),
  getBeginnerCityEditorial: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/utils/best-time-to-surf-utils", () => ({
  getBestTimeToSurfUrl: jest.fn().mockResolvedValue(undefined),
}));

import IntentPage, { revalidate as declaredRevalidate } from "@/app/[intent]/[city]/page";
import { createPublicReadClient } from "@/lib/supabase/server";
import { getBeachesByIntentAndCity } from "@/actions/beach/beach-query-actions";
import {
  findCitiesMatchingPattern,
  findCityBySlug,
} from "@/actions/city/city-metadata-actions";
import {
  getCitySunTimesData,
  getCityTideDataExpanded,
  getCityWaterTempExpanded,
  getIntentForecastSummary,
} from "@/actions/forecast/intent-forecast-actions";

const CITY = {
  cityName: "Test Harbor",
  state: "CA",
  stateName: "California",
  totalBeaches: 2,
  beginnerCount: 1,
  intermediateCount: 1,
  advancedCount: 1,
  beaches: [],
  centerLat: 33.6,
  centerLon: -117.9,
};

const BEACH_ROWS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "North Jetty",
    slug: "north-jetty",
    city: "Test Harbor",
    state: "CA",
    country: "USA",
    lat: 33.61,
    lon: -117.91,
    skill_level: "longboard",
    crowd_level: "light",
  },
];

function mockBeachQueries(): void {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "or", "eq", "order", "limit", "in", "is", "not"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: BEACH_ROWS, error: null });
  (createPublicReadClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => builder),
  });
}

async function effectiveWindow(intent: string, city: string): Promise<number> {
  mockCacheWindowsRead.length = 0;
  await IntentPage({ params: Promise.resolve({ intent, city }) });
  return Math.min(declaredRevalidate, ...mockCacheWindowsRead);
}

const TIDE_DATA = {
  tidePoints: [],
  currentStatus: "Rising",
  currentHeight: "3.1 ft",
  nextTideType: "High",
  nextTideTime: "4:12 PM",
  nextTideHeight: "5.0 ft",
  beachName: "North Jetty",
  tideStation: null,
  sevenDayExtrema: [],
  hourlyPoints: [],
  beachTidePreferences: [],
};

const WATER_TEMP_DATA = {
  currentTemp: 64,
  points: [],
  beachName: "North Jetty",
  wetsuitRecommendation: { thickness: "4/3mm", description: "", extras: [] },
  beachTemps: [],
  monthlyAverages: null,
};

const SUN_DATA = {
  sunrise: "6:40 AM",
  sunset: "6:45 PM",
  firstLight: "6:10 AM",
  lastLight: "7:15 PM",
  dayLength: "12h 5m",
  dayLengthChange: "-2 min",
  goldenHour: { start: "5:45 PM", end: "6:45 PM" },
  sevenDayTimes: [],
  beachName: "North Jetty",
};

describe("/[intent]/[city] effective ISR window", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBeachQueries();
    (findCityBySlug as jest.Mock).mockResolvedValue({ success: true, data: CITY });
    (getCityTideDataExpanded as jest.Mock).mockResolvedValue(TIDE_DATA);
    (getCityWaterTempExpanded as jest.Mock).mockResolvedValue(WATER_TEMP_DATA);
    (getCitySunTimesData as jest.Mock).mockResolvedValue(SUN_DATA);
  });

  it("declares the hourly window its meta descriptions promise", () => {
    expect(declaredRevalidate).toBe(3600);
  });

  // These renders show tide predictions, water temperature, sun times, and beach
  // metadata, with no surf recommendation or hold, and say "Updated hourly".
  it.each([
    ["tide", "test-harbor"],
    ["water-temp", "test-harbor"],
    ["dawn-patrol", "test-harbor"],
    ["sunset", "test-harbor"],
    ["beginner", "test-harbor"],
    ["beginner", "ca"],
    ["longboard", "ca"],
    ["least-crowded", "ca"],
  ])("regenerates /%s/%s hourly, not at the beach-list cache window", async (intent, city) => {
    await expect(effectiveWindow(intent, city)).resolves.toBe(3600);
  });

  // Live recommendations ("refresh every 30 minutes") and water-quality holds
  // are evaluated at render; keep their current 15-minute window.
  it.each([
    ["longboard", "test-harbor"],
    ["least-crowded", "test-harbor"],
  ])("keeps the 15-minute window for live recommendations on /%s/%s", async (intent, city) => {
    await expect(effectiveWindow(intent, city)).resolves.toBe(900);
    expect(getIntentForecastSummary).toHaveBeenCalled();
  });

  it("keeps the 15-minute window when a tide page falls back to live recommendations", async () => {
    (getCityTideDataExpanded as jest.Mock).mockResolvedValue(null);

    await expect(effectiveWindow("tide", "test-harbor")).resolves.toBe(900);
    expect(getIntentForecastSummary).toHaveBeenCalled();
  });
});

describe("/[intent]/[city] unknown first segment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBeachQueries();
    (findCityBySlug as jest.Mock).mockResolvedValue({ success: true, data: CITY });
  });

  it.each([
    ["wp-admin", "setup-config.php"],
    [".well-known", "traffic-advice"],
    ["beginner-surf-spots", "tijuana"],
  ])("returns 404 for /%s/%s without a city lookup", async (intent, city) => {
    await expect(
      IntentPage({ params: Promise.resolve({ intent, city }) }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(findCityBySlug).not.toHaveBeenCalled();
    expect(findCitiesMatchingPattern).not.toHaveBeenCalled();
    expect(createPublicReadClient).not.toHaveBeenCalled();
  });

  it("still resolves the city for a known intent before returning 404", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({ success: false, data: null });
    (findCitiesMatchingPattern as jest.Mock).mockResolvedValue({ success: true, data: [] });

    await expect(
      IntentPage({ params: Promise.resolve({ intent: "tide", city: "nowhere-xyz" }) }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(findCityBySlug).toHaveBeenCalledWith("nowhere-xyz");
  });
});

describe("getBeachesByIntentAndCity cache window", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBeachQueries();
  });

  async function windowRead(options?: { revalidateSeconds?: number }): Promise<number[]> {
    mockCacheWindowsRead.length = 0;
    const result = await getBeachesByIntentAndCity("tide", "test-harbor", "ca", options);
    expect(result.data).toHaveLength(BEACH_ROWS.length);
    return [...mockCacheWindowsRead];
  }

  it("keeps the 15-minute default for existing callers", async () => {
    await expect(windowRead()).resolves.toEqual([900]);
  });

  it("uses a caller's positive whole-second window", async () => {
    await expect(windowRead({ revalidateSeconds: 3600 })).resolves.toEqual([3600]);
  });

  it.each([0, -60, 1.5, Number.NaN])(
    "falls back to the default for an invalid window (%p)",
    async (revalidateSeconds) => {
      await expect(windowRead({ revalidateSeconds })).resolves.toEqual([900]);
    },
  );
});
