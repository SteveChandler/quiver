import type { Beach } from "@/types/database";

const mockOrder = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockIs = jest.fn(() => ({ order: mockOrder }));
const mockOr = jest.fn(() => ({ is: mockIs }));
const mockSelect = jest.fn(() => ({ or: mockOr, eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => ({ from: mockFrom })),
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { getBeachByIdFromDb, getBeachesFromDb } from "@/lib/services/beach-query-service";

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
    mockSingle.mockReset();
    mockEq.mockClear();
    mockIs.mockClear();
    mockOr.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getBeachByIdFromDb", () => {
    it.each(["null", "moonlight-beach", "", "not-a-uuid"])(
      "rejects %p without querying the database or logging an error",
      async (id) => {
        const logError = jest.spyOn(console, "error");
        await expect(getBeachByIdFromDb(id)).resolves.toEqual({
          success: false,
          error: "Invalid beach ID",
        });
        expect(mockFrom).not.toHaveBeenCalled();
        expect(logError).not.toHaveBeenCalled();
      },
    );

    it("preserves UUID lookup and returns the matching beach", async () => {
      const id = "12345678-1234-4567-89ab-123456789abc";
      const expectedBeach = beach({ id });
      mockSingle.mockResolvedValue({ data: expectedBeach, error: null });

      await expect(getBeachByIdFromDb(id)).resolves.toEqual({
        success: true,
        data: expectedBeach,
      });
      expect(mockFrom).toHaveBeenCalledWith("beaches");
      expect(mockEq).toHaveBeenCalledWith("id", id);
      expect(mockSingle).toHaveBeenCalledTimes(1);
    });
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
      const selectedFields = (mockSelect.mock.calls[0] as unknown as [string])[0];
      expect(selectedFields).toContain("city");
      expect(selectedFields).toContain("state");
      expect(selectedFields).not.toMatch(/\b(?:location|updated_at)\b/);
    });

    it("does not retry schema errors with removed legacy columns", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockOrder.mockResolvedValue({
        data: null,
        error: { code: "42703", message: "column beaches.unknown does not exist" },
      });

      await expect(getBeachesFromDb()).resolves.toEqual({
        success: false,
        error: "column beaches.unknown does not exist",
      });

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockSelect).not.toHaveBeenCalledWith(expect.stringContaining("location"));
    });
  });
});
