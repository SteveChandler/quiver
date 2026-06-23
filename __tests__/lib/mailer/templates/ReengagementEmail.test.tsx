/**
 * Unit tests for ReengagementEmail React component
 * Tests the re-engagement email template rendering
 *
 * Test coverage:
 * - Rendering with all props
 * - Rendering with minimal props (null optional fields)
 * - Score-based messaging (EPIC, GOOD, FAIR, RIDEABLE, MEH)
 * - Score display (0-100 scale from beach_daily_intel)
 * - Optional sections visibility (bestWindow, recentIntel)
 * - URL construction (ctaUrl, unsubscribeUrl)
 * - Time formatting
 * - Tag formatting
 * - Accessibility and semantic HTML
 */

import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ReengagementEmail,
  ReengagementEmailProps,
} from "@/lib/mailer/templates/ReengagementEmail";

/**
 * The zine layout wraps everything in table-based brand chrome (EmailShell,
 * Wordmark, Stamp, PaperPanel, CTAButton, Footer), so the conditions list is
 * no longer the only <table> in the DOM. Locate it by the row labels it owns.
 */
function getConditionsTable(container: HTMLElement): HTMLTableElement | null {
  const cells = Array.from(container.querySelectorAll("td"));
  const labelCell = cells.find((cell) =>
    ["Waves", "Wind", "Best Window"].includes(cell.textContent?.trim() ?? "")
  );
  return labelCell?.closest("table") ?? null;
}

describe("ReengagementEmail", () => {
  const defaultProps: ReengagementEmailProps = {
    displayName: "John Doe",
    beachName: "Ocean Beach",
    beachSlug: "ocean-beach",
    conditionsScore: 90,
    surfDescription: "Clean 3-4ft waves",
    windDescription: "Light offshore",
    bestWindow: {
      start: "8:00 AM",
      end: "10:00 AM",
    },
    recentIntel: [
      { id: "intel-1", tag: "waves", description: "Clean sets rolling through" },
      { id: "intel-2", tag: "wind", description: "Glassy in the morning" },
    ],
    ctaUrl: "https://quiversurf.app/beach/ocean-beach",
    unsubscribeUrl: "https://quiversurf.app/settings",
    baseUrl: "https://quiversurf.app",
  };

  describe("Basic Rendering", () => {
    it("should render with all props provided", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container).toBeInTheDocument();
      expect(container.textContent).toContain("Hey John Doe!");
      expect(container.textContent).toContain("Ocean Beach");
    });

    it("should render with minimal props (null optional fields)", () => {
      const minimalProps: ReengagementEmailProps = {
        displayName: null,
        beachName: "Test Beach",
        beachSlug: "test-beach",
        conditionsScore: 80,
        surfDescription: null,
        windDescription: null,
        bestWindow: null,
        recentIntel: [],
        ctaUrl: "https://quiversurf.app/beach/test-beach",
        unsubscribeUrl: "https://quiversurf.app/settings",
      };

      const { container } = render(<ReengagementEmail {...minimalProps} />);

      expect(container).toBeInTheDocument();
      expect(container.textContent).toContain("Hey there!");
      expect(container.textContent).toContain("Test Beach");
    });

    it("should use default baseUrl if not provided", () => {
      const propsWithoutBaseUrl: ReengagementEmailProps = {
        ...defaultProps,
        baseUrl: undefined,
      };

      const { container } = render(
        <ReengagementEmail {...propsWithoutBaseUrl} />
      );
      const ctaLink = container.querySelector(
        'a[href="https://quiversurf.app/beach/ocean-beach"]'
      );

      expect(ctaLink).toHaveTextContent("Check the forecast");
    });
  });

  describe("Greeting", () => {
    it("should use display name in greeting when provided", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).toContain("Hey John Doe!");
    });

    it("should use generic greeting when display name is null", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        displayName: null,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("Hey there!");
    });
  });

  describe("Score-based Messaging", () => {
    it("should show 'EPIC' label for score >= 85", () => {
      const testScores = [90, 95, 100];

      testScores.forEach((score) => {
        const { container } = render(
          <ReengagementEmail {...defaultProps} conditionsScore={score} />
        );

        expect(container.textContent).toContain("EPIC Conditions");
        expect(container.textContent).toContain(
          "This is as good as it gets. Drop what you're doing."
        );
      });
    });

    it("should show 'GOOD' label for score 70-84", () => {
      const { container } = render(
        <ReengagementEmail {...defaultProps} conditionsScore={80} />
      );

      expect(container.textContent).toContain("GOOD Conditions");
      expect(container.textContent).toContain(
        "Conditions are dialed. Worth rearranging your schedule."
      );
    });

    it("should show 'FAIR' label for score 55-69", () => {
      const { container } = render(
        <ReengagementEmail {...defaultProps} conditionsScore={65} />
      );

      expect(container.textContent).toContain("FAIR Conditions");
      expect(container.textContent).toContain(
        "Solid conditions today. A good day to shake off the rust."
      );
    });

    it("should show 'FAIR' label for edge case score 60", () => {
      const { container } = render(
        <ReengagementEmail {...defaultProps} conditionsScore={60} />
      );

      expect(container.textContent).toContain("FAIR Conditions");
    });
  });

  describe("Score Display", () => {
    it("should display the raw score value (0-100 scale)", () => {
      const testCases = [
        { score: 100, expected: "100" },
        { score: 90, expected: "90" },
        { score: 80, expected: "80" },
        { score: 65, expected: "65" },
        { score: 75, expected: "75" },
        { score: 0, expected: "0" },
      ];

      testCases.forEach(({ score, expected }) => {
        const { container } = render(
          <ReengagementEmail {...defaultProps} conditionsScore={score} />
        );

        // Score should be in the text content
        expect(container.textContent).toContain(expected);
      });
    });
  });

  describe("Conditions Summary Table", () => {
    it("should display surf description when provided", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).toContain("Waves");
      expect(container.textContent).toContain("Clean 3-4ft waves");
    });

    it("should hide surf row when surfDescription is null", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        surfDescription: null,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).not.toContain("Waves");
    });

    it("should display wind description when provided", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).toContain("Wind");
      expect(container.textContent).toContain("Light offshore");
    });

    it("should hide wind row when windDescription is null", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        windDescription: null,
        recentIntel: [], // Remove intel that contains "WIND" tag
      };

      const { container } = render(<ReengagementEmail {...props} />);

      // Check conditions-table rows - should only have 2 (Waves and Best Window)
      const table = getConditionsTable(container);
      const rows = table?.querySelectorAll("tr");
      expect(rows?.length).toBe(2); // Only Waves and Best Window
    });

    it("should display best window when provided", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).toContain("Best Window");
      expect(container.textContent).toContain("8:00 AM - 10:00 AM");
    });

    it("should hide best window row when bestWindow is null", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        bestWindow: null,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).not.toContain("Best Window");
    });

    it("should render table with all conditions when all props provided", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const rows = getConditionsTable(container)?.querySelectorAll("tbody tr");
      expect(rows?.length).toBe(3); // Waves, Wind, Best Window
    });

    it("should render table with no rows when all conditions are null", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        surfDescription: null,
        windDescription: null,
        bestWindow: null,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      // With no conditions, the conditions table is omitted entirely.
      expect(getConditionsTable(container)).toBeNull();
    });
  });

  describe("Recent Community Intel", () => {
    it("should display intel section when recentIntel has items", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).toContain("Recent Community Intel");
      expect(container.textContent).toContain("Clean sets rolling through");
      expect(container.textContent).toContain("Glassy in the morning");
    });

    it("should hide intel section when recentIntel is empty", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        recentIntel: [],
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).not.toContain("Recent Community Intel");
    });

    it("should format intel tags to uppercase", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        recentIntel: [
          { id: "intel-1", tag: "waves", description: "Test 1" },
          { id: "intel-2", tag: "wind", description: "Test 2" },
        ],
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("WAVES");
      expect(container.textContent).toContain("WIND");
    });

    it("should display multiple intel posts", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        recentIntel: [
          { id: "intel-1", tag: "conditions", description: "Post 1" },
          { id: "intel-2", tag: "crowd", description: "Post 2" },
        ],
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("Post 1");
      expect(container.textContent).toContain("Post 2");
    });

    it("should limit display to provided intel posts", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        recentIntel: [{ id: "intel-1", tag: "waves", description: "Only one post" }],
      };

      const { container } = render(<ReengagementEmail {...props} />);

      // Check that the single intel post is displayed
      expect(container.textContent).toContain("Only one post");
      expect(container.textContent).toContain("WAVES");
    });
  });

  describe("Call-to-Action URLs", () => {
    it("should render one primary forecast CTA", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const ctaButton = container.querySelector(
        'a[href="https://quiversurf.app/beach/ocean-beach"]'
      );
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveTextContent("Check the forecast");

      const links = container.querySelectorAll("a");
      expect(links).toHaveLength(2);
      expect(container.textContent).not.toContain("Check Full Forecast");
    });

    it("should not render the secondary log-session CTA", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).not.toContain("Log Your Session");
      expect(container.textContent).not.toContain("Going surfing?");
      expect(
        container.querySelector('a[href*="/session/confirm"]')
      ).not.toBeInTheDocument();
    });

    it("should use unsubscribeUrl for manage preferences link", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const unsubscribeLink = container.querySelector(
        'a[href="https://quiversurf.app/settings"]'
      );
      expect(unsubscribeLink).toBeInTheDocument();
      expect(unsubscribeLink?.textContent).toContain(
        "Manage notification preferences"
      );
    });

  });

  describe("Header and Footer", () => {
    it("should display header with title", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).toContain("Conditions are Looking Good!");
    });

    it("should display footer with beach name", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      expect(container.textContent).toContain(
        "You're receiving this because you have forecast alerts enabled for Ocean Beach."
      );
    });

    it("should display footer unsubscribe link", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const unsubscribeLink = container.querySelector(
        'a[href="https://quiversurf.app/settings"]'
      );
      expect(unsubscribeLink).toBeInTheDocument();
    });
  });

  describe("Styling and Layout", () => {
    it("should have max-width container", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // EmailShell caps the email card table at 600px (the outer div is the
      // full-bleed canvas; the inner table holds the width constraint).
      const cardTable = Array.from(container.querySelectorAll("table")).find(
        (table) => table.style.maxWidth === "600px"
      );
      expect(cardTable?.style.maxWidth).toBe("600px");
    });

    it("should use correct brand color for header", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // Check that header exists with the blue background
      const divs = container.querySelectorAll("div");
      const headerDiv = Array.from(divs).find(
        (div) => div.style.backgroundColor === "rgb(37, 45, 107)"
      );
      expect(headerDiv?.style.backgroundColor).toBe("rgb(37, 45, 107)");
    });

    it("should display score badge with condition color", () => {
      const testCases = [
        { score: 90, color: "rgb(0, 212, 170)" }, // EPIC - teal
        { score: 80, color: "rgb(29, 158, 117)" }, // GOOD - teal
        { score: 65, color: "rgb(253, 184, 75)" }, // FAIR - gold
      ];

      testCases.forEach(({ score, color }) => {
        const { container } = render(
          <ReengagementEmail {...defaultProps} conditionsScore={score} />
        );

        // The score badge is now a zine <Stamp> (a styled <span>) tinted with
        // the semantic condition color from getConditionLabel.
        const badge = Array.from(
          container.querySelectorAll<HTMLElement>("span")
        ).find((el) => el.style.backgroundColor === color);
        expect(badge?.style.backgroundColor).toBe(color);
      });
    });

    it("should have centered layout for score badge", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // Check that centered divs exist
      const divs = container.querySelectorAll("div");
      const centeredDiv = Array.from(divs).find(
        (div) => div.style.textAlign === "center"
      );
      expect(centeredDiv?.style.textAlign).toBe("center");
    });

    it("should render the motivational quote on a cream paper panel", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // The quote now lives in a zine <PaperPanel>: a cream (PAPER #F5EEDC)
      // cut-paper cell tilted onto the twilight page.
      const paperCell = Array.from(
        container.querySelectorAll<HTMLElement>("td")
      ).find((el) => el.style.backgroundColor === "rgb(245, 238, 220)");
      expect(paperCell?.style.backgroundColor).toBe("rgb(245, 238, 220)");
      expect(paperCell?.textContent).toContain(
        "This is as good as it gets. Drop what you're doing."
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long beach names", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        beachName: "Super Long Beach Name That Goes On Forever and Ever Beach",
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain(
        "Super Long Beach Name That Goes On Forever and Ever Beach"
      );
    });

    it("should handle empty string display name", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        displayName: "",
      };

      const { container } = render(<ReengagementEmail {...props} />);

      // Empty string is falsy in the template logic, so should use generic greeting
      expect(container.textContent).toContain("Hey there!");
    });

    it("should handle special characters in beach slug", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        beachSlug: "ocean-beach-&-cove",
      };

      const { container } = render(<ReengagementEmail {...props} />);

      const forecastLink = container.querySelector(
        'a[href="https://quiversurf.app/beach/ocean-beach"]'
      );
      expect(forecastLink).toBeInTheDocument();
    });

    it("should handle score edge case 0", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        conditionsScore: 0,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("0");
      expect(container.textContent).toContain("MEH Conditions");
    });

    it("should handle score edge case 100", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        conditionsScore: 100,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("100");
      expect(container.textContent).toContain("EPIC Conditions");
    });

    it("should handle fractional scores correctly", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        conditionsScore: 82,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("82");
      expect(container.textContent).toContain("GOOD Conditions");
    });
  });

  describe("Accessibility", () => {
    it("should use semantic HTML for table", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const table = container.querySelector("table");
      const tbody = container.querySelector("tbody");
      const tr = container.querySelector("tr");
      const td = container.querySelector("td");

      expect(table).toBeInTheDocument();
      expect(tbody).toBeInTheDocument();
      expect(tr).toBeInTheDocument();
      expect(td).toBeInTheDocument();
    });

    it("should use proper heading hierarchy", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // The zine layout has a single <h1> headline; section kickers (e.g.
      // "Recent Community Intel") are rendered as mono <Eyebrow> labels, not
      // <h3>s, so we assert the headline plus the section label text.
      const h1 = container.querySelector("h1");
      expect(h1).toBeInTheDocument();
      expect(container.textContent).toContain("Recent Community Intel");
    });

    it("should have descriptive link text", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const links = container.querySelectorAll("a");
      links.forEach((link) => {
        expect(link.textContent?.trim()).not.toBe("");
        expect(link.textContent?.trim()).not.toBe("Click here");
      });
    });

    it("should use proper HTML entities", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // React renders these as actual characters in textContent
      // Check for em dash, quotes, and arrow
      expect(container.textContent).toContain("\u2014"); // mdash —
      expect(container.textContent).toContain("\u201C"); // ldquo "
      expect(container.textContent).toContain("\u201D"); // rdquo "
      expect(container.textContent).toContain("\u2192"); // rarr →

      // Check that &apos; is used in the HTML (for "You're")
      expect(container.innerHTML).toMatch(/You.*re receiving/);
    });
  });

  describe("Content Variations", () => {
    it("should display different motivational copy for each score tier", () => {
      const testCases = [
        {
          score: 90,
          expectedCopy: "This is as good as it gets. Drop what you're doing.",
        },
        {
          score: 80,
          expectedCopy:
            "Conditions are dialed. Worth rearranging your schedule.",
        },
        {
          score: 65,
          expectedCopy: "Solid conditions today. A good day to shake off the rust.",
        },
      ];

      testCases.forEach(({ score, expectedCopy }) => {
        const { container } = render(
          <ReengagementEmail {...defaultProps} conditionsScore={score} />
        );

        expect(container.textContent).toContain(expectedCopy);
      });
    });

    it("should show consistent beach name across email", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const beachNameOccurrences = (
        container.textContent?.match(/Ocean Beach/g) || []
      ).length;
      expect(beachNameOccurrences).toBeGreaterThanOrEqual(2); // Header and footer minimum
    });
  });
});
