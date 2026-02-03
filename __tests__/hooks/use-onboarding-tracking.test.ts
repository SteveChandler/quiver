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
  beforeEach(() => {
    jest.clearAllMocks();
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
      act(() => {
        stepChangeCallback(0, 1, "welcome");
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith("onboarding_step", {
          metadata: {
            step: 1, // 1-indexed for human readability
            step_name: "welcome",
            completed: true,
          },
          debounceMs: 100,
        });
      });
    });

    it("tracks multiple step transitions", async () => {
      renderHook(() => useOnboardingTracking());

      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      // Simulate multiple step changes
      act(() => {
        stepChangeCallback(0, 1, "welcome");
      });

      act(() => {
        stepChangeCallback(1, 2, "home_beach");
      });

      act(() => {
        stepChangeCallback(2, 3, "profile");
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(3);
      });

      // Verify each call
      expect(mockTrack).toHaveBeenNthCalledWith(1, "onboarding_step", {
        metadata: { step: 1, step_name: "welcome", completed: true },
        debounceMs: 100,
      });

      expect(mockTrack).toHaveBeenNthCalledWith(2, "onboarding_step", {
        metadata: { step: 2, step_name: "home_beach", completed: true },
        debounceMs: 100,
      });

      expect(mockTrack).toHaveBeenNthCalledWith(3, "onboarding_step", {
        metadata: { step: 3, step_name: "profile", completed: true },
        debounceMs: 100,
      });
    });
  });

  describe("completion tracking", () => {
    it("tracks final completion event when toStep is ONBOARDING_COMPLETION_SIGNAL", async () => {
      renderHook(() => useOnboardingTracking());

      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      // Simulate completion (toStep = -1)
      act(() => {
        stepChangeCallback(5, ONBOARDING_COMPLETION_SIGNAL, "completion");
      });

      await waitFor(() => {
        // Should fire two events: one for the step completion, one for final completion
        expect(mockTrack).toHaveBeenCalledTimes(2);
      });

      // First call: step completion
      expect(mockTrack).toHaveBeenNthCalledWith(1, "onboarding_step", {
        metadata: { step: 6, step_name: "completion", completed: true },
        debounceMs: 100,
      });

      // Second call: final completion
      expect(mockTrack).toHaveBeenNthCalledWith(2, "onboarding_step", {
        metadata: { step: 6, step_name: "completed", completed: true },
        debounceMs: 100,
      });
    });

    it("does not track final completion for regular step changes", async () => {
      renderHook(() => useOnboardingTracking());

      const stepChangeCallback = mockSetOnStepChange.mock.calls[0][0];

      // Simulate regular step change (not completion)
      act(() => {
        stepChangeCallback(2, 3, "profile");
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(1);
      });

      // Should only have one call, not two
      expect(mockTrack).toHaveBeenCalledWith("onboarding_step", {
        metadata: { step: 3, step_name: "profile", completed: true },
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
