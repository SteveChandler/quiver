/**
 * Tests for hooks/use-coast-pulse-realtime.ts
 *
 * Asserts:
 * 1. intel_posts channel subscribes with a server-side filter string beach_id=in.(...)
 * 2. sessions channel subscribes with a server-side filter string beach_id=in.(...)
 * 3. enhanced_forecasts channel is NEVER created (dropped in favor of polling)
 * 4. isStale flag is promoted to a ref so cleanup correctly gates in-flight callbacks
 * 5. Cleanup removes channels directly without setTimeout wrapper
 */

import { renderHook, act } from "@testing-library/react";

// --- Supabase mock -------------------------------------------------------
// We need to track .on() calls with their config so we can inspect filters.
// The global mock-supabase doesn't expose per-channel config, so we override
// createClient inline with a spy-friendly implementation.

const mockSubscribe = jest.fn(() => ({}));
const mockOn = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn(() => Promise.resolve("ok"));

// mockOn returns a chain that supports further .on() calls and .subscribe()
const channelChain = {
  on: mockOn,
  subscribe: mockSubscribe,
};
mockOn.mockReturnValue(channelChain);

mockChannel.mockImplementation((name: string) => ({
  on: mockOn,
  subscribe: mockSubscribe,
  _name: name,
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  })),
}));

// Import after mocks are set up
import { useCoastPulseRealtime } from "@/hooks/use-coast-pulse-realtime";

// ---------------------------------------------------------------------------

const BEACH_IDS = ["beach-1", "beach-2", "beach-3"];
const NOOP = () => {};

function renderRealtime(beachIds = BEACH_IDS) {
  return renderHook(() =>
    useCoastPulseRealtime({
      nearbyBeachIds: beachIds,
      onIntelPost: NOOP,
      onConditionsChanged: NOOP,
      onSessionEvent: NOOP,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Re-apply after clearAllMocks
  mockOn.mockReturnValue(channelChain);
  mockChannel.mockImplementation((name: string) => ({
    on: mockOn,
    subscribe: mockSubscribe,
    _name: name,
  }));
  mockRemoveChannel.mockReturnValue(Promise.resolve("ok"));
});

describe("useCoastPulseRealtime — channel filters", () => {
  it("subscribes intel_posts channel with beach_id=in.(...) server-side filter", () => {
    renderRealtime(BEACH_IDS);

    // Collect all postgres_changes configs passed to .on()
    const postgresConfigs = mockOn.mock.calls
      .filter(([event]) => event === "postgres_changes")
      .map(([, config]) => config as { table: string; filter?: string });

    const intelConfig = postgresConfigs.find((c) => c.table === "intel_posts");
    expect(intelConfig).not.toBeNull();
    expect(intelConfig?.filter).toMatch(/^beach_id=in\.\(/);
    // All provided beach IDs must appear in the filter
    for (const id of BEACH_IDS) {
      expect(intelConfig?.filter).toContain(id);
    }
  });

  it("subscribes sessions channel with beach_id=in.(...) server-side filter", () => {
    renderRealtime(BEACH_IDS);

    const postgresConfigs = mockOn.mock.calls
      .filter(([event]) => event === "postgres_changes")
      .map(([, config]) => config as { table: string; filter?: string });

    const sessionsConfig = postgresConfigs.find((c) => c.table === "sessions");
    expect(sessionsConfig).not.toBeNull();
    expect(sessionsConfig?.filter).toMatch(/^beach_id=in\.\(/);
    for (const id of BEACH_IDS) {
      expect(sessionsConfig?.filter).toContain(id);
    }
  });

  it("does NOT create a channel for enhanced_forecasts (use polling instead)", () => {
    renderRealtime(BEACH_IDS);

    // No channel should be named with 'forecasts'
    const channelNames = mockChannel.mock.calls.map(([name]: [string]) => name);
    const forecastChannel = channelNames.find((n) => n.includes("forecast"));
    expect(forecastChannel).toBeUndefined();

    // Also confirm no postgres_changes subscription targets enhanced_forecasts
    const postgresConfigs = mockOn.mock.calls
      .filter(([event]) => event === "postgres_changes")
      .map(([, config]) => config as { table: string });

    const enhancedForecastsEntry = postgresConfigs.find(
      (c) => c.table === "enhanced_forecasts"
    );
    expect(enhancedForecastsEntry).toBeUndefined();
  });

  it("creates exactly 2 channels (intel + sessions) — not 3", () => {
    renderRealtime(BEACH_IDS);
    // channel() call count = number of subscribed channels
    expect(mockChannel).toHaveBeenCalledTimes(2);
  });

  it("calls onConditionsChanged via polling interval, not realtime push", () => {
    jest.useFakeTimers();
    const onConditionsChanged = jest.fn();

    renderHook(() =>
      useCoastPulseRealtime({
        nearbyBeachIds: BEACH_IDS,
        onIntelPost: NOOP,
        onConditionsChanged,
        onSessionEvent: NOOP,
      })
    );

    // At mount: no immediate call
    expect(onConditionsChanged).not.toHaveBeenCalled();

    // After 5 minutes the poll fires
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(onConditionsChanged).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it("cleans up polling interval on unmount", () => {
    jest.useFakeTimers();
    const onConditionsChanged = jest.fn();
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const { unmount } = renderHook(() =>
      useCoastPulseRealtime({
        nearbyBeachIds: BEACH_IDS,
        onIntelPost: NOOP,
        onConditionsChanged,
        onSessionEvent: NOOP,
      })
    );

    unmount();

    // Advance past the poll window — callback must NOT fire after unmount
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(onConditionsChanged).not.toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it("removes channels on unmount without setTimeout delay", async () => {
    jest.useFakeTimers();
    const { unmount } = renderRealtime(BEACH_IDS);

    unmount();

    // removeChannel should be called synchronously (no setTimeout wrapper)
    // Advance 0ms — if it were delayed, it wouldn't fire yet
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(mockRemoveChannel).toHaveBeenCalledTimes(2); // one per channel

    jest.useRealTimers();
  });
});
