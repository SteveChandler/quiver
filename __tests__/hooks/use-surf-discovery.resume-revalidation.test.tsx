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
 * A later real return still requires its own check; focus signals while the
 * page stayed on screen (window blur/focus included) must not erase the call.
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

/** A real departure takes the page off screen; blur alone does not. */
function hidePage(): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "hidden",
  });
  window.dispatchEvent(new Event("blur"));
  document.dispatchEvent(new Event("visibilitychange"));
}

function showPage(): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
}

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
    jest.spyOn(document, "hasFocus").mockReturnValue(true);
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: response }) });
    window.localStorage?.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("issues one revalidation for a tab switch that fires focus and visibilitychange", async () => {
    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      hidePage();
      showPage();
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the call when an already-focused page receives repeated focus signals", async () => {
    const focused = jest.spyOn(document, "hasFocus").mockReturnValue(true);
    try {
      const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      const previous = result.current.discovery;

      await act(async () => {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(async () => { window.dispatchEvent(new Event("focus")); });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.current.discovery).toBe(previous);
      expect(result.current.loading).toBe(false);
    } finally {
      focused.mockRestore();
    }
  });

  it("keeps the call when the window blurs and refocuses while the page stays visible", async () => {
    // Clicking the address bar, an extension, DevTools, or a window beside the
    // browser blurs the window without taking the page off screen.
    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const previous = result.current.discovery;

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.discovery).toBe(previous);
    expect(result.current.loading).toBe(false);
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
      const { recordRequest: recordHomeDiscoveryRequest } = useHomeDiscoveryRequestMetrics();
      return useSurfDiscovery({
        immediate: true,
        suppressInitialResume: true,
        onRequest: () => recordHomeDiscoveryRequest("primary"),
      });
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(captureClientPostHogEventAfterConsent).toHaveBeenCalledTimes(1);

    act(() => {
      hidePage();
      showPage();
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
      hidePage();
      showPage();
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    // Well past the pairing window — a separate resume, not the focus/
    // visibilitychange pair from one tab switch.
    nowSpy.mockReturnValue(base + 5_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
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

  it("drains a queued resume when a superseding refresh lands before the stale recheck settles", async () => {
    // An options refresh (B) supersedes the in-flight resume recheck (A) and
    // resolves first, so the drain effect still sees A and skips. When A later
    // settles, the queued recheck must still run; otherwise the hook stays
    // pending with no request in flight and Home sits on "Rechecking" forever.
    const releases: Array<() => void> = [];
    const deferredResponse = () =>
      new Promise((resolve) => {
        releases.push(() =>
          resolve({ ok: true, json: async () => ({ data: response }) }),
        );
      });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: response }) })
      .mockImplementationOnce(deferredResponse) // A: first resume recheck
      .mockImplementationOnce(deferredResponse) // B: options refresh
      .mockImplementationOnce(deferredResponse); // C: queued resume recheck
    const [releaseA, releaseB, releaseC] = [0, 1, 2].map(
      (index) => () => releases[index]?.(),
    );

    const nowSpy = jest.spyOn(Date, "now");
    const base = 1_000_000;
    nowSpy.mockReturnValue(base);

    const { result, rerender } = renderHook(
      ({ timeSlot }: { timeSlot: "any" | "afternoon" }) =>
        useSurfDiscovery({ immediate: true, timeSlot }),
      { initialProps: { timeSlot: "any" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      hidePage();
      showPage();
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    // A separate return well past the pairing window queues behind A.
    nowSpy.mockReturnValue(base + 5_000);
    act(() => {
      hidePage();
      showPage();
      document.dispatchEvent(new Event("visibilitychange"));
    });

    rerender({ timeSlot: "afternoon" });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));

    await act(async () => { releaseB(); });
    await act(async () => { releaseA(); });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(result.current.discovery).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => { releaseC(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.discovery).not.toBeNull();

    nowSpy.mockRestore();
  });

  it("still revalidates on a later, separate resume", async () => {
    const { result } = renderHook(() => useSurfDiscovery({ immediate: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      hidePage();
      showPage();
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(2);

    act(() => {
      hidePage();
      showPage();
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
