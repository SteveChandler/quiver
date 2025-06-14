import { render, screen } from "@testing-library/react";
import {
  BuoyStatusIndicator,
  ConditionBadge,
  WaveQualityBadge,
  DataFreshnessIndicator,
} from "@/components/buoy/status-indicators";

describe("Status Indicators", () => {
  describe("BuoyStatusIndicator", () => {
    it("should render online status", () => {
      render(<BuoyStatusIndicator status="online" />);

      expect(screen.getByText("Online")).toBeInTheDocument();

      // Should have green color indicator
      const colorIndicator = document.querySelector(".bg-green-500");
      expect(colorIndicator).toBeInTheDocument();
    });

    it("should render offline status", () => {
      render(<BuoyStatusIndicator status="offline" />);

      expect(screen.getByText("Offline")).toBeInTheDocument();

      // Should have gray color indicator
      const colorIndicator = document.querySelector(".bg-gray-500");
      expect(colorIndicator).toBeInTheDocument();
    });

    it("should render stale status", () => {
      render(<BuoyStatusIndicator status="stale" />);

      expect(screen.getByText("Stale Data")).toBeInTheDocument();

      // Should have yellow color indicator
      const colorIndicator = document.querySelector(".bg-yellow-500");
      expect(colorIndicator).toBeInTheDocument();
    });

    it("should render error status", () => {
      render(<BuoyStatusIndicator status="error" />);

      expect(screen.getByText("Error")).toBeInTheDocument();

      // Should have red color indicator
      const colorIndicator = document.querySelector(".bg-red-500");
      expect(colorIndicator).toBeInTheDocument();
    });

    it("should render with last update time", () => {
      const lastUpdate = new Date("2024-01-01T12:00:00Z");
      render(<BuoyStatusIndicator status="online" lastUpdate={lastUpdate} />);

      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.getByText("1/1/2024")).toBeInTheDocument();
    });

    it("should render with last update string", () => {
      render(
        <BuoyStatusIndicator
          status="online"
          lastUpdate="2024-01-01T12:00:00Z"
        />
      );

      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.getByText("1/1/2024")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <BuoyStatusIndicator status="online" className="custom-status" />
      );

      expect(container.firstChild).toHaveClass("custom-status");
    });

    it("should render appropriate icons for each status", () => {
      const statuses = ["online", "offline", "stale", "error"] as const;

      statuses.forEach((status) => {
        const { container } = render(<BuoyStatusIndicator status={status} />);
        const icon = container.querySelector("svg");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("ConditionBadge", () => {
    const conditionTypes = [
      "excellent",
      "good",
      "fair",
      "poor",
      "unknown",
    ] as const;

    it("should render different condition types", () => {
      conditionTypes.forEach((type) => {
        const { unmount } = render(<ConditionBadge type={type} />);

        expect(
          screen.getByText(type.charAt(0).toUpperCase() + type.slice(1))
        ).toBeInTheDocument();
        unmount();
      });
    });

    it("should render with custom label", () => {
      render(<ConditionBadge type="excellent" label="Perfect" />);

      expect(screen.getByText("Perfect")).toBeInTheDocument();
      expect(screen.queryByText("Excellent")).not.toBeInTheDocument();
    });

    it("should apply appropriate colors for each condition", () => {
      const expectedColors = {
        excellent: "bg-green-500",
        good: "bg-blue-500",
        fair: "bg-yellow-500",
        poor: "bg-red-500",
        unknown: "bg-gray-500",
      };

      conditionTypes.forEach((type) => {
        const { container } = render(<ConditionBadge type={type} />);
        const badge = container.querySelector(`.${expectedColors[type]}`);
        expect(badge).toBeInTheDocument();
      });
    });

    it("should apply custom className", () => {
      render(<ConditionBadge type="good" className="custom-badge" />);

      const badge = screen.getByText("Good");
      expect(badge).toHaveClass("custom-badge");
    });

    it("should have proper text color for contrast", () => {
      render(<ConditionBadge type="excellent" />);

      const badge = screen.getByText("Excellent");
      expect(badge).toHaveClass("text-white");
    });
  });

  describe("WaveQualityBadge", () => {
    it("should render Small for waves < 2ft", () => {
      render(<WaveQualityBadge waveHeight={1.5} />);

      expect(screen.getByText("Small")).toBeInTheDocument();

      // Should have poor condition color (red)
      const badge = screen.getByText("Small");
      expect(badge).toHaveClass("bg-red-500");
    });

    it("should render Good for waves 2-4ft", () => {
      render(<WaveQualityBadge waveHeight={3.0} />);

      expect(screen.getByText("Good")).toBeInTheDocument();

      // Should have good condition color (blue)
      const badge = screen.getByText("Good");
      expect(badge).toHaveClass("bg-blue-500");
    });

    it("should render Great for waves 4-6ft", () => {
      render(<WaveQualityBadge waveHeight={5.0} />);

      expect(screen.getByText("Great")).toBeInTheDocument();

      // Should have excellent condition color (green)
      const badge = screen.getByText("Great");
      expect(badge).toHaveClass("bg-green-500");
    });

    it("should render Epic for waves > 6ft", () => {
      render(<WaveQualityBadge waveHeight={8.0} />);

      expect(screen.getByText("Epic")).toBeInTheDocument();

      // Should have excellent condition color (green)
      const badge = screen.getByText("Epic");
      expect(badge).toHaveClass("bg-green-500");
    });

    it("should render No Data for undefined wave height", () => {
      render(<WaveQualityBadge waveHeight={undefined} />);

      expect(screen.getByText("No Data")).toBeInTheDocument();

      // Should have unknown condition color (gray)
      const badge = screen.getByText("No Data");
      expect(badge).toHaveClass("bg-gray-500");
    });

    it("should render No Data for zero wave height", () => {
      render(<WaveQualityBadge waveHeight={0} />);

      expect(screen.getByText("No Data")).toBeInTheDocument();
    });

    it("should handle edge cases for wave height boundaries", () => {
      // Test exact boundary values
      render(<WaveQualityBadge waveHeight={2.0} />);
      expect(screen.getByText("Good")).toBeInTheDocument();

      const { rerender } = render(<WaveQualityBadge waveHeight={4.0} />);
      expect(screen.getByText("Great")).toBeInTheDocument();

      rerender(<WaveQualityBadge waveHeight={6.0} />);
      expect(screen.getByText("Epic")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(
        <WaveQualityBadge waveHeight={3.0} className="custom-wave-badge" />
      );

      const badge = screen.getByText("Good");
      expect(badge).toHaveClass("custom-wave-badge");
    });
  });

  describe("DataFreshnessIndicator", () => {
    beforeEach(() => {
      // Mock Date.now to control current time
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should render online status for recent data (< 1 hour)", () => {
      const recentTimestamp = new Date("2024-01-01T11:30:00Z"); // 30 minutes ago
      render(<DataFreshnessIndicator timestamp={recentTimestamp} />);

      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.getByText("30m ago")).toBeInTheDocument();
    });

    it("should render stale status for old data (1-6 hours)", () => {
      const staleTimestamp = new Date("2024-01-01T08:00:00Z"); // 4 hours ago
      render(<DataFreshnessIndicator timestamp={staleTimestamp} />);

      expect(screen.getByText("Stale Data")).toBeInTheDocument();
      expect(screen.getByText("4h ago")).toBeInTheDocument();
    });

    it("should render offline status for very old data (> 6 hours)", () => {
      const oldTimestamp = new Date("2024-01-01T04:00:00Z"); // 8 hours ago
      render(<DataFreshnessIndicator timestamp={oldTimestamp} />);

      expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("should handle string timestamp", () => {
      const timestampString = "2024-01-01T11:45:00Z"; // 15 minutes ago
      render(<DataFreshnessIndicator timestamp={timestampString} />);

      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.getByText("15m ago")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const timestamp = new Date("2024-01-01T11:00:00Z");
      const { container } = render(
        <DataFreshnessIndicator
          timestamp={timestamp}
          className="custom-freshness"
        />
      );

      expect(container.firstChild).toHaveClass("custom-freshness");
    });

    it("should handle edge cases for time boundaries", () => {
      // Exactly 1 hour ago (should be stale)
      const oneHourAgo = new Date("2024-01-01T11:00:00Z");
      render(<DataFreshnessIndicator timestamp={oneHourAgo} />);
      expect(screen.getByText("Stale Data")).toBeInTheDocument();

      // Exactly 6 hours ago (should be offline)
      const { rerender } = render(
        <DataFreshnessIndicator timestamp={oneHourAgo} />
      );
      const sixHoursAgo = new Date("2024-01-01T06:00:00Z");
      rerender(<DataFreshnessIndicator timestamp={sixHoursAgo} />);
      expect(screen.getByText("Offline")).toBeInTheDocument();
    });
  });

  describe("formatLastUpdate helper function", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should format minutes correctly", () => {
      const timestamp = new Date("2024-01-01T11:45:00Z"); // 15 minutes ago
      render(<BuoyStatusIndicator status="online" lastUpdate={timestamp} />);

      expect(screen.getByText("15m ago")).toBeInTheDocument();
    });

    it("should format hours correctly", () => {
      const timestamp = new Date("2024-01-01T09:00:00Z"); // 3 hours ago
      render(<BuoyStatusIndicator status="online" lastUpdate={timestamp} />);

      expect(screen.getByText("3h ago")).toBeInTheDocument();
    });

    it("should format days correctly", () => {
      const timestamp = new Date("2023-12-30T12:00:00Z"); // 2 days ago
      render(<BuoyStatusIndicator status="online" lastUpdate={timestamp} />);

      // Should show date instead of relative time for old data
      expect(screen.getByText(/12\/30\/2023/)).toBeInTheDocument();
    });

    it("should handle zero time difference", () => {
      const timestamp = new Date("2024-01-01T12:00:00Z"); // Now
      render(<BuoyStatusIndicator status="online" lastUpdate={timestamp} />);

      expect(screen.getByText("0m ago")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", () => {
      render(<BuoyStatusIndicator status="online" />);

      // Should render as a badge component
      const badge = screen.getByText("Online").closest(".inline-flex");
      expect(badge).toBeInTheDocument();
    });

    it("should have readable text contrast", () => {
      const conditions = [
        "excellent",
        "good",
        "fair",
        "poor",
        "unknown",
      ] as const;

      conditions.forEach((condition) => {
        const { container } = render(<ConditionBadge type={condition} />);
        const badge = container.querySelector("[class*='text-white']");
        expect(badge).toBeInTheDocument();
      });
    });

    it("should include meaningful text for screen readers", () => {
      render(<WaveQualityBadge waveHeight={4.5} />);

      // The text should be descriptive enough for screen readers
      expect(screen.getByText("Great")).toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("should handle invalid timestamp gracefully", () => {
      expect(() => {
        render(<DataFreshnessIndicator timestamp={new Date("invalid")} />);
      }).not.toThrow();
    });

    it("should handle negative wave heights", () => {
      render(<WaveQualityBadge waveHeight={-1} />);

      // Negative values are still processed as Small (since -1 < 2)
      expect(screen.getByText("Small")).toBeInTheDocument();
    });

    it("should handle extremely large wave heights", () => {
      render(<WaveQualityBadge waveHeight={100} />);

      // Should still categorize as Epic
      expect(screen.getByText("Epic")).toBeInTheDocument();
    });
  });
});
