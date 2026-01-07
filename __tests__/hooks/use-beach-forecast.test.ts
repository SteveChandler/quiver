import { renderHook, act, waitFor } from "@testing-library/react";
import { useBeachForecast } from "@/hooks/use-beach-forecast";
import { getBeaches, getBeachById } from "@/actions/beach-actions";

// Mock actions
jest.mock("@/actions/beach-actions", () => ({
  getBeaches: jest.fn(),
  getBeachById: jest.fn(),
}));

// Mock current forecast utils
jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn((forecasts) => forecasts[0]),
  formatCurrentTime: jest.fn(() => "12:00:00"),
}));

const mockGetBeaches = getBeaches as jest.MockedFunction<typeof getBeaches>;
const mockGetBeachById = getBeachById as jest.MockedFunction<typeof getBeachById>;

describe("useBeachForecast", () => {
  const mockBeaches = [
    { id: "1", name: "Beach 1" },
    { id: "2", name: "Pacific Beach" },
  ];

  const mockForecast = {
    forecast_date: "2023-10-27",
    forecast_time: "12:00",
    wave_height: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    
    mockGetBeaches.mockResolvedValue({
      success: true,
      data: mockBeaches as any,
    });

    mockGetBeachById.mockResolvedValue({
      success: true,
      data: mockBeaches[0] as any,
    });
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useBeachForecast());

    expect(result.current.beach).toBeNull();
    expect(result.current.forecast).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should load available beaches", async () => {
    const { result } = renderHook(() => useBeachForecast());

    await act(async () => {
      await result.current.loadAvailableBeaches();
    });

    expect(mockGetBeaches).toHaveBeenCalled();
    expect(result.current.availableBeaches).toHaveLength(2);
    expect(result.current.loadingBeaches).toBe(false);
  });

  it("should load forecast for a specific beach", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { forecasts: [mockForecast] },
      }),
    });

    const { result } = renderHook(() => useBeachForecast());

    await act(async () => {
      await result.current.loadForecastForBeach("1");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/forecasts/update-enhanced?beachId=1")
    );
    expect(result.current.forecast).toEqual(mockForecast);
    expect(result.current.loading).toBe(false);
  });

  it("should handle forecast loading error", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useBeachForecast());

    await act(async () => {
      await result.current.loadForecastForBeach("1");
    });

    expect(result.current.error).toBe("Failed to load forecast");
    expect(result.current.loading).toBe(false);
  });

  it("should initialize with profile home beach", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { forecasts: [mockForecast] },
      }),
    });

    const { result } = renderHook(() => useBeachForecast());

    await act(async () => {
      await result.current.initializeWithProfile({ home_beach_id: "1" } as any);
    });

    expect(mockGetBeachById).toHaveBeenCalledWith("1");
    expect(result.current.beach).toEqual(mockBeaches[0]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/forecasts/update-enhanced?beachId=1")
    );
  });

  it("should fallback to Pacific Beach if no home beach", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { forecasts: [mockForecast] },
      }),
    });

    const { result } = renderHook(() => useBeachForecast());

    await act(async () => {
      await result.current.initializeWithProfile(null);
    });

    expect(mockGetBeaches).toHaveBeenCalled();
    // Should find Pacific Beach (mockBeaches[1])
    expect(result.current.beach).toEqual(mockBeaches[1]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/forecasts/update-enhanced?beachId=2")
    );
  });
});



























