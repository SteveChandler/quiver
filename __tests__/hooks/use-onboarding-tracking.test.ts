import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useOnboardingTracking } from "@/hooks/use-onboarding-tracking";
import { ONBOARDING_COMPLETION_SIGNAL } from "@/store/onboarding-store";

// Mock the onboarding store
const mockSetOnStepChange = jest.fn();
jest.mock("@/store/onboarding-store", () => ({
  useOnboardingStore: () => ({
    setOnStepChange: mockSetOnStepChange,
  }),
  ONBOARDING_COMPLETION_SIGNAL: -1,
}));

// Mock useTrackEvent hook
const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

describe("useOnboardingTracking", () => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Deterministic Date.now: starts at 1_000_000 and advances by 5_000ms per call.
    let current = 1_000_000;
    nowSpy = jest.spyOn(Date, "now").mockImplementation(() => {
      const value = current;
      current += 5_000;
      return value;
    });
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe("callback setup", () => {
    it("sets up step change callback on mount", () => {
      renderHook(() => useOnboardingTracking());

      expect(mockSetOnStepChange).toHaveBeenCalledTimes(1);
      expect(mockSetOnStepChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it("cleans up callback on unmount", () => {
      const { unmount } = renderHook(() => useOnboardingTracking());

      // First call is the setup
      expect(mockSetOnStepChange).toHaveBeenCalledTimes(1);

      unmount();

      // Second call is the cleanup with null
      expect(mockSetOnStepChange).toHaveBeenCalledTimes(2);
      expect(mockSetOnStepChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe("step completion tracking", () => {
    it("tracks step completion events with correct metadata", async () => {
      renderHook(() => useOnboardingTracking());

      // Get the callback that was passed to setOnStepChange
      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      // Simulate step change from step 0 to step 1
      // Date.now mock: hook mount captures 1_000_000, callback fires at 1_005_000 → 5_000ms on step
      act(() => {
        stepChangeCallback(0, 1, "home_beach");
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith("onboarding_step", {
          metadata: {
            step: "home_beach", // Named identifier, not numeric
            step_name: "home_beach",
            completed: true,
            direction: "forward",
            time_on_step_ms: 5_000,
          },
          debounceMs: 100,
        });
      });
    });

    it("tracks multiple step transitions", async () => {
      renderHook(() => useOnboardingTracking());

      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      // Simulate multiple step changes through the real onboarding step names
      act(() => {
        stepChangeCallback(0, 1, "home_beach");
      });

      act(() => {
        stepChangeCallback(1, 2, "level_and_time");
      });

      act(() => {
        stepChangeCallback(2, 1, "payoff");
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(3);
      });

      // Verify each call. Date.now mock advances 5_000ms per call:
      // mount=1_000_000, callback1=1_005_000, callback2=1_010_000, callback3=1_015_000.
      expect(mockTrack).toHaveBeenNthCalledWith(1, "onboarding_step", {
        metadata: { step: "home_beach", step_name: "home_beach", completed: true, direction: "forward", time_on_step_ms: 5_000 },
        debounceMs: 100,
      });

      expect(mockTrack).toHaveBeenNthCalledWith(2, "onboarding_step", {
        metadata: { step: "level_and_time", step_name: "level_and_time", completed: true, direction: "forward", time_on_step_ms: 5_000 },
        debounceMs: 100,
      });

      // Back transition (toStep < fromStep)
      expect(mockTrack).toHaveBeenNthCalledWith(3, "onboarding_step", {
        metadata: { step: "payoff", step_name: "payoff", completed: true, direction: "back", time_on_step_ms: 5_000 },
        debounceMs: 100,
      });
    });

    it("emits a numeric time_on_step_ms for sequential transitions", async () => {
      renderHook(() => useOnboardingTracking());
      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      act(() => {
        stepChangeCallback(0, 1, "home_beach");
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(1);
      });

      const trackCall = mockTrack.mock.calls[0];
      const metadata = trackCall[1].metadata;
      expect(typeof metadata.time_on_step_ms).toBe("number");
      expect(metadata.time_on_step_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("completion tracking", () => {
    it("tracks final completion event when toStep is ONBOARDING_COMPLETION_SIGNAL", async () => {
      renderHook(() => useOnboardingTracking());

      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      // Simulate completion from the payoff step (toStep = -1)
      act(() => {
        stepChangeCallback(2, ONBOARDING_COMPLETION_SIGNAL, "payoff");
      });

      await waitFor(() => {
        // Should fire two events: one for the step completion, one for final completion
        expect(mockTrack).toHaveBeenCalledTimes(2);
      });

      // First call: step completion
      expect(mockTrack).toHaveBeenNthCalledWith(1, "onboarding_step", {
        metadata: { step: "payoff", step_name: "payoff", completed: true, direction: "forward" },
        debounceMs: 100,
      });

      // Second call: final completion (debounceMs: 0 — fires right after payoff step event with same debounce key)
      expect(mockTrack).toHaveBeenNthCalledWith(2, "onboarding_step", {
        metadata: { step: "completed", step_name: "completed", completed: true, direction: "forward" },
        debounceMs: 0,
      });
    });

    it("does not track final completion for regular step changes", async () => {
      renderHook(() => useOnboardingTracking());

      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      // Simulate regular step change (not completion)
      act(() => {
        stepChangeCallback(1, 2, "level_and_time");
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(1);
      });

      // Should only have one call, not two
      expect(mockTrack).toHaveBeenCalledWith("onboarding_step", {
        metadata: { step: "level_and_time", step_name: "level_and_time", completed: true, direction: "forward" },
        debounceMs: 100,
      });
    });
  });

  describe("hook stability", () => {
    it("does not re-set callback on re-render when dependencies are stable", async () => {
      const { rerender } = renderHook(() => useOnboardingTracking());

      expect(mockSetOnStepChange).toHaveBeenCalledTimes(1);

      rerender();

      // Should still only be called once (plus potential cleanup/setup from strict mode)
      // In non-strict mode, this should be 1
      expect(mockSetOnStepChange.mock.calls.filter((call: unknown[]) => call[0] !== null).length).toBe(1);
    });
  });

  describe("ONBOARDING_COMPLETION_SIGNAL constant", () => {
    it("exports ONBOARDING_COMPLETION_SIGNAL constant", () => {
      expect(ONBOARDING_COMPLETION_SIGNAL).toBe(-1);
    });
  });
});
