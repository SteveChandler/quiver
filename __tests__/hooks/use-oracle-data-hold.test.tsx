import { renderHook } from "@testing-library/react";

import { useOracleData } from "@/hooks/use-oracle-data";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";

const mockUseSurfDiscovery = useSurfDiscovery as jest.MockedFunction<
  typeof useSurfDiscovery
>;

jest.mock("@/hooks/use-cached-profile", () => ({
  useCachedProfile: () => ({
    profile: { id: "profile-1", experience_level: "intermediate" },
    profileLoading: false,
    homeBeach: null,
    refreshProfile: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => ({
    coords: { lat: 21.31, lon: -157.86 },
    loading: false,
    source: "browser",
    usingDefaultLocation: false,
    requestLocation: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-surf-discovery", () => ({
  useSurfDiscovery: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({ data: null, loading: false }),
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

function recommendation(id: string): SurfDiscoveryRecommendation {
  return {
    beach: {
      id,
      name: id === "fallback" ? "Fallback Beach" : "Primary Beach",
      slug: id,
      city: "Test City",
      state: "CA",
      photo_url: `https://example.com/${id}.jpg`,
    },
    window: {
      start: new Date("2026-07-20T16:00:00.000Z"),
      end: new Date("2026-07-20T18:00:00.000Z"),
      timezone: "America/Los_Angeles",
    },
    forecast: {},
    score: 80,
    reasons: ["Clean window"],
    similarity: null,
    generated_at: "2026-07-19T12:00:00.000Z",
  } as unknown as SurfDiscoveryRecommendation;
}

function response(
  recommendations: SurfDiscoveryRecommendation[],
  availability?: SurfDiscoveryResponse["recommendationAvailability"],
): SurfDiscoveryResponse {
  return {
    recommendations,
    searchCriteria: { maxResults: 10 },
    metadata: {
      totalBeachesConsidered: recommendations.length,
      successfulForecasts: recommendations.length,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: "2026-07-19T12:00:00.000Z",
    },
    regionalCall: "",
    ...(availability ? { recommendationAvailability: availability } : {}),
  };
}

function hookResult(discovery: SurfDiscoveryResponse): ReturnType<typeof useSurfDiscovery> {
  return {
    discovery,
    loading: false,
    error: null,
    refetch: jest.fn(),
    hasRecommendations: discovery.recommendations.length > 0,
    isCached: false,
    clearCacheAndRefetch: jest.fn(),
  };
}

describe("useOracleData major-event hold precedence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not start the San Diego fallback when primary discovery is explicit none", () => {
    const held = response([], {
      state: "none",
      reasonCode: "major_event_hold",
      holdEpoch: "hold-1:1",
    });
    const fallback = response([recommendation("fallback")]);

    mockUseSurfDiscovery.mockImplementation((options) =>
      options?.userLocation?.lat === 32.715
        ? hookResult(fallback)
        : hookResult(held),
    );

    const { result } = renderHook(() => useOracleData());
    const fallbackCall = mockUseSurfDiscovery.mock.calls.find(
      ([options]) => options?.userLocation?.lat === 32.715,
    );

    expect(fallbackCall?.[0]?.enabled).toBe(false);
    expect(result.current.discovery).toBe(held);
    expect(result.current.topRecommendation).toBeNull();
    expect(result.current.remainingSpots).toEqual([]);
  });

  it("treats explicit none as authoritative over stale recommendation rows", () => {
    const stalePositive = recommendation("stale-primary");
    const held = response([stalePositive], {
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "hold-unresolved",
    });

    mockUseSurfDiscovery.mockReturnValue(hookResult(held));

    const { result } = renderHook(() => useOracleData());

    expect(result.current.discovery).toBe(held);
    expect(result.current.topRecommendation).toBeNull();
    expect(result.current.remainingSpots).toEqual([]);
  });

  it.each([
    ["absent", undefined],
    [
      "available",
      { state: "available", holdEpoch: "ordinary-1" } as const,
    ],
  ])(
    "keeps the legacy San Diego fallback when availability is %s",
    (_label, availability) => {
      const primary = response([], availability);
      const fallbackPositive = recommendation("fallback");
      const fallback = response([fallbackPositive], availability);

      mockUseSurfDiscovery.mockImplementation((options) =>
        options?.userLocation?.lat === 32.715
          ? hookResult(fallback)
          : hookResult(primary),
      );

      const { result } = renderHook(() => useOracleData());
      const fallbackCall = mockUseSurfDiscovery.mock.calls.find(
        ([options]) => options?.userLocation?.lat === 32.715,
      );

      expect(fallbackCall?.[0]?.enabled).toBe(true);
      expect(result.current.discovery).toBe(fallback);
      expect(result.current.topRecommendation).toBe(fallbackPositive);
    },
  );
});
