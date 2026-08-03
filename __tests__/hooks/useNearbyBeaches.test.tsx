jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

import { renderHook } from "@testing-library/react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { createClient } from "@/lib/supabase/client";
import { fetchNearestBeaches, useNearbyBeaches } from "@/hooks/useNearbyBeaches";

const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const SUCCESS_RESULT = {
  data: [
    {
      id: "1",
      name: "Test Beach",
      lat: 32.72,
      lon: -117.25,
      meters: 500,
      rating: 4.0,
      reviewCount: 10,
      imageUrl: "/images/test.jpg",
      slug: "test-beach",
      city: "San Diego",
      state: "CA",
    },
  ],
  loading: false,
  error: null,
  refetch: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
};

const LOADING_RESULT = {
  data: null,
  loading: true,
  error: null,
  refetch: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
};

const ERROR_RESULT = {
  data: null,
  loading: false,
  error: "nearest_beaches RPC failed",
  refetch: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
};

const EMPTY_RESULT = {
  data: [] as typeof SUCCESS_RESULT.data,
  loading: false,
  error: null,
  refetch: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
};

const SKIPPED_RESULT = {
  data: null,
  loading: false,
  error: null,
  refetch: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
};

describe("useNearbyBeaches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDataFetcher.mockReturnValue(SUCCESS_RESULT as any);
  });

  it("returns nearby beaches when lat/lon provided", () => {
    const { result } = renderHook(() => useNearbyBeaches(32.72, -117.25));

    expect(result.current.data).toEqual(SUCCESS_RESULT.data);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    expect(mockUseDataFetcher).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ skip: false })
    );
  });

  it("skips fetch when lat is undefined", () => {
    mockUseDataFetcher.mockReturnValue(SKIPPED_RESULT as any);

    const { result } = renderHook(() => useNearbyBeaches(undefined, -117.25));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);

    expect(mockUseDataFetcher).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ skip: true })
    );
  });

  it("skips fetch when lon is undefined", () => {
    mockUseDataFetcher.mockReturnValue(SKIPPED_RESULT as any);

    const { result } = renderHook(() => useNearbyBeaches(32.72, undefined));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);

    expect(mockUseDataFetcher).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ skip: true })
    );
  });

  it("returns loading state while fetching", () => {
    mockUseDataFetcher.mockReturnValue(LOADING_RESULT as any);

    const { result } = renderHook(() => useNearbyBeaches(32.72, -117.25));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns error state on RPC failure", () => {
    mockUseDataFetcher.mockReturnValue(ERROR_RESULT as any);

    const { result } = renderHook(() => useNearbyBeaches(32.72, -117.25));

    expect(result.current.error).toBe("nearest_beaches RPC failed");
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("returns empty array when no beaches nearby", () => {
    mockUseDataFetcher.mockReturnValue(EMPTY_RESULT as any);

    const { result } = renderHook(() => useNearbyBeaches(32.72, -117.25));

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe("fetchNearestBeaches country hydration", () => {
    it("returns the hydrated Mexico country", async () => {
      const countryLookup = jest.fn().mockResolvedValue({
        data: [{ id: "mexico-beach", country: "Mexico" }],
        error: null,
      });
      mockCreateClient.mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: [{
            id: "mexico-beach",
            name: "K-40",
            lat: 32.2,
            lon: -117.1,
            meters: 100,
            slug: "k-40-puerto-nuevo",
            city: "Puerto Nuevo",
            state: "Baja California",
          }],
          error: null,
        }),
        from: jest.fn(() => ({
          select: jest.fn(() => ({ in: countryLookup })),
        })),
      } as any);

      const result = await fetchNearestBeaches(32.2, -117.1);

      expect(result[0].country).toBe("Mexico");
      expect(countryLookup).toHaveBeenCalledWith("id", ["mexico-beach"]);
    });

    it("throws when country hydration fails", async () => {
      mockCreateClient.mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: [{
            id: "mexico-beach",
            name: "K-40",
            lat: 32.2,
            lon: -117.1,
            meters: 100,
          }],
          error: null,
        }),
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({
              data: null,
              error: new Error("country lookup failed"),
            }),
          })),
        })),
      } as any);

      await expect(fetchNearestBeaches(32.2, -117.1)).rejects.toThrow(
        "country lookup failed",
      );
    });

    it("throws when country hydration is incomplete", async () => {
      mockCreateClient.mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: [{ id: "mexico-beach", name: "K-40", lat: 32.2, lon: -117.1, meters: 100 }],
          error: null,
        }),
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      } as any);

      await expect(fetchNearestBeaches(32.2, -117.1)).rejects.toThrow(
        "country hydration was incomplete",
      );
    });

    it.each([null, "", "   "])(
      "throws when hydration returns an unusable country (%j)",
      async (country) => {
        mockCreateClient.mockReturnValue({
          rpc: jest.fn().mockResolvedValue({
            data: [{ id: "mexico-beach", name: "K-40", lat: 32.2, lon: -117.1, meters: 100 }],
            error: null,
          }),
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [{ id: "mexico-beach", country }],
                error: null,
              }),
            })),
          })),
        } as any);

        await expect(fetchNearestBeaches(32.2, -117.1)).rejects.toThrow(
          "country hydration was incomplete",
        );
      },
    );

    it("prefers a valid hydrated country over an unusable RPC country", async () => {
      const countryLookup = jest.fn().mockResolvedValue({
        data: [{ id: "mexico-beach", country: "Mexico" }],
        error: null,
      });
      mockCreateClient.mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: [{
            id: "mexico-beach",
            name: "K-40",
            lat: 32.2,
            lon: -117.1,
            meters: 100,
            country: " ",
          }],
          error: null,
        }),
        from: jest.fn(() => ({
          select: jest.fn(() => ({ in: countryLookup })),
        })),
      } as any);

      const result = await fetchNearestBeaches(32.2, -117.1);

      expect(result[0].country).toBe("Mexico");
    });
  });
});
