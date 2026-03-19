import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeBeachStep } from "@/components/onboarding/steps/home-beach-step";
import { LevelAndTimeStep } from "@/components/onboarding/steps/level-and-time-step";
import { PayoffStep } from "@/components/onboarding/steps/payoff-step";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useProfileContext } from "@/context/profile-context";
import { useForecastPreview } from "@/hooks/use-forecast-preview";
import { saveOnboardingData } from "@/actions/onboarding-actions";
import { data as dataClient } from "@/lib/data/client";
import { getLocalDateString } from "@/lib/utils/timezone-utils";
import { toast } from "sonner";

// Mock the store
jest.mock("@/store/onboarding-store");
const mockUseOnboardingStore = useOnboardingStore as unknown as jest.Mock;

// Mock global fetch for HomeBeachStep
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response)
);

// Mock dependencies for PayoffStep
jest.mock("@/context/profile-context", () => ({
  useProfileContext: () => ({ updateProfile: jest.fn() }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

jest.mock("@/hooks/use-forecast-preview");
const mockUseForecastPreview = useForecastPreview as jest.Mock;

jest.mock("@/actions/onboarding-actions");
const mockSaveOnboardingData = saveOnboardingData as jest.Mock;

jest.mock("@/lib/data/client", () => ({
  data: {
    intel: {
      getDaily: jest.fn(),
    },
  },
}));
const mockGetDaily = dataClient.intel.getDaily as jest.Mock;

jest.mock("@/lib/utils/timezone-utils");
const mockGetLocalDateString = getLocalDateString as jest.Mock;

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true, // Disable animations in tests
}));

jest.mock("canvas-confetti", () => jest.fn());

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

describe("Onboarding Step Components - New 3-Step Flow", () => {
  const mockUpdateData = jest.fn();
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn();
  const mockCompleteOnboarding = jest.fn();

  const mockCloseDialog = jest.fn();

  // Default store state
  const defaultStore = {
    data: {},
    updateData: mockUpdateData,
    nextStep: mockNextStep,
    prevStep: mockPrevStep,
    completeOnboarding: mockCompleteOnboarding,
    closeDialog: mockCloseDialog,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOnboardingStore.mockReturnValue(defaultStore);
    mockUseForecastPreview.mockReturnValue({
      forecastPreview: null,
      loading: false,
    });
    mockGetLocalDateString.mockReturnValue("2026-02-10");
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

    it("calls closeDialog when skip for now button is clicked", async () => {
      const user = userEvent.setup();
      render(<HomeBeachStep />);

      const skipBtn = screen.getByRole("button", { name: /Skip for now/i });
      await user.click(skipBtn);

      expect(mockCloseDialog).toHaveBeenCalled();
    });

    // Note: Search and selection tests involve complex async interactions
    // that work differently in Jest/JSDOM vs real browser.
    // Full flow tested in E2E (e2e/onboarding.spec.ts).
  });

  describe("LevelAndTimeStep", () => {
    it("renders both sections (experience level and time)", () => {
      render(<LevelAndTimeStep />);

      expect(
        screen.getByText(/What kind of surfer\??/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/When do you surf\?/i)).toBeInTheDocument();
    });

    it("renders all 4 experience level options", () => {
      render(<LevelAndTimeStep />);

      expect(screen.getByText("Beginner")).toBeInTheDocument();
      expect(screen.getByText("Intermediate")).toBeInTheDocument();
      expect(screen.getByText("Advanced")).toBeInTheDocument();
      expect(screen.getByText("Expert")).toBeInTheDocument();
    });

    it("renders all 3 time preference options", () => {
      render(<LevelAndTimeStep />);

      expect(screen.getByText("Dawn Patrol")).toBeInTheDocument();
      expect(screen.getByText("After Work")).toBeInTheDocument();
      expect(screen.getByText("Weekends")).toBeInTheDocument();
    });

    it("renders Back, Skip, and Continue buttons", () => {
      render(<LevelAndTimeStep />);

      expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Skip/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Continue/i })
      ).toBeInTheDocument();
    });

    it("clicking Skip calls nextStep without calling updateData", async () => {
      const user = userEvent.setup();
      render(<LevelAndTimeStep />);

      const skipBtn = screen.getByRole("button", { name: /Skip/i });
      await user.click(skipBtn);

      expect(mockNextStep).toHaveBeenCalled();
      expect(mockUpdateData).not.toHaveBeenCalled();
    });

    it("clicking Back calls prevStep", async () => {
      const user = userEvent.setup();
      render(<LevelAndTimeStep />);

      const backBtn = screen.getByRole("button", { name: /Back/i });
      await user.click(backBtn);

      expect(mockPrevStep).toHaveBeenCalled();
    });

    it("selecting a level and clicking Continue calls updateData with experienceLevel then nextStep", async () => {
      const user = userEvent.setup();
      render(<LevelAndTimeStep />);

      // Select intermediate level
      const intermediateBtn = screen.getByText("Intermediate").closest("button");
      if (intermediateBtn) {
        await user.click(intermediateBtn);
      }

      const continueBtn = screen.getByRole("button", { name: /Continue/i });
      await user.click(continueBtn);

      expect(mockUpdateData).toHaveBeenCalledWith({
        experienceLevel: "intermediate",
        preferredTime: undefined,
      });
      expect(mockNextStep).toHaveBeenCalled();
    });

    it("selecting a time and clicking Continue calls updateData with preferredTime then nextStep", async () => {
      const user = userEvent.setup();
      render(<LevelAndTimeStep />);

      // Select dawn patrol
      const dawnBtn = screen.getByText("Dawn Patrol").closest("button");
      if (dawnBtn) {
        await user.click(dawnBtn);
      }

      const continueBtn = screen.getByRole("button", { name: /Continue/i });
      await user.click(continueBtn);

      expect(mockUpdateData).toHaveBeenCalledWith({
        experienceLevel: undefined,
        preferredTime: "dawn",
      });
      expect(mockNextStep).toHaveBeenCalled();
    });

    it("pre-fills from store data", () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          experienceLevel: "intermediate",
          preferredTime: "dawn",
        },
      });

      render(<LevelAndTimeStep />);

      // Check that selected items have the ocean-blue border class
      const intermediateBtn = screen.getByText("Intermediate").closest("button");
      const dawnBtn = screen.getByText("Dawn Patrol").closest("button");

      expect(intermediateBtn?.className).toContain("border-[#F78E42]");
      expect(dawnBtn?.className).toContain("border-[#F78E42]");
    });

    it("Continue without any selection still calls nextStep (acts like skip)", async () => {
      const user = userEvent.setup();
      render(<LevelAndTimeStep />);

      const continueBtn = screen.getByRole("button", { name: /Continue/i });
      await user.click(continueBtn);

      expect(mockNextStep).toHaveBeenCalled();
    });

    it("selecting both level and time then clicking Continue updates both", async () => {
      const user = userEvent.setup();
      render(<LevelAndTimeStep />);

      // Select advanced level
      const advancedBtn = screen.getByText("Advanced").closest("button");
      if (advancedBtn) {
        await user.click(advancedBtn);
      }

      // Select weekends
      const weekendsBtn = screen.getByText("Weekends").closest("button");
      if (weekendsBtn) {
        await user.click(weekendsBtn);
      }

      const continueBtn = screen.getByRole("button", { name: /Continue/i });
      await user.click(continueBtn);

      expect(mockUpdateData).toHaveBeenCalledWith({
        experienceLevel: "advanced",
        preferredTime: "weekends",
      });
      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  describe("PayoffStep", () => {
    beforeEach(() => {
      // Default successful save response
      mockSaveOnboardingData.mockResolvedValue({
        success: true,
        data: { success: true, profile: { id: "user-123" } },
      });

      // Default no intel
      mockGetDaily.mockResolvedValue(null);
    });

    it("renders payoff-step test ID", () => {
      render(<PayoffStep />);
      expect(screen.getByTestId("payoff-step")).toBeInTheDocument();
    });

    it("shows loading skeleton initially", () => {
      render(<PayoffStep />);

      // Check for loading skeletons (animated pulse divs)
      const container = screen.getByTestId("payoff-step");
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows beach name from store data", async () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Pipeline",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(screen.getByText(/You're set up for Pipeline/i)).toBeInTheDocument();
      });
    });

    it("shows Your Best Window card when intel resolves with data", async () => {
      const mockIntel = {
        best_window_start: "06:00:00",
        best_window_end: "09:00:00",
        best_window_description: "Perfect offshore winds",
        conditions_score: 8,
        surf_min_ft: 3,
        surf_max_ft: 5,
        wind_quality: "offshore",
        wind_speed_mph: 10,
      };

      mockGetDaily.mockResolvedValue(mockIntel);

      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Pipeline",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(screen.getByText(/Your Best Window/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Perfect offshore winds/i)).toBeInTheDocument();
      });

      // Score is rendered via AnimatedScore (spring animation) — in JSDOM it stays at 0
      // Just verify the score display structure exists
      await waitFor(() => {
        expect(screen.getByText(/\/10/i)).toBeInTheDocument();
      });
    });

    it("shows fallback forecast card when no intel but forecastPreview available", async () => {
      mockUseForecastPreview.mockReturnValue({
        forecastPreview: {
          wave_height: "3-5 ft",
          wind_speed: "10 mph",
          wind_direction: "offshore",
        },
        loading: false,
      });

      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(screen.getByText(/Today's Conditions/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/3-5 ft/i)).toBeInTheDocument();
      });
    });

    it("shows no-data card when neither intel nor forecast available", async () => {
      mockUseForecastPreview.mockReturnValue({
        forecastPreview: null,
        loading: false,
      });

      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(
          screen.getByText(/Your personalized forecast is ready on the home page/i)
        ).toBeInTheDocument();
      });
    });

    it("shows XP badge after loading", async () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(screen.getByText(/\+100 XP/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Kook/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Welcome to the surf community/i)
        ).toBeInTheDocument();
      });
    });

    it("shows CTA button after loading", async () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /See your full forecast/i })
        ).toBeInTheDocument();
      });
    });

    it("calls saveOnboardingData on mount", async () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(mockSaveOnboardingData).toHaveBeenCalledWith({
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        });
      });
    });

    it("shows complete-onboarding-button test ID on CTA", async () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(
          screen.getByTestId("complete-onboarding-button")
        ).toBeInTheDocument();
      });
    });

    it("shows error toast when save fails", async () => {
      mockSaveOnboardingData.mockResolvedValue({
        success: false,
        error: "Database error",
      });

      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Database error")
        );
      });
    });

    it("fetches daily intel with correct parameters", async () => {
      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-456",
          homeBeachName: "Rincon",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        expect(mockGetDaily).toHaveBeenCalledWith("beach-456", "2026-02-10");
      });
    });

    it("displays formatted time from intel best window", async () => {
      const mockIntel = {
        best_window_start: "06:00:00",
        best_window_end: "09:00:00",
      };

      mockGetDaily.mockResolvedValue(mockIntel);

      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Pipeline",
        },
      });

      render(<PayoffStep />);

      await waitFor(() => {
        // Time formatting is locale-dependent, just check that times are displayed
        const timeElements = screen.getAllByText(/AM|PM/i);
        expect(timeElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("completes onboarding and navigates to home beach when slug data available", async () => {
      const mockPush = jest.fn();
      const mockRefresh = jest.fn();

      jest.spyOn(require("next/navigation"), "useRouter").mockReturnValue({
        push: mockPush,
        refresh: mockRefresh,
      });

      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
          homeBeachSlug: "malibu-surfrider",
          homeBeachCity: "Malibu",
          homeBeachState: "CA",
        },
      });

      const user = userEvent.setup();
      render(<PayoffStep />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /See your full forecast/i })
        ).toBeInTheDocument();
      });

      const ctaButton = screen.getByRole("button", {
        name: /See your full forecast/i,
      });
      await user.click(ctaButton);

      await waitFor(() => {
        expect(mockCompleteOnboarding).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/ca/malibu/malibu-surfrider");
      });

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Welcome to Quiver!");
      });
    });

    it("falls back to home forecast tab when beach slug data is missing", async () => {
      const mockPush = jest.fn();
      const mockRefresh = jest.fn();

      jest.spyOn(require("next/navigation"), "useRouter").mockReturnValue({
        push: mockPush,
        refresh: mockRefresh,
      });

      mockUseOnboardingStore.mockReturnValue({
        ...defaultStore,
        data: {
          homeBeachId: "beach-123",
          homeBeachName: "Malibu",
          // No slug/city/state — should fall back
        },
      });

      const user = userEvent.setup();
      render(<PayoffStep />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /See your full forecast/i })
        ).toBeInTheDocument();
      });

      const ctaButton = screen.getByRole("button", {
        name: /See your full forecast/i,
      });
      await user.click(ctaButton);

      await waitFor(() => {
        expect(mockCompleteOnboarding).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/?tab=forecast");
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Welcome to Quiver!");
      });
    });
  });
});
