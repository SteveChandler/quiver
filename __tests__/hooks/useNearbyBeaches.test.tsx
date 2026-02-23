jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

import { renderHook } from "@testing-library/react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useNearbyBeaches } from "@/hooks/useNearbyBeaches";

const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;

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
});
