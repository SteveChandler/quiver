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

  it("opens dialog for new user (no profile)", () => {
    jest.useFakeTimers();
    render(<OnboardingDialog />);

    // Fast-forward timers for setTimeout
    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("does not auto-open dialog if onboarding was completed in this session", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      isOpen: false,
      isCompleted: true,
      currentStep: 0,
      openDialog: mockOpenDialog,
      reset: mockReset,
      checkUserId: mockCheckUserId,
      closeDialog: jest.fn(),
      setCurrentStep: jest.fn(),
    });

    jest.useFakeTimers();
    render(<OnboardingDialog />);

    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("opens dialog for user with incomplete profile", () => {
    (useProfileContext as jest.Mock).mockReturnValue({
      profile: { onboarding_completed_at: null },
      isLoading: false,
    });

    jest.useFakeTimers();
    render(<OnboardingDialog />);

    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("does not open dialog if profile is loaded and onboarding completed", () => {
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

  it("does not open dialog if dismissed for current user", () => {
    // OnboardingDialog uses a TTL-based dismissal key:
    // `onboarding_dismissed_until_${userId}` stores a future timestamp (ms).
    localStorage.setItem(
      "onboarding_dismissed_until_user-123",
      String(Date.now() + 24 * 60 * 60 * 1000)
    );

    jest.useFakeTimers();
    render(<OnboardingDialog />);

    act(() => {
      jest.runAllTimers();
    });

    expect(mockOpenDialog).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("opens dialog if dismissed for different user", () => {
    localStorage.setItem(
      "onboarding_dismissed_until_other-user",
      String(Date.now() + 24 * 60 * 60 * 1000)
    );

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

  it("renders skip button that is hidden on payoff step", () => {
    // Step 0 - skip button visible
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

    const { rerender } = render(<OnboardingDialog />);
    expect(screen.getByLabelText("Skip onboarding")).toBeInTheDocument();

    // Step 2 (payoff) - skip button hidden
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      isOpen: true,
      isCompleted: false,
      currentStep: 2,
      openDialog: mockOpenDialog,
      reset: mockReset,
      checkUserId: mockCheckUserId,
      closeDialog: jest.fn(),
      setCurrentStep: jest.fn(),
    });

    rerender(<OnboardingDialog />);
    expect(screen.queryByLabelText("Skip onboarding")).not.toBeInTheDocument();
  });
});
