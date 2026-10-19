/** @jest-environment node */

import type { SupabaseClient } from "@supabase/supabase-js";

const mockGetNearestTideStation = jest.fn();
const mockGetBeachModelTides = jest.fn();

jest.mock("@/lib/services/noaa-tide-service", () => ({
  getNearestTideStation: (...args: unknown[]) => mockGetNearestTideStation(...args),
}));

jest.mock("@/lib/services/tides/model-tides", () => ({
  getBeachModelTides: (...args: unknown[]) => mockGetBeachModelTides(...args),
}));

jest.mock("@/scripts/load-env.mjs", () => ({ config: jest.fn() }));

import { fetchTideBeachIds } from "@/scripts/tide-forecast-integrity";

it("counts only coordinate beaches with a NOAA station or FES2022 model as tide targets", async () => {
  const beaches = [
    { id: "station-a", lat: 32, lon: -117 },
    { id: "station-b", lat: 32, lon: -117 },
    { id: "model", lat: 23, lon: -110 },
    { id: "no-source", lat: 50, lon: -130 },
    { id: "no-coordinates", lat: null, lon: -117 },
  ];
  const range = jest.fn(async (start: number) => ({ data: start === 0 ? beaches : [], error: null }));
  const builder = { select: () => builder, order: () => builder, range };
  const client = { from: jest.fn(() => builder) } as unknown as SupabaseClient;
  mockGetBeachModelTides.mockImplementation((id: string) => id === "model" ? { beachId: id } : null);
  mockGetNearestTideStation.mockImplementation(async (lat: number) => lat === 32 ? { id: "S1" } : null);

  const result = await fetchTideBeachIds(client);

  expect(result).toEqual({
    allIds: beaches.map((beach) => beach.id),
    selectedIds: ["station-a", "station-b", "model"],
  });
  expect(mockGetNearestTideStation).toHaveBeenCalledTimes(2);
  expect(mockGetNearestTideStation).toHaveBeenCalledWith(32, -117);
  expect(mockGetNearestTideStation).toHaveBeenCalledWith(50, -130);
});
