import { render, screen } from "@testing-library/react";
import { TideConditionsCard } from "@/components/beach-detail/tide-conditions-card";

describe("TideConditionsCard", () => {
  describe("Rendering with valid data", () => {
    it("should render the card with prose text", () => {
      render(
        <TideConditionsCard
          prose="This beach works best on a mid to high tide. Low tide can expose rocks and make conditions dangerous."
          preferredDirection="rising"
        />
      );

      expect(
        screen.getByText(
          /This beach works best on a mid to high tide. Low tide can expose rocks and make conditions dangerous./
        )
      ).toBeInTheDocument();
    });

    it("should render the card title", () => {
      render(
        <TideConditionsCard
          prose="Works on any tide"
          preferredDirection="either"
        />
      );

      expect(screen.getByText("Best Tide Conditions")).toBeInTheDocument();
    });

    it("should render the Waves icon", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Rising tide preferred"
          preferredDirection="rising"
        />
      );

      // Check for the Waves icon SVG
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Preferred direction labels", () => {
    it("should render 'Rising tide preferred' label for rising direction", () => {
      render(
        <TideConditionsCard
          prose="Best on rising tide"
          preferredDirection="rising"
        />
      );

      expect(screen.getByText("Rising tide preferred")).toBeInTheDocument();
    });

    it("should render 'Falling tide preferred' label for falling direction", () => {
      render(
        <TideConditionsCard
          prose="Best on falling tide"
          preferredDirection="falling"
        />
      );

      expect(screen.getByText("Falling tide preferred")).toBeInTheDocument();
    });

    it("should render 'Mid-tide preferred' label for slack direction", () => {
      render(
        <TideConditionsCard
          prose="Best at mid-tide"
          preferredDirection="slack"
        />
      );

      expect(screen.getByText("Mid-tide preferred")).toBeInTheDocument();
    });

    it("should render 'Works on any tide' label for either direction", () => {
      render(
        <TideConditionsCard
          prose="Tide doesn't matter much"
          preferredDirection="either"
        />
      );

      expect(screen.getByText("Works on any tide")).toBeInTheDocument();
    });

    it("should render the raw preferredDirection if not in known labels", () => {
      render(
        <TideConditionsCard
          prose="Custom tide preference"
          preferredDirection="custom-tide-type"
        />
      );

      expect(screen.getByText("custom-tide-type")).toBeInTheDocument();
    });

    it("should not render badge when preferredDirection is null", () => {
      render(
        <TideConditionsCard
          prose="No specific tide preference"
          preferredDirection={null}
        />
      );

      expect(screen.queryByText(/tide preferred/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Works on any tide/i)).not.toBeInTheDocument();
    });
  });

  describe("Handling missing or null data", () => {
    it("should return null when prose is null", () => {
      const { container } = render(
        <TideConditionsCard prose={null} preferredDirection="rising" />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should return null when prose is empty string (falsy)", () => {
      const { container } = render(
        <TideConditionsCard prose="" preferredDirection="rising" />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render when prose exists but preferredDirection is null", () => {
      render(
        <TideConditionsCard
          prose="Tide conditions vary throughout the day"
          preferredDirection={null}
        />
      );

      expect(
        screen.getByText("Tide conditions vary throughout the day")
      ).toBeInTheDocument();
      expect(screen.getByText("Best Tide Conditions")).toBeInTheDocument();
    });
  });

  describe("Visual styling and layout", () => {
    it("should apply correct card styling classes", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Styling test"
          preferredDirection="rising"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass(
        "overflow-hidden",
        "rounded-[8px]",
        "border-2",
        "bg-[#F4EBD8]",
        "shadow-[3px_3px_0_#11100D]"
      );
    });

    it("should apply solid editorial background classes", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Background test"
          preferredDirection="falling"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-[#F4EBD8]");
    });

    it("should apply proper spacing class (mt-6)", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Spacing test"
          preferredDirection="slack"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("mt-6");
    });

    it("should render badge with secondary variant", () => {
      render(
        <TideConditionsCard
          prose="Badge test"
          preferredDirection="rising"
        />
      );

      const badge = screen.getByText("Rising tide preferred").closest("div");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Content display", () => {
    it("should render prose text in muted foreground color", () => {
      render(
        <TideConditionsCard
          prose="Muted text example"
          preferredDirection="rising"
        />
      );

      const proseText = screen.getByText("Muted text example");
      expect(proseText).toHaveClass("text-[#11100D]");
    });

    it("should render prose text with small font size", () => {
      render(
        <TideConditionsCard
          prose="Small font test"
          preferredDirection="rising"
        />
      );

      const proseText = screen.getByText("Small font test");
      expect(proseText).toHaveClass("text-sm");
    });

    it("should render prose text with relaxed leading", () => {
      render(
        <TideConditionsCard
          prose="Leading test"
          preferredDirection="rising"
        />
      );

      const proseText = screen.getByText("Leading test");
      expect(proseText).toHaveClass("leading-relaxed");
    });

    it("should handle multiline prose text", () => {
      const multilineProse = `This beach works best on a rising tide.

      Low tide can expose sharp rocks and shallow reef.
      High tide provides good wave shape but can be overwhelming for beginners.`;

      render(
        <TideConditionsCard
          prose={multilineProse}
          preferredDirection="rising"
        />
      );

      // Use a flexible text matcher for multiline content
      expect(
        screen.getByText((content, element) => {
          return element?.textContent === multilineProse;
        })
      ).toBeInTheDocument();
    });

    it("should handle very long prose text", () => {
      const longProse =
        "This is an extremely detailed tide condition description that goes on for quite a while explaining all the nuances of how the tide affects this particular surf spot, including details about underwater topography, current patterns, and optimal timing for different skill levels of surfers.";

      render(
        <TideConditionsCard prose={longProse} preferredDirection="either" />
      );

      expect(screen.getByText(longProse)).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle special characters in prose", () => {
      render(
        <TideConditionsCard
          prose="Best conditions: 3-4ft @ rising tide (2hrs before high)"
          preferredDirection="rising"
        />
      );

      expect(
        screen.getByText("Best conditions: 3-4ft @ rising tide (2hrs before high)")
      ).toBeInTheDocument();
    });

    it("should handle empty preferredDirection string", () => {
      render(
        <TideConditionsCard
          prose="Empty direction test"
          preferredDirection=""
        />
      );

      // Empty string should still render the badge with empty text
      expect(screen.getByText("Empty direction test")).toBeInTheDocument();
    });

    it("should handle whitespace-only prose gracefully", () => {
      const { container } = render(
        <TideConditionsCard prose="   " preferredDirection="rising" />
      );

      // Component will still render since "   " is truthy
      expect(container.firstChild).toBeInTheDocument();
    });

    it("should handle undefined prose", () => {
      const { container } = render(
        <TideConditionsCard
          prose={undefined as any}
          preferredDirection="rising"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should handle undefined preferredDirection", () => {
      render(
        <TideConditionsCard
          prose="Undefined direction test"
          preferredDirection={undefined as any}
        />
      );

      expect(screen.getByText("Undefined direction test")).toBeInTheDocument();
      // No badge should be rendered for undefined
      expect(screen.queryByText(/tide preferred/i)).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should render semantic HTML structure", () => {
      render(
        <TideConditionsCard
          prose="Accessibility test"
          preferredDirection="rising"
        />
      );

      // Card should contain proper heading
      expect(screen.getByText("Best Tide Conditions")).toBeInTheDocument();

      // Prose should be in a paragraph
      const prose = screen.getByText("Accessibility test");
      expect(prose.tagName).toBe("P");
    });

    it("should maintain readable text hierarchy", () => {
      render(
        <TideConditionsCard
          prose="Text hierarchy test"
          preferredDirection="rising"
        />
      );

      const title = screen.getByText("Best Tide Conditions");
      const prose = screen.getByText("Text hierarchy test");

      // Title should have larger font
      expect(title).toHaveClass("text-lg");

      // Prose should have smaller font
      expect(prose).toHaveClass("text-sm");
    });

    it("should have proper color contrast", () => {
      render(
        <TideConditionsCard
          prose="Color contrast test"
          preferredDirection="rising"
        />
      );

      const title = screen.getByText("Best Tide Conditions");
      expect(title).toHaveClass("text-[#F4EBD8]");

      const prose = screen.getByText("Color contrast test");
      expect(prose).toHaveClass("text-[#11100D]");
    });
  });

  describe("Component structure", () => {
    it("should render header with brand background", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Header test"
          preferredDirection="rising"
        />
      );

      // Find the header section by looking for the element containing the title
      const header = screen.getByText("Best Tide Conditions").closest("header");

      expect(header).toHaveClass("bg-[#0B3A75]", "border-b-2");
    });

    it("should render CardContent with proper spacing", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Content spacing test"
          preferredDirection="rising"
        />
      );

      const prose = screen.getByText("Content spacing test");
      const content = prose.closest("div");

      expect(content).toHaveClass("space-y-4");
    });

    it("should maintain consistent icon sizing", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Icon sizing test"
          preferredDirection="rising"
        />
      );

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-5", "w-5");
    });

    it("should apply consistent icon color", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Icon color test"
          preferredDirection="rising"
        />
      );

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-[#F78E42]");
    });
  });

  describe("Integration scenarios", () => {
    it("should render complete card with all elements", () => {
      render(
        <TideConditionsCard
          prose="Complete surf spot with optimal tide conditions. Best surfed 2 hours before to 1 hour after high tide."
          preferredDirection="rising"
        />
      );

      // All main elements should be present
      expect(screen.getByText("Best Tide Conditions")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Complete surf spot with optimal tide conditions/
        )
      ).toBeInTheDocument();
      expect(screen.getByText("Rising tide preferred")).toBeInTheDocument();
    });

    it("should render minimal card with only prose", () => {
      render(
        <TideConditionsCard
          prose="Minimal tide information"
          preferredDirection={null}
        />
      );

      // Title and prose should be present
      expect(screen.getByText("Best Tide Conditions")).toBeInTheDocument();
      expect(screen.getByText("Minimal tide information")).toBeInTheDocument();

      // Badge should not be present
      expect(screen.queryByText(/tide preferred/i)).not.toBeInTheDocument();
    });

    it("should handle real-world tide prose examples", () => {
      const realWorldExamples = [
        "Works on all tides but best at mid to high tide",
        "Low tide exposes reef - high tide recommended for beginners",
        "Best 2hrs before to 2hrs after high tide",
        "Consistent on any tide",
      ];

      realWorldExamples.forEach((prose) => {
        const { rerender } = render(
          <TideConditionsCard prose={prose} preferredDirection="rising" />
        );

        expect(screen.getByText(prose)).toBeInTheDocument();

        // Clean up for next iteration
        rerender(
          <TideConditionsCard prose="" preferredDirection="rising" />
        );
      });
    });
  });

  describe("Responsive behavior", () => {
    it("should apply responsive classes for different screen sizes", () => {
      const { container } = render(
        <TideConditionsCard
          prose="Responsive test"
          preferredDirection="rising"
        />
      );

      const card = container.firstChild as HTMLElement;
      // Card should have responsive shadow and border
      expect(card).toHaveClass("shadow-[3px_3px_0_#11100D]", "border-[#11100D]");
    });

    it("should maintain readability on all devices", () => {
      render(
        <TideConditionsCard
          prose="Mobile-friendly tide information"
          preferredDirection="rising"
        />
      );

      const prose = screen.getByText("Mobile-friendly tide information");
      // Text should have appropriate sizing for mobile
      expect(prose).toHaveClass("text-sm", "leading-relaxed");
    });
  });
});
