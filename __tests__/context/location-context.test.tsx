import { render, screen, waitFor, renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "../setup/vitest-shim";
import {
  LocationProvider,
  useLocation,
  useLocationSafe,
} from "@/context/location-context";
import type { IPLocationData } from "@/lib/location/types";
import { IP_LOCATION_COOKIE } from "@/lib/location/types";
import * as ipLocationModule from "@/lib/location/ip-location";

// Mock the ip-location module
jest.mock("@/lib/location/ip-location", () => ({
  parseIPLocationCookie: jest.fn(),
  matchToMetroArea: jest.fn(),
  DEFAULT_LOCATION: {
    slug: "san-diego",
    displayName: "San Diego",
    coordinates: { lat: 32.7503, lon: -117.2534 },
  },
}));

describe("LocationContext", () => {
  let mockGeolocation: any;
  let originalDocument: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original document
    originalDocument = global.document;

    // Clear all cookies
    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
    }

    // Setup navigator.geolocation mock
    mockGeolocation = {
      getCurrentPosition: jest.fn(),
    };
    Object.defineProperty(navigator, "geolocation", {
      writable: true,
      configurable: true,
      value: mockGeolocation,
    });

    // Default mock implementations
    (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(null);
    (ipLocationModule.matchToMetroArea as jest.Mock).mockReturnValue({
      slug: "san-diego",
      displayName: "San Diego",
      coordinates: { lat: 32.7503, lon: -117.2534 },
    });
  });

  afterEach(() => {
    // Restore document if it was modified
    if (originalDocument && global.document !== originalDocument) {
      Object.defineProperty(global, "document", {
        writable: true,
        configurable: true,
        value: originalDocument,
      });
    }
  });

  describe("getCookieValue (internal utility)", () => {
    const TestComponent = ({ cookieName }: { cookieName: string }) => {
      // We can't directly test the internal getCookieValue function,
      // but we can test it indirectly through the provider's behavior
      return <div>Test</div>;
    };

    it("should parse single cookie", () => {
      document.cookie = `${IP_LOCATION_COOKIE}=${encodeURIComponent(
        JSON.stringify({ city: "San Diego" })
      )}`;

      render(
        <LocationProvider>
          <TestComponent cookieName={IP_LOCATION_COOKIE} />
        </LocationProvider>
      );

      expect(ipLocationModule.parseIPLocationCookie).toHaveBeenCalled();
    });

    it("should parse multiple cookies and find the right one", () => {
      const ipLocationData = { city: "Los Angeles", latitude: 34.05, longitude: -118.24 };
      document.cookie = `other_cookie=value`;
      document.cookie = `${IP_LOCATION_COOKIE}=${encodeURIComponent(
        JSON.stringify(ipLocationData)
      )}`;
      document.cookie = `another_cookie=value2`;

      render(
        <LocationProvider>
          <TestComponent cookieName={IP_LOCATION_COOKIE} />
        </LocationProvider>
      );

      expect(ipLocationModule.parseIPLocationCookie).toHaveBeenCalled();
    });

    it("should handle missing cookie", () => {
      document.cookie = "other_cookie=value";
      document.cookie = "another_cookie=value2";

      render(
        <LocationProvider>
          <TestComponent cookieName={IP_LOCATION_COOKIE} />
        </LocationProvider>
      );

      expect(ipLocationModule.parseIPLocationCookie).toHaveBeenCalledWith(undefined);
    });

    it("should handle empty cookie string", () => {
      // Clear all cookies by setting them to expire
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }

      render(
        <LocationProvider>
          <TestComponent cookieName={IP_LOCATION_COOKIE} />
        </LocationProvider>
      );

      expect(ipLocationModule.parseIPLocationCookie).toHaveBeenCalled();
    });

    it("should decode URL-encoded cookie values", () => {
      const complexData = { city: "San José", region: "CA & Beach" };
      document.cookie = `${IP_LOCATION_COOKIE}=${encodeURIComponent(JSON.stringify(complexData))}`;

      render(
        <LocationProvider>
          <TestComponent cookieName={IP_LOCATION_COOKIE} />
        </LocationProvider>
      );

      const callArg = (ipLocationModule.parseIPLocationCookie as jest.Mock).mock.calls[0][0];
      expect(callArg).toContain("San José");
    });
  });

  describe("useLocation hook", () => {
    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test since we expect an error
      const originalError = console.error;
      console.error = jest.fn();

      try {
        renderHook(() => useLocation());
        // If we get here without an error, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain(
          "useLocation must be used within a LocationProvider"
        );
      } finally {
        console.error = originalError;
      }
    });

    it("should return location context when used inside provider", () => {
      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(result.current).toBeDefined();
      expect(result.current.location).toBeDefined();
      expect(result.current.ipLocation).toBeDefined();
      expect(result.current.requestPreciseLocation).toBeDefined();
      expect(result.current.hasPreciseLocation).toBeDefined();
      expect(result.current.locationError).toBeDefined();
      expect(result.current.clearError).toBeDefined();
    });
  });

  describe("useLocationSafe hook", () => {
    it("should return null when used outside provider", () => {
      const { result } = renderHook(() => useLocationSafe());

      expect(result.current).toBeNull();
    });

    it("should return location context when used inside provider", () => {
      const { result } = renderHook(() => useLocationSafe(), {
        wrapper: LocationProvider,
      });

      expect(result.current).not.toBeNull();
      expect(result.current?.location).toBeDefined();
    });
  });

  describe("LocationProvider initialization", () => {
    it("should initialize with default location when no cookie exists", () => {
      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(result.current.location.displayName).toBe("San Diego");
      expect(result.current.location.source).toBe("default");
      expect(result.current.ipLocation).toBeNull();
      expect(result.current.hasPreciseLocation).toBe(false);
    });

    it("should initialize with IP location from cookie", () => {
      const ipLocationData: IPLocationData = {
        city: "Los Angeles",
        region: "CA",
        country: "US",
        latitude: 34.05,
        longitude: -118.24,
      };

      document.cookie = `${IP_LOCATION_COOKIE}=${encodeURIComponent(
        JSON.stringify(ipLocationData)
      )}`;

      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(ipLocationData);
      (ipLocationModule.matchToMetroArea as jest.Mock).mockReturnValue({
        slug: "los-angeles",
        displayName: "Los Angeles",
        coordinates: { lat: 34.05, lon: -118.24 },
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(result.current.ipLocation).toEqual(ipLocationData);
      expect(result.current.location.displayName).toBe("Los Angeles");
      expect(result.current.location.source).toBe("ip");
      expect(result.current.location.isLoading).toBe(false);
    });

    it("should handle invalid cookie data gracefully", () => {
      document.cookie = `${IP_LOCATION_COOKIE}=invalid-json-data`;
      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(result.current.ipLocation).toBeNull();
      expect(result.current.location.source).toBe("default");
    });
  });

  describe("Metro matching logic", () => {
    it("should match IP coordinates to metro area", () => {
      const ipLocationData: IPLocationData = {
        city: "Santa Monica",
        region: "CA",
        country: "US",
        latitude: 34.0195,
        longitude: -118.4912,
      };

      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(ipLocationData);
      (ipLocationModule.matchToMetroArea as jest.Mock).mockReturnValue({
        slug: "los-angeles",
        displayName: "Los Angeles",
        coordinates: { lat: 34.05, lon: -118.24 },
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(ipLocationModule.matchToMetroArea).toHaveBeenCalledWith(ipLocationData);
      expect(result.current.location.displayName).toBe("Los Angeles");
    });

    it("should match browser coordinates to metro area", async () => {
      (ipLocationModule.matchToMetroArea as jest.Mock).mockImplementation((data) => {
        if (data.latitude === 33.1959 && data.longitude === -117.3795) {
          return {
            slug: "san-diego",
            displayName: "San Diego",
            coordinates: { lat: 33.1959, lon: -117.3795 },
          };
        }
        return ipLocationModule.DEFAULT_LOCATION;
      });

      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: {
            latitude: 33.1959,
            longitude: -117.3795,
          },
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.hasPreciseLocation).toBe(true);
      });

      expect(ipLocationModule.matchToMetroArea).toHaveBeenCalledWith(
        expect.objectContaining({
          city: null,
          region: null,
          country: null,
          latitude: 33.1959,
          longitude: -117.3795,
        })
      );
    });

    it("should handle missing coordinates gracefully", () => {
      const ipLocationData: IPLocationData = {
        city: "Unknown City",
        region: "CA",
        country: "US",
        latitude: null,
        longitude: null,
      };

      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(ipLocationData);
      (ipLocationModule.matchToMetroArea as jest.Mock).mockReturnValue(
        ipLocationModule.DEFAULT_LOCATION
      );

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(result.current.location.displayName).toBe("San Diego");
    });
  });

  describe("requestPreciseLocation", () => {
    it("should request browser geolocation successfully", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: {
            latitude: 32.7157,
            longitude: -117.1611,
          },
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.hasPreciseLocation).toBe(true);
      });

      expect(result.current.location.coordinates).toEqual({
        lat: 32.7157,
        lon: -117.1611,
      });
      expect(result.current.location.source).toBe("browser");
      expect(result.current.locationError).toBeNull();
    });

    it("should handle PERMISSION_DENIED error", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({
          code: 1, // PERMISSION_DENIED
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.locationError).toBe(
          "Location permission denied. Using approximate location."
        );
      });

      expect(result.current.hasPreciseLocation).toBe(false);
    });

    it("should handle POSITION_UNAVAILABLE error", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({
          code: 2, // POSITION_UNAVAILABLE
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.locationError).toBe(
          "Location unavailable. Using approximate location."
        );
      });
    });

    it("should handle TIMEOUT error", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({
          code: 3, // TIMEOUT
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.locationError).toBe(
          "Location request timed out. Using approximate location."
        );
      });
    });

    it("should handle unknown geolocation errors", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({
          code: 999, // Unknown error code
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.locationError).toBe(
          "Unable to get your location. Using approximate location."
        );
      });
    });

    it("should handle missing geolocation API", async () => {
      Object.defineProperty(global.navigator, "geolocation", {
        writable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.locationError).toBe(
          "Geolocation is not supported by your browser"
        );
      });

      expect(result.current.hasPreciseLocation).toBe(false);
    });

    it("should use high accuracy and no caching options", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: {
            latitude: 32.7157,
            longitude: -117.1611,
          },
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  });

  describe("clearError", () => {
    it("should clear location error", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.locationError).not.toBeNull();
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.locationError).toBeNull();
    });
  });

  describe("Location priority system", () => {
    it("should prioritize browser location over IP location", async () => {
      const ipLocationData: IPLocationData = {
        city: "Los Angeles",
        region: "CA",
        country: "US",
        latitude: 34.05,
        longitude: -118.24,
      };

      document.cookie = `${IP_LOCATION_COOKIE}=${encodeURIComponent(
        JSON.stringify(ipLocationData)
      )}`;

      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(ipLocationData);
      (ipLocationModule.matchToMetroArea as jest.Mock)
        .mockReturnValueOnce({
          slug: "los-angeles",
          displayName: "Los Angeles",
          coordinates: { lat: 34.05, lon: -118.24 },
        })
        .mockReturnValueOnce({
          slug: "san-diego",
          displayName: "San Diego",
          coordinates: { lat: 32.7157, lon: -117.1611 },
        });

      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: {
            latitude: 32.7157,
            longitude: -117.1611,
          },
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      // Initially should use IP location
      expect(result.current.location.displayName).toBe("Los Angeles");
      expect(result.current.location.source).toBe("ip");

      // After requesting precise location, should use browser location
      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.location.source).toBe("browser");
      });

      expect(result.current.location.displayName).toBe("San Diego");
    });

    it("should use default location when no data available", () => {
      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(result.current.location.source).toBe("default");
      expect(result.current.location.displayName).toBe("San Diego");
      expect(result.current.location.coordinates).toEqual({
        lat: 32.7503,
        lon: -117.2534,
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle coordinates with edge values (0, 0)", () => {
      const ipLocationData: IPLocationData = {
        city: "Null Island",
        region: null,
        country: null,
        latitude: 0,
        longitude: 0,
      };

      (ipLocationModule.parseIPLocationCookie as jest.Mock).mockReturnValue(ipLocationData);

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      expect(result.current.ipLocation).toEqual(ipLocationData);
    });

    it("should handle very large coordinate values", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: {
            latitude: 89.9999,
            longitude: 179.9999,
          },
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.location.coordinates).toEqual({
          lat: 89.9999,
          lon: 179.9999,
        });
      });
    });

    it("should handle negative coordinate values", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: {
            latitude: -33.8688,
            longitude: -151.2093,
          },
        });
      });

      const { result } = renderHook(() => useLocation(), {
        wrapper: LocationProvider,
      });

      await act(async () => {
        await result.current.requestPreciseLocation();
      });

      await waitFor(() => {
        expect(result.current.location.coordinates).toEqual({
          lat: -33.8688,
          lon: -151.2093,
        });
      });
    });

    it.skip("should handle SSR environment (no document)", () => {
      // This test is challenging in JSDOM environment
      // The getCookieValue function checks `typeof document === "undefined"`
      // In real SSR environments (Next.js server components), this works correctly
      // Skipping in JSDOM since it always provides a document object
    });
  });

  describe("Component integration", () => {
    it("should provide location to child components", () => {
      const TestChild = () => {
        const { location } = useLocation();
        return <div data-testid="location-name">{location.displayName}</div>;
      };

      render(
        <LocationProvider>
          <TestChild />
        </LocationProvider>
      );

      expect(screen.getByTestId("location-name")).toHaveTextContent("San Diego");
    });

    it("should update child components when location changes", async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: {
            latitude: 34.05,
            longitude: -118.24,
          },
        });
      });

      (ipLocationModule.matchToMetroArea as jest.Mock).mockReturnValue({
        slug: "los-angeles",
        displayName: "Los Angeles",
        coordinates: { lat: 34.05, lon: -118.24 },
      });

      const TestChild = () => {
        const { location, requestPreciseLocation } = useLocation();
        return (
          <div>
            <div data-testid="location-name">{location.displayName}</div>
            <button onClick={requestPreciseLocation}>Get Location</button>
          </div>
        );
      };

      render(
        <LocationProvider>
          <TestChild />
        </LocationProvider>
      );

      const button = screen.getByText("Get Location");

      await act(async () => {
        button.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("location-name")).toHaveTextContent("Los Angeles");
      });
    });
  });
});
