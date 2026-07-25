import { act, renderHook } from "@testing-library/react";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useOracleData } from "@/hooks/use-oracle-data";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";

type HomeDiscoveryWindow = Window & {
  __quiverHomeDiscoveryRequestCount?: number;
};

jest.mock("@/hooks/use-cached-profile", () => ({
  useCachedProfile: jest.fn(),
}));

jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: jest.fn(),
}));

jest.mock("@/hooks/use-surf-discovery", () => ({
  useSurfDiscovery: jest.fn(),
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({ data: null, loading: false }),
}));

describe("useOracleData home performance gates", () => {
  const markMock = jest.fn();
  const originalPerformanceMark = performance.mark;

  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as HomeDiscoveryWindow).__quiverHomeDiscoveryRequestCount;
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: markMock,
    });

    (useCachedProfile as jest.Mock).mockReturnValue({
      profile: { id: "profile-1", experience_level: "intermediate" },
      homeBeach: {
        id: "beach-1",
        name: "Ocean Beach",
        lat: 32.75,
        lon: -117.25,
      },
      refreshProfile: jest.fn(),
      profileLoading: false,
    });
    (useGeolocation as jest.Mock).mockReturnValue({
      coords: { lat: 32.75, lon: -117.25 },
      loading: false,
      source: "default",
      usingDefaultLocation: true,
      requestLocation: jest.fn(),
    });
    (useSurfDiscovery as jest.Mock).mockReturnValue({
      discovery: null,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: originalPerformanceMark,
    });
  });

  it("uses cached/default coordinates on mount and counts primary/fallback requests", () => {
    renderHook(() => useOracleData());

    expect(useGeolocation).toHaveBeenCalledWith(
      expect.objectContaining({
        autoRequest: false,
        enablePolling: true,
        monitoringContext: "home",
      })
    );

    const primaryOptions = (useSurfDiscovery as jest.Mock).mock.calls[0][0];
    const fallbackOptions = (useSurfDiscovery as jest.Mock).mock.calls[1][0];

    act(() => {
      primaryOptions.onRequest();
      fallbackOptions.onRequest();
    });

    expect(
      (window as HomeDiscoveryWindow).__quiverHomeDiscoveryRequestCount
    ).toBe(2);
    expect(markMock).toHaveBeenNthCalledWith(
      1,
      "quiver:home:discovery-request:1:primary"
    );
    expect(markMock).toHaveBeenNthCalledWith(
      2,
      "quiver:home:discovery-request:2:fallback"
    );
  });
});
