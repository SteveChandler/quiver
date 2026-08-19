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
