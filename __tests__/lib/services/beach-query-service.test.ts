import type { Beach } from "@/types/database";

const mockOrder = jest.fn();
const mockIs = jest.fn(() => ({ order: mockOrder }));
const mockOr = jest.fn(() => ({ is: mockIs }));
const mockSelect = jest.fn(() => ({ or: mockOr }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => ({ from: mockFrom })),
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { getBeachesFromDb } from "@/lib/services/beach-query-service";

type BeachOverrides = Omit<Partial<Beach>, "lat" | "lon"> & {
  lat?: unknown;
  lon?: unknown;
};

function beach(overrides: BeachOverrides): Beach {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    city: "San Diego",
    state: "CA",
    country: "USA",
    lat: 32.75,
    lon: -117.25,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as unknown as Beach;
}

describe("beach-query-service", () => {
  beforeEach(() => {
    mockOrder.mockReset();
    mockIs.mockClear();
    mockOr.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  describe("getBeachesFromDb", () => {
    it("filters beaches without finite lat/lon coordinates", async () => {
      const validBeach = beach({ id: "valid" });

      mockOrder.mockResolvedValue({
        data: [
          validBeach,
          beach({ id: "missing-lat", lat: null }),
          beach({ id: "missing-lon", lon: null }),
          beach({ id: "string-lat", lat: "32.75" as unknown as number }),
          beach({ id: "nan-lon", lon: Number.NaN }),
        ],
        error: null,
      });

      await expect(getBeachesFromDb()).resolves.toEqual({
        success: true,
        data: [validBeach],
      });
      expect(mockFrom).toHaveBeenCalledWith("beaches");
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("lat, lon"));
    });
  });
});
