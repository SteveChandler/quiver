/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TideChartSection } from "@/components/beach-detail/tide-chart-section";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock dynamic import — TideChart rendered as a stub
jest.mock("next/dynamic", () => (fn: any) => {
  const Component = (props: any) => (
    <div
      data-testid="tide-chart"
      data-window-hours={props.windowHours}
      data-compact={props.compact}
    />
  );
  Component.displayName = "DynamicTideChart";
  return Component;
});

jest.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

const mockForecast: EnhancedForecastEntity = {
  id: "f1",
  beach_id: "beach-1",
  forecast_at: "2026-02-10T12:00Z",
  forecast_date: "2026-02-10",
  forecast_time: "12:00",
  wave_height: "4.5",
  wave_period: "12",
  wind_speed: "8",
  wind_direction: "NW",
  wave_direction: "SW",
  water_temp: "60",
  tide_height: "3.2",
  tide_status: "rising",
} as any;

describe("TideChartSection", () => {
  it("renders the chart with Tide Forecast heading", () => {
    render(<TideChartSection forecasts={[mockForecast]} />);

    expect(screen.getByTestId("tide-chart-section")).toBeInTheDocument();
    expect(screen.getByText("Tide Forecast")).toBeInTheDocument();
    expect(screen.getByTestId("tide-chart")).toBeInTheDocument();
  });

  it("renders time range toggle with Today, 3-Day, 7-Day options", () => {
    render(<TideChartSection forecasts={[mockForecast]} />);

    expect(screen.getByRole("tab", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "3-Day" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "7-Day" })).toBeInTheDocument();
  });

  it("defaults to Today (18h) window", () => {
    render(<TideChartSection forecasts={[mockForecast]} />);

    const chart = screen.getByTestId("tide-chart");
    expect(chart).toHaveAttribute("data-window-hours", "18");
  });

  it("switches to 3-Day (72h) window on click", () => {
    render(<TideChartSection forecasts={[mockForecast]} />);

    fireEvent.click(screen.getByRole("tab", { name: "3-Day" }));

    const chart = screen.getByTestId("tide-chart");
    expect(chart).toHaveAttribute("data-window-hours", "72");
  });

  it("switches to 7-Day (168h) window on click", () => {
    render(<TideChartSection forecasts={[mockForecast]} />);

    fireEvent.click(screen.getByRole("tab", { name: "7-Day" }));

    const chart = screen.getByTestId("tide-chart");
    expect(chart).toHaveAttribute("data-window-hours", "168");
  });

  it("returns null when forecasts is empty", () => {
    const { container } = render(<TideChartSection forecasts={[]} />);

    expect(container.firstChild).toBeNull();
  });
});
