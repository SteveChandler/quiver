import React from "react";
import { render, screen } from "@testing-library/react";
import {
  TideTooltipContent,
  ChartReferenceLine,
  ChartDateAxis,
  ChartTideAxis,
  formatChartTime,
  formatChartDate,
  getTideChartConfig,
} from "@/components/ui/chart";

// Mock Recharts components
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceLine: (props: any) => (
    <div data-testid="reference-line" {...props} />
  ),
  XAxis: (props: any) => <g data-testid="x-axis" {...props} />,
  YAxis: (props: any) => <g data-testid="y-axis" {...props} />,
}));

describe("Enhanced Chart Utilities", () => {
  describe("TideTooltipContent", () => {
    it("should render tide tooltip with high tide data", () => {
      const mockPayload = [
        {
          payload: {
            type: "high",
            height: 5.2,
            time: new Date("2024-01-15T14:30:00Z"),
          },
        },
      ];

      render(<TideTooltipContent active={true} payload={mockPayload} />);

      expect(screen.getByText("High tide")).toBeInTheDocument();
      expect(screen.getByText("5.2 ft")).toBeInTheDocument();
      expect(screen.getByText("Height:")).toBeInTheDocument();
      expect(screen.getByText("Time:")).toBeInTheDocument();
    });

    it("should render tide tooltip with low tide data", () => {
      const mockPayload = [
        {
          payload: {
            type: "low",
            height: -1.5,
            time: new Date("2024-01-15T08:15:00Z"),
          },
        },
      ];

      render(<TideTooltipContent active={true} payload={mockPayload} />);

      expect(screen.getByText("Low tide")).toBeInTheDocument();
      expect(screen.getByText("-1.5 ft")).toBeInTheDocument();
    });

    it("should not render when inactive", () => {
      const { container } = render(
        <TideTooltipContent active={false} payload={[]} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should not render when no payload", () => {
      const { container } = render(
        <TideTooltipContent active={true} payload={[]} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should handle string height values", () => {
      const mockPayload = [
        {
          payload: {
            type: "high",
            height: "3.5",
            time: new Date("2024-01-15T14:30:00Z"),
          },
        },
      ];

      render(<TideTooltipContent active={true} payload={mockPayload} />);

      expect(screen.getByText("3.5 ft")).toBeInTheDocument();
    });
  });

  describe("ChartReferenceLine", () => {
    it("should render reference line with default props", () => {
      const { container } = render(<ChartReferenceLine x={100} />);

      const line = container.querySelector('[data-testid="reference-line"]');
      expect(line).toBeInTheDocument();
      expect(line).toHaveAttribute("x", "100");
    });

    it("should render reference line with custom props", () => {
      const { container } = render(
        <ChartReferenceLine
          y={50}
          stroke="#FF0000"
          strokeDasharray="10 5"
          strokeWidth={3}
        />
      );

      const line = container.querySelector('[data-testid="reference-line"]');
      expect(line).toBeInTheDocument();
      expect(line).toHaveAttribute("y", "50");
    });
  });

  describe("ChartDateAxis", () => {
    it("should render date axis with default props", () => {
      const { container } = render(<ChartDateAxis />);

      const axis = container.querySelector('[data-testid="x-axis"]');
      expect(axis).toBeInTheDocument();
    });

    it("should use custom dataKey", () => {
      const { container } = render(<ChartDateAxis dataKey="timestamp" />);

      const axis = container.querySelector('[data-testid="x-axis"]');
      expect(axis).toHaveAttribute("dataKey", "timestamp");
    });
  });

  describe("ChartTideAxis", () => {
    it("should render tide axis with default domain", () => {
      const { container } = render(<ChartTideAxis />);

      const axis = container.querySelector('[data-testid="y-axis"]');
      expect(axis).toBeInTheDocument();
    });

    it("should use custom domain", () => {
      const { container } = render(<ChartTideAxis domain={[-10, 10]} />);

      const axis = container.querySelector('[data-testid="y-axis"]');
      expect(axis).toBeInTheDocument();
    });

    it("should use custom label", () => {
      const { container } = render(<ChartTideAxis label="Custom Height (m)" />);

      const axis = container.querySelector('[data-testid="y-axis"]');
      expect(axis).toBeInTheDocument();
    });
  });

  describe("Utility Functions", () => {
    describe("formatChartTime", () => {
      it("should format Date object to time string", () => {
        const date = new Date("2024-01-15T14:30:00Z");
        const result = formatChartTime(date);

        // The exact format depends on locale, but should contain time components
        expect(result).toMatch(/\d{1,2}:\d{2}/); // HH:MM format
        expect(result).toMatch(/(AM|PM)/); // 12-hour format
      });

      it("should format timestamp to time string", () => {
        const timestamp = new Date("2024-01-15T08:15:00Z").getTime();
        const result = formatChartTime(timestamp);

        expect(result).toMatch(/\d{1,2}:\d{2}/);
        expect(result).toMatch(/(AM|PM)/);
      });

      it("should format string date to time string", () => {
        const dateString = "2024-01-15T20:45:00Z";
        const result = formatChartTime(dateString);

        expect(result).toMatch(/\d{1,2}:\d{2}/);
        expect(result).toMatch(/(AM|PM)/);
      });
    });

    describe("formatChartDate", () => {
      it("should format Date object to date string", () => {
        const date = new Date("2024-01-15T14:30:00Z");
        const result = formatChartDate(date);

        expect(result).toMatch(/Jan \d{1,2}/); // Month abbreviation and day
      });

      it("should format timestamp to date string", () => {
        const timestamp = new Date("2024-03-22T08:15:00Z").getTime();
        const result = formatChartDate(timestamp);

        expect(result).toMatch(/Mar \d{1,2}/);
      });

      it("should format string date to date string", () => {
        const dateString = "2024-12-05T20:45:00Z";
        const result = formatChartDate(dateString);

        expect(result).toMatch(/Dec \d{1,2}/);
      });
    });

    describe("getTideChartConfig", () => {
      it("should return chart config with tide-specific colors", () => {
        const config = getTideChartConfig();

        expect(config).toHaveProperty("tideHeight");
        expect(config).toHaveProperty("highTide");
        expect(config).toHaveProperty("lowTide");

        expect(config.tideHeight.color).toBe("#FF3B8B"); // Hot pink (primary)
        expect(config.highTide.color).toBe("#FFD639"); // Electric yellow
        expect(config.lowTide.color).toBe("#333333"); // Dark grey

        expect(config.tideHeight.label).toBe("Tide Height");
        expect(config.highTide.label).toBe("High Tide");
        expect(config.lowTide.label).toBe("Low Tide");
      });
    });
  });
});
