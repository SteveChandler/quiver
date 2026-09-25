/**
 * @jest-environment node
 */

import {
  getBestTimeToSurfData,
  getCitiesWithBestMonthsData,
} from "@/actions/city/best-time-actions";
import { createPublicReadClient } from "@/lib/supabase/server";

const mockRankBeaches = jest.fn(
  async (beaches: Array<{ id: string }>) => beaches,
);

jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createPublicReadClient: jest.fn(),
}));
jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

type Row = Record<string, unknown>;

function mockBeachesQuery(rows: Row[]) {
  const chain: Record<string, jest.Mock> = {};
  const result = Promise.resolve({ data: rows, error: null });
  for (const method of ["select", "not", "or", "ilike", "eq"]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.order = jest.fn(() => result);
  // getCitiesWithBestMonthsData awaits the chain after its last filter.
  (chain as unknown as PromiseLike<unknown>).then = ((
    ...args: Parameters<Promise<unknown>["then"]>
  ) => result.then(...args)) as never;
  (createPublicReadClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => chain),
  });
  return chain;
}

describe("getCitiesWithBestMonthsData", () => {
  beforeEach(() => {
    mockRankBeaches.mockReset();
    mockRankBeaches.mockImplementation(async (beaches) => beaches);
  });

  it("lists only cities the best-time city route can render", async () => {
    mockBeachesQuery([
      { city: "Tijuana", state: "Baja California", best_months: [10, 11] },
      { city: "El Pescadero", state: "Baja California Sur", best_months: [] },
      { city: "Venustiano Carranza (Santa María)", state: "Baja California", best_months: [1] },
      { city: "San Diego", state: "CA", best_months: [] },
    ]);

    const result = await getCitiesWithBestMonthsData();

    expect(result.success).toBe(true);
    expect(result.data?.map((c) => c.city).sort()).toEqual(["San Diego", "Tijuana"]);
    // No per-request hold lookup: it would make the daily-ISR hub dynamic.
    expect(mockRankBeaches).not.toHaveBeenCalled();
  });
});

describe("getBestTimeToSurfData", () => {
  beforeEach(() => {
    mockRankBeaches.mockReset();
    mockRankBeaches.mockImplementation(async (beaches) => beaches);
  });

  it("matches a Mexico state by its stored display name, not an uppercased one", async () => {
    const chain = mockBeachesQuery([
      {
        id: "tj-1",
        name: "Playas de Tijuana",
        slug: "playas-de-tijuana",
        city: "Tijuana",
        state: "Baja California",
        country: "Mexico",
        best_months: [10, 11, 12],
        skill_level: null,
        crowd_level: null,
      },
    ]);

    const result = await getBestTimeToSurfData("Tijuana", "Baja California");

    expect(chain.eq).toHaveBeenCalledWith("state", "Baja California");
    expect(result.data?.state).toBe("Baja California");
    expect(result.data?.topBeaches).toHaveLength(1);
  });

  it("keeps the calendar but lists no beaches when every beach is held", async () => {
    mockBeachesQuery([
      {
        id: "ib-1",
        name: "Imperial Beach Pier",
        slug: "imperial-beach-pier",
        city: "Imperial Beach",
        state: "CA",
        country: "USA",
        best_months: [5, 6, 7],
        skill_level: null,
        crowd_level: null,
      },
    ]);
    mockRankBeaches.mockResolvedValue([]);

    const result = await getBestTimeToSurfData("Imperial Beach", "CA");

    expect(result.data).not.toBeNull();
    expect(result.data?.topBeaches).toEqual([]);
    expect(result.data?.monthly.find((m) => m.month === 6)?.bestMonthCount).toBe(1);
  });

  it("still uppercases US state codes", async () => {
    const chain = mockBeachesQuery([]);

    await getBestTimeToSurfData("San Diego", "ca");

    expect(chain.eq).toHaveBeenCalledWith("state", "CA");
  });
});
