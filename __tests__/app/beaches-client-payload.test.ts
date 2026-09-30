/**
 * @jest-environment node
 */

// State hub and city pages are ISR: client-component props are serialized into
// the RSC payload on every regeneration. These fail if a column a client
// component never reads reaches it.

jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getAllBeachLocations: jest.fn(),
}));

jest.mock("@/actions/beach/beach-state-actions", () => ({
  getStateMapBeaches: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "or", "eq", "in", "is", "not", "order", "limit", "ilike"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null });
  return {
    createPublicReadClient: () => ({ from: () => builder }),
    createSupabaseServerClient: async () => ({ from: () => builder }),
  };
});

import { isValidElement, type ReactElement, type ReactNode } from "react";
import UsaStatePage from "@/app/beaches/usa/[state]/page";
import { EditorialLayout } from "@/app/beaches/[country]/[state]/[city]/editorial-layout";
import { StandardLayout } from "@/app/beaches/[country]/[state]/[city]/standard-layout";
import { LocationMapClient } from "@/app/beaches/[country]/[state]/[city]/location-map-client";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getStateMapBeaches } from "@/actions/beach/beach-state-actions";
import { StateMapView } from "@/components/state/state-map-view";
import { CityMapView } from "@/components/city/city-map-view";
import { GuidesByIntentGrid } from "@/components/city/guides-by-intent-grid";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";
import { mockSanDiegoEditorial } from "@/__tests__/fixtures/city-editorial";
import type { Beach } from "@/types/database";
import type { BeachWithMetrics, LocationStats } from "@/types/location";

const MAP_BEACH_KEYS = [
  "id", "name", "slug", "city", "state", "country", "region", "lat", "lon",
  "timezone", "is_private", "skill_level", "break_type", "crowd_level",
  "wave_tips", "best_conditions_prose", "crowd_tips",
].sort();

const CITY_MAP_SPOT_KEYS = [
  "id", "slug", "name", "city", "region", "coordinates", "skillLevel",
  "overview", "crowdFactor", "conditions", "swellAdvice",
].sort();

const INTENT_GUIDE_KEYS = ["slug", "name", "skill_level", "crowd_level"].sort();

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

// What getStateMapBeaches returns: a narrow select expanded with defaults.
function paddedHubBeach(index: number): Beach {
  return createBeachWithDefaults({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: `Jetty ${index}`,
    slug: `jetty-${index}`,
    city: "Test Harbor",
    state: "CA",
    country: "USA",
    lat: 33.6 + index / 100,
    lon: -117.9,
    timezone: "America/Los_Angeles",
    created_at: "2026-01-01T00:00:00.000Z",
    geog: "0101000020E6100000",
    skill_level: "beginner",
    break_type: "beach",
    average_rating: 4.2,
    review_count: 12,
  });
}

// What the location RPCs return: 18 columns, no timezone or region.
function rpcBeach(index: number): BeachWithMetrics {
  return {
    id: `00000000-0000-4000-8000-00000000001${index}`,
    name: `Point ${index}`,
    slug: `point-${index}`,
    city: "Test Harbor",
    state: "CA",
    country: "USA",
    lat: 33.6 + index / 100,
    lon: -117.9,
    skill_level: index === 1 ? "beginner" : "advanced",
    crowd_level: index === 1 ? "light" : "heavy",
    break_type: "point",
    best_conditions_prose: "Clean west swell.",
    description: "A long description the map never shows. ".repeat(10),
    average_rating: 4.5,
    review_count: 20,
    composite_score: 0.8,
    recent_intel_count: 3,
    avg_confirmations: 1,
    compositeScore: 0.8,
    recentIntelCount: 3,
    avgConfirmations: 1,
  } as unknown as BeachWithMetrics;
}

const STATS: LocationStats = {
  locationName: "Test Harbor",
  stateName: "California",
  countryName: "United States",
  totalBeaches: 2,
  averageRating: 4.5,
  totalReviews: 40,
  topBeaches: 2,
};

const PARAMS = { country: "usa", state: "ca", city: "test-harbor" };

describe("state hub client payload", () => {
  beforeEach(() => {
    (getAllBeachLocations as jest.Mock).mockResolvedValue({
      success: true,
      data: [{ city: "Test Harbor", state: "CA", country: "USA", beach_count: 2 }],
    });
    (getStateMapBeaches as jest.Mock).mockResolvedValue({
      success: true,
      data: [paddedHubBeach(1), paddedHubBeach(2)],
    });
  });

  it("sends StateMapView only the beach columns the map reads", async () => {
    const tree = await UsaStatePage({ params: Promise.resolve({ state: "ca" }) });

    const [map] = findElements(tree, StateMapView);
    const beaches = (map.props as { beaches: object[] }).beaches;
    expect(propKeys(beaches)).toEqual(MAP_BEACH_KEYS);
    expect(beaches[0]).toMatchObject({ name: "Jetty 1", country: "USA", timezone: "America/Los_Angeles" });
  });
});

describe("city page client payload", () => {
  const beaches = [rpcBeach(1), rpcBeach(2)];

  it("sends CityMapView and GuidesByIntentGrid only the fields they read on editorial cities", () => {
    const tree = EditorialLayout({
      params: PARAMS,
      displayCityName: "Test Harbor",
      stats: STATS,
      beaches,
      editorial: mockSanDiegoEditorial,
      jsonLd: {},
      itemListItems: [],
    });

    const [map] = findElements(tree, CityMapView);
    expect(propKeys((map.props as { spots: object[] }).spots)).toEqual(CITY_MAP_SPOT_KEYS);

    const [guides] = findElements(tree, GuidesByIntentGrid);
    const guideBeaches = (guides.props as { beaches: object[] }).beaches;
    expect(propKeys(guideBeaches)).toEqual(INTENT_GUIDE_KEYS);
    expect(guideBeaches).toEqual(
      beaches.map(({ slug, name, skill_level, crowd_level }) => ({ slug, name, skill_level, crowd_level })),
    );
  });

  it("sends LocationMapClient only map columns, keeping each row's own keys", () => {
    const tree = StandardLayout({
      params: PARAMS,
      displayCityName: "Test Harbor",
      stats: STATS,
      location: { country: "USA", state: "CA", city: "Test Harbor" },
      beaches,
      metroConfig: null,
      jsonLd: {},
      itemListItems: [],
    });

    const [map] = findElements(tree, LocationMapClient);
    const mapBeaches = (map.props as { beaches: object[] }).beaches;
    // The RPC rows carry no timezone or region: projection must not invent them,
    // or the map would trust a default timezone.
    expect(propKeys(mapBeaches)).toEqual(
      ["best_conditions_prose", "break_type", "city", "country", "crowd_level", "id", "lat", "lon", "name", "skill_level", "slug", "state"],
    );
  });
});
