/**
 * Unit tests for ReengagementEmail React component
 * Tests the re-engagement email template rendering
 *
 * Test coverage:
 * - Rendering with all props
 * - Rendering with minimal props (null optional fields)
 * - Score-based messaging (Perfect, Excellent, Good)
 * - Score percentage display (0-10 scale to 0-100 percentage)
 * - Optional sections visibility (bestWindow, recentIntel)
 * - URL construction (ctaUrl, logSessionUrl, unsubscribeUrl)
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

describe("ReengagementEmail", () => {
  const defaultProps: ReengagementEmailProps = {
    displayName: "John Doe",
    beachName: "Ocean Beach",
    beachSlug: "ocean-beach",
    conditionsScore: 9,
    surfDescription: "Clean 3-4ft waves",
    windDescription: "Light offshore",
    bestWindow: {
      start: "8:00 AM",
      end: "10:00 AM",
    },
    recentIntel: [
      { tag: "waves", description: "Clean sets rolling through" },
      { tag: "wind", description: "Glassy in the morning" },
    ],
    ctaUrl: "https://quiversurf.app/beaches/ocean-beach",
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
        conditionsScore: 8,
        surfDescription: null,
        windDescription: null,
        bestWindow: null,
        recentIntel: [],
        ctaUrl: "https://quiversurf.app/beaches/test-beach",
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
      const logSessionLink = container.querySelector(
        'a[href*="/sessions/log"]'
      );

      expect(logSessionLink).toHaveAttribute(
        "href",
        "https://quiversurf.app/sessions/log?beach=ocean-beach"
      );
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
    it("should show 'Perfect' label and emoji for score 9-10", () => {
      const testScores = [9, 9.5, 10];

      testScores.forEach((score) => {
        const { container } = render(
          <ReengagementEmail {...defaultProps} conditionsScore={score} />
        );

        expect(container.textContent).toContain("Perfect Conditions");
        expect(container.textContent).toContain("🔥");
        expect(container.textContent).toContain(
          "This is as good as it gets. Drop what you're doing."
        );
      });
    });

    it("should show 'Excellent' label and emoji for score 8", () => {
      const { container } = render(
        <ReengagementEmail {...defaultProps} conditionsScore={8} />
      );

      expect(container.textContent).toContain("Excellent Conditions");
      expect(container.textContent).toContain("✨");
      expect(container.textContent).toContain(
        "Conditions are dialed. Worth rearranging your schedule."
      );
    });

    it("should show 'Good' label and emoji for score 7", () => {
      const { container } = render(
        <ReengagementEmail {...defaultProps} conditionsScore={7} />
      );

      expect(container.textContent).toContain("Good Conditions");
      expect(container.textContent).toContain("🌊");
      expect(container.textContent).toContain(
        "Solid conditions today. A good day to shake off the rust."
      );
    });

    it("should show 'Good' label for edge case score 7.5", () => {
      const { container } = render(
        <ReengagementEmail {...defaultProps} conditionsScore={7.5} />
      );

      expect(container.textContent).toContain("Good Conditions");
    });
  });

  describe("Score Display", () => {
    it("should convert score to display percentage (0-10 to 0-100)", () => {
      const testCases = [
        { score: 10, expected: "100" },
        { score: 9, expected: "90" },
        { score: 8, expected: "80" },
        { score: 7, expected: "70" },
        { score: 7.5, expected: "75" },
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

      // Check table rows - should only have 2 (Waves and Best Window)
      const table = container.querySelector("table");
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

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(3); // Waves, Wind, Best Window
    });

    it("should render table with no rows when all conditions are null", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        surfDescription: null,
        windDescription: null,
        bestWindow: null,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(0);
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
          { tag: "waves", description: "Test 1" },
          { tag: "wind", description: "Test 2" },
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
          { tag: "conditions", description: "Post 1" },
          { tag: "crowd", description: "Post 2" },
        ],
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("Post 1");
      expect(container.textContent).toContain("Post 2");
    });

    it("should limit display to provided intel posts", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        recentIntel: [{ tag: "waves", description: "Only one post" }],
      };

      const { container } = render(<ReengagementEmail {...props} />);

      // Check that the single intel post is displayed
      expect(container.textContent).toContain("Only one post");
      expect(container.textContent).toContain("WAVES");
    });
  });

  describe("Call-to-Action URLs", () => {
    it("should use ctaUrl for main CTA button", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const ctaButton = container.querySelector(
        'a[href="https://quiversurf.app/beaches/ocean-beach"]'
      );
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton?.textContent).toContain("Check Full Forecast");
    });

    it("should construct logSessionUrl from baseUrl and beachSlug", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      const logSessionLink = container.querySelector(
        'a[href="https://quiversurf.app/sessions/log?beach=ocean-beach"]'
      );
      expect(logSessionLink).toBeInTheDocument();
      expect(logSessionLink?.textContent).toContain("Log Your Session");
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

    it("should construct correct logSessionUrl with custom baseUrl", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        baseUrl: "https://staging.quiversurf.app",
      };

      const { container } = render(<ReengagementEmail {...props} />);

      const logSessionLink = container.querySelector(
        'a[href="https://staging.quiversurf.app/sessions/log?beach=ocean-beach"]'
      );
      expect(logSessionLink).toBeInTheDocument();
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

      // React inline styles render as objects, so check via element directly
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toBeTruthy();
      expect(mainDiv.style.maxWidth).toBe("600px");
    });

    it("should use correct brand color for header", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // Check that header exists with the blue background
      const divs = container.querySelectorAll("div");
      const headerDiv = Array.from(divs).find(
        (div) => div.style.backgroundColor === "rgb(0, 102, 204)"
      );
      expect(headerDiv).toBeTruthy();
    });

    it("should display score badge with condition color", () => {
      const testCases = [
        { score: 9, color: "rgb(16, 185, 129)" }, // Perfect - green
        { score: 8, color: "rgb(59, 130, 246)" }, // Excellent - blue
        { score: 7, color: "rgb(34, 197, 94)" }, // Good - green
      ];

      testCases.forEach(({ score, color }) => {
        const { container } = render(
          <ReengagementEmail {...defaultProps} conditionsScore={score} />
        );

        // Find div with matching background color
        const divs = container.querySelectorAll("div");
        const badge = Array.from(divs).find(
          (div) => div.style.backgroundColor === color
        );
        expect(badge).toBeTruthy();
      });
    });

    it("should have centered layout for score badge", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // Check that centered divs exist
      const divs = container.querySelectorAll("div");
      const centeredDiv = Array.from(divs).find(
        (div) => div.style.textAlign === "center"
      );
      expect(centeredDiv).toBeTruthy();
    });

    it("should have proper spacing in motivational copy section", () => {
      const { container } = render(<ReengagementEmail {...defaultProps} />);

      // Check for motivational copy background color
      const divs = container.querySelectorAll("div");
      const motivationalDiv = Array.from(divs).find(
        (div) => div.style.backgroundColor === "rgb(245, 249, 255)"
      );
      expect(motivationalDiv).toBeTruthy();
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

      const logSessionLink = container.querySelector(
        'a[href*="beach=ocean-beach-&-cove"]'
      );
      expect(logSessionLink).toBeInTheDocument();
    });

    it("should handle score edge case 0", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        conditionsScore: 0,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("0");
      expect(container.textContent).toContain("Good Conditions");
    });

    it("should handle score edge case 10", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        conditionsScore: 10,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("100");
      expect(container.textContent).toContain("Perfect Conditions");
    });

    it("should handle fractional scores correctly", () => {
      const props: ReengagementEmailProps = {
        ...defaultProps,
        conditionsScore: 8.7,
      };

      const { container } = render(<ReengagementEmail {...props} />);

      expect(container.textContent).toContain("87");
      expect(container.textContent).toContain("Excellent Conditions");
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

      const h1 = container.querySelector("h1");
      const h3 = container.querySelector("h3");

      expect(h1).toBeInTheDocument();
      expect(h3).toBeInTheDocument();
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
          score: 9,
          expectedCopy: "This is as good as it gets. Drop what you're doing.",
        },
        {
          score: 8,
          expectedCopy:
            "Conditions are dialed. Worth rearranging your schedule.",
        },
        {
          score: 7,
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
