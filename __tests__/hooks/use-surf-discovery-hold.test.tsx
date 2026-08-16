import { act, renderHook, waitFor } from "@testing-library/react";

import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import type { SurfDiscoveryResponse } from "@/types/personalization";

const mockUser = { id: "user-held", email: "held@example.com" };

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({ user: mockUser })),
}));

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function discoveryResponse(
  availability: SurfDiscoveryResponse["recommendationAvailability"],
  recommendationCount: number,
): SurfDiscoveryResponse {
  const isAvailable =
    availability?.state === "available" && recommendationCount > 0;
  return {
    sessionDecision: {
      schemaVersion: "canonical-session-decision.v1",
      engineVersion: "rules.v1",
      decisionId: "b".repeat(64),
      createdAt: "2026-07-19T12:00:00.000Z",
      expiresAt: "2099-07-19T12:15:00.000Z",
      scope: {
        kind: "plan_next_session",
        windowStart: "2026-07-19T12:00:00.000Z",
        windowEnd: "2026-07-20T12:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      verdict: isAvailable ? "go" : "no",
      decisionBasis: isAvailable ? "physical_fallback" : "safety_override",
      reasonCode: isAvailable
        ? "selected_go"
        : availability?.reasonCode ?? "no_candidates",
      selection: isAvailable
        ? {
            candidateId: "candidate-1",
            beachId: "beach-1",
            beachName: "Beach 1",
            windowStart: "2026-07-20T15:00:00.000Z",
            windowEnd: "2026-07-20T18:00:00.000Z",
            timezone: "America/Los_Angeles",
            forecastRef: {
              forecastId: "forecast-1",
              beachId: "beach-1",
              forecastAt: "2026-07-20T15:00:00.000Z",
            },
            skillEligibility: {
              skill: "intermediate",
              state: "eligible",
              reasonCodes: [],
            },
            evidence: {
              conditionScore: 90,
              recommendationLabel: "Worth it",
              personalMatch: null,
            },
          }
        : null,
      skillEligibility: {
        skill: "intermediate",
        state: isAvailable ? "eligible" : "ineligible",
        reasonCodes: isAvailable
          ? []
          : [availability?.reasonCode ?? "no_candidates"],
      },
      holdEpoch: availability?.holdEpoch ?? "missing-hold-state",
    },
    recommendations: Array.from(
      { length: recommendationCount },
      (_, index) =>
        ({
          recommendationId: `candidate-${index + 1}`,
          beach: {
            id: `beach-${index + 1}`,
            name: `Beach ${index + 1}`,
            slug: `beach-${index + 1}`,
            city: "San Diego",
            state: "CA",
            lat: 32.7,
            lon: -117.2,
          },
          window: {
            start: new Date("2026-07-20T15:00:00.000Z"),
            end: new Date("2026-07-20T18:00:00.000Z"),
            tide: "Rising",
            wind: "5 mph E",
            waveHeight: "6 ft",
            wavePeriod: "14s",
            dataSource: "NOAA_NWS",
            confidence: 90,
            timezone: "America/Los_Angeles",
          },
          forecast: {},
          score: 90,
          matchQuality: "excellent",
          subscores: {
            waveHeightFit: 20,
            periodEnergyScore: 18,
            windAlignment: 17,
            tideFit: 12,
            affinityBonus: 10,
            personalizationBonus: 0,
            distancePenalty: 0,
          },
          summary: "Go surf this window",
          reasons: ["Clean swell"],
          warnings: [],
          similarity: null,
          generated_at: "2026-07-19T12:00:00.000Z",
        }) as unknown as SurfDiscoveryResponse["recommendations"][number],
    ),
    searchCriteria: { maxResults: 5 },
    metadata: {
      totalBeachesConsidered: recommendationCount,
      successfulForecasts: recommendationCount,
      failedBeaches: 0,
      staleBeaches: 0,
      partialSuccess: false,
      generated_at: "2026-07-19T12:00:00.000Z",
    },
    regionalCall: "",
    recommendationAvailability: availability,
  };
}

function serialized(response: SurfDiscoveryResponse): SurfDiscoveryResponse {
  return {
    ...response,
    recommendations: response.recommendations.map((recommendation) => ({
      ...recommendation,
      window: {
        ...recommendation.window,
        start: recommendation.window.start.toISOString() as unknown as Date,
        end: recommendation.window.end.toISOString() as unknown as Date,
      },
    })),
  };
}

describe("useSurfDiscovery major-event hold precedence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("deletes cached positives and lets fresh explicit none win", async () => {
    const cachedPositive = discoveryResponse(
      { state: "available", holdEpoch: "before-hold" },
      1,
    );
    window.localStorage.setItem(
      "quiver_discovery_user-held_stale",
      JSON.stringify({
        discovery: cachedPositive,
        timestamp: Date.now(),
        optionsHash: "stale",
      }),
    );
    window.localStorage.setItem("unrelated_objective_cache", "keep-me");

    const held = discoveryResponse(
      {
        state: "none",
        reasonCode: "major_event_hold",
        holdEpoch: "active-hold",
      },
      1,
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: serialized(held) }),
    });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => {
      expect(result.current.discovery?.recommendationAvailability?.state).toBe(
        "none",
      );
    });
    expect(result.current.discovery?.recommendations).toEqual([]);
    expect(result.current.hasRecommendations).toBe(false);
    expect(result.current.isCached).toBe(false);
    expect(
      window.localStorage.getItem("quiver_discovery_user-held_stale"),
    ).toBeNull();
    expect(window.localStorage.getItem("unrelated_objective_cache")).toBe(
      "keep-me",
    );
  });

  it("never persists a fresh recommendation response", async () => {
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "clear" },
      1,
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: serialized(allowed) }),
    });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasRecommendations).toBe(true);
    expect(
      Object.keys(window.localStorage).filter((key) =>
        key.startsWith("quiver_discovery_"),
      ),
    ).toEqual([]);
    expect(result.current.isCached).toBe(false);
  });

  it("clears and revalidates a positive decision when its authority expires", async () => {
    jest.useFakeTimers().setSystemTime(
      new Date("2026-07-19T12:00:00.000Z"),
    );
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "clear" },
      1,
    );
    allowed.sessionDecision!.expiresAt = "2026-07-19T12:00:01.000Z";
    const refreshResponse = deferred<{
      ok: boolean;
      json: () => Promise<{ data: SurfDiscoveryResponse }>;
    }>();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockReturnValueOnce(refreshResponse.promise);

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));
    act(() => {
      jest.advanceTimersByTime(1_001);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.discovery).toBeNull();
    expect(result.current.hasRecommendations).toBe(false);
  });

  it("waits out authority that outlasts the max timer delay, then revalidates", async () => {
    const maxTimerDelayMs = 2_147_483_647;
    jest.useFakeTimers().setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "clear" },
      1,
    );
    // 30 days of authority — longer than a timer can hold in one hop.
    const grantedMs = 30 * 24 * 60 * 60 * 1000;
    allowed.sessionDecision!.expiresAt = new Date(
      Date.parse(allowed.sessionDecision!.createdAt) + grantedMs,
    ).toISOString();
    const held = discoveryResponse(
      { state: "none", reasonCode: "major_event_hold", holdEpoch: "active-hold" },
      1,
    );
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(held) }),
      });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));

    // First hop: authority is still live, so nothing may be revalidated yet.
    act(() => {
      jest.advanceTimersByTime(maxTimerDelayMs);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.hasRecommendations).toBe(true);

    // Past the granted window the re-armed timer must still fire, and the hold
    // that comes back must be what wins.
    await act(async () => {
      jest.advanceTimersByTime(grantedMs - maxTimerDelayMs);
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.discovery?.recommendationAvailability?.state).toBe(
      "none",
    );
    expect(result.current.hasRecommendations).toBe(false);
  });

  it("bounds authority by the server-authored lifetime when the client clock lags", async () => {
    // Client clock 30 days behind the server: a normal 15-minute decision would
    // otherwise look like 30 days of authority.
    jest.useFakeTimers().setSystemTime(new Date("2026-06-19T12:00:00.000Z"));
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "clear" },
      1,
    );
    allowed.sessionDecision!.createdAt = "2026-07-19T12:00:00.000Z";
    allowed.sessionDecision!.expiresAt = "2026-07-19T12:15:00.000Z";
    const held = discoveryResponse(
      { state: "none", reasonCode: "major_event_hold", holdEpoch: "active-hold" },
      1,
    );
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(held) }),
      });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));
    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.discovery?.recommendationAvailability?.state).toBe(
      "none",
    );
    expect(result.current.hasRecommendations).toBe(false);
  });

  it("expires on schedule even if the clock is moved backward mid-session", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "clear" },
      1,
    );
    allowed.sessionDecision!.expiresAt = "2026-07-19T12:15:00.000Z";
    const held = discoveryResponse(
      { state: "none", reasonCode: "major_event_hold", holdEpoch: "active-hold" },
      1,
    );
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(held) }),
      });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));

    // Clock yanked 30 days backward after the timer was armed.
    jest.setSystemTime(new Date("2026-06-19T12:00:00.000Z"));
    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.hasRecommendations).toBe(false);
  });

  it("does not extend authority when a hop fires late", async () => {
    const maxTimerDelayMs = 2_147_483_647;
    jest.useFakeTimers().setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "clear" },
      1,
    );
    const grantedMs = 30 * 24 * 60 * 60 * 1000;
    allowed.sessionDecision!.expiresAt = new Date(
      Date.parse(allowed.sessionDecision!.createdAt) + grantedMs,
    ).toISOString();
    const held = discoveryResponse(
      { state: "none", reasonCode: "major_event_hold", holdEpoch: "active-hold" },
      1,
    );
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(held) }),
      });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));

    // Tab suspended: the wall clock runs past the whole grant before the first
    // hop is delivered. The delayed hop must expire, not re-arm the remainder.
    jest.setSystemTime(new Date(Date.now() + grantedMs));
    await act(async () => {
      jest.advanceTimersByTime(maxTimerDelayMs);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.hasRecommendations).toBe(false);
  });

  it("stays fail-closed when the decision carries an unreadable createdAt", async () => {
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "clear" },
      1,
    );
    allowed.sessionDecision!.createdAt = "not-a-timestamp";
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: serialized(allowed) }),
    });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // The projection now rejects an unreadable createdAt at the boundary, so
    // the surface is emptied like every other invalid decision (previously the
    // hook's expiry effect caught this one render later via reset()).
    expect(result.current.discovery?.recommendations ?? []).toEqual([]);
    expect(result.current.hasRecommendations).toBe(false);
    expect(
      Object.keys(window.localStorage).filter((key) =>
        key.includes("surf-discovery"),
      ),
    ).toEqual([]);
  });

  it("revalidates a visible session and replaces a prior positive with explicit none", async () => {
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "before-hold" },
      1,
    );
    const held = discoveryResponse(
      {
        state: "none",
        reasonCode: "major_event_hold",
        holdEpoch: "active-hold",
      },
      1,
    );
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(held) }),
      });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.discovery?.recommendationAvailability?.state).toBe(
        "none",
      );
    });
    expect(result.current.discovery?.recommendations).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/surf/discover",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("revalidates an open session when the window regains focus", async () => {
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "before-hold" },
      1,
    );
    const held = discoveryResponse(
      {
        state: "none",
        reasonCode: "major_event_hold",
        holdEpoch: "active-hold",
      },
      1,
    );
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(held) }),
      });

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(result.current.discovery?.recommendationAvailability?.state).toBe(
        "none",
      );
    });
    expect(result.current.discovery?.recommendations).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("clears a prior positive before manual refetch and stays fail-closed on error", async () => {
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "before-hold" },
      1,
    );
    const refreshResponse = deferred<{
      ok: boolean;
      status: number;
      json: () => Promise<{ error: string }>;
    }>();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: serialized(allowed) }),
      })
      .mockReturnValueOnce(refreshResponse.promise);

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.hasRecommendations).toBe(true));
    act(() => {
      void result.current.refetch();
    });
    expect(result.current.discovery).toBeNull();

    refreshResponse.resolve({
      ok: false,
      status: 503,
      json: async () => ({ error: "Hold state unavailable" }),
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Hold state unavailable");
    });
    expect(result.current.discovery).toBeNull();
    expect(result.current.hasRecommendations).toBe(false);
  });

  it("queues a resume revalidation when the initial request is still in flight", async () => {
    const allowed = discoveryResponse(
      { state: "available", holdEpoch: "before-hold" },
      1,
    );
    const held = discoveryResponse(
      {
        state: "none",
        reasonCode: "major_event_hold",
        holdEpoch: "active-hold",
      },
      1,
    );
    const initialResponse = deferred<{
      ok: boolean;
      json: () => Promise<{ data: SurfDiscoveryResponse }>;
    }>();
    const resumeResponse = deferred<{
      ok: boolean;
      json: () => Promise<{ data: SurfDiscoveryResponse }>;
    }>();
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(initialResponse.promise)
      .mockReturnValueOnce(resumeResponse.promise);

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    expect(result.current.loading).toBe(true);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    initialResponse.resolve({
      ok: true,
      json: async () => ({ data: serialized(allowed) }),
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(result.current.discovery).toBeNull();

    resumeResponse.resolve({
      ok: true,
      json: async () => ({ data: serialized(held) }),
    });

    await waitFor(() => {
      expect(result.current.discovery?.recommendationAvailability?.state).toBe(
        "none",
      );
    });
    expect(result.current.discovery?.recommendations).toEqual([]);
  });
});
