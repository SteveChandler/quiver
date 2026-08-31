import { renderHook, waitFor } from "@testing-library/react";
import { useEnhancedForecast } from "@/hooks/use-enhanced-forecast";
import { forecastCache } from "@/lib/utils/request-cache";

let mockAuthUser: { id: string } | null = null;

jest.mock("@/context/auth-context", () => ({
  useOptionalAuth: () => ({ user: mockAuthUser }),
}));

function forecastResponse(waveHeight: string): Response {
  return {
    ok: true,
    headers: new Headers(),
    json: async () => ({
      success: true,
      data: {
        forecasts: [{ wave_height: waveHeight }],
        forecastsByDate: {},
      },
    }),
  } as Response;
}

describe("useEnhancedForecast identity-scoped cache", () => {
  beforeEach(() => {
    forecastCache.clear();
    mockAuthUser = null;
    jest.restoreAllMocks();
  });

  it("reuses cached responses for anonymous users", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(forecastResponse("3 ft"));
    const first = renderHook(() =>
      useEnhancedForecast({ beachId: "beach-1", autoGenerate: false }),
    );
    await waitFor(() => expect(first.result.current.forecasts).toHaveLength(1));
    first.unmount();

    const second = renderHook(() =>
      useEnhancedForecast({ beachId: "beach-1", autoGenerate: false }),
    );
    await waitFor(() => expect(second.result.current.forecasts).toHaveLength(1));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it("invalidates and refetches on account switch", async () => {
    mockAuthUser = { id: "account-a" };
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(async () =>
        forecastResponse(mockAuthUser?.id === "account-a" ? "4 ft" : "5 ft"),
      );
    const { result, rerender, unmount } = renderHook(() =>
      useEnhancedForecast({ beachId: "beach-1", autoGenerate: false }),
    );
    await waitFor(() => expect(result.current.forecasts[0]?.wave_height).toBe("4 ft"));
    fetchSpy.mockClear();

    mockAuthUser = { id: "account-b" };
    rerender();
    expect(result.current.forecasts).toEqual([]);
    await waitFor(() => expect(result.current.forecasts[0]?.wave_height).toBe("5 ft"));

    expect(fetchSpy.mock.calls).toEqual([
      [expect.stringContaining("beachId=beach-1"), { cache: "no-store" }],
    ]);
    unmount();
  });

  it("discards a canary response that resolves after logout", async () => {
    mockAuthUser = { id: "canary" };
    let resolveCanary!: (response: Response) => void;
    const canaryResponse = new Promise<Response>((resolve) => {
      resolveCanary = resolve;
    });
    jest.spyOn(global, "fetch").mockImplementation(() =>
      mockAuthUser ? canaryResponse : Promise.resolve(forecastResponse("3 ft")),
    );
    const { result, rerender, unmount } = renderHook(() =>
      useEnhancedForecast({ beachId: "beach-1", autoGenerate: false }),
    );

    mockAuthUser = null;
    rerender();
    await waitFor(() => expect(result.current.forecasts[0]?.wave_height).toBe("3 ft"));

    resolveCanary(forecastResponse("9 ft"));
    await Promise.resolve();
    expect(result.current.forecasts[0]?.wave_height).toBe("3 ft");
    unmount();
  });
});
