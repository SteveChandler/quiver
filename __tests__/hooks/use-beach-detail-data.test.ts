import { renderHook, act } from "@testing-library/react";
import { useBeachDetailData } from "@/hooks/use-beach-detail-data";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { createMockBeach } from "../setup/typed-mocks";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import { forecastCache } from "@/lib/utils/request-cache";

let mockAuthUser: { id: string } | null = null;

jest.mock("@/context/auth-context", () => ({
  useOptionalAuth: () => ({ user: mockAuthUser }),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/lib/monitoring/fallback-tracker", () => ({
  trackFallback: jest.fn(),
}));

const mockUseDataFetcher = useDataFetcher as jest.Mock;

const mockBeach = createMockBeach({ id: "beach-1", name: "Blacks Beach" });

const mockForecasts: EnhancedForecastEntity[] = [
  {
    id: "forecast-1",
    beach_id: "beach-1",
    forecast_at: "2026-02-23T08:00:00Z",
    forecast_date: "2026-02-23",
    forecast_time: "08:00:00",
    wave_height: "4-6ft",
  } as EnhancedForecastEntity,
];

const mockSources: BeachSources = {
  camera_url: "https://example.com/cam",
  embed_allowed: true,
};

function makeSuccessMocks({
  beach = mockBeach,
  forecasts = mockForecasts,
  sources = mockSources,
  beachLoading = false,
  forecastLoading = false,
  sourcesLoading = false,
  beachError = null,
  forecastError = null,
  sourcesError = null,
  forecastRefetch = jest.fn(),
} = {}) {
  mockUseDataFetcher
    .mockReturnValueOnce({
      data: { data: { beach } },
      loading: beachLoading,
      error: beachError,
      refetch: jest.fn(),
      retry: jest.fn(),
      reset: jest.fn(),
    })
    .mockReturnValueOnce({
      data: { data: { forecasts } },
      loading: forecastLoading,
      error: forecastError,
      refetch: forecastRefetch,
      retry: jest.fn(),
      reset: jest.fn(),
    })
    .mockReturnValueOnce({
      data: { data: { sources } },
      loading: sourcesLoading,
      error: sourcesError,
      refetch: jest.fn(),
      retry: jest.fn(),
      reset: jest.fn(),
    });
}

describe("useBeachDetailData", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    forecastCache.clear();
    mockAuthUser = null;
  });

  it("returns beach data from API when no initialBeach", () => {
    makeSuccessMocks();

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    expect(result.current.beach).toEqual(mockBeach);
    expect(result.current.loading).toBe(false);
    expect(result.current.errors.beach).toBeNull();
  });

  it("returns initialBeach when provided (skips fetch)", () => {
    const initialBeach = createMockBeach({ id: "beach-1", name: "Initial Beach" });

    makeSuccessMocks({ beach: initialBeach });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1", initialBeach })
    );

    // When initialBeach is provided, loading must be false
    expect(result.current.beach).toEqual(initialBeach);
    expect(result.current.loading).toBe(false);

    // The beach useDataFetcher call must have been invoked with skip: true
    const firstCallOptions = mockUseDataFetcher.mock.calls[0][1];
    expect(firstCallOptions.skip).toBe(true);
  });

  it("fetches forecasts and returns as EnhancedForecastEntity[]", () => {
    makeSuccessMocks();

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    expect(result.current.forecasts).toEqual(mockForecasts);
    expect(result.current.forecasts).toHaveLength(1);
  });

  it("fetches account-aware forecasts without browser caching", async () => {
    makeSuccessMocks();
    renderHook(() => useBeachDetailData({ beachId: "beach-1" }));
    const fetchForecasts = mockUseDataFetcher.mock.calls[1][0];
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { forecasts: [] } }),
      headers: new Headers(),
    } as Response);

    await fetchForecasts();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/forecasts/update-enhanced"),
      { cache: "no-store" },
    );
    fetchSpy.mockRestore();
  });

  it("keys the forecast cache by auth identity and clears it on account switch", () => {
    mockAuthUser = { id: "account-a" };
    makeSuccessMocks();
    const clearSpy = jest.spyOn(forecastCache, "clear");
    const { rerender } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" }),
    );

    expect(mockUseDataFetcher.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        cache: forecastCache,
        cacheKey: "beach-detail-forecasts:account-a:beach-1:10",
      }),
    );

    makeSuccessMocks();
    mockAuthUser = { id: "account-b" };
    rerender();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(mockUseDataFetcher.mock.calls[4][1].cacheKey).toBe(
      "beach-detail-forecasts:account-b:beach-1:10",
    );
  });

  it("fetches sources and returns BeachSources", () => {
    makeSuccessMocks();

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    expect(result.current.sources).toEqual(mockSources);
    expect(result.current.sources?.camera_url).toBe("https://example.com/cam");
    expect(result.current.sources?.embed_allowed).toBe(true);
  });

  it("loading=true only when beach is loading (progressive loading)", () => {
    // When no initialBeach and beach is still loading
    mockUseDataFetcher
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    // loading should reflect beach loading since no initialBeach
    expect(result.current.loading).toBe(true);
  });

  it("loading=false when initialBeach is provided even if fetcher says loading", () => {
    const initialBeach = createMockBeach({ id: "beach-1" });

    mockUseDataFetcher
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1", initialBeach })
    );

    // When initialBeach is set, loading is never driven by beach fetcher
    expect(result.current.loading).toBe(false);
  });

  it("returns error objects for each data type independently", () => {
    mockUseDataFetcher
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: "HTTP 404",
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: "HTTP 500",
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: "HTTP 503",
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    expect(result.current.errors.beach).toBe("HTTP 404");
    expect(result.current.errors.forecasts).toBe("HTTP 500");
    expect(result.current.errors.sources).toBe("HTTP 503");
  });

  it("refetch triggers forecast revalidation", () => {
    const mockForecastRefetch = jest.fn();
    makeSuccessMocks({ forecastRefetch: mockForecastRefetch });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    act(() => {
      result.current.refetch();
    });

    expect(mockForecastRefetch).toHaveBeenCalledTimes(1);
  });

  it("refreshForecast triggers revalidation", async () => {
    const mockForecastRefetch = jest.fn().mockResolvedValue(undefined);
    makeSuccessMocks({ forecastRefetch: mockForecastRefetch });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    await act(async () => {
      await result.current.refreshForecast();
    });

    expect(mockForecastRefetch).toHaveBeenCalledTimes(1);
  });

  it("returns empty forecasts on forecast error", () => {
    // Set up mocks for forecast error case
    jest.resetAllMocks();
    mockUseDataFetcher
      .mockReturnValueOnce({
        data: { data: { beach: mockBeach } },
        loading: false,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: "HTTP 502",
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: { data: { sources: mockSources } },
        loading: false,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    expect(result.current.forecasts).toEqual([]);
    expect(result.current.errors.forecasts).toBe("HTTP 502");
  });

  it("returns null sources on sources error", () => {
    jest.resetAllMocks();
    mockUseDataFetcher
      .mockReturnValueOnce({
        data: { data: { beach: mockBeach } },
        loading: false,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: { data: { forecasts: mockForecasts } },
        loading: false,
        error: null,
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: "HTTP 404",
        refetch: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      });

    const { result } = renderHook(() =>
      useBeachDetailData({ beachId: "beach-1" })
    );

    expect(result.current.sources).toBeNull();
    expect(result.current.errors.sources).toBe("HTTP 404");
  });
});
