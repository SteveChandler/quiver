import { renderHook, act, waitFor } from "@testing-library/react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { captureClientPostHogEvent } from "@/lib/posthog-client";

jest.mock("@/lib/posthog-client", () => ({
  captureClientPostHogEvent: jest.fn(),
}));

const capturePostHogEventMock = jest.mocked(captureClientPostHogEvent);

// Mock timers for safety timeout tests
beforeEach(() => {
  jest.useFakeTimers();
  capturePostHogEventMock.mockClear();
  // Reset geolocation mock
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: jest.fn(),
      watchPosition: jest.fn(),
      clearWatch: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
  // Clear localStorage
  window.localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const LA_JOLLA = { lat: 32.8473, lon: -117.275 };

function mockGeoSuccess(coords = LA_JOLLA) {
  (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
    (success: PositionCallback) => {
      success({
        coords: {
          latitude: coords.lat,
          longitude: coords.lon,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    }
  );
}

function mockGeoError(code: number) {
  (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
    (_success: PositionCallback, error: PositionErrorCallback) => {
      const geoError = {
        code,
        message: "Test error",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError;
      error(geoError);
    }
  );
}

function mockGeoHang() {
  // Never calls success or error - simulates GPS hang
  (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
    () => {
      // intentionally does nothing
    }
  );
}

describe("useGeolocation", () => {
  describe("autoRequest behavior", () => {
    it("requests GPS on mount when autoRequest: true", () => {
      mockGeoSuccess();
      renderHook(() => useGeolocation({ autoRequest: true }));

      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
      const options = (navigator.geolocation.getCurrentPosition as jest.Mock)
        .mock.calls[0][2] as PositionOptions;
      expect(options.enableHighAccuracy).toBe(true);
      expect(options.maximumAge).toBe(0);
      expect(options.timeout).toBe(10000);
    });

    it("does NOT request GPS on mount when autoRequest: false", () => {
      renderHook(() => useGeolocation({ autoRequest: false }));

      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it("defaults autoRequest to true", () => {
      mockGeoSuccess();
      renderHook(() => useGeolocation());

      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });
  });

  describe("successful GPS fix", () => {
    it("returns fresh coords from GPS with source browser", () => {
      mockGeoSuccess(LA_JOLLA);
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      // After GPS resolves synchronously in mock
      expect(result.current.userLocation).toEqual(LA_JOLLA);
      expect(result.current.source).toBe("browser");
      expect(result.current.usingDefaultLocation).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.errorType).toBeNull();
    });

    it("clears any previous errors on success", () => {
      mockGeoSuccess();
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.locationError).toBeNull();
      expect(result.current.errorType).toBeNull();
      expect(result.current.hasTimedOut).toBe(false);
    });
  });

  describe("GPS errors with fallback", () => {
    it("records denied home GPS requests", () => {
      mockGeoError(1);

      renderHook(() =>
        useGeolocation({
          autoRequest: true,
          monitoringContext: "home",
        })
      );

      expect(capturePostHogEventMock).toHaveBeenCalledWith(
        "home_geolocation_request",
        {
          trigger: "auto",
          outcome: "denied",
        }
      );
    });

    it("falls back on PERMISSION_DENIED with errorType denied", () => {
      mockGeoError(1); // PERMISSION_DENIED
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.errorType).toBe("denied");
      expect(result.current.usingDefaultLocation).toBe(true);
      expect(result.current.loading).toBe(false);
      // Fallback coords are Ocean Beach (default)
      expect(result.current.userLocation).toEqual({ lat: 32.7503, lon: -117.2534 });
      expect(result.current.source).toBe("default");
    });

    it("falls back on TIMEOUT with errorType timeout", () => {
      mockGeoError(3); // TIMEOUT
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.errorType).toBe("timeout");
      expect(result.current.usingDefaultLocation).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it("falls back on POSITION_UNAVAILABLE with errorType unavailable", () => {
      mockGeoError(2); // POSITION_UNAVAILABLE
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.errorType).toBe("unavailable");
      expect(result.current.usingDefaultLocation).toBe(true);
    });

    it("uses lastBeach from localStorage as fallback when available", () => {
      const lastBeach = { lat: 33.0, lon: -117.5, name: "Test Beach" };
      window.localStorage.setItem("quiver:lastBeach", JSON.stringify(lastBeach));

      mockGeoError(1); // PERMISSION_DENIED
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.userLocation).toMatchObject({ lat: 33.0, lon: -117.5 });
      expect(result.current.source).toBe("lastUsedBeach");
    });

    it("uses provided defaultLocation when no lastBeach stored", () => {
      const customDefault = { lat: 34.0, lon: -118.5 };
      mockGeoError(1);
      const { result } = renderHook(() =>
        useGeolocation({ autoRequest: true, defaultLocation: customDefault })
      );

      expect(result.current.userLocation).toEqual(customDefault);
      expect(result.current.source).toBe("default");
    });

    it("ignores lastBeach when useLastBeach is false", () => {
      const lastBeach = { lat: 33.0, lon: -117.5, name: "Windansea" };
      window.localStorage.setItem("quiver:lastBeach", JSON.stringify(lastBeach));

      mockGeoError(1); // PERMISSION_DENIED
      const { result } = renderHook(() =>
        useGeolocation({ autoRequest: true, useLastBeach: false })
      );

      // Should fall through to Ocean Beach default, NOT Windansea
      expect(result.current.userLocation).toEqual({ lat: 32.7503, lon: -117.2534 });
      expect(result.current.source).toBe("default");
    });

    it("uses defaultLocation when useLastBeach is false even with lastBeach stored", () => {
      const lastBeach = { lat: 33.0, lon: -117.5, name: "Windansea" };
      window.localStorage.setItem("quiver:lastBeach", JSON.stringify(lastBeach));
      const customDefault = { lat: 34.0, lon: -118.5 };

      mockGeoError(1);
      const { result } = renderHook(() =>
        useGeolocation({ autoRequest: true, useLastBeach: false, defaultLocation: customDefault })
      );

      expect(result.current.userLocation).toEqual(customDefault);
      expect(result.current.source).toBe("default");
    });

    it("defaults useLastBeach to true (backward compat)", () => {
      const lastBeach = { lat: 33.0, lon: -117.5, name: "Test Beach" };
      window.localStorage.setItem("quiver:lastBeach", JSON.stringify(lastBeach));

      mockGeoError(1);
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      // Should still use lastBeach by default
      expect(result.current.userLocation).toMatchObject({ lat: 33.0, lon: -117.5 });
      expect(result.current.source).toBe("lastUsedBeach");
    });
  });

  describe("safety timeout", () => {
    it("records a timed-out home GPS request", () => {
      mockGeoHang();
      renderHook(() =>
        useGeolocation({
          autoRequest: true,
          monitoringContext: "home",
        })
      );

      act(() => {
        jest.advanceTimersByTime(12000);
      });

      expect(capturePostHogEventMock).toHaveBeenCalledWith(
        "home_geolocation_request",
        {
          trigger: "auto",
          outcome: "timeout",
        }
      );
    });

    it("fires safety timeout after 12 seconds if GPS hangs", () => {
      mockGeoHang();
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Advance past safety timeout (12s)
      act(() => {
        jest.advanceTimersByTime(12000);
      });

      expect(result.current.hasTimedOut).toBe(true);
      expect(result.current.usingDefaultLocation).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.errorType).toBe("timeout");
      expect(result.current.userLocation).toEqual({ lat: 32.7503, lon: -117.2534 });
    });

    it("does not fire safety timeout if GPS resolves before 12s", () => {
      mockGeoSuccess(LA_JOLLA);
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      // GPS resolved immediately via mock
      act(() => {
        jest.advanceTimersByTime(12000);
      });

      expect(result.current.hasTimedOut).toBe(false);
      expect(result.current.userLocation).toEqual(LA_JOLLA);
      expect(result.current.source).toBe("browser");
    });
  });

  describe("requestLocation (force retry)", () => {
    it("records an explicit home GPS success without coordinates", () => {
      mockGeoSuccess(LA_JOLLA);
      const { result } = renderHook(() =>
        useGeolocation({
          autoRequest: false,
          monitoringContext: "home",
        })
      );

      expect(capturePostHogEventMock).not.toHaveBeenCalled();

      act(() => {
        result.current.requestLocation();
      });

      expect(capturePostHogEventMock).toHaveBeenCalledTimes(1);
      expect(capturePostHogEventMock).toHaveBeenCalledWith(
        "home_geolocation_request",
        {
          trigger: "explicit",
          outcome: "success",
        }
      );

      const properties = capturePostHogEventMock.mock.calls[0][1];
      expect(properties).not.toHaveProperty("lat");
      expect(properties).not.toHaveProperty("lon");
      expect(properties).not.toHaveProperty("latitude");
      expect(properties).not.toHaveProperty("longitude");
    });

    it("forces a new GPS request when called with true", () => {
      mockGeoError(1); // First call fails
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.errorType).toBe("denied");

      // Now mock success for retry
      mockGeoSuccess(LA_JOLLA);

      act(() => {
        result.current.requestLocation();
      });

      // Should have called getCurrentPosition again
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
      expect(result.current.userLocation).toEqual(LA_JOLLA);
      expect(result.current.source).toBe("browser");
    });

    it("does not duplicate requests when already in-flight", () => {
      mockGeoHang();
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      // Try calling getUserLocation again without forceRetry
      act(() => {
        result.current.getUserLocation();
      });

      // Should still only have 1 call (blocked by hasAttemptedRef)
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });
  });

  describe("polling behavior", () => {
    it("records home polling separately from the initial GPS request", () => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      mockGeoSuccess(LA_JOLLA);

      renderHook(() =>
        useGeolocation({
          autoRequest: true,
          enablePolling: true,
          pollingIntervalMs: 60000,
          monitoringContext: "home",
        })
      );

      expect(capturePostHogEventMock).toHaveBeenLastCalledWith(
        "home_geolocation_request",
        {
          trigger: "auto",
          outcome: "success",
        }
      );

      capturePostHogEventMock.mockClear();
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(capturePostHogEventMock).toHaveBeenCalledTimes(1);
      expect(capturePostHogEventMock).toHaveBeenCalledWith(
        "home_geolocation_request",
        {
          trigger: "poll",
          outcome: "success",
        }
      );
    });

    it("does not poll when enablePolling is false", () => {
      mockGeoSuccess(LA_JOLLA);
      renderHook(() =>
        useGeolocation({ autoRequest: true, enablePolling: false })
      );

      // Advance 6 minutes
      act(() => {
        jest.advanceTimersByTime(6 * 60 * 1000);
      });

      // Only the initial call
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it("polls with high accuracy and maximumAge 30000 when enabled", () => {
      // First call succeeds to get source='browser'
      mockGeoSuccess(LA_JOLLA);
      renderHook(() =>
        useGeolocation({
          autoRequest: true,
          enablePolling: true,
          pollingIntervalMs: 60000,
        })
      );

      // Make document visible for polling
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });

      // Advance past polling interval
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      // Should have 2 calls: initial + one poll
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);

      // Check polling call options
      const pollingOptions = (
        navigator.geolocation.getCurrentPosition as jest.Mock
      ).mock.calls[1][2] as PositionOptions;
      expect(pollingOptions.enableHighAccuracy).toBe(true);
      expect(pollingOptions.maximumAge).toBe(30000);
      expect(pollingOptions.timeout).toBe(8000);
    });

    it("pauses while hidden and waits a full interval after returning visible", () => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      mockGeoSuccess(LA_JOLLA);

      renderHook(() =>
        useGeolocation({
          autoRequest: true,
          enablePolling: true,
          pollingIntervalMs: 60000,
        })
      );

      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      act(() => {
        jest.advanceTimersByTime(5 * 60000);
      });
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(59999);
      });
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    });
  });

  describe("useDefaultLocation", () => {
    it("resets to fallback coords when called", () => {
      mockGeoSuccess(LA_JOLLA);
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.source).toBe("browser");

      act(() => {
        result.current.useDefaultLocation();
      });

      expect(result.current.usingDefaultLocation).toBe(true);
      expect(result.current.userLocation).toEqual({ lat: 32.7503, lon: -117.2534 });
      expect(result.current.source).toBe("default");
    });
  });

  describe("compatibility layer", () => {
    it("exposes coords as alias for userLocation", () => {
      mockGeoSuccess(LA_JOLLA);
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.coords).toBe(result.current.userLocation);
      expect(result.current.coords).toEqual(LA_JOLLA);
    });

    it("exposes error as alias for locationError", () => {
      mockGeoError(1);
      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      expect(result.current.error).toBe(result.current.locationError);
    });
  });

  describe("geolocation unavailable", () => {
    it("records unavailable home GPS requests", () => {
      Object.defineProperty(navigator, "geolocation", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      renderHook(() =>
        useGeolocation({
          autoRequest: true,
          monitoringContext: "home",
        })
      );

      expect(capturePostHogEventMock).toHaveBeenCalledWith(
        "home_geolocation_request",
        {
          trigger: "auto",
          outcome: "unavailable",
        }
      );
    });

    it("handles missing navigator.geolocation gracefully", () => {
      Object.defineProperty(navigator, "geolocation", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useGeolocation({ autoRequest: true }));

      // Should advance past safety timeout setup
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.errorType).toBe("unavailable");
      expect(result.current.loading).toBe(false);
    });
  });

  describe("setLastBeach", () => {
    it("persists beach to localStorage", () => {
      mockGeoSuccess();
      const { result } = renderHook(() => useGeolocation());

      act(() => {
        result.current.setLastBeach({ lat: 33.0, lon: -117.5, name: "My Beach" });
      });

      const stored = JSON.parse(
        window.localStorage.getItem("quiver:lastBeach") || "{}"
      );
      expect(stored.lat).toBe(33.0);
      expect(stored.lon).toBe(-117.5);
      expect(stored.name).toBe("My Beach");
    });
  });
});
