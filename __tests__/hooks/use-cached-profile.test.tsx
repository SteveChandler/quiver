/**
 * Tests for `useCachedProfile` — focused on the onboarding-completion
 * invalidation contract.
 *
 * The legacy hook (used by OracleHomeScreen via useOracleData, plus
 * app-header.tsx and home-screen/index.tsx) must drop its localStorage
 * cache and refetch when the onboarding_completed event fires. Without
 * this, fresh signups see the Oracle home screen with homeBeach=null and
 * land on the "We couldn't find any surf spots" empty state — confirmed
 * in Supabase analytics on 2026-04-24 for user 5d7fada5... who got stuck
 * in a re-open loop post-signup.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";

// localStorage stub
let localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageData[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageData[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageData[key];
  }),
  clear: jest.fn(() => {
    localStorageData = {};
  }),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

// auth mock
const mockUseAuth = jest.fn();
jest.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// profile-actions mock — what the hook's refetch calls
const mockGetProfileWithHomeBeach = jest.fn();
jest.mock("@/actions/profile-actions", () => ({
  getProfileWithHomeBeach: (...args: unknown[]) => mockGetProfileWithHomeBeach(...args),
}));

import { useCachedProfile } from "@/hooks/use-cached-profile";

const USER = { id: "user-abc" };
const PRE_ONBOARDING_PROFILE = { id: "user-abc", home_beach_id: null };
const POST_ONBOARDING_PROFILE = {
  id: "user-abc",
  home_beach_id: "beach-malibu",
  onboarding_completed_at: "2026-04-24T12:12:35.557Z",
};
const POST_ONBOARDING_BEACH = { id: "beach-malibu", name: "Malibu Third Point", lat: 34.0375, lon: -118.6835 };

describe("useCachedProfile — onboarding_completed invalidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageData = {};
    mockUseAuth.mockReturnValue({ user: USER, isLoading: false, isAuthenticated: true });
  });

  it("clears the localStorage cache when the onboarding_completed event fires", async () => {
    // Seed the legacy cache with a pre-onboarding profile (the real-world
    // bug: homeBeach=null from the cache written before the user selected
    // a home beach).
    localStorageData["quiver_profile_cache"] = JSON.stringify({
      profile: PRE_ONBOARDING_PROFILE,
      homeBeach: null,
      timestamp: Date.now() - 60_000,
    });

    mockGetProfileWithHomeBeach.mockResolvedValue({
      success: true,
      data: { profile: POST_ONBOARDING_PROFILE, homeBeach: POST_ONBOARDING_BEACH },
    });

    const { result } = renderHook(() => useCachedProfile());

    // Cache-hit path — hook serves stale data initially.
    await waitFor(() => {
      expect(result.current.homeBeach).toBeNull();
    });

    // Clear spy calls so we only observe the post-event side effect.
    localStorageMock.removeItem.mockClear();

    // Fire the completion event — mirrors payoff-step.tsx:265 exactly.
    await act(async () => {
      window.dispatchEvent(new CustomEvent("onboarding_completed"));
    });

    // The listener must invoke refreshProfile → clearCache, which removes
    // the legacy cache key. This is the contract that unblocks OracleHomeScreen
    // from serving stale homeBeach=null to fresh signups.
    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("quiver_profile_cache");
    });
  });

  it("removes the event listener on unmount (no leak)", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useCachedProfile());

    expect(
      addSpy.mock.calls.some(([type]) => type === "onboarding_completed")
    ).toBe(true);

    unmount();

    expect(
      removeSpy.mock.calls.some(([type]) => type === "onboarding_completed")
    ).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
