/** @jest-environment node */

import { GET } from "@/app/api/beaches/favorites/route";
import { loadFavoriteBeaches } from "@/components/map/map-favorites-loader";
import type { SavedSpotTarget } from "@/types/saved-spot";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: unknown) => handler,
  createSuccessResponse: (data: unknown) => data,
}));

describe("GET /api/beaches/favorites", () => {
  it("keeps the curated beaches contract and returns ranked, owned, active saved targets", async () => {
    const beach = { id: "beach-1", name: "Curated Beach" };
    const customSpot = {
      id: "spot-1", user_id: "user-1", name: "My Reef", lat: 33, lon: -118,
      break_type: "reef", nearest_beach_id: "beach-1", deleted_at: null,
    };
    const rows = [
      { rank: 1, beach_id: null, custom_spot_id: "spot-1", beaches: null, custom_spots: customSpot },
      { rank: 2, beach_id: "beach-1", custom_spot_id: null, beaches: beach, custom_spots: null },
      { rank: 3, beach_id: null, custom_spot_id: "spot-2", beaches: null, custom_spots: { ...customSpot, id: "spot-2", deleted_at: "2026-10-01" } },
      { rank: 4, beach_id: null, custom_spot_id: "spot-3", beaches: null, custom_spots: { ...customSpot, id: "spot-3", user_id: "other-user" } },
    ];
    const orderCreated = jest.fn(async () => ({ data: rows, error: null }));
    const orderRank = jest.fn(() => ({ order: orderCreated }));
    const eq = jest.fn(() => ({ order: orderRank }));
    const select = jest.fn(() => ({ eq }));
    const supabase = { from: jest.fn(() => ({ select })) };

    const result = await (GET as Function)(undefined, { user: { id: "user-1" }, supabase }) as {
      beaches: typeof beach[];
      targets: SavedSpotTarget[];
    };

    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(orderRank).toHaveBeenCalledWith("rank", { ascending: true, nullsFirst: false });
    expect(orderCreated).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result.beaches).toEqual([beach]);
    expect(result.targets.map((target) => target.kind)).toEqual(["custom_spot", "beach"]);
    expect(result.targets.map((target) => target.rank)).toEqual([1, 2]);
    const [savedCustom, savedBeach] = result.targets;
    if (savedCustom.kind !== "custom_spot" || savedBeach.kind !== "beach") {
      throw new Error("Unexpected target kinds");
    }
    expect(savedCustom.customSpot).toEqual({
      id: "spot-1", name: "My Reef", lat: 33, lon: -118,
      break_type: "reef", nearest_beach_id: "beach-1",
    });
    expect(savedCustom.nearestBeachId).toBe("beach-1");
    expect(savedBeach.beach).toEqual(beach);
  });
});

it("keeps map favorites limited to curated beach IDs when saved targets include a custom spot", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: {
      beaches: [{ id: "beach-1" }],
      targets: [
        { kind: "custom_spot", customSpot: { id: "spot-1" } },
        { kind: "beach", beach: { id: "beach-1" } },
      ],
    } }),
  })) as unknown as typeof fetch;
  try {
    expect(await loadFavoriteBeaches("user-1")).toEqual(new Set(["beach-1"]));
  } finally {
    global.fetch = originalFetch;
  }
});
