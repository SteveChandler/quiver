/**
 * Tests for SessionPromptEmail component
 *
 * @module __tests__/mailer/templates/SessionPromptEmail
 */

import { render, screen } from "@testing-library/react";
import {
  SessionPromptEmail,
  type SessionPromptEmailProps,
} from "@/lib/mailer/templates/SessionPromptEmail";

// Mock the email formatters module
jest.mock("@/lib/email/email-formatters", () => ({
  getConditionLabel: jest.fn((score: number) => {
    if (score >= 9) {
      return { label: "Perfect", color: "#10b981", emoji: "🔥" };
    } else if (score >= 8) {
      return { label: "Excellent", color: "#3b82f6", emoji: "✨" };
    } else {
      return { label: "Good", color: "#22c55e", emoji: "🌊" };
    }
  }),
}));

// Helper factory
function makeProps(
  overrides: Partial<SessionPromptEmailProps> = {}
): SessionPromptEmailProps {
  return {
    displayName: "John",
    beachName: "Black's Beach",
    conditionsScore: 8,
    surfDescription: "Clean 4-6ft sets",
    logSessionUrl: "https://quiversurf.app/sessions/new?beach=blacks",
    unsubscribeUrl: "https://quiversurf.app/profile/notifications",
    ...overrides,
  };
}

describe("SessionPromptEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Greeting", () => {
    it("renders personalized greeting when displayName provided", () => {
      const props = makeProps({ displayName: "Sarah" });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText("Hey Sarah!")).toBeInTheDocument();
    });

    it("renders generic greeting when displayName is null", () => {
      const props = makeProps({ displayName: null });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText("Hey there!")).toBeInTheDocument();
    });
  });

  describe("Beach Name Display", () => {
    it("displays beach name in content text", () => {
      const props = makeProps({ beachName: "Swami's" });
      render(<SessionPromptEmail {...props} />);

      // Beach name appears in <strong> tag
      expect(screen.getByText("Swami's")).toBeInTheDocument();
      expect(screen.getByText(/yesterday/i)).toBeInTheDocument();
    });

    it("displays beach name in footer text", () => {
      const props = makeProps({ beachName: "Trestles" });
      render(<SessionPromptEmail {...props} />);

      expect(
        screen.getByText(/forecast alerts enabled for Trestles/i)
      ).toBeInTheDocument();
    });

    it("handles beach names with special characters", () => {
      const props = makeProps({ beachName: "La Jolla Shores" });
      render(<SessionPromptEmail {...props} />);

      // Beach name appears in <strong> tag
      expect(screen.getByText("La Jolla Shores")).toBeInTheDocument();
      expect(screen.getByText(/yesterday/i)).toBeInTheDocument();
    });
  });

  describe("Condition Score Display", () => {
    it("displays condition score as X/10 format", () => {
      const props = makeProps({ conditionsScore: 8 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/\(8\/10\)/i)).toBeInTheDocument();
    });

    it("displays score 9 correctly", () => {
      const props = makeProps({ conditionsScore: 9 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/\(9\/10\)/i)).toBeInTheDocument();
    });

    it("displays score 7 correctly", () => {
      const props = makeProps({ conditionsScore: 7 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/\(7\/10\)/i)).toBeInTheDocument();
    });

    it("displays score 10 correctly", () => {
      const props = makeProps({ conditionsScore: 10 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/\(10\/10\)/i)).toBeInTheDocument();
    });

    it("displays score 5 correctly", () => {
      const props = makeProps({ conditionsScore: 5 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/\(5\/10\)/i)).toBeInTheDocument();
    });
  });

  describe("Condition Label", () => {
    it("uses lowercase condition label for score 9 (perfect)", () => {
      const props = makeProps({ conditionsScore: 9 });
      render(<SessionPromptEmail {...props} />);

      // Label is in <strong> tag
      expect(screen.getByText("perfect")).toBeInTheDocument();
      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
    });

    it("uses lowercase condition label for score 8 (excellent)", () => {
      const props = makeProps({ conditionsScore: 8 });
      render(<SessionPromptEmail {...props} />);

      // Label is in <strong> tag
      expect(screen.getByText("excellent")).toBeInTheDocument();
      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
    });

    it("uses lowercase condition label for score 7 (good)", () => {
      const props = makeProps({ conditionsScore: 7 });
      render(<SessionPromptEmail {...props} />);

      // Label is in <strong> tag
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
    });
  });

  describe("Conditional Surf Description", () => {
    it("appends surf description when provided", () => {
      const props = makeProps({ surfDescription: "Clean 4-6ft sets" });
      render(<SessionPromptEmail {...props} />);

      expect(
        screen.getByText(/Clean 4-6ft sets\./i)
      ).toBeInTheDocument();
    });

    it("appends different surf description correctly", () => {
      const props = makeProps({ surfDescription: "Choppy 2-3ft wind swell" });
      render(<SessionPromptEmail {...props} />);

      expect(
        screen.getByText(/Choppy 2-3ft wind swell\./i)
      ).toBeInTheDocument();
    });

    it("omits surf description when null", () => {
      const props = makeProps({ surfDescription: null });
      render(<SessionPromptEmail {...props} />);

      // Should not have extra description text after the score
      const paragraph = screen.getByText(/Conditions were looking/i);
      expect(paragraph.textContent).not.toMatch(/Clean/i);
      expect(paragraph.textContent).not.toMatch(/Choppy/i);
    });

    it("sentence ends correctly when surf description absent", () => {
      const props = makeProps({ surfDescription: null });
      render(<SessionPromptEmail {...props} />);

      // Should end with "...yesterday (8/10). If you got out there..."
      const text = screen.getByText(/yesterday \(8\/10\)\./i);
      expect(text).toBeInTheDocument();
    });
  });

  describe("CTA Link", () => {
    it("renders 'Log Your Session' link with correct URL", () => {
      const props = makeProps({
        logSessionUrl: "https://quiversurf.app/sessions/new?beach=blacks",
      });
      render(<SessionPromptEmail {...props} />);

      const link = screen.getByText(/Log Your Session/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://quiversurf.app/sessions/new?beach=blacks"
      );
    });

    it("handles session URL with different query parameters", () => {
      const props = makeProps({
        logSessionUrl:
          "https://quiversurf.app/sessions/new?beach=swamis&date=2026-02-10",
      });
      render(<SessionPromptEmail {...props} />);

      const link = screen.getByText(/Log Your Session/i);
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://quiversurf.app/sessions/new?beach=swamis&date=2026-02-10"
      );
    });
  });

  describe("Header Text", () => {
    it("displays 'How Was Your Session?' in header", () => {
      const props = makeProps();
      render(<SessionPromptEmail {...props} />);

      expect(
        screen.getByRole("heading", { name: /How Was Your Session\?/i })
      ).toBeInTheDocument();
    });
  });

  describe("Unsubscribe Link", () => {
    it("renders 'Manage notification preferences' link with correct URL", () => {
      const props = makeProps({
        unsubscribeUrl: "https://quiversurf.app/profile/notifications",
      });
      render(<SessionPromptEmail {...props} />);

      const link = screen.getByText(/Manage notification preferences/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://quiversurf.app/profile/notifications"
      );
    });
  });

  describe("Motivational Message", () => {
    it("displays community and forecast improvement message", () => {
      const props = makeProps();
      render(<SessionPromptEmail {...props} />);

      expect(
        screen.getByText(
          /Your session logs help the community and improve our forecasts\./i
        )
      ).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("renders complete email with all data", () => {
      const props = makeProps();
      render(<SessionPromptEmail {...props} />);

      // Header
      expect(
        screen.getByRole("heading", { name: /How Was Your Session\?/i })
      ).toBeInTheDocument();

      // Greeting
      expect(screen.getByText("Hey John!")).toBeInTheDocument();

      // Condition text with beach name and score
      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
      expect(screen.getByText("excellent")).toBeInTheDocument();
      expect(screen.getByText("Black's Beach")).toBeInTheDocument();
      expect(screen.getByText(/\(8\/10\)/i)).toBeInTheDocument();

      // Surf description
      expect(screen.getByText(/Clean 4-6ft sets\./i)).toBeInTheDocument();

      // Motivational message
      expect(
        screen.getByText(
          /Your session logs help the community and improve our forecasts\./i
        )
      ).toBeInTheDocument();

      // CTA
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
      });
      render(<SessionPromptEmail {...props} />);

      // Generic greeting
      expect(screen.getByText("Hey there!")).toBeInTheDocument();

      // Condition text without surf description
      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
      expect(screen.getByText("excellent")).toBeInTheDocument();
      expect(screen.getByText("Black's Beach")).toBeInTheDocument();
      expect(screen.getByText(/\(8\/10\)/i)).toBeInTheDocument();

      // No surf description appended
      const paragraph = screen.getByText(/Conditions were looking/i);
      expect(paragraph.textContent).not.toMatch(/Clean/i);

      // CTA still present
      expect(screen.getByText(/Log Your Session/i)).toBeInTheDocument();
    });

    it("renders with perfect conditions (score 10)", () => {
      const props = makeProps({
        conditionsScore: 10,
        surfDescription: "Epic 6-8ft barrels",
      });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
      expect(screen.getByText("perfect")).toBeInTheDocument();
      expect(screen.getByText(/\(10\/10\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Epic 6-8ft barrels\./i)).toBeInTheDocument();
    });

    it("renders with lower conditions (score 5)", () => {
      const props = makeProps({
        conditionsScore: 5,
        surfDescription: "Small 1-2ft wind chop",
      });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText(/\(5\/10\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Small 1-2ft wind chop\./i)).toBeInTheDocument();
    });
  });

  describe("Text Content Accuracy", () => {
    it("includes 'If you got out there, we'd love to hear how it was!' text", () => {
      const props = makeProps();
      render(<SessionPromptEmail {...props} />);

      expect(
        screen.getByText(
          /If you got out there, we'd love to hear how it was!/i
        )
      ).toBeInTheDocument();
    });

    it("displays full content paragraph correctly", () => {
      const props = makeProps({
        conditionsScore: 9,
        beachName: "Swami's",
        surfDescription: "Perfect peeling rights",
      });
      render(<SessionPromptEmail {...props} />);

      // Should have complete sentence structure
      const paragraph = screen.getByText(/Conditions were looking/i);
      expect(paragraph.textContent).toMatch(
        /Conditions were looking perfect at Swami's yesterday \(9\/10\)\. Perfect peeling rights\. If you got out there/i
      );
    });
  });
});
