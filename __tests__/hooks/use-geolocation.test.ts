import { renderHook, act, waitFor } from "@testing-library/react";
import { useGeolocation } from "@/hooks/use-geolocation";

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// Mock gtag
const mockGtag = jest.fn();

describe("useGeolocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup navigator.geolocation mock
    Object.defineProperty(global.navigator, "geolocation", {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    // Setup window.gtag mock
    Object.defineProperty(global.window, "gtag", {
      value: mockGtag,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("should initialize with default Ocean Beach location", () => {
    const { result } = renderHook(() => useGeolocation());

    expect(result.current.userLocation).toEqual({
      lat: 32.7503,
      lng: -117.2534,
    });
    expect(result.current.usingDefaultLocation).toBe(true);
    expect(result.current.hasTimedOut).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  it("should use custom default location if provided", () => {
    const customLocation = { lat: 40.7128, lng: -74.006 };
    const { result } = renderHook(() =>
      useGeolocation({ defaultLocation: customLocation })
    );

    expect(result.current.userLocation).toEqual(customLocation);
    expect(result.current.usingDefaultLocation).toBe(true);
  });

  it("should successfully get user location", async () => {
    const mockPosition = {
      coords: {
        lat: 33.7701,
        lon: -118.1937,
      },
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.userLocation).toEqual({
        lat: 33.7701,
        lng: -118.1937,
      });
      expect(result.current.usingDefaultLocation).toBe(false);
      expect(result.current.hasTimedOut).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.locationError).toBeNull();
    });
  });

  it("should set hasTimedOut to true after safety timeout", async () => {
    // Don't call success or error callback - simulate hanging request
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // Do nothing - simulate hanging
    });

    const { result } = renderHook(() => useGeolocation());

    // Fast-forward time by 10 seconds (safety timeout)
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(result.current.hasTimedOut).toBe(true);
      expect(result.current.usingDefaultLocation).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.locationError).toContain("timed out");
    });

    // Verify gtag was called for monitoring
    expect(mockGtag).toHaveBeenCalledWith("event", "geolocation_timeout", {
      event_category: "geolocation",
      event_label: "safety_timeout",
      value: 10000,
    });
  });

  it("should handle permission denied error", async () => {
    const mockError = {
      code: 1, // PERMISSION_DENIED
      message: "User denied geolocation",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
      error(mockError);
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.locationError).toContain("denied");
      expect(result.current.loading).toBe(false);
      expect(result.current.hasTimedOut).toBe(false);
    });
  });

  it("should allow retry with forceRetry parameter", async () => {
    // First attempt times out
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // Do nothing - simulate hanging
    });

    const { result } = renderHook(() => useGeolocation());

    // Fast-forward to timeout
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(result.current.hasTimedOut).toBe(true);
    });

    // Now mock successful response for retry
    const mockPosition = {
      coords: {
        lat: 33.7701,
        lon: -118.1937,
      },
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });

    // Call getUserLocation with forceRetry
    await act(async () => {
      await result.current.getUserLocation(true);
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.userLocation).toEqual({
        lat: 33.7701,
        lng: -118.1937,
      });
      expect(result.current.hasTimedOut).toBe(false);
      expect(result.current.usingDefaultLocation).toBe(false);
    });
  });

  it("should prevent multiple simultaneous requests without forceRetry", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // Do nothing
    });

    const { result } = renderHook(() => useGeolocation());

    // First call starts
    await act(async () => {
      jest.runAllTimers();
    });

    // Try to call again without forceRetry
    await act(async () => {
      await result.current.getUserLocation(false);
    });

    // Should only be called once (from initial mount)
    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("should reset attempt state with resetAttempt function", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // Simulate hanging to trigger timeout
    });

    const { result } = renderHook(() => useGeolocation());

    // Fast-forward to timeout
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(result.current.hasTimedOut).toBe(true);
    });

    // Call resetAttempt
    await act(async () => {
      result.current.resetAttempt();
    });

    expect(result.current.hasTimedOut).toBe(false);
    expect(result.current.locationError).toBeNull();
  });

  it("should use default location when explicitly called", async () => {
    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      result.current.useDefaultLocation();
    });

    expect(result.current.usingDefaultLocation).toBe(true);
    expect(result.current.hasTimedOut).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.locationError).toBeNull();
  });

  it("should cleanup timeout on unmount", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // Do nothing - simulate hanging
    });

    const { result, unmount } = renderHook(() => useGeolocation());

    // Start the timeout
    await act(async () => {
      jest.advanceTimersByTime(5000); // Half way through timeout
    });

    // Unmount before timeout completes
    unmount();

    // Advance past timeout
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    // Timeout should not have fired since component unmounted
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it("should handle position unavailable error", async () => {
    const mockError = {
      code: 2, // POSITION_UNAVAILABLE
      message: "Position unavailable",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
      error(mockError);
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.locationError).toContain("unavailable");
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle geolocation timeout error", async () => {
    const mockError = {
      code: 3, // TIMEOUT
      message: "Geolocation timeout",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
      error(mockError);
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.locationError).toContain("timed out");
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle missing geolocation API", async () => {
    // Remove geolocation from navigator
    Object.defineProperty(global.navigator, "geolocation", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.locationError).toContain("not supported");
      expect(result.current.loading).toBe(false);
    });
  });
});
