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
    if (score >= 80) return { label: "EPIC", color: "#00D4AA" };
    if (score >= 70) return { label: "GOOD", color: "#1D9E75" };
    if (score >= 55) return { label: "FAIR", color: "#FDB84B" };
    if (score >= 40) return { label: "RIDEABLE", color: "#888780" };
    return { label: "MEH", color: "#5F5E5A" };
  }),
}));

// Helper factory
function makeProps(
  overrides: Partial<SessionPromptEmailProps> = {}
): SessionPromptEmailProps {
  return {
    displayName: "John",
    beachName: "Black's Beach",
    conditionsScore: 70,
    surfDescription: "Clean 4-6ft sets",
    appSessionUrl: "https://www.quiversurf.app/sessions/new?entrySource=email",
    confirmUrl: "https://quiversurf.app/sessions/new?beach=blacks&action=confirm",
    skipUrl: "https://quiversurf.app/sessions/new?beach=blacks&action=skip",
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
      expect(screen.getByText(/Conditions were looking/i).textContent).toContain(
        "yesterday (scored 70).",
      );
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
      expect(screen.getByText(/Conditions were looking/i).textContent).toContain(
        "yesterday (scored 70).",
      );
    });
  });

  describe("Condition Score Display", () => {
    it("renders a 0-100 condition score without a /10 scale", () => {
      const props = makeProps({ conditionsScore: 85 });
      render(<SessionPromptEmail {...props} />);

      const paragraph = screen.getByText(/Conditions were looking/i);
      expect(paragraph.textContent).toContain("yesterday (scored 85).");
      expect(paragraph.textContent).not.toContain("/10");
    });

    it("displays score 70 correctly", () => {
      const props = makeProps({ conditionsScore: 70 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/scored 70/i)).toBeInTheDocument();
    });

    it("displays score 69 correctly", () => {
      const props = makeProps({ conditionsScore: 69 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/scored 69/i)).toBeInTheDocument();
    });

    it("displays score 100 correctly", () => {
      const props = makeProps({ conditionsScore: 100 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/scored 100/i)).toBeInTheDocument();
    });

    it("displays score 45 correctly", () => {
      const props = makeProps({ conditionsScore: 45 });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/scored 45/i)).toBeInTheDocument();
    });
  });

  describe("Condition Label", () => {
    it("uses lowercase condition label for score 85 (EPIC)", () => {
      const props = makeProps({ conditionsScore: 85 });
      render(<SessionPromptEmail {...props} />);

      // Label is in <strong> tag
      expect(screen.getByText("epic")).toBeInTheDocument();
      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
    });

    it("uses lowercase condition label for score 70 (GOOD)", () => {
      const props = makeProps({ conditionsScore: 70 });
      render(<SessionPromptEmail {...props} />);

      // Label is in <strong> tag
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
    });

    it("uses lowercase condition label for score 69 (FAIR)", () => {
      const props = makeProps({ conditionsScore: 69 });
      render(<SessionPromptEmail {...props} />);

      // Label is in <strong> tag
      expect(screen.getByText("fair")).toBeInTheDocument();
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

      // Should end with "...yesterday (scored 70). If you got out there..."
      const text = screen.getByText(/yesterday \(scored 70\)\./i);
      expect(text).toBeInTheDocument();
    });
  });

  describe("CTA Link", () => {
    it("renders primary app CTA link with correct URL", () => {
      const appSessionUrl =
        "https://www.quiversurf.app/sessions/new?entrySource=email&beachId=beach-1";
      const props = makeProps({ appSessionUrl });
      render(<SessionPromptEmail {...props} />);

      const link = screen.getByText(/Open in Quiver/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", appSessionUrl);
    });

    it("renders confirm CTA link with correct URL", () => {
      const confirmUrl = "https://quiversurf.app/sessions/new?beach=blacks&action=confirm";
      const props = makeProps({ confirmUrl });
      render(<SessionPromptEmail {...props} />);

      const link = screen.getByText(/Yes, I surfed!/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", confirmUrl);
    });

    it("renders skip CTA link with correct URL", () => {
      const skipUrl = "https://quiversurf.app/sessions/new?beach=blacks&action=skip";
      const props = makeProps({ skipUrl });
      render(<SessionPromptEmail {...props} />);

      const link = screen.getByText(/No, I didn't surf/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", skipUrl);
    });

    it("handles confirm URL with different query parameters", () => {
      const confirmUrl =
        "https://quiversurf.app/sessions/new?beach=swamis&date=2026-02-10&action=confirm";
      const props = makeProps({ confirmUrl });
      render(<SessionPromptEmail {...props} />);

      const link = screen.getByText(/Yes, I surfed!/i);
      expect(link.closest("a")).toHaveAttribute("href", confirmUrl);
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
          /Your session log is the record you'll compare the next call against\./i
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
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText("Black's Beach")).toBeInTheDocument();
      expect(screen.getByText(/scored 70/i)).toBeInTheDocument();

      // Surf description
      expect(screen.getByText(/Clean 4-6ft sets\./i)).toBeInTheDocument();

      // Motivational message
      expect(
        screen.getByText(
          /Your session log is the record you'll compare the next call against\./i
        )
      ).toBeInTheDocument();

      // CTA
      expect(screen.getByText(/Yes, I surfed!/i)).toBeInTheDocument();
      expect(screen.getByText(/No, I didn't surf/i)).toBeInTheDocument();

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
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText("Black's Beach")).toBeInTheDocument();
      expect(screen.getByText(/scored 70/i)).toBeInTheDocument();

      // No surf description appended
      const paragraph = screen.getByText(/Conditions were looking/i);
      expect(paragraph.textContent).not.toMatch(/Clean/i);

      // CTA still present
      expect(screen.getByText(/Yes, I surfed!/i)).toBeInTheDocument();
    });

    it("renders with EPIC conditions (score 100)", () => {
      const props = makeProps({
        conditionsScore: 100,
        surfDescription: "Epic 6-8ft barrels",
      });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
      expect(screen.getByText("epic")).toBeInTheDocument();
      expect(screen.getByText(/scored 100/i)).toBeInTheDocument();
      expect(screen.getByText(/Epic 6-8ft barrels\./i)).toBeInTheDocument();
    });

    it("renders with lower conditions (score 45)", () => {
      const props = makeProps({
        conditionsScore: 45,
        surfDescription: "Small 1-2ft wind chop",
      });
      render(<SessionPromptEmail {...props} />);

      expect(screen.getByText(/Conditions were looking/i)).toBeInTheDocument();
      expect(screen.getByText("rideable")).toBeInTheDocument();
      expect(screen.getByText(/scored 45/i)).toBeInTheDocument();
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
        conditionsScore: 85,
        beachName: "Swami's",
        surfDescription: "Perfect peeling rights",
      });
      render(<SessionPromptEmail {...props} />);

      // Should have complete sentence structure
      const paragraph = screen.getByText(/Conditions were looking/i);
      expect(paragraph.textContent).toMatch(
        /Conditions were looking epic at Swami's yesterday \(scored 85\)\. Perfect peeling rights\. If you got out there/i
      );
    });
  });
});
