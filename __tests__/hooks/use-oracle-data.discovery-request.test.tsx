import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useOracleData } from "@/hooks/use-oracle-data";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/context/profile-context", () => ({
  useProfileContext: () => ({
    profile: { id: "user-1", experience_level: "intermediate" },
    homeBeach: { id: "beach-1", name: "Ocean Beach", lat: 32.75, lon: -117.25 },
    refreshProfile: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock("@/hooks/use-geolocation", () => ({ useGeolocation: jest.fn() }));
jest.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => true }));
jest.mock("@/lib/posthog-client", () => ({
  captureClientPostHogEventAfterConsent: jest.fn(),
}));
jest.mock("@/lib/recommendations/canonical-decision/client-projection", () => ({
  projectCanonicalDiscoverySurface: (data: unknown) => data,
}));

const mockGeo = useGeolocation as jest.Mock;
const mockCapture = captureClientPostHogEventAfterConsent as jest.Mock;

function discoveryResponse(recommendations: Array<{ beach: { id: string } }>) {
  return {
    recommendations: recommendations.map((recommendation) => ({
      ...recommendation,
      window: {
        start: "2026-10-11T12:00:00.000Z",
        end: "2026-10-11T14:00:00.000Z",
      },
    })),
    searchCriteria: { maxResults: 10 },
    metadata: {},
    regionalCall: "",
  };
}

describe("Home discovery requests", () => {
  let geoLoading: boolean;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    geoLoading = false;
    mockGeo.mockImplementation((): Partial<ReturnType<typeof useGeolocation>> => ({
      coords: { lat: 32.75, lon: -117.25 },
      loading: geoLoading,
      source: "default",
      usingDefaultLocation: true,
      requestLocation: jest.fn(),
    }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: discoveryResponse([{ beach: { id: "beach-1" } }]) }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("issues one primary request per home load when geolocation settles at the same location", async () => {
    const { rerender } = renderHook(() => useOracleData(), { wrapper: StrictMode });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await act(async () => {});

    jest.useFakeTimers();

    geoLoading = true;
    rerender();
    geoLoading = false;
    rerender();
    await act(async () => { jest.advanceTimersByTime(301); });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const requests = mockCapture.mock.calls.filter(([event]) => event === "home_discovery_request");
    expect(requests).toEqual([["home_discovery_request", {
      home_load_id: expect.any(String),
      request_number: 1,
      source: "primary",
    }]]);
  });

  it("waits for initial location readiness before starting primary discovery", async () => {
    geoLoading = true;
    const { rerender } = renderHook(() => useOracleData());
    expect(global.fetch).not.toHaveBeenCalled();

    geoLoading = false;
    rerender();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it("issues a fallback request when primary discovery returns no recommendations", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: discoveryResponse([]) }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: discoveryResponse([{ beach: { id: "fallback" } }]) }),
      });

    const { result } = renderHook(() => useOracleData());
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.discovery?.recommendations[0].beach.id).toBe("fallback"));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain("lat=32.75&lon=-117.25");
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain("lat=32.715&lon=-117.161");
    const requests = mockCapture.mock.calls.filter(([event]) => event === "home_discovery_request");
    expect(requests).toEqual([
      ["home_discovery_request", {
        home_load_id: expect.any(String), request_number: 1, source: "primary",
      }],
      ["home_discovery_request", {
        home_load_id: expect.any(String), request_number: 2, source: "fallback",
      }],
    ]);
    expect(requests[1][1].home_load_id).toBe(requests[0][1].home_load_id);
  });
});
