import { act, renderHook, waitFor } from "@testing-library/react";
import { useProfileContext } from "@/context/profile-context";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useOracleData } from "@/hooks/use-oracle-data";
import { IP_LOCATION_COOKIE } from "@/lib/location/types";

const mockAuth = { user: { id: "user-1" } };
jest.mock("@/context/auth-context", () => ({
  useAuth: () => mockAuth,
}));
jest.mock("@/context/profile-context", () => ({ useProfileContext: jest.fn() }));
jest.mock("@/hooks/use-geolocation", () => ({
  ...jest.requireActual("@/hooks/use-geolocation"),
  useGeolocation: jest.fn(),
}));
jest.mock("@/actions/beach-media-actions", () => ({
  getBestBeachPhotosAction: jest.fn(async () => ({ data: [] })),
}));
jest.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => true }));
jest.mock("@/lib/posthog-client", () => ({
  captureClientPostHogEventAfterConsent: jest.fn(),
}));
jest.mock("@/lib/recommendations/canonical-decision/client-projection", () => ({
  projectCanonicalDiscoverySurface: (data: unknown) => data,
}));

const mockProfile = useProfileContext as jest.Mock;
const mockGeo = useGeolocation as jest.Mock;
const fetchMock = jest.fn();

const HOME_BEACH = { id: "home-1", name: "Home Break", lat: 34.01, lon: -118.5 };
const GPS = { lat: 33.9, lon: -118.42 };
const NEAREST = { id: "near-1", name: "Nearest Point", slug: "nearest-point", lat: 41.1, lon: -71.5, distanceMiles: 212.4 };

let geoState: { coords: { lat: number; lon: number } | null; source: string; lastBeach: unknown };
const requestBrowserLocation = jest.fn();

function discoveryBody(overrides: Record<string, unknown> = {}) {
  return {
    recommendations: [],
    searchCriteria: { maxResults: 10 },
    metadata: { outcome: "no_candidates", totalBeachesConsidered: 0 },
    regionalCall: "",
    recommendationAvailability: { state: "available", holdEpoch: "no-candidates" },
    ...overrides,
  };
}

function respondWith(body: unknown, status = 200): void {
  fetchMock.mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => (status < 400 ? { data: body } : { error: "boom" }),
  });
}

function requestedLocations(): Array<{ lat: number; lon: number }> {
  return fetchMock.mock.calls.map(([url]) => {
    const params = new URL(url as string, "http://localhost").searchParams;
    return { lat: Number(params.get("lat")), lon: Number(params.get("lon")) };
  });
}

function setIPCookie(value: Record<string, unknown> | null): void {
  document.cookie = value === null
    ? `${IP_LOCATION_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    : `${IP_LOCATION_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; path=/`;
}

/** A longitude whose solar offset agrees with the test runner's timezone right now. */
function longitudeMatchingLocalTimezone(): number {
  return (-new Date().getTimezoneOffset() / 60) * 15 || 0;
}

describe("useOracleData origin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    setIPCookie(null);
    global.fetch = fetchMock;
    respondWith(discoveryBody());
    geoState = { coords: null, source: "default", lastBeach: null };
    mockGeo.mockImplementation(() => ({
      coords: geoState.coords,
      loading: false,
      source: geoState.source,
      usingDefaultLocation: geoState.source !== "browser",
      lastBeach: geoState.lastBeach,
      requestLocation: requestBrowserLocation,
    }));
    mockProfile.mockReturnValue({
      profile: { id: "user-1", experience_level: "intermediate" },
      homeBeach: null,
      refreshProfile: jest.fn(),
      isLoading: false,
    });
  });

  it("asks for a place and requests nothing when there is no location evidence", async () => {
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(result.current.locationUnresolved).toBe(true));
    await act(async () => {});

    expect(result.current.origin).toBeNull();
    expect(result.current.userLocation).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not report unresolved while the profile is still loading", async () => {
    mockProfile.mockReturnValue({ profile: null, homeBeach: null, refreshProfile: jest.fn(), isLoading: true });
    const { result } = renderHook(() => useOracleData());
    await act(async () => {});

    expect(result.current.locationUnresolved).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scouts from the home beach when there is no browser fix", async () => {
    mockProfile.mockReturnValue({
      profile: { id: "user-1" },
      homeBeach: HOME_BEACH,
      refreshProfile: jest.fn(),
      isLoading: false,
    });
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.origin).toMatchObject({ source: "homeBeach", approximate: false, label: "Home Break" });
    expect(requestedLocations()).toEqual([{ lat: HOME_BEACH.lat, lon: HOME_BEACH.lon }]);
    expect(fetchMock.mock.calls[0][0]).toContain("widenEmpty=1");
  });

  it("prefers a live browser fix over the home beach", async () => {
    mockProfile.mockReturnValue({ profile: { id: "user-1" }, homeBeach: HOME_BEACH, refreshProfile: jest.fn(), isLoading: false });
    geoState = { coords: GPS, source: "browser", lastBeach: null };
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.origin?.source).toBe("browser");
    expect(requestedLocations()).toEqual([GPS]);
  });

  it("uses a browser fix from the last 24 hours before the home beach", async () => {
    mockProfile.mockReturnValue({ profile: { id: "user-1" }, homeBeach: HOME_BEACH, refreshProfile: jest.fn(), isLoading: false });
    window.localStorage.setItem("quiver:lastGeoFix", JSON.stringify({ ...GPS, at: Date.now() - 60 * 60 * 1000 }));
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.origin?.source).toBe("recentFix");
    expect(requestedLocations()).toEqual([GPS]);
  });

  it("ignores a browser fix older than 24 hours", async () => {
    mockProfile.mockReturnValue({ profile: { id: "user-1" }, homeBeach: HOME_BEACH, refreshProfile: jest.fn(), isLoading: false });
    window.localStorage.setItem("quiver:lastGeoFix", JSON.stringify({ ...GPS, at: Date.now() - 25 * 60 * 60 * 1000 }));
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.origin?.source).toBe("homeBeach");
  });

  it("uses a timezone-corroborated IP location, labelled approximate, before the last beach", async () => {
    const lon = longitudeMatchingLocalTimezone();
    setIPCookie({ city: "Testville", region: "ZZ", country: "US", latitude: 30.5, longitude: lon });
    geoState = { coords: null, source: "lastUsedBeach", lastBeach: { lat: 10, lon: 10, name: "Old Spot" } };
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.origin).toMatchObject({ source: "ip", approximate: true, label: "Testville, ZZ" });
    expect(requestedLocations()).toEqual([{ lat: 30.5, lon }]);
  });

  it("rejects IP evidence the browser timezone contradicts and the development stand-in", async () => {
    const lon = longitudeMatchingLocalTimezone();
    setIPCookie({ city: "Faraway", region: null, country: null, latitude: 0, longitude: lon + 120 });
    const contradicted = renderHook(() => useOracleData());
    await waitFor(() => expect(contradicted.result.current.locationUnresolved).toBe(true));
    contradicted.unmount();

    setIPCookie({ city: "Devtown", region: null, country: null, latitude: 0, longitude: lon, synthetic: true });
    const synthetic = renderHook(() => useOracleData());
    await waitFor(() => expect(synthetic.result.current.locationUnresolved).toBe(true));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the last beach, labelled approximate", async () => {
    geoState = { coords: null, source: "lastUsedBeach", lastBeach: { lat: 21.3, lon: -157.9, name: "Old Spot" } };
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.origin).toMatchObject({ source: "lastBeach", approximate: true, label: "Old Spot" });
    expect(requestedLocations()).toEqual([{ lat: 21.3, lon: -157.9 }]);
  });
});

describe("useOracleData empty pool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    setIPCookie(null);
    global.fetch = fetchMock;
    geoState = { coords: GPS, source: "browser", lastBeach: null };
    mockGeo.mockImplementation(() => ({
      coords: geoState.coords,
      loading: false,
      source: geoState.source,
      usingDefaultLocation: false,
      lastBeach: null,
      requestLocation: requestBrowserLocation,
    }));
    mockProfile.mockReturnValue({
      profile: { id: "user-1" },
      homeBeach: HOME_BEACH,
      refreshProfile: jest.fn(),
      isLoading: false,
    });
  });

  it("surfaces a widened drive range without moving the origin", async () => {
    respondWith(discoveryBody({
      recommendations: [{
        beach: { id: "far-1", name: "Far Reef" },
        window: { start: "2026-10-26T14:00:00.000Z", end: "2026-10-26T16:00:00.000Z" },
      }],
      metadata: { outcome: "success", totalBeachesConsidered: 1 },
      scope: { widenedFromMiles: 15 },
    }));
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(result.current.widenedFromMiles).toBe(15));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedLocations()).toEqual([GPS]);
    expect(result.current.origin?.source).toBe("browser");
    expect(result.current.nearestBeach).toBeNull();
  });

  it("names the nearest beach, and scouts from it only when asked", async () => {
    respondWith(discoveryBody({ scope: { nearestBeach: NEAREST } }));
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(result.current.nearestBeach).toEqual(NEAREST));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.topRecommendation).toBeNull();
    expect(result.current.userLocation).toEqual(GPS);

    act(() => result.current.scoutFromBeach(NEAREST));
    expect(result.current.origin).toMatchObject({ source: "selectedBeach", label: "Nearest Point" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(requestedLocations()[1]).toEqual({ lat: NEAREST.lat, lon: NEAREST.lon });

    act(() => result.current.requestLocation());
    expect(requestBrowserLocation).toHaveBeenCalledTimes(1);
    expect(result.current.origin?.source).toBe("browser");
  });

  it("reports a failed request as an error from the same origin, with no second request", async () => {
    respondWith(null, 503);
    const { result } = renderHook(() => useOracleData());

    await waitFor(() => expect(result.current.discoveryError).not.toBeNull());
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedLocations()).toEqual([GPS]);
    expect(result.current.discovery).toBeNull();
  });
});
