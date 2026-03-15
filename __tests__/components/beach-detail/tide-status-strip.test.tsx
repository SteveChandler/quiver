/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { TideStatusStrip } from "@/components/beach-detail/tide-status-strip";
import type { DynamicTideResult } from "@/hooks/use-dynamic-tide";

jest.mock("@/lib/formatters/surf-data", () => ({
  formatTideHeight: jest.fn((ft: number) => `${ft.toFixed(1)}ft`),
}));

const baseTide: DynamicTideResult = {
  nextTide: { type: "high", height: 5.2, time: Date.now() / 1000 + 3600 },
  minutesUntil: 102,
  nextHigh: { type: "high", height: 5.2, time: Date.now() / 1000 + 3600 },
  nextLow: null,
  minutesToHigh: 102,
  minutesToLow: null,
  usingFallback: false,
  currentDirection: "rising",
  minutesToDirectionChange: 102,
};

describe("TideStatusStrip", () => {
  it("renders Rising state with next tide info", () => {
    render(<TideStatusStrip dynamicTide={baseTide} />);

    expect(screen.getByTestId("tide-status-strip")).toBeInTheDocument();
    expect(screen.getByText("Rising")).toBeInTheDocument();
    expect(screen.getByText(/Next High 5\.2ft/)).toBeInTheDocument();
    expect(screen.getByText(/in 1h 42m/)).toBeInTheDocument();
  });

  it("renders Falling state", () => {
    const fallingTide: DynamicTideResult = {
      ...baseTide,
      currentDirection: "falling",
      nextTide: { type: "low", height: 0.3, time: Date.now() / 1000 + 1800 },
      minutesUntil: 30,
    };

    render(<TideStatusStrip dynamicTide={fallingTide} />);

    expect(screen.getByText("Falling")).toBeInTheDocument();
    expect(screen.getByText(/Next Low 0\.3ft/)).toBeInTheDocument();
    expect(screen.getByText(/in 30m/)).toBeInTheDocument();
  });

  it("renders Slack state", () => {
    const slackTide: DynamicTideResult = {
      ...baseTide,
      currentDirection: "slack",
    };

    render(<TideStatusStrip dynamicTide={slackTide} />);

    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("returns null when currentDirection is null", () => {
    const nullTide: DynamicTideResult = {
      ...baseTide,
      currentDirection: null,
    };

    const { container } = render(<TideStatusStrip dynamicTide={nullTide} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders without next tide info when nextTide is null", () => {
    const noNextTide: DynamicTideResult = {
      ...baseTide,
      nextTide: null,
      minutesUntil: null,
    };

    render(<TideStatusStrip dynamicTide={noNextTide} />);

    expect(screen.getByText("Rising")).toBeInTheDocument();
    expect(screen.queryByText(/Next/)).not.toBeInTheDocument();
  });
});
