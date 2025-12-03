import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileStep } from "@/components/onboarding/steps/profile-step";
import { HomeBeachStep } from "@/components/onboarding/steps/home-beach-step";
import { PreferencesStep } from "@/components/onboarding/steps/preferences-step";
import { useOnboardingStore } from "@/store/onboarding-store";

// Mock the store
jest.mock("@/store/onboarding-store");
const mockUseOnboardingStore = useOnboardingStore as unknown as jest.Mock;

// Mock global fetch for HomeBeachStep
global.fetch = jest.fn();

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

  describe("PreferencesStep", () => {
    it("renders experience level section", () => {
      render(<PreferencesStep />);
      // Use getAllByText since label and select option both contain the text
      const experienceLevelElements = screen.getAllByText(/Experience Level/i);
      expect(experienceLevelElements.length).toBeGreaterThan(0);
    });

    it("renders surf styles section", () => {
      render(<PreferencesStep />);
      expect(screen.getByText(/Surf Styles/i)).toBeInTheDocument();
    });

    it("renders optional preference sections", () => {
      render(<PreferencesStep />);
      // Use getAllByText since label and select option both contain the text
      const waveSizeElements = screen.getAllByText(/Preferred Wave Size/i);
      const breakTypeElements = screen.getAllByText(/Preferred Break Type/i);
      expect(waveSizeElements.length).toBeGreaterThan(0);
      expect(breakTypeElements.length).toBeGreaterThan(0);
    });

    it("renders continue and back buttons", () => {
      render(<PreferencesStep />);
      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    });

    it("calls prevStep when back button is clicked", async () => {
      const user = userEvent.setup();
      render(<PreferencesStep />);

      const backBtn = screen.getByRole("button", { name: /Back/i });
      await user.click(backBtn);

      expect(mockPrevStep).toHaveBeenCalled();
    });

    // Note: Form validation tests with react-hook-form Controller
    // are prone to Jest/JSDOM environment issues.
    // Full form validation tested in E2E (e2e/onboarding.spec.ts).
  });
});
