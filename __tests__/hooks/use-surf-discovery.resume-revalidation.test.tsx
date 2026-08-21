/**
 * Resume revalidation must stay fail-closed (covered in
 * use-surf-discovery-hold.test.tsx) WITHOUT amplifying requests.
 *
 * A single tab switch fires both `focus` and `visibilitychange`. Each one
 * used to produce its own discovery request: the second event queued behind
 * the first and drained into a follow-up fetch once the first settled. That
 * doubled load on `/api/surf/discover` — an uncacheable route with a 30s
 * budget — and doubled the time the home screen spent with no payload.
 *
 * A resume revalidation already in flight reflects state as of its own
 * response, so it covers every resume event raised while it runs.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useHomeDiscoveryRequestMetrics } from "@/hooks/use-home-discovery-request-metrics";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";

const mockUser = { id: "user-123", email: "test@example.com" };
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({ user: mockUser })),
}));

jest.mock("@/lib/posthog-client", () => ({
  captureClientPostHogEventAfterConsent: jest.fn(),
}));

const response = {
  sessionDecision: null,
  recommendations: [
    {
      recommendationId: "candidate-1",
      beach: { id: "beach-1", name: "Ocean Beach", slug: "ocean-beach" },
      window: {
        start: "2025-12-16T15:00:00.000Z",
        end: "2025-12-16T18:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      forecast: {},
      score: 85,
      summary: "Good",
      reasons: [],
      warnings: [],
    },
  ],
  searchCriteria: { maxResults: 5 },
  metadata: {},
  regionalCall: "",
};

describe("useSurfDiscovery resume revalidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: response }) });
    window.localStorage?.clear();
  });

  it("issues one revalidation for a tab switch that fires focus and visibilitychange", async () => {
    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not revalidate when focus arrives during the initial Home request", async () => {
    let releaseInitial: (() => void) | undefined;
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseInitial = () =>
              resolve({ ok: true, json: async () => ({ data: response }) });
          }),
      );

    const { result } = renderHook(() => {
      const recordHomeDiscoveryRequest = useHomeDiscoveryRequestMetrics();
      return useSurfDiscovery({
        immediate: true,
        suppressInitialResume: true,
        onRequest: () => recordHomeDiscoveryRequest("primary"),
      });
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(captureClientPostHogEventAfterConsent).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      releaseInitial?.();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(captureClientPostHogEventAfterConsent).toHaveBeenCalledTimes(1);
    expect(captureClientPostHogEventAfterConsent).toHaveBeenCalledWith(
      "home_discovery_request",
      {
        home_load_id: expect.any(String),
        request_number: 1,
        source: "primary",
      },
    );
  });

  it("queues a resume that arrives after the coalescing window, mid-flight", async () => {
    // A hold can activate after the in-flight request already read hold state
    // server-side, so a genuinely later resume signal must not be swallowed by
    // the request it overlaps — it has to earn its own recheck.
    let releaseResume: (() => void) | undefined;
    global.fetch = jest
      .fn()
      // initial
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: response }) })
      // resume request — held open so a later signal lands mid-flight
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseResume = () =>
              resolve({ ok: true, json: async () => ({ data: response }) });
          })
      )
      .mockResolvedValue({ ok: true, json: async () => ({ data: response }) });

    const nowSpy = jest.spyOn(Date, "now");
    const base = 1_000_000;
    nowSpy.mockReturnValue(base);

    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    // Well past the pairing window — a separate resume, not the focus/
    // visibilitychange pair from one tab switch.
    nowSpy.mockReturnValue(base + 5_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      releaseResume?.();
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    nowSpy.mockRestore();
  });

  it("still revalidates on a later, separate resume", async () => {
    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(2);

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
