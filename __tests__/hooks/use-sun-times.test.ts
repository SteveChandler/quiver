import { renderHook } from "@testing-library/react";
import { useSunTimes } from "@/hooks/use-sun-times";

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

import { useDataFetcher } from "@/hooks/use-data-fetcher";

const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;

const baseReturn = {
  refetch: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
};

describe("useSunTimes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns sunrise and sunset as Date objects when data is available", () => {
    mockUseDataFetcher.mockReturnValue({
      data: {
        sunrise_utc: "2026-02-23T14:30:00Z",
        sunset_utc: "2026-02-24T01:45:00Z",
      },
      loading: false,
      error: null,
      ...baseReturn,
    });

    const { result } = renderHook(() =>
      useSunTimes("beach-uuid-123", "2026-02-23")
    );

    expect(result.current.sunrise).toBeInstanceOf(Date);
    expect(result.current.sunset).toBeInstanceOf(Date);
    expect(result.current.sunrise?.toISOString()).toBe("2026-02-23T14:30:00.000Z");
    expect(result.current.sunset?.toISOString()).toBe("2026-02-24T01:45:00.000Z");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns null for sunrise and sunset when data is null", () => {
    mockUseDataFetcher.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      ...baseReturn,
    });

    const { result } = renderHook(() =>
      useSunTimes("beach-uuid-123", "2026-02-23")
    );

    expect(result.current.sunrise).toBeNull();
    expect(result.current.sunset).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns null and calls useDataFetcher with skip:true when beachId is null", () => {
    mockUseDataFetcher.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      ...baseReturn,
    });

    const { result } = renderHook(() =>
      useSunTimes(null, "2026-02-23")
    );

    expect(result.current.sunrise).toBeNull();
    expect(result.current.sunset).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    expect(mockUseDataFetcher).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ skip: true })
    );
  });

  it("returns null and calls useDataFetcher with skip:true when date is null", () => {
    mockUseDataFetcher.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      ...baseReturn,
    });

    const { result } = renderHook(() =>
      useSunTimes("beach-uuid-123", null)
    );

    expect(result.current.sunrise).toBeNull();
    expect(result.current.sunset).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    expect(mockUseDataFetcher).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ skip: true })
    );
  });

  it("returns loading state while fetching", () => {
    mockUseDataFetcher.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      ...baseReturn,
    });

    const { result } = renderHook(() =>
      useSunTimes("beach-uuid-123", "2026-02-23")
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.sunrise).toBeNull();
    expect(result.current.sunset).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns error state on fetch failure", () => {
    mockUseDataFetcher.mockReturnValue({
      data: null,
      loading: false,
      error: "HTTP 500",
      ...baseReturn,
    });

    const { result } = renderHook(() =>
      useSunTimes("beach-uuid-123", "2026-02-23")
    );

    expect(result.current.error).toBe("HTTP 500");
    expect(result.current.sunrise).toBeNull();
    expect(result.current.sunset).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
