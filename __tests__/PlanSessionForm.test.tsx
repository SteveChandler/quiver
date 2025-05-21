import { render, screen, fireEvent } from "@testing-library/react";
import { PlanSessionForm } from "@/components/plan-session-form";
import { renderWithAppRouter } from "../test-utils/test-utils";
import {
  mockUseSearchParams,
  resetMockRouter,
} from "../test-utils/nextNavigation";

// Mock the ForecastCard component
jest.mock("@/components/forecast-card", () => ({
  ForecastCard: () => <div data-testid="forecast-card">Forecast Card</div>,
}));

// Mock session actions
jest.mock("@/actions/session-actions", () => ({
  createPlannedSession: jest.fn(),
  createLoggedSession: jest.fn(),
  getUserBoards: jest.fn().mockResolvedValue([]),
  getBeaches: jest.fn().mockResolvedValue([]),
}));

describe("PlanSessionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockRouter();
  });

  describe("Plan Mode", () => {
    it("renders the plan session form with title", () => {
      renderWithAppRouter(<PlanSessionForm mode="plan" />);

      expect(
        screen.getByRole("heading", { name: /Plan Session/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Ready to catch some waves/i)
      ).toBeInTheDocument();
    });

    it("renders the beach selection step as first step", () => {
      renderWithAppRouter(<PlanSessionForm mode="plan" />);

      expect(
        screen.getByText(/Which beach are you heading to/i)
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Search or select from your favorites/i)
      ).toBeInTheDocument();
    });

    it("includes progression steps and next button", () => {
      renderWithAppRouter(<PlanSessionForm mode="plan" />);

      // Check for progression steps
      const firstStep = screen.getByText("1");
      expect(firstStep).toBeInTheDocument();

      // Next button should be available
      const nextButton = screen.getByRole("button", { name: /Next/i });
      expect(nextButton).toBeInTheDocument();
    });

    it("has a form element", () => {
      const { container } = renderWithAppRouter(
        <PlanSessionForm mode="plan" />
      );

      // Find the form element directly
      const formElement = container.querySelector("form");
      expect(formElement).toBeInTheDocument();
    });
  });

  describe("Log Mode", () => {
    it("renders the log session form with title", () => {
      renderWithAppRouter(<PlanSessionForm mode="log" />);

      expect(
        screen.getByRole("heading", { name: /Log Session/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Ready to catch some waves/i)
      ).toBeInTheDocument();
    });

    it("renders the beach selection step as first step in log mode", () => {
      renderWithAppRouter(<PlanSessionForm mode="log" />);

      expect(
        screen.getByText(/Which beach are you heading to/i)
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Search or select from your favorites/i)
      ).toBeInTheDocument();
    });

    it("displays the correct number of steps based on mode", () => {
      const { container } = renderWithAppRouter(<PlanSessionForm mode="log" />);

      // Log mode should have more steps than plan mode (5 steps shown in progress bar)
      const steps = container.querySelectorAll(".rounded-full.h-8.w-8");
      expect(steps.length).toBeGreaterThan(3); // At least 4 steps
    });
  });

  describe("Mode Detection", () => {
    it("uses the mode from props if searchParams is not specified", () => {
      mockUseSearchParams(null);
      renderWithAppRouter(<PlanSessionForm mode="plan" />);

      expect(
        screen.getByRole("heading", { name: /Plan Session/i })
      ).toBeInTheDocument();
    });

    it("uses mode from searchParams if specified", () => {
      mockUseSearchParams("log");
      renderWithAppRouter(<PlanSessionForm mode="plan" />);

      expect(
        screen.getByRole("heading", { name: /Log Session/i })
      ).toBeInTheDocument();
    });
  });
});
