/**
 * @jest-environment node
 *
 * After rain, every beach near a gauge is held for 72 hours. Holds stop go
 * calls; they must not empty a city's spot directory or its water-temp
 * reading (/water-temp/san-diego went blank on Oct 23 2026). These run the real
 * rankBeaches/selectBeach and fake only the hold resolver and Supabase.
 */

const mockResolveWaterQualityHolds = jest.fn();

jest.mock("@/lib/recommendations/major-event-hold/water-quality", () => ({
  resolveWaterQualityHolds: (...args: unknown[]) => mockResolveWaterQualityHolds(...args),
}));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(),
  createSupabaseServerClient: jest.fn(async () => ({})),
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/community-photos", () => ({
  communityPhotoTargetKey: jest.fn(() => "key"),
  getResolvedSpotPhotoMap: jest.fn(async () => new Map()),
}));

import { createPublicReadClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getBeachesByIntentAndCity } from "@/actions/beach/beach-query-actions";
import { getCityWaterTempExpanded, getIntentForecastSummary } from "@/actions/forecast/intent-forecast-actions";

const BLACKS = "11111111-1111-4111-8111-111111111111";
const OCEAN_BEACH = "22222222-2222-4222-8222-222222222222";
const BEACHES = [
  { id: BLACKS, name: "Blacks Beach", slug: "blacks", city: "San Diego", state: "CA", timezone: "America/Los_Angeles", skill_level: "longboard" },
  { id: OCEAN_BEACH, name: "Ocean Beach", slug: "ocean-beach", city: "San Diego", state: "CA", timezone: "America/Los_Angeles", skill_level: "beginner" },
];

/** Every chained call returns the query; awaiting it yields `rows`, `.single()` the first row. */
function query(rows: unknown[]) {
  const result = { data: rows, error: null };
  const chain: Record<string, unknown> = {
    single: jest.fn(async () => ({ data: rows[0] ?? null, error: null })),
    maybeSingle: jest.fn(async () => ({ data: rows[0] ?? null, error: null })),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  for (const method of ["select", "or", "eq", "in", "ilike", "gte", "lt", "lte", "not", "order", "limit"]) {
    chain[method] = jest.fn(() => chain);
  }
  return chain;
}

function fakeSupabase() {
  const forecastAt = new Date().toISOString();
  const forecasts = BEACHES.map((beach) => ({
    beach_id: beach.id,
    water_temp: "64°F",
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    water_temp_source: "coops",
    beaches: beach,
  }));
  return {
    from: jest.fn((table: string) => {
      if (table === "beaches") return query(BEACHES);
      if (table === "enhanced_forecasts") return query(forecasts);
      return query([]);
    }),
  };
}

function holdEveryBeach(heldUntil: string | null) {
  mockResolveWaterQualityHolds.mockImplementation(async (candidates: Array<{ beachId: string }>) => {
    const ids = [...new Set(candidates.map(({ beachId }) => beachId))];
    return {
      state: "resolved",
      heldBeachIds: ids,
      waterQualityStatusByBeachId: Object.fromEntries(ids.map((id) => [id, heldUntil ? "advisory" : "closure"])),
      ...(heldUntil ? { heldUntilByBeachId: Object.fromEntries(ids.map((id) => [id, heldUntil])) } : {}),
      epoch: heldUntil ? "rain" : "county",
    };
  });
}

describe("intent city pages while every beach is held", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const supabase = fakeSupabase();
    (createPublicReadClient as jest.Mock).mockReturnValue(supabase);
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(supabase);
  });

  describe("by runoff after rain", () => {
    beforeEach(() => holdEveryBeach(new Date(Date.now() + 72 * 3600_000).toISOString()));

    it("still lists the city's spots", async () => {
      const result = await getBeachesByIntentAndCity("longboard", "san-diego", "ca");
      expect(result.data?.map(({ id }) => id)).toEqual([BLACKS, OCEAN_BEACH]);
    });

    it("still reads the city's water temperature and its beaches", async () => {
      const result = await getCityWaterTempExpanded("San Diego", "CA");
      expect(result).toMatchObject({ currentTemp: 64, beachName: "Blacks Beach" });
      expect(result?.beachTemps.map(({ beachId }) => beachId).sort()).toEqual([BLACKS, OCEAN_BEACH]);
    });

    it("still makes no live pick from them", async () => {
      await expect(getIntentForecastSummary(BEACHES, "longboard")).resolves.toBeNull();
    });
  });

  describe("by a standing closure", () => {
    beforeEach(() => holdEveryBeach(null));

    it("removes the closed spots", async () => {
      const result = await getBeachesByIntentAndCity("longboard", "san-diego", "ca");
      expect(result.data).toEqual([]);
    });
  });
});
