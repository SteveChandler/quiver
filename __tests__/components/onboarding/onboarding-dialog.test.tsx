import React from "react";
import { render, screen, act } from "@testing-library/react";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSearchParams } from "next/navigation";

// Mocks
jest.mock("@/context/auth-context");
jest.mock("@/context/profile-context");
jest.mock("@/store/onboarding-store");
// Shared router-replace spy so tests can assert the param strip fires without
// opening the dialog. Must be `mock`-prefixed for jest.mock hoisting.
const mockRouterReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  // Added for plan abstract-exploring-phoenix (Commit B): the dialog uses
  // useRouter + usePathname to strip ?onboarding=required from the URL.
  useRouter: () => ({ replace: mockRouterReplace, push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => "/",
}));
jest.mock("@/components/onboarding/steps/home-beach-step", () => ({
  HomeBeachStep: () => <div data-testid="home-beach-step" />,
}));
jest.mock("@/components/onboarding/steps/experience-level-step", () => ({
  ExperienceLevelStep: () => <div data-testid="level-and-time-step" />,
}));
jest.mock("@/components/onboarding/steps/payoff-step", () => ({
  PayoffStep: () => <div data-testid="payoff-step" />,
}));
jest.mock("@/hooks/use-onboarding-tracking", () => ({
  useOnboardingTracking: jest.fn(),
}));
jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));
jest.mock("@/actions/onboarding-actions", () => ({
  skipOnboarding: jest.fn(),
}));
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            animate: _a,
            initial: _i,
            exit: _e,
            variants: _v,
            custom: _c,
            transition: _t,
            whileTap: _wt,
            whileHover: _wh,
            ...rest
          } = props;
          return <div ref={ref} {...rest} />;
        }
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

describe("OnboardingDialog Logic", () => {
  const mockOpenDialog = jest.fn();
  const mockReset = jest.fn();
  const mockCheckUserId = jest.fn();
  const mockReopenFresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mocks
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (useProfileContext as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
    });
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      isOpen: false,
      isCompleted: false,
      currentStep: 0,
      openDialog: mockOpenDialog,
      reset: mockReset,
      checkUserId: mockCheckUserId,
      reopenFresh: mockReopenFresh,
      closeDialog: jest.fn(),
      setCurrentStep: jest.fn(),
    });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn(),
      toString: () => "",
    });
  });

  // Auto-open behaviour was removed in plan vast-dancing-whale. The dialog now
  // only opens via explicit user action: the Oracle home screen's
  // ContextualCTA, the profile page's SetHomeBreakCta, or the
  // ?showOnboarding=1 URL param. The tests below pin that contract.

  it("does NOT auto-open for a brand-new user (no profile)", () => {
    jest.useFakeTimers();
    render(<OnboardingDialog />);

    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("does NOT auto-open for a user with incomplete profile", () => {
    (useProfileContext as jest.Mock).mockReturnValue({
      profile: { onboarding_completed_at: null },
      isLoading: false,
    });

    jest.useFakeTimers();
    render(<OnboardingDialog />);

    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("does NOT auto-open when onboarding already completed", () => {
    (useProfileContext as jest.Mock).mockReturnValue({
      profile: { onboarding_completed_at: "2023-01-01" },
      isLoading: false,
    });

    jest.useFakeTimers();
    render(<OnboardingDialog />);

    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("does NOT call reopenFresh while profile is still loading (race guard)", () => {
    // Fresh-signup race: `user` has loaded but ProfileContext's initial fetch
    // is still in-flight (isLoading=true, profile=null). Before the guard at
    // onboarding-dialog.tsx:260, the effect would lock its decision on this
    // first render and call reopenFresh — then the subsequent profile-loaded
    // re-render would bail on the one-shot ref, keeping the dialog force-open
    // even when profile.onboarding_completed_at eventually arrived. Confirmed
    // live on 2026-04-24 for user 5d7fada5... (4 completions + 3 re-opens in
    // ~3 min). The guard must defer until ProfileContext settles.
    (useProfileContext as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
    });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === "onboarding" ? "required" : null),
      toString: () => "onboarding=required",
    });

    const replaceStateSpy = jest.spyOn(window.history, "replaceState");
    render(<OnboardingDialog />);

    expect(mockReopenFresh).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    replaceStateSpy.mockRestore();
  });

  it("does NOT re-open when ?onboarding=required is set AND onboarding already completed", () => {
    // Guards the activated-user case: a stale welcome-email link, bookmark,
    // or browser autocomplete must not force-reopen the dialog for a user
    // whose profile already shows onboarding_completed_at. The param must
    // still be stripped so a refresh settles on a clean URL.
    //
    // The strip uses `window.history.replaceState` directly — Next 16's
    // `router.replace` was silently re-writing the URL back to
    // ?onboarding=required during the initial RSC streaming window
    // (confirmed via stack-traced replaceState on dev 2026-04-27).
    (useProfileContext as jest.Mock).mockReturnValue({
      profile: {
        onboarding_completed_at: "2026-04-20T18:42:44Z",
        home_beach_id: "b1",
      },
      isLoading: false,
    });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === "onboarding" ? "required" : null),
      toString: () => "onboarding=required",
    });

    // Simulate the URL having ?onboarding=required so window.location.search
    // matches what stripParam reads.
    const originalSearch = window.location.search;
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "?onboarding=required", pathname: "/" },
      writable: true,
    });

    const replaceStateSpy = jest.spyOn(window.history, "replaceState");
    render(<OnboardingDialog />);

    expect(mockReopenFresh).not.toHaveBeenCalled();
    expect(mockOpenDialog).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/");

    replaceStateSpy.mockRestore();
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: originalSearch },
      writable: true,
    });
  });

  it("opens dialog when ?showOnboarding=1 URL param is set", () => {
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === "showOnboarding" ? "1" : null),
    });

    jest.useFakeTimers();
    render(<OnboardingDialog />);

    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("calls checkUserId on mount", () => {
    render(<OnboardingDialog />);
    expect(mockCheckUserId).toHaveBeenCalledWith("user-123");
  });

  it("renders full-screen overlay with role=dialog when open", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      isOpen: true,
      isCompleted: false,
      currentStep: 0,
      openDialog: mockOpenDialog,
      reset: mockReset,
      checkUserId: mockCheckUserId,
      closeDialog: jest.fn(),
      setCurrentStep: jest.fn(),
    });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === "showOnboarding" ? "1" : null),
    });

    render(<OnboardingDialog />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Set up your surf profile");
  });

  it("does NOT render the old dialog-level X button (replaced by in-step Maybe later)", () => {
    // The absolute-positioned X button in the top-right corner of the dialog was a
    // reflex-tap magnet — ~33% of new users were tapping it within 6 seconds and
    // getting permanently locked out. It's been replaced by explicit "Maybe later"
    // buttons inside HomeBeachStep and LevelAndTimeStep (tested separately).
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      isOpen: true,
      isCompleted: false,
      currentStep: 0,
      openDialog: mockOpenDialog,
      reset: mockReset,
      checkUserId: mockCheckUserId,
      closeDialog: jest.fn(),
      setCurrentStep: jest.fn(),
    });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === "showOnboarding" ? "1" : null),
    });

    render(<OnboardingDialog />);
    expect(screen.queryByLabelText("Skip onboarding")).not.toBeInTheDocument();
  });
});
