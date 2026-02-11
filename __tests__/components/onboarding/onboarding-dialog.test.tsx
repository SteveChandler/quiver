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
jest.mock("@/components/onboarding/stepper", () => ({
  Stepper: () => <div data-testid="stepper" />,
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
jest.mock("@/actions/onboarding-actions", () => ({
  skipOnboarding: jest.fn(),
}));

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
});

