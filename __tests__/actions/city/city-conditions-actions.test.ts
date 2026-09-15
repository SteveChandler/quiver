/**
 * @jest-environment node
 */

const mockChain = {
  from: jest.fn(),
  select: jest.fn(),
  ilike: jest.fn(),
  gte: jest.fn(),
  lt: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
  then: undefined as unknown,
};
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) =>
  beaches.filter((beach) => beach.id !== "held-beach"),
);

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: () => unknown) => fn),
}));
jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => mockChain),
}));
jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

import { getCitySurfReport } from "@/actions/city/city-conditions-actions";

describe("city best-right-now water-quality policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.ilike.mockReturnValue(mockChain);
    mockChain.gte.mockReturnValue(mockChain);
    mockChain.lt.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockReturnValue(mockChain);
    mockChain.then = (resolve: (value: unknown) => unknown) =>
      resolve({
        data: [
          {
            beach_id: "held-beach",
            forecast_at: "2026-08-13T10:00:00.000Z",
            updated_at: "2026-08-13T08:00:00.000Z",
            wave_height: "6 ft",
            wave_period: "14 s",
            wind_speed: "2 mph",
            wind_direction: "W",
            beaches: {
              id: "held-beach",
              name: "Held Beach",
              slug: "held-beach",
              city: "San Diego",
              state: "CA",
            },
          },
          {
            beach_id: "safe-beach",
            forecast_at: "2026-08-13T10:00:00.000Z",
            updated_at: "2026-08-13T08:00:00.000Z",
            wave_height: "3 ft",
            wave_period: "10 s",
            wind_speed: "5 mph",
            wind_direction: "W",
            beaches: {
              id: "safe-beach",
              name: "Safe Beach",
              slug: "safe-beach",
              city: "San Diego",
              state: "CA",
            },
          },
        ],
        error: null,
      });
  });

  it("removes a held beach before selecting the city best-right-now beach", async () => {
    const result = await getCitySurfReport("San Diego", "CA");

    expect(result?.bestBeach?.beachId).toBe("safe-beach");
    expect(result?.beaches.map(({ beachId }) => beachId)).toEqual([
      "safe-beach",
    ]);
    expect(mockRankBeaches).toHaveBeenCalled();
  });

  it("over-fetches city candidates before filtering held beaches", async () => {
    await getCitySurfReport("San Diego", "CA");

    expect(mockChain.limit).toHaveBeenCalledWith(205);
  });
});

it("keeps the source timestamp stable across regeneration and preserves forecast TTL", async () => {
  jest.useFakeTimers();
  try {
    const chain = mockChain;
    for (const key of ["from", "select", "ilike", "gte", "lt", "order", "limit"] as const) chain[key].mockReturnValue(chain);
    chain.then = (resolve: (value: unknown) => unknown) => resolve({data: [{
      beach_id: "safe-beach", forecast_at: "2026-09-15T16:00:00Z", updated_at: "2026-09-15T12:00:00Z",
      wave_height: "3 ft", wave_period: "10 s", wind_speed: "5 mph", wind_direction: "W",
      beaches: {id: "safe-beach", name: "Safe", slug: "safe", city: "San Diego", state: "CA"},
    }], error: null});
    jest.setSystemTime(new Date("2026-09-15T13:00:00Z"));
    const first = await getCitySurfReport("San Diego", "CA");
    jest.setSystemTime(new Date("2026-09-15T13:20:00Z"));
    expect(await getCitySurfReport("San Diego", "CA")).toEqual(first);
    expect(first?.updatedAt).toBe("2026-09-15T12:00:00.000Z");
    const { unstable_cache } = await import("next/cache");
    expect(unstable_cache).toHaveBeenLastCalledWith(expect.any(Function), expect.any(Array), expect.objectContaining({revalidate: 900}));
  } finally { jest.useRealTimers(); }
});

it.each([
  { second: "2026-09-15T11:00:00Z", expected: "2026-09-15T11:00:00.000Z" },
  { second: null, expected: null },
  { second: "invalid", expected: null },
])("uses the oldest displayed source or unknown freshness: $second", async ({second, expected}) => {
  for (const key of ["from", "select", "ilike", "gte", "lt", "order", "limit"] as const) mockChain[key].mockReturnValue(mockChain);
  mockChain.then = (resolve: (value: unknown) => unknown) => resolve({data: [
    {id: "one", updated_at: "2026-09-15T12:00:00Z"}, {id: "two", updated_at: second},
    {id: "held-beach", updated_at: "2026-09-13T01:00:00Z"},
  ].map(({id, updated_at}) => ({
    beach_id: id, forecast_at: "2026-09-15T16:00:00Z", updated_at,
    wave_height: "3 ft", wave_period: "10 s", wind_speed: "5 mph", wind_direction: "W",
    beaches: {id, name: id, slug: id, city: "San Diego", state: "CA"},
  })), error: null});
  const report = await getCitySurfReport("San Diego", "CA");
  expect(report?.beaches.map(beach => beach.beachId)).toEqual(["one", "two"]);
  expect(report?.updatedAt).toBe(expected);
});
