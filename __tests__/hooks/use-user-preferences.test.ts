// __tests__/hooks/use-user-preferences.test.ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { useUserPreferences } from "@/hooks/use-user-preferences";

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

import { useAuth } from "@/context/auth-context";

describe("useUserPreferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when user is not authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useUserPreferences());

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetches preferences when user is authenticated", async () => {
    const mockPrefs = {
      wave_min_ft: 3,
      wave_max_ft: 5,
      confidence: 0.75,
      sample_size: 12,
    };

    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPrefs }),
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(
      () => {
        expect(result.current.data).toEqual(mockPrefs);
      },
      { timeout: 5000 },
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockPrefs);
    expect(global.fetch).toHaveBeenCalledWith("/api/user/preferences");
  });

  it("returns null on fetch error", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(
      () => {
        expect(result.current.error?.message).toContain("500");
      },
      { timeout: 5000 },
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("sets error on network failure", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network timeout")
    );

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(
      () => {
        expect(result.current.error?.message).toBe("Network timeout");
      },
      { timeout: 5000 },
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe("Network timeout");
    expect(result.current.data).toBeNull();
  });

  it("sets error on HTTP error response", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(
      () => {
        expect(result.current.error?.message).toContain("500");
      },
      { timeout: 5000 },
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toContain("500");
    expect(result.current.data).toBeNull();
  });

  it("refetch functionality works correctly", async () => {
    const mockPrefs1 = {
      wave_min_ft: 3,
      wave_max_ft: 5,
      confidence: 0.75,
      sample_size: 12,
    };

    const mockPrefs2 = {
      wave_min_ft: 4,
      wave_max_ft: 6,
      confidence: 0.8,
      sample_size: 15,
    };

    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockPrefs1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockPrefs2 }),
      });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(
      () => {
        expect(result.current.data).toEqual(mockPrefs1);
      },
      { timeout: 5000 },
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockPrefs1);

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(
      () => {
        expect(result.current.data).toEqual(mockPrefs2);
      },
      { timeout: 5000 },
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
