import { render, screen } from "@testing-library/react";
import { TideDirection } from "@/components/ui/tide-direction";

describe("TideDirection", () => {
  describe("compact variant (default)", () => {
    it("should render rising tide with correct styling", () => {
      render(<TideDirection status="Rising" currentHeight="3.2 ft" />);

      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.getByText("(3.2 ft)")).toBeInTheDocument();

      // Check for rising tide icon (TrendingUp)
      const container = screen.getByText("Rising").parentElement;
      const icon = container?.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon).toHaveClass("text-green-600");
    });

    it("should render falling tide with correct styling", () => {
      render(<TideDirection status="Falling" currentHeight="1.8 ft" />);

      expect(screen.getByText("Falling")).toBeInTheDocument();
      expect(screen.getByText("(1.8 ft)")).toBeInTheDocument();

      const container = screen.getByText("Falling").parentElement;
      const icon = container?.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon).toHaveClass("text-red-600");
    });

    it("should render high slack tide with correct styling", () => {
      render(<TideDirection status="High Slack" currentHeight="4.1 ft" />);

      expect(screen.getByText("High Slack")).toBeInTheDocument();
      expect(screen.getByText("(4.1 ft)")).toBeInTheDocument();

      const container = screen.getByText("High Slack").parentElement;
      const icon = container?.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon).toHaveClass("text-blue-600");
    });

    it("should render low slack tide with correct styling", () => {
      render(<TideDirection status="Low Slack" currentHeight="0.5 ft" />);

      expect(screen.getByText("Low Slack")).toBeInTheDocument();
      expect(screen.getByText("(0.5 ft)")).toBeInTheDocument();

      const container = screen.getByText("Low Slack").parentElement;
      const icon = container?.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon).toHaveClass("text-gray-600");
    });

    it("should handle unknown tide status", () => {
      render(<TideDirection status="Unknown" currentHeight="2.0 ft" />);

      expect(screen.getByText("Unknown")).toBeInTheDocument();
      expect(screen.getByText("(2.0 ft)")).toBeInTheDocument();

      const container = screen.getByText("Unknown").parentElement;
      const icon = container?.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon).toHaveClass("text-gray-500");
    });

    it("should render without current height", () => {
      render(<TideDirection status="Rising" />);

      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <TideDirection
          status="Rising"
          currentHeight="3.2 ft"
          className="custom-tide-class"
        />
      );

      const tideContainer = container.firstChild as HTMLElement;
      expect(tideContainer).toHaveClass("custom-tide-class");
    });
  });

  describe("detailed variant", () => {
    it("should render rising tide in detailed format", () => {
      const { container } = render(
        <TideDirection
          status="Rising"
          currentHeight="3.2 ft"
          variant="detailed"
        />
      );

      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.getByText("3.2 ft")).toBeInTheDocument();
      expect(screen.getByText("Tide is coming in")).toBeInTheDocument();

      // Check for detailed layout with background color - get the root container
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("bg-green-50", "border-green-200");
    });

    it("should render falling tide in detailed format", () => {
      const { container } = render(
        <TideDirection
          status="Falling"
          currentHeight="1.8 ft"
          variant="detailed"
        />
      );

      expect(screen.getByText("Falling")).toBeInTheDocument();
      expect(screen.getByText("1.8 ft")).toBeInTheDocument();
      expect(screen.getByText("Tide is going out")).toBeInTheDocument();

      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("bg-red-50", "border-red-200");
    });

    it("should render high slack in detailed format", () => {
      const { container } = render(
        <TideDirection
          status="High Slack"
          currentHeight="4.1 ft"
          variant="detailed"
        />
      );

      expect(screen.getByText("High Slack")).toBeInTheDocument();
      expect(screen.getByText("4.1 ft")).toBeInTheDocument();
      expect(screen.getByText("Near high tide")).toBeInTheDocument();

      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("bg-blue-50", "border-blue-200");
    });

    it("should render low slack in detailed format", () => {
      const { container } = render(
        <TideDirection
          status="Low Slack"
          currentHeight="0.5 ft"
          variant="detailed"
        />
      );

      expect(screen.getByText("Low Slack")).toBeInTheDocument();
      expect(screen.getByText("0.5 ft")).toBeInTheDocument();
      expect(screen.getByText("Near low tide")).toBeInTheDocument();

      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("bg-gray-50", "border-gray-200");
    });

    it("should render detailed format without current height", () => {
      render(<TideDirection status="Rising" variant="detailed" />);

      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.getByText("Tide is coming in")).toBeInTheDocument();
      // Height should not be displayed when not provided
      expect(screen.queryByText(/ft/)).not.toBeInTheDocument();
    });
  });

  describe("status parsing", () => {
    it("should handle case insensitive status matching", () => {
      render(<TideDirection status="RISING" />);
      expect(screen.getByText("Rising")).toBeInTheDocument();

      render(<TideDirection status="falling" />);
      expect(screen.getByText("Falling")).toBeInTheDocument();

      render(<TideDirection status="High slack" />);
      expect(screen.getByText("High Slack")).toBeInTheDocument();

      render(<TideDirection status="LOW SLACK" />);
      expect(screen.getByText("Low Slack")).toBeInTheDocument();
    });

    it("should handle partial status matching", () => {
      render(<TideDirection status="Tide is rising rapidly" />);
      expect(screen.getByText("Rising")).toBeInTheDocument();

      render(<TideDirection status="Currently falling" />);
      expect(screen.getByText("Falling")).toBeInTheDocument();

      render(<TideDirection status="High tide slack water" />);
      expect(screen.getByText("High Slack")).toBeInTheDocument();

      render(<TideDirection status="Low slack tide" />);
      expect(screen.getByText("Low Slack")).toBeInTheDocument();
    });

    it("should default to unknown for unrecognized status", () => {
      render(<TideDirection status="Completely unrecognized status" />);
      expect(screen.getByText("Unknown")).toBeInTheDocument();
      // Note: "Tide status unavailable" text is only shown in detailed variant
    });

    it("should handle empty status", () => {
      render(<TideDirection status="" />);
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper semantic structure for compact variant", () => {
      render(<TideDirection status="Rising" currentHeight="3.2 ft" />);

      const container = screen.getByText("Rising").parentElement;
      expect(container).toHaveClass("flex", "items-center");

      // Text should be visible and readable
      expect(screen.getByText("Rising")).toBeVisible();
      expect(screen.getByText("(3.2 ft)")).toBeVisible();
    });

    it("should have proper semantic structure for detailed variant", () => {
      render(
        <TideDirection
          status="Rising"
          currentHeight="3.2 ft"
          variant="detailed"
        />
      );

      expect(screen.getByText("Rising")).toBeVisible();
      expect(screen.getByText("3.2 ft")).toBeVisible();
      expect(screen.getByText("Tide is coming in")).toBeVisible();
    });

    it("should have proper color contrast for different states", () => {
      const { rerender } = render(<TideDirection status="Rising" />);

      let icon = screen.getByText("Rising").parentElement?.querySelector("svg");
      expect(icon).toHaveClass("text-green-600");

      rerender(<TideDirection status="Falling" />);
      icon = screen.getByText("Falling").parentElement?.querySelector("svg");
      expect(icon).toHaveClass("text-red-600");

      rerender(<TideDirection status="High Slack" />);
      icon = screen.getByText("High Slack").parentElement?.querySelector("svg");
      expect(icon).toHaveClass("text-blue-600");

      rerender(<TideDirection status="Unknown" />);
      icon = screen.getByText("Unknown").parentElement?.querySelector("svg");
      expect(icon).toHaveClass("text-gray-500");
    });
  });

  describe("edge cases", () => {
    it("should handle very long status strings", () => {
      const longStatus =
        "This is an extremely long tide status that should still be parsed correctly if it contains the word rising";
      render(<TideDirection status={longStatus} />);
      expect(screen.getByText("Rising")).toBeInTheDocument();
    });

    it("should handle very long current height values", () => {
      render(
        <TideDirection
          status="Rising"
          currentHeight="3.123456789 ft above mean lower low water"
        />
      );
      expect(
        screen.getByText("(3.123456789 ft above mean lower low water)")
      ).toBeInTheDocument();
    });

    it("should handle special characters in status", () => {
      render(<TideDirection status="Rising-Tide/Status*123" />);
      expect(screen.getByText("Rising")).toBeInTheDocument();
    });

    it("should handle null-like currentHeight values", () => {
      render(<TideDirection status="Rising" currentHeight="" />);
      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.queryByText("()")).not.toBeInTheDocument();
    });
  });

  describe("styling consistency", () => {
        it("should maintain consistent icon sizing", () => {
      const { rerender, container } = render(<TideDirection status="Rising" />);
      
      let icon = screen.getByText("Rising").parentElement?.querySelector("svg");
      expect(icon).toHaveClass("h-4", "w-4");

      rerender(<TideDirection status="Rising" variant="detailed" />);
      // In detailed variant, icon is in the circular container
      const iconContainer = container.querySelector("[class*='w-10 h-10']");
      icon = iconContainer?.querySelector("svg") || null;
      expect(icon).toHaveClass("h-5", "w-5");
    });

    it("should apply consistent spacing in compact variant", () => {
      render(<TideDirection status="Rising" currentHeight="3.2 ft" />);
      
      const container = screen.getByText("Rising").parentElement;
      expect(container).toHaveClass("gap-1");
    });

    it("should apply consistent spacing in detailed variant", () => {
      const { container } = render(
        <TideDirection 
          status="Rising" 
          currentHeight="3.2 ft" 
          variant="detailed" 
        />
      );
      
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("gap-3", "p-3");
    });
  });
});
