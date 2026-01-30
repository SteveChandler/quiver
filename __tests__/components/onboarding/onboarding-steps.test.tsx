import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileStep } from "@/components/onboarding/steps/profile-step";
import { HomeBeachStep } from "@/components/onboarding/steps/home-beach-step";
import { ExperienceStep } from "@/components/onboarding/steps/experience-step";
import { WavePreferencesStep } from "@/components/onboarding/steps/wave-preferences-step";
import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";
import { CompletionStep } from "@/components/onboarding/steps/completion-step";
import { useOnboardingStore } from "@/store/onboarding-store";

// Mock the store
jest.mock("@/store/onboarding-store");
const mockUseOnboardingStore = useOnboardingStore as unknown as jest.Mock;

// Mock global fetch for HomeBeachStep and CompletionStep
global.fetch = jest.fn();

// Mock profile context for CompletionStep
jest.mock("@/context/profile-context", () => ({
  useProfileContext: () => ({ updateProfile: jest.fn() }),
}));

// Mock onboarding actions for CompletionStep
// Note: The actual response is wrapped by withAuthenticatedAction which returns
// { success: true, data: { success: true, profile: {...} } }
jest.mock("@/actions/onboarding-actions", () => ({
  saveOnboardingData: jest
    .fn()
    .mockResolvedValue({ success: true, data: { success: true, profile: {} } }),
}));

describe("Onboarding Step Components", () => {
  const mockUpdateData = jest.fn();
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn();

  // Default store state
  const defaultStore = {
    data: {},
    updateData: mockUpdateData,
    nextStep: mockNextStep,
    prevStep: mockPrevStep,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOnboardingStore.mockReturnValue(defaultStore);
  });

  describe("ProfileStep", () => {
    it("renders the profile form correctly", () => {
      render(<ProfileStep />);

      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).toBeInTheDocument();
    });

    it("pre-fills data from store", () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: { fullName: "Existing User", displayName: "ExistingDisplay" },
      });

      render(<ProfileStep />);

      expect(screen.getByLabelText(/Full Name/i)).toHaveValue("Existing User");
      expect(screen.getByLabelText(/Display Name/i)).toHaveValue(
        "ExistingDisplay"
      );
    });

    it("renders form fields with correct placeholder text", () => {
      render(<ProfileStep />);

      expect(
        screen.getByPlaceholderText(/e.g., Sarah Johnson/i)
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/e.g., WaveRider/i)
      ).toBeInTheDocument();
    });

    it("displays helper text for display name", () => {
      render(<ProfileStep />);

      expect(
        screen.getByText(/This is how you'll appear to other surfers/i)
      ).toBeInTheDocument();
    });

    // Note: Validation tests that interact with react-hook-form Controller are skipped
    // due to Jest/JSDOM environment limitations with zodResolver.
    // These behaviors are verified in E2E tests (e2e/onboarding.spec.ts).
  });

  describe("HomeBeachStep", () => {
    it("renders search input", () => {
      render(<HomeBeachStep />);
      expect(
        screen.getByPlaceholderText(/e.g., Malibu, Pipeline, Rincon/i)
      ).toBeInTheDocument();
    });

    it("renders continue button", () => {
      render(<HomeBeachStep />);
      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).toBeInTheDocument();
    });

    it("calls prevStep when back button is clicked", async () => {
      const user = userEvent.setup();
      render(<HomeBeachStep />);

      const backBtn = screen.getByRole("button", { name: /Back/i });
      await user.click(backBtn);

      expect(mockPrevStep).toHaveBeenCalled();
    });

    // Note: Search and selection tests involve complex async interactions
    // that work differently in Jest/JSDOM vs real browser.
    // Full flow tested in E2E (e2e/onboarding.spec.ts).
  });

  describe("ExperienceStep", () => {
    it("renders experience level cards", () => {
      render(<ExperienceStep />);
      expect(screen.getByText(/What's your experience/i)).toBeInTheDocument();
      expect(screen.getByTestId("experience-beginner")).toBeInTheDocument();
      expect(screen.getByTestId("experience-intermediate")).toBeInTheDocument();
      expect(screen.getByTestId("experience-advanced")).toBeInTheDocument();
      expect(screen.getByTestId("experience-expert")).toBeInTheDocument();
    });

    it("renders continue and back buttons", () => {
      render(<ExperienceStep />);
      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    });

    it("calls prevStep when back button is clicked", async () => {
      const user = userEvent.setup();
      render(<ExperienceStep />);

      const backBtn = screen.getByRole("button", { name: /Back/i });
      await user.click(backBtn);

      expect(mockPrevStep).toHaveBeenCalled();
    });

    it("selects an experience level and enables continue", async () => {
      const user = userEvent.setup();
      render(<ExperienceStep />);

      const intermediateCard = screen.getByTestId("experience-intermediate");
      await user.click(intermediateCard);

      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).not.toBeDisabled();
    });
  });

  describe("WavePreferencesStep", () => {
    it("renders wave size and break type sections", () => {
      render(<WavePreferencesStep />);
      expect(screen.getByText(/What waves do you prefer/i)).toBeInTheDocument();
      expect(screen.getByText(/Wave Size/i)).toBeInTheDocument();
      expect(screen.getByText(/Break Type/i)).toBeInTheDocument();
      expect(screen.getByText(/Surf Styles/i)).toBeInTheDocument();
    });

    it("renders continue and back buttons", () => {
      render(<WavePreferencesStep />);
      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    });

    it("calls prevStep when back button is clicked", async () => {
      const user = userEvent.setup();
      render(<WavePreferencesStep />);

      const backBtn = screen.getByRole("button", { name: /Back/i });
      await user.click(backBtn);

      expect(mockPrevStep).toHaveBeenCalled();
    });

    it("requires at least one surf style to continue", () => {
      render(<WavePreferencesStep />);
      // Continue should be disabled initially (no surf styles selected)
      expect(screen.getByRole("button", { name: /Continue/i })).toBeDisabled();
    });

    it("enables continue when surf style is selected", async () => {
      const user = userEvent.setup();
      render(<WavePreferencesStep />);

      const shortboardBtn = screen.getByTestId("surf-style-shortboard");
      await user.click(shortboardBtn);

      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).not.toBeDisabled();
    });
  });

  describe("WelcomeStep", () => {
    it("renders welcome content correctly", () => {
      render(<WelcomeStep />);

      expect(screen.getByTestId("welcome-step")).toBeInTheDocument();
      expect(screen.getByTestId("welcome-logo")).toBeInTheDocument();
      expect(screen.getByText(/Welcome to Quiver/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Your personal surf companion/i)
      ).toBeInTheDocument();
    });

    it("renders Get Started button", () => {
      render(<WelcomeStep />);

      expect(screen.getByTestId("welcome-get-started")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Get Started/i })
      ).toBeInTheDocument();
    });

    it("calls nextStep when Get Started is clicked", async () => {
      const user = userEvent.setup();
      render(<WelcomeStep />);

      await user.click(screen.getByTestId("welcome-get-started"));

      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  describe("CompletionStep", () => {
    const mockCompleteOnboarding = jest.fn();

    beforeEach(() => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        completeOnboarding: mockCompleteOnboarding,
      });
    });

    it("renders completion content correctly", () => {
      render(<CompletionStep />);

      expect(screen.getByTestId("completion-step")).toBeInTheDocument();
      expect(screen.getByText(/You're all set/i)).toBeInTheDocument();
      expect(screen.getByText(/\+100 XP earned/i)).toBeInTheDocument();
    });

    it("renders View Full Forecast button", () => {
      render(<CompletionStep />);

      expect(
        screen.getByTestId("complete-onboarding-button")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /View Full Forecast/i })
      ).toBeInTheDocument();
    });

    it("shows personalized welcome when fullName is set", () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: { fullName: "John Doe" },
        completeOnboarding: mockCompleteOnboarding,
      });
      render(<CompletionStep />);

      expect(screen.getByText(/Welcome, John/i)).toBeInTheDocument();
    });

    it("shows forecast preview section when home beach is set", () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: { homeBeachId: "beach-123", homeBeachName: "Malibu" },
        completeOnboarding: mockCompleteOnboarding,
      });
      render(<CompletionStep />);

      expect(screen.getByText(/Today at Malibu/i)).toBeInTheDocument();
    });

    // Note: Save flow and async operations tested in E2E
  });
});
