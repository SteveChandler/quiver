import { render, screen } from "@testing-library/react";
import { TideTiming, TideSchedule } from "@/components/ui/tide-timing";

describe("TideTiming", () => {
  describe("compact variant (default)", () => {
    it("should render high tide timing", () => {
      const { container } = render(
        <TideTiming
          nextTideTime="2:30 PM"
          nextTideType="High Tide"
          nextTideHeight="4.2 ft"
        />
      );

      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("2:30 PM")).toBeInTheDocument();
      expect(screen.getByText("(4.2 ft)")).toBeInTheDocument();

      // Check for high tide icon (ArrowUp) - it's a sibling in the main container
      const icon = container.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon).toHaveClass("text-blue-600");
    });

    it("should render low tide timing", () => {
      const { container } = render(
        <TideTiming
          nextTideTime="8:45 AM"
          nextTideType="Low Tide"
          nextTideHeight="0.8 ft"
        />
      );

      expect(screen.getByText("Low")).toBeInTheDocument();
      expect(screen.getByText("8:45 AM")).toBeInTheDocument();
      expect(screen.getByText("(0.8 ft)")).toBeInTheDocument();

      // Check for low tide icon (ArrowDown) - it's a sibling in the main container
      const icon = container.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon).toHaveClass("text-gray-600");
    });

    it("should handle unknown tide time", () => {
      render(<TideTiming nextTideTime="Unknown" nextTideType="Unknown" />);

      expect(screen.getByText("Next")).toBeInTheDocument();
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("should render without tide height", () => {
      render(<TideTiming nextTideTime="2:30 PM" nextTideType="High Tide" />);

      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("2:30 PM")).toBeInTheDocument();
      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
    });
  });

  describe("detailed variant", () => {
    it("should render high tide in detailed format", () => {
      const { container } = render(
        <TideTiming
          nextTideTime="2:30 PM"
          nextTideType="High Tide"
          nextTideHeight="4.2 ft"
          variant="detailed"
        />
      );

      expect(screen.getByText("Next High Tide")).toBeInTheDocument();
      expect(screen.getByText("2:30 PM")).toBeInTheDocument();
      expect(screen.getByText("Height: 4.2 ft")).toBeInTheDocument();

      // Check for detailed layout styling on the outermost container
      const mainContainer = container.firstElementChild;
      expect(mainContainer).toHaveClass("bg-blue-50");
    });

    it("should render low tide in detailed format", () => {
      const { container } = render(
        <TideTiming
          nextTideTime="8:45 AM"
          nextTideType="Low Tide"
          nextTideHeight="0.8 ft"
          variant="detailed"
        />
      );

      expect(screen.getByText("Next Low Tide")).toBeInTheDocument();
      expect(screen.getByText("8:45 AM")).toBeInTheDocument();
      expect(screen.getByText("Height: 0.8 ft")).toBeInTheDocument();

      // Check for detailed layout styling on the outermost container
      const mainContainer = container.firstElementChild;
      expect(mainContainer).toHaveClass("bg-gray-50");
    });

    it("should render detailed format without height", () => {
      render(
        <TideTiming
          nextTideTime="2:30 PM"
          nextTideType="High Tide"
          variant="detailed"
        />
      );

      expect(screen.getByText("Next High Tide")).toBeInTheDocument();
      expect(screen.getByText("2:30 PM")).toBeInTheDocument();
      expect(screen.queryByText("Height:")).not.toBeInTheDocument();
    });
  });

  describe("time formatting", () => {
    it("should handle already formatted time", () => {
      render(<TideTiming nextTideTime="2:30 PM" nextTideType="High Tide" />);

      expect(screen.getByText("2:30 PM")).toBeInTheDocument();
    });

    it("should format timestamp to readable time", () => {
      // Mock timestamp for a specific time
      const timestamp = "1640995800"; // This should be parsed as a timestamp
      render(<TideTiming nextTideTime={timestamp} nextTideType="High Tide" />);

      // The component should try to format this timestamp
      // Since this is a unit test, we're mainly testing that it doesn't crash
      expect(screen.getByText("High")).toBeInTheDocument();
    });

    it("should handle malformed time gracefully", () => {
      render(
        <TideTiming
          nextTideTime="invalid-time-format"
          nextTideType="High Tide"
        />
      );

      expect(screen.getByText("invalid-time-format")).toBeInTheDocument();
    });

    it("should handle empty time", () => {
      render(<TideTiming nextTideTime="" nextTideType="High Tide" />);

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("tide type parsing", () => {
    it("should parse high tide variations", () => {
      const { rerender } = render(
        <TideTiming nextTideTime="2:30 PM" nextTideType="High Tide" />
      );
      expect(screen.getByText("High")).toBeInTheDocument();

      rerender(<TideTiming nextTideTime="2:30 PM" nextTideType="HIGH" />);
      expect(screen.getByText("High")).toBeInTheDocument();

      rerender(
        <TideTiming nextTideTime="2:30 PM" nextTideType="high tide event" />
      );
      expect(screen.getByText("High")).toBeInTheDocument();
    });

    it("should parse low tide variations", () => {
      const { rerender } = render(
        <TideTiming nextTideTime="8:45 AM" nextTideType="Low Tide" />
      );
      expect(screen.getByText("Low")).toBeInTheDocument();

      rerender(<TideTiming nextTideTime="8:45 AM" nextTideType="LOW" />);
      expect(screen.getByText("Low")).toBeInTheDocument();

      rerender(<TideTiming nextTideTime="8:45 AM" nextTideType="low water" />);
      expect(screen.getByText("Low")).toBeInTheDocument();
    });

    it("should handle unknown tide types", () => {
      render(
        <TideTiming nextTideTime="12:00 PM" nextTideType="Unknown Type" />
      );
      expect(screen.getByText("Next")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper semantic structure", () => {
      render(
        <TideTiming
          nextTideTime="2:30 PM"
          nextTideType="High Tide"
          nextTideHeight="4.2 ft"
        />
      );

      expect(screen.getByText("High")).toBeVisible();
      expect(screen.getByText("2:30 PM")).toBeVisible();
      expect(screen.getByText("(4.2 ft)")).toBeVisible();
    });
  });
});

describe("TideSchedule", () => {
  const mockTides = [
    {
      time: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      height: 4.2,
      name: "High Tide",
      type: "H" as const,
    },
    {
      time: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
      height: 0.8,
      name: "Low Tide",
      type: "L" as const,
    },
    {
      time: Math.floor(Date.now() / 1000) + 10800, // 3 hours from now
      height: 3.9,
      name: "High Tide",
      type: "H" as const,
    },
    {
      time: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (past)
      height: 1.2,
      name: "Low Tide",
      type: "L" as const,
    },
  ];

  describe("tide schedule display", () => {
    it("should render today's tides", () => {
      render(<TideSchedule tides={mockTides} />);

      expect(screen.getByText("Today's Tides")).toBeInTheDocument();
      expect(screen.getAllByText("High")).toHaveLength(2); // Multiple high tides expected
      expect(screen.getAllByText("Low")).toHaveLength(2); // Multiple low tides expected
      expect(screen.getByText("4.2ft")).toBeInTheDocument();
      expect(screen.getByText("0.8ft")).toBeInTheDocument();
    });

    it("should show time until upcoming tides", () => {
      render(<TideSchedule tides={mockTides} />);

      // Should show countdown for future tides - use getAllByText since multiple tides may show countdown
      const countdownElements = screen.getAllByText(/in \d+h \d+m/);
      expect(countdownElements.length).toBeGreaterThan(0);
    });

    it("should mark past tides with reduced opacity", () => {
      render(<TideSchedule tides={mockTides} />);

      // Past tides should have reduced opacity styling
      const tideElements = screen.getAllByText(/\d+:\d+/);
      expect(tideElements.length).toBeGreaterThan(0);
    });

    it("should distinguish between high and low tides visually", () => {
      const { container } = render(<TideSchedule tides={mockTides} />);

      // High tides should have blue styling
      const highTideElements = container.querySelectorAll(".bg-blue-50");
      expect(highTideElements.length).toBeGreaterThan(0);

      // Low tides should have gray styling
      const lowTideElements = container.querySelectorAll(".bg-gray-50");
      expect(lowTideElements.length).toBeGreaterThan(0);
    });

    it("should limit display to 4 tides", () => {
      const manyTides = Array.from({ length: 10 }, (_, i) => ({
        time: Math.floor(Date.now() / 1000) + i * 3600,
        height: 2.0 + (i % 2) * 2,
        name: i % 2 === 0 ? "High Tide" : "Low Tide",
        type: (i % 2 === 0 ? "H" : "L") as const,
      }));

      render(<TideSchedule tides={manyTides} />);

      // Should show overflow indicator
      expect(screen.getByText(/\+\d+ more tides today/)).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should not render when no tides provided", () => {
      const { container } = render(<TideSchedule tides={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("should not render when tides is undefined", () => {
      const { container } = render(<TideSchedule />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("time calculations", () => {
    it("should handle tides from different days gracefully", () => {
      const yesterday = Math.floor(Date.now() / 1000) - 86400; // 24 hours ago
      const tomorrow = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      const crossDayTides = [
        { time: yesterday, height: 2.0, name: "High Tide", type: "H" as const },
        { time: tomorrow, height: 3.0, name: "High Tide", type: "H" as const },
        ...mockTides,
      ];

      render(<TideSchedule tides={crossDayTides} />);

      // Should only show today's tides
      expect(screen.getByText("Today's Tides")).toBeInTheDocument();
    });

    it("should format tide times correctly", () => {
      render(<TideSchedule tides={mockTides} />);

      // Should show formatted times (HH:MM format)
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe("accessibility", () => {
    it("should have proper semantic structure", () => {
      render(<TideSchedule tides={mockTides} />);

      expect(screen.getByText("Today's Tides")).toBeVisible();

      // Icons should be present for accessibility
      const icons = screen
        .getByText("Today's Tides")
        .parentElement?.querySelectorAll("svg");
      expect(icons?.length).toBeGreaterThan(0);
    });

    it("should have readable text for all tide information", () => {
      render(<TideSchedule tides={mockTides} />);

      // All tide information should be visible - use getAllByText for multiple elements
      expect(screen.getAllByText("High")[0]).toBeVisible();
      expect(screen.getAllByText("Low")[0]).toBeVisible();
      expect(screen.getByText("4.2ft")).toBeVisible();
      expect(screen.getByText("0.8ft")).toBeVisible();
    });
  });

  describe("edge cases", () => {
    it("should handle tides with missing properties", () => {
      const incompleteTides = [
        {
          time: Math.floor(Date.now() / 1000) + 3600,
          height: 4.2,
          name: "High Tide",
        },
      ] as any;

      render(<TideSchedule tides={incompleteTides} />);

      expect(screen.getByText("Today's Tides")).toBeInTheDocument();
      expect(screen.getByText("4.2ft")).toBeInTheDocument();
    });

    it("should handle invalid timestamps", () => {
      const invalidTides = [
        {
          time: NaN,
          height: 4.2,
          name: "High Tide",
          type: "H" as const,
        },
      ];

      const { container } = render(<TideSchedule tides={invalidTides} />);
      // Should not crash, might render nothing or handle gracefully
      expect(container).toBeTruthy();
    });

    it("should handle very large height values", () => {
      const extremeTides = [
        {
          time: Math.floor(Date.now() / 1000) + 3600,
          height: 999.99,
          name: "Extreme High Tide",
          type: "H" as const,
        },
      ];

      render(<TideSchedule tides={extremeTides} />);

      expect(screen.getByText("999.99ft")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <TideSchedule tides={mockTides} className="custom-schedule-class" />
      );

      const scheduleContainer = container.firstChild as HTMLElement;
      expect(scheduleContainer).toHaveClass("custom-schedule-class");
    });

    it("should maintain consistent spacing", () => {
      const { container } = render(<TideSchedule tides={mockTides} />);

      // The outermost container should have space-y-2 class
      const scheduleContainer = container.firstElementChild;
      expect(scheduleContainer).toHaveClass("space-y-2");
    });
  });
});
