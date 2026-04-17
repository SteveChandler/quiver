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
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  // Added for plan abstract-exploring-phoenix (Commit B): the dialog now
  // uses useRouter + usePathname to strip ?onboarding=required from the URL
  // after opening. Tests don't assert the replace() call — the e2e spec
  // covers that invariant — so lightweight jest.fn stubs are sufficient.
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => "/",
}));
jest.mock("@/components/onboarding/steps/home-beach-step", () => ({
  HomeBeachStep: () => <div data-testid="home-beach-step" />,
}));
jest.mock("@/components/onboarding/steps/level-and-time-step", () => ({
  LevelAndTimeStep: () => <div data-testid="level-and-time-step" />,
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
      closeDialog: jest.fn(),
      setCurrentStep: jest.fn(),
    });
    (useSearchParams as jest.Mock).mockReturnValue({ get: jest.fn() });
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
