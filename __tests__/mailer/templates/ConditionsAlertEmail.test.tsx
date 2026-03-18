/**
 * Tests for ConditionsAlertEmail component
 *
 * @module __tests__/mailer/templates/ConditionsAlertEmail
 */

import { render, screen } from "@testing-library/react";
import {
  ConditionsAlertEmail,
  type ConditionsAlertEmailProps,
} from "@/lib/mailer/templates/ConditionsAlertEmail";

// Mock the email formatters module
jest.mock("@/lib/email/email-formatters", () => ({
  getConditionLabel: jest.fn((score: number) => {
    if (score >= 85) {
      return { label: "Perfect", color: "#10b981", emoji: "🔥" };
    } else if (score >= 70) {
      return { label: "Excellent", color: "#3b82f6", emoji: "✨" };
    } else {
      return { label: "Good", color: "#22c55e", emoji: "🌊" };
    }
  }),
}));

// Helper factory
function makeProps(
  overrides: Partial<ConditionsAlertEmailProps> = {}
): ConditionsAlertEmailProps {
  return {
    displayName: "John",
    beachName: "Black's Beach",
    conditionsScore: 80,
    surfDescription: "Clean 4-6ft sets",
    windDescription: "Light offshore 5-10mph",
    bestWindow: { start: "6:00 AM", end: "10:00 AM" },
    ctaUrl: "https://quiversurf.app/beach/blacks",
    logSessionUrl: "https://quiversurf.app/sessions/new",
    unsubscribeUrl: "https://quiversurf.app/profile/notifications",
    ...overrides,
  };
}

describe("ConditionsAlertEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Greeting", () => {
    it("renders personalized greeting when displayName provided", () => {
      const props = makeProps({ displayName: "Sarah" });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Hey Sarah!")).toBeInTheDocument();
    });

    it("renders generic greeting when displayName is null", () => {
      const props = makeProps({ displayName: null });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Hey there!")).toBeInTheDocument();
    });
  });

  describe("Score Badge", () => {
    it("displays score 80 directly", () => {
      const props = makeProps({ conditionsScore: 80 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("80")).toBeInTheDocument();
    });

    it("displays score 90 directly", () => {
      const props = makeProps({ conditionsScore: 90 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("90")).toBeInTheDocument();
    });

    it("displays score 75 directly", () => {
      const props = makeProps({ conditionsScore: 75 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("75")).toBeInTheDocument();
    });

    it("displays score 100 directly", () => {
      const props = makeProps({ conditionsScore: 100 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("displays score 50 directly", () => {
      const props = makeProps({ conditionsScore: 50 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("50")).toBeInTheDocument();
    });
  });

  describe("Condition Label", () => {
    it("renders 'Perfect Conditions' for score 90", () => {
      const props = makeProps({ conditionsScore: 90 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Perfect Conditions")).toBeInTheDocument();
    });

    it("renders 'Excellent Conditions' for score 80", () => {
      const props = makeProps({ conditionsScore: 80 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Excellent Conditions")).toBeInTheDocument();
    });

    it("renders 'Good Conditions' for score 60", () => {
      const props = makeProps({ conditionsScore: 60 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Good Conditions")).toBeInTheDocument();
    });

    it("renders 'Good Conditions' for score 50", () => {
      const props = makeProps({ conditionsScore: 50 });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Good Conditions")).toBeInTheDocument();
    });
  });

  describe("Motivational Copy", () => {
    it("displays top-tier copy for score >= 85", () => {
      const props = makeProps({ conditionsScore: 90 });
      render(<ConditionsAlertEmail {...props} />);

      expect(
        screen.getByText(
          /This is as good as it gets\. Drop what you're doing\./i
        )
      ).toBeInTheDocument();
    });

    it("displays high-tier copy for score >= 70", () => {
      const props = makeProps({ conditionsScore: 80 });
      render(<ConditionsAlertEmail {...props} />);

      expect(
        screen.getByText(
          /Conditions are dialed\. Worth rearranging your schedule\./i
        )
      ).toBeInTheDocument();
    });

    it("displays standard copy for score < 70", () => {
      const props = makeProps({ conditionsScore: 60 });
      render(<ConditionsAlertEmail {...props} />);

      expect(
        screen.getByText(
          /Solid conditions today\. A good day to shake off the rust\./i
        )
      ).toBeInTheDocument();
    });

    it("displays standard copy for score 50", () => {
      const props = makeProps({ conditionsScore: 50 });
      render(<ConditionsAlertEmail {...props} />);

      expect(
        screen.getByText(
          /Solid conditions today\. A good day to shake off the rust\./i
        )
      ).toBeInTheDocument();
    });
  });

  describe("Conditional Surf Row", () => {
    it("shows surf row when surfDescription provided", () => {
      const props = makeProps({ surfDescription: "Clean 4-6ft sets" });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Waves")).toBeInTheDocument();
      expect(screen.getByText("Clean 4-6ft sets")).toBeInTheDocument();
    });

    it("hides surf row when surfDescription is null", () => {
      const props = makeProps({ surfDescription: null });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.queryByText("Waves")).not.toBeInTheDocument();
    });
  });

  describe("Conditional Wind Row", () => {
    it("shows wind row when windDescription provided", () => {
      const props = makeProps({ windDescription: "Light offshore 5-10mph" });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Wind")).toBeInTheDocument();
      expect(screen.getByText("Light offshore 5-10mph")).toBeInTheDocument();
    });

    it("hides wind row when windDescription is null", () => {
      const props = makeProps({ windDescription: null });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.queryByText("Wind")).not.toBeInTheDocument();
    });
  });

  describe("Conditional Best Window Row", () => {
    it("shows best window row when bestWindow provided", () => {
      const props = makeProps({
        bestWindow: { start: "6:00 AM", end: "10:00 AM" },
      });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Best Window")).toBeInTheDocument();
      expect(screen.getByText("6:00 AM - 10:00 AM")).toBeInTheDocument();
    });

    it("displays correct time format for afternoon window", () => {
      const props = makeProps({
        bestWindow: { start: "2:00 PM", end: "5:00 PM" },
      });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("2:00 PM - 5:00 PM")).toBeInTheDocument();
    });

    it("hides best window row when bestWindow is null", () => {
      const props = makeProps({ bestWindow: null });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.queryByText("Best Window")).not.toBeInTheDocument();
    });
  });

  describe("CTA Links", () => {
    it("renders 'Check Full Forecast' link with correct URL", () => {
      const props = makeProps({
        ctaUrl: "https://quiversurf.app/beach/blacks",
      });
      render(<ConditionsAlertEmail {...props} />);

      const link = screen.getByText(/Check Full Forecast/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://quiversurf.app/beach/blacks"
      );
    });

    it("renders 'Log Your Session' link with correct URL", () => {
      const props = makeProps({
        logSessionUrl: "https://quiversurf.app/sessions/new",
      });
      render(<ConditionsAlertEmail {...props} />);

      const link = screen.getByText(/Log Your Session/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://quiversurf.app/sessions/new"
      );
    });
  });

  describe("Unsubscribe Link", () => {
    it("renders 'Manage notification preferences' link with correct URL", () => {
      const props = makeProps({
        unsubscribeUrl: "https://quiversurf.app/profile/notifications",
      });
      render(<ConditionsAlertEmail {...props} />);

      const link = screen.getByText(/Manage notification preferences/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://quiversurf.app/profile/notifications"
      );
    });
  });

  describe("Beach Name Display", () => {
    it("displays beach name in header", () => {
      const props = makeProps({ beachName: "Swami's" });
      render(<ConditionsAlertEmail {...props} />);

      // Header shows beach name with emoji
      const header = screen.getByRole("heading", { level: 1 });
      expect(header.textContent).toMatch(/Swami's/);
    });

    it("displays beach name in footer text", () => {
      const props = makeProps({ beachName: "Trestles" });
      render(<ConditionsAlertEmail {...props} />);

      expect(
        screen.getByText(/forecast alerts enabled for Trestles/i)
      ).toBeInTheDocument();
    });

    it("handles beach names with special characters", () => {
      const props = makeProps({ beachName: "La Jolla Shores" });
      render(<ConditionsAlertEmail {...props} />);

      const header = screen.getByRole("heading", { level: 1 });
      expect(header.textContent).toMatch(/La Jolla Shores/);
    });
  });

  describe("Conditions Table Rendering", () => {
    it("renders all three rows when all descriptions provided", () => {
      const props = makeProps({
        surfDescription: "Clean 4-6ft sets",
        windDescription: "Light offshore 5-10mph",
        bestWindow: { start: "6:00 AM", end: "10:00 AM" },
      });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Waves")).toBeInTheDocument();
      expect(screen.getByText("Wind")).toBeInTheDocument();
      expect(screen.getByText("Best Window")).toBeInTheDocument();
    });

    it("renders only surf row when only surfDescription provided", () => {
      const props = makeProps({
        surfDescription: "Clean 4-6ft sets",
        windDescription: null,
        bestWindow: null,
      });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.getByText("Waves")).toBeInTheDocument();
      expect(screen.queryByText("Wind")).not.toBeInTheDocument();
      expect(screen.queryByText("Best Window")).not.toBeInTheDocument();
    });

    it("renders no table when all descriptions null", () => {
      const props = makeProps({
        surfDescription: null,
        windDescription: null,
        bestWindow: null,
      });
      render(<ConditionsAlertEmail {...props} />);

      expect(screen.queryByText("Waves")).not.toBeInTheDocument();
      expect(screen.queryByText("Wind")).not.toBeInTheDocument();
      expect(screen.queryByText("Best Window")).not.toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("renders complete email with all data", () => {
      const props = makeProps();
      render(<ConditionsAlertEmail {...props} />);

      // Greeting
      expect(screen.getByText("Hey John!")).toBeInTheDocument();

      // Score and condition
      expect(screen.getByText("80")).toBeInTheDocument();
      expect(screen.getByText("Excellent Conditions")).toBeInTheDocument();

      // Motivational copy
      expect(
        screen.getByText(
          /Conditions are dialed\. Worth rearranging your schedule\./i
        )
      ).toBeInTheDocument();

      // Conditions table
      expect(screen.getByText("Clean 4-6ft sets")).toBeInTheDocument();
      expect(screen.getByText("Light offshore 5-10mph")).toBeInTheDocument();
      expect(screen.getByText("6:00 AM - 10:00 AM")).toBeInTheDocument();

      // CTAs
      expect(screen.getByText(/Check Full Forecast/i)).toBeInTheDocument();
      expect(screen.getByText(/Log Your Session/i)).toBeInTheDocument();

      // Footer
      expect(
        screen.getByText(/forecast alerts enabled for Black's Beach/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Manage notification preferences/i)
      ).toBeInTheDocument();
    });

    it("renders minimal email with only required data", () => {
      const props = makeProps({
        displayName: null,
        surfDescription: null,
        windDescription: null,
        bestWindow: null,
      });
      render(<ConditionsAlertEmail {...props} />);

      // Generic greeting
      expect(screen.getByText("Hey there!")).toBeInTheDocument();

      // Score and condition still present
      expect(screen.getByText("80")).toBeInTheDocument();
      expect(screen.getByText("Excellent Conditions")).toBeInTheDocument();

      // CTAs still present
      expect(screen.getByText(/Check Full Forecast/i)).toBeInTheDocument();
      expect(screen.getByText(/Log Your Session/i)).toBeInTheDocument();

      // No conditions table
      expect(screen.queryByText("Waves")).not.toBeInTheDocument();
      expect(screen.queryByText("Wind")).not.toBeInTheDocument();
      expect(screen.queryByText("Best Window")).not.toBeInTheDocument();
    });
  });
});
