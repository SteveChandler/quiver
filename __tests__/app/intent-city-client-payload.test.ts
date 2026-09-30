/**
 * @jest-environment node
 */

// Props passed to client components are serialized into the page's RSC payload
// and rewritten on every ISR regeneration. These tests fail if a beach column
// or spot field the maps never read reaches StateMapView or CityMapView.

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachesByIntentAndCity: jest.fn(),
  getBeachesByIntentAndState: jest.fn(),
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

jest.mock("@/lib/utils/best-time-to-surf-utils", () => ({
  getBestTimeToSurfUrl: jest.fn().mockResolvedValue(undefined),
}));

import { isValidElement, type ReactElement, type ReactNode } from "react";
import IntentPage from "@/app/[intent]/[city]/page";
import {
  getBeachesByIntentAndCity,
  getBeachesByIntentAndState,
} from "@/actions/beach/beach-query-actions";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { StateMapView } from "@/components/state/state-map-view";
import { CityMapView } from "@/components/city/city-map-view";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { TidePageContent } from "@/components/intent/tide-page-content";
import { WaterTempPageContent } from "@/components/intent/water-temp-page-content";
import { DawnPatrolPageContent } from "@/components/intent/dawn-patrol-page-content";
import { SunsetPageContent } from "@/components/intent/sunset-page-content";
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import type { Beach } from "@/types/database";
import type { BeachWithMetrics } from "@/types/location";

// Every beach column read by InteractiveMap's module graph (markers, cluster and
// preview popups, beach URLs). `country` must be present: buildBeachUrl
// branches on the key existing.
const MAP_BEACH_KEYS = [
  "id", "name", "slug", "city", "state", "country", "region", "lat", "lon",
  "timezone", "is_private", "skill_level", "break_type", "crowd_level",
  "wave_tips", "best_conditions_prose", "crowd_tips",
];

// SurfSpot fields CityMapView reads for its list and the map beaches it builds.
const CITY_MAP_SPOT_KEYS = [
  "id", "slug", "name", "city", "region", "coordinates", "skillLevel",
  "overview", "crowdFactor", "conditions", "swellAdvice",
];

const CITY = {
  cityName: "Test Harbor",
  state: "CA",
  stateName: "California",
  totalBeaches: 2,
  beginnerCount: 2,
  intermediateCount: 0,
  advancedCount: 0,
  beaches: [],
  centerLat: 33.6,
  centerLon: -117.9,
};

function heavyBeach(index: number): Beach {
  const factors = Array.from({ length: 36 }, (_, i) => Math.round(Math.cos(i) * 1e6) / 1e6);
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: `Jetty ${index}`,
    slug: `jetty-${index}`,
    city: "Test Harbor",
    state: "CA",
    country: null,
    region: null,
    lat: 33.6 + index / 100,
    lon: -117.9 - index / 100,
    timezone: "America/Los_Angeles",
    is_private: false,
    skill_level: "beginner",
    break_type: "beach",
    crowd_level: "light",
    wave_tips: "Works on a mid tide.",
    best_conditions_prose: "Clean west swell with light wind.",
    crowd_tips: "Quiet before 7 AM.",
    description: "A mellow beach break.",
    preference_model: { beginner_window: { buckets: [1, 2, 3] }, calibration: { notes: "x".repeat(400) } },
    swell_access_factors: factors,
    wind_exposure_factors: factors,
    shoaling_factors: { bins: [{ factor: 1.1, tp_min_s: 8, tp_max_s: 12 }] },
    terrain_params: { k: 3, step_m: 60, dem_source: "copernicus" },
    terrain_analysis_debug: { samples: factors },
    editorial_sources: [{ source_urls: ["https://example.com"], coverage_action: "keep" }],
    real_takeaways: ["Paddle out at the channel."],
    parking_tips: "Lot fills early.",
    access_tips: "Stairs at the north end.",
    local_etiquette: "Share the peak.",
    features: ["restrooms"],
    hazards: ["rip currents"],
    warnings: ["Sewage advisories after rain."],
    geog: "0101000020E6100000",
  } as unknown as Beach;
}

const BEACHES = [heavyBeach(1), heavyBeach(2)];
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app").replace(/\/$/, "");

function findElements(node: ReactNode, type: unknown, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    node.forEach((child) => findElements(child, type, found));
    return found;
  }
  if (!isValidElement(node)) return found;
  if (node.type === type) found.push(node);
  findElements((node.props as { children?: ReactNode }).children, type, found);
  return found;
}

function propKeys(items: object[]): string[] {
  return [...new Set(items.flatMap((item) => Object.keys(item)))].sort();
}

function spotsFor(beaches: Beach[]) {
  return transformBeachesToSurfSpots(
    beaches.map((beach) => ({
      ...beach,
      compositeScore: 0,
      recentIntelCount: 0,
      avgConfirmations: 0,
    })) as BeachWithMetrics[],
  );
}

describe("/[intent]/[city] client payload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (findCityBySlug as jest.Mock).mockResolvedValue({ success: true, data: CITY });
    (getBeachesByIntentAndState as jest.Mock).mockResolvedValue({ success: true, data: BEACHES });
    (getBeachesByIntentAndCity as jest.Mock).mockResolvedValue({ success: true, data: BEACHES });
  });

  it("sends StateMapView only the beach columns the map reads", async () => {
    const tree = await IntentPage({ params: Promise.resolve({ intent: "beginner", city: "ca" }) });

    const [map] = findElements(tree, StateMapView);
    const mapBeaches = (map.props as { beaches: object[] }).beaches;
    expect(propKeys(mapBeaches)).toEqual([...MAP_BEACH_KEYS].sort());
    expect(mapBeaches).toEqual(
      BEACHES.map((beach) =>
        Object.fromEntries(MAP_BEACH_KEYS.map((key) => [key, beach[key as keyof Beach]])),
      ),
    );

    // Server-only structured data still sees full rows.
    const [itemList] = findElements(tree, ItemListSchema);
    const items = (itemList.props as { items: Array<{ name: string; url: string }> }).items;
    expect(items.map((item) => item.name)).toEqual(BEACHES.map((beach) => beach.name));
    expect(items.map((item) => item.url)).toEqual(
      BEACHES.map((beach) => `${SITE_URL}${buildBeachUrl(beach)}`),
    );
  });

  it("sends CityMapView only the spot fields it reads on live-recommendation pages", async () => {
    const tree = await IntentPage({ params: Promise.resolve({ intent: "longboard", city: "test-harbor" }) });

    const [map] = findElements(tree, CityMapView);
    const spots = (map.props as { spots: object[] }).spots;
    expect(propKeys(spots)).toEqual([...CITY_MAP_SPOT_KEYS].sort());
    expect(spots).toHaveLength(BEACHES.length);
  });

  const common = {
    cityName: CITY.cityName,
    citySlug: "test-harbor",
    stateSlug: "ca",
    stateName: CITY.stateName,
    regionLabel: "Test Harbor, California",
    baseUrl: "https://www.quiversurf.app",
  };

  const contentRenders: Array<[string, () => ReactNode]> = [
    [
      "tide",
      () =>
        TidePageContent({
          ...common,
          pageContent: buildIntentPageContent("tide", CITY),
          tideData: {
            tidePoints: [],
            currentStatus: null,
            currentHeight: null,
            nextTideType: null,
            nextTideTime: null,
            nextTideHeight: null,
            beachName: "Jetty 1",
            tideStation: null,
            sevenDayExtrema: [],
            hourlyPoints: [],
            beachTidePreferences: [],
          },
          spots: spotsFor(BEACHES),
          updatedAt: "Refreshed hourly",
        }),
    ],
    [
      "water-temp",
      () =>
        WaterTempPageContent({
          ...common,
          pageContent: buildIntentPageContent("water-temp", CITY, { waterTempData: { currentTemp: 64 } }),
          waterTempData: {
            currentTemp: 64,
            points: [],
            beachName: "Jetty 1",
            wetsuitRecommendation: { thickness: "4/3mm", description: "", extras: [] },
            beachTemps: [],
            monthlyAverages: null,
          },
          spots: spotsFor(BEACHES),
        }),
    ],
    ...(["dawn-patrol", "sunset"] as const).map((intent) => [
      intent,
      () => {
        const Content = intent === "dawn-patrol" ? DawnPatrolPageContent : SunsetPageContent;
        return Content({
          ...common,
          pageContent: buildIntentPageContent(intent, CITY),
          sunTimesData: {
            sunrise: "6:40 AM",
            sunset: "6:45 PM",
            firstLight: "6:10 AM",
            lastLight: "7:15 PM",
            dayLength: "12h 5m",
            dayLengthChange: "-2 min",
            goldenHour: { start: "5:45 PM", end: "6:45 PM" },
            sevenDayTimes: [],
            beachName: "Jetty 1",
          },
          spots: spotsFor(BEACHES),
        });
      },
    ] as [string, () => ReactNode]),
  ];

  it.each(contentRenders)("sends CityMapView only the spot fields it reads on /%s pages", (_intent, render) => {
    const [map] = findElements(render(), CityMapView);
    const spots = (map.props as { spots: object[] }).spots;
    expect(propKeys(spots)).toEqual([...CITY_MAP_SPOT_KEYS].sort());
  });
});
