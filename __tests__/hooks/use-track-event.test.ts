import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";
import { buildBfrWebEventMetadata } from "@/lib/analytics/event-taxonomy";
import { FollowTopic } from "@/types/beach-follow";

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useOptionalAuth: jest.fn(),
}));

// Mock visitor-id module
jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "visitor-uuid-123"),
}));

const mockCaptureClientPostHogEvent = jest.fn();
jest.mock("@/lib/posthog-client", () => ({
  captureClientPostHogEvent: (...args: unknown[]) =>
    mockCaptureClientPostHogEvent(...args),
}));

// Mock fetch
global.fetch = jest.fn();

import { useOptionalAuth } from "@/context/auth-context";

describe("useTrackEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("basic tracking", () => {
    it("accepts builder-validated BFR metadata through the shared transport", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: null });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      const metadata = buildBfrWebEventMetadata(
        {
          audience_class: "general_utility",
          page_type: "beach_water_temp",
          experiment_key: "bfr-follow-holdout-v1",
          experiment_arm: "treatment",
          topic: FollowTopic.WaterTemp,
        },
        "beach_follow_started",
      );
      expect(metadata).not.toBeNull();
      if (!metadata) return;

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_follow_started", {
          beachId: "beach-456",
          metadata,
          debounceMs: 0,
        });
      });

      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({
        eventType: "beach_follow_started",
        beachId: "beach-456",
        metadata,
      });
    });

    it("calls /api/events with correct payload for authenticated user", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          metadata: { duration_ms: 5000 },
        });
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const fetchOptions = fetchCall[1];
      const body = JSON.parse(fetchOptions.body);

      expect(fetchCall[0]).toBe("/api/events");
      expect(fetchOptions).toMatchObject({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      });
      expect(body).toMatchObject({
        eventType: "beach_view",
        beachId: "beach-456",
        metadata: { duration_ms: 5000 },
      });
      expect(typeof body.viewportWidth).toBe("number");
      expect(mockCaptureClientPostHogEvent).toHaveBeenCalledWith("beach_view", {
        beach_id: "beach-456",
        duration_ms: 5000,
      });
    });

    it("includes keepalive: true in fetch options", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("discovery_click", {
          beachId: "beach-789",
          metadata: { position: 0, score_shown: 95, alternatives_count: 5 },
        });
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const fetchOptions = fetchCall[1];

      expect(fetchOptions.keepalive).toBe(true);
    });

    it("tracks event without beachId", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("location_update", {
          metadata: { lat: 33.0, lon: -117.0, accuracy_m: 10 },
        });
      });

      const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchBody).toMatchObject({
        eventType: "location_update",
        metadata: { lat: 33.0, lon: -117.0, accuracy_m: 10 },
      });
    });

    it("tracks event with empty metadata", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
        });
      });

      const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchBody).toMatchObject({
        eventType: "beach_view",
        beachId: "beach-456",
        metadata: {},
      });
    });
  });

  describe("PostHog handoff", () => {
    it("waits for the consent-aware API before capturing", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      let resolveFetch: (response: unknown) => void = () => undefined;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);
      const { result } = renderHook(() => useTrackEvent());

      let trackPromise: Promise<void>;
      act(() => {
        trackPromise = result.current.track("beach_view");
      });

      expect(mockCaptureClientPostHogEvent).not.toHaveBeenCalled();

      resolveFetch({
        ok: true,
        json: async () => ({ success: true, data: { ok: true } }),
      });
      await act(async () => {
        await trackPromise!;
      });

      expect(mockCaptureClientPostHogEvent).toHaveBeenCalledWith(
        "beach_view",
        {},
      );
    });

    it.each([
      ["tracking_disabled", { ok: true, status: "tracking_disabled" }],
      ["bot_filtered", { ok: true, status: "bot_filtered" }],
      ["skipped", { ok: true, skipped: true }],
    ])("does not capture when the API reports %s", async (_name, data) => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data }),
      });
      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view");
      });

      expect(mockCaptureClientPostHogEvent).not.toHaveBeenCalled();
    });
  });

  describe("guest users", () => {
    it("tracks anonymously for guests with sessionId", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: null });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          metadata: { duration_ms: 5000 },
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          body: expect.stringContaining('"sessionId":"visitor-uuid-123"'),
        })
      );
    });

    it("tracks with sessionId when user is undefined", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: undefined });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          body: expect.stringContaining('"sessionId":"visitor-uuid-123"'),
        })
      );
    });

    it("tracks with sessionId when user.id is missing", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: {} });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          body: expect.stringContaining('"sessionId":"visitor-uuid-123"'),
        })
      );
    });
  });

  describe("debouncing", () => {
    it("debounces duplicate events (same event+beach within debounceMs)", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      // Fire same event twice within 1000ms
      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          metadata: { duration_ms: 5000 },
        });
      });

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          metadata: { duration_ms: 6000 },
        });
      });

      // Should only call fetch once (second call debounced)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("does not debounce after debounceMs has passed", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      // Fire first event
      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          metadata: { duration_ms: 5000 },
          debounceMs: 1000,
        });
      });

      // Advance time by 1001ms
      act(() => {
        jest.advanceTimersByTime(1001);
      });

      // Fire second event (after debounce period)
      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          metadata: { duration_ms: 6000 },
          debounceMs: 1000,
        });
      });

      // Should call fetch twice
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("does not debounce different event types", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
        });
      });

      await act(async () => {
        await result.current.track("forecast_check", {
          beachId: "beach-456",
        });
      });

      // Should call fetch twice (different event types)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("does not debounce different beaches", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
        });
      });

      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-789",
        });
      });

      // Should call fetch twice (different beaches)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("respects custom debounceMs value", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { result } = renderHook(() => useTrackEvent());

      // Fire first event with 500ms debounce
      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          debounceMs: 500,
        });
      });

      // Advance time by 400ms (still within debounce)
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Fire second event (should be debounced)
      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          debounceMs: 500,
        });
      });

      // Should only call fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Advance time by 200ms more (total 600ms > 500ms debounce)
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Fire third event (should not be debounced)
      await act(async () => {
        await result.current.track("beach_view", {
          beachId: "beach-456",
          debounceMs: 500,
        });
      });

      // Should call fetch twice now
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("swallows fetch errors (tracking should never break the app)", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      const { result } = renderHook(() => useTrackEvent());

      // Should not throw
      await act(async () => {
        await expect(
          result.current.track("beach_view", {
            beachId: "beach-456",
          })
        ).resolves.not.toThrow();
      });
    });

    it("swallows JSON parsing errors", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const { result } = renderHook(() => useTrackEvent());

      // Should not throw
      await act(async () => {
        await expect(
          result.current.track("beach_view", {
            beachId: "beach-456",
          })
        ).resolves.not.toThrow();
      });
    });

    it("swallows HTTP errors", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });

      const { result } = renderHook(() => useTrackEvent());

      // Should not throw
      await act(async () => {
        await expect(
          result.current.track("beach_view", {
            beachId: "beach-456",
          })
        ).resolves.not.toThrow();
      });
    });
  });

  describe("fire and forget behavior", () => {
    it("does not wait for fetch to complete", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });

      // Create a promise that resolves after a delay
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise<any>((resolve) => {
        resolveFetch = resolve;
        // Simulate slow network - resolve after 100ms
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ ok: true }),
          });
        }, 100);
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(() => useTrackEvent());

      // Track should return immediately (fire and forget)
      // The track function doesn't await the fetch internally
      act(() => {
        // Don't await - just call it
        result.current.track("beach_view", {
          beachId: "beach-456",
        });
      });

      // Should call fetch immediately
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("hook stability", () => {
    it("track function reference is stable across re-renders", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });

      const { result, rerender } = renderHook(() => useTrackEvent());

      const firstTrack = result.current.track;

      rerender();

      const secondTrack = result.current.track;

      expect(firstTrack).toBe(secondTrack);
    });

    it("track function updates when user changes", async () => {
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });

      const { result, rerender } = renderHook(() => useTrackEvent());

      const firstTrack = result.current.track;

      // Change user
      (useOptionalAuth as jest.Mock).mockReturnValue({ user: { id: "user-456" } });

      rerender();

      const secondTrack = result.current.track;

      // Track function should be different (because it depends on user.id)
      expect(firstTrack).not.toBe(secondTrack);
    });
  });
});
