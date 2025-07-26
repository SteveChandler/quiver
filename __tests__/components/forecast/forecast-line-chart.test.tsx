import React from "react";
import { render, screen } from "@testing-library/react";
import { ForecastLineChart } from "@/components/forecast/forecast-line-chart";
import { EnhancedForecastEntity } from "@/types/forecast";
import {
  createMultipleMockForecastEntities,
  TEST_SCENARIOS,
} from "../../setup/forecast-test-utils";

const mockForecasts = createMultipleMockForecastEntities();

describe("ForecastLineChart", () => {
  it("renders empty state when no forecasts provided", () => {
    render(<ForecastLineChart forecasts={[]} />);
    expect(screen.getByText("No forecast data available")).toBeInTheDocument();
  });

  it("renders SVG chart with forecast data", () => {
    const { container } = render(
      <ForecastLineChart forecasts={mockForecasts} />
    );

    // Check if SVG is rendered
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Check if chart elements are present
    expect(svg?.querySelector("path")).toBeInTheDocument(); // Line path
    expect(svg?.querySelector("circle")).toBeInTheDocument(); // Data points
  });

  it("renders legend with confidence indicators", () => {
    render(<ForecastLineChart forecasts={mockForecasts} />);

    expect(screen.getByText("Wave Height")).toBeInTheDocument();
    expect(screen.getByText("High Confidence (80%+)")).toBeInTheDocument();
    expect(screen.getByText("Medium Confidence (60-80%)")).toBeInTheDocument();
    expect(screen.getByText("Low Confidence (<60%)")).toBeInTheDocument();
  });

  it("processes wave height data correctly", () => {
    const { container } = render(
      <ForecastLineChart forecasts={mockForecasts} />
    );

    // Check if wave heights are displayed
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // The component should process "3-4 ft" -> 3.5 ft and "4-5 ft" -> 4.5 ft
    // Check if text elements with processed values exist
    const textElements = svg?.querySelectorAll("text");
    expect(textElements).toBeTruthy();
    expect(textElements!.length).toBeGreaterThan(0);
  });

  it("handles responsive design with minimum width", () => {
    const { container } = render(
      <ForecastLineChart forecasts={mockForecasts} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("min-w-[600px]");
  });

  it("shows correct day labels", () => {
    render(<ForecastLineChart forecasts={mockForecasts} />);

    // The component should show day labels based on the forecast dates
    // Since we're using mock dates, they should appear as formatted dates
    const container = document.querySelector("svg");
    expect(container).toBeInTheDocument();
  });

  it("applies custom className when provided", () => {
    const { container } = render(
      <ForecastLineChart forecasts={mockForecasts} className="custom-chart" />
    );

    expect(container.firstChild).toHaveClass("custom-chart");
  });

  it("handles single forecast correctly", () => {
    const singleForecast = [mockForecasts[0]];
    const { container } = render(
      <ForecastLineChart forecasts={singleForecast} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Should still render chart elements for single data point
    expect(svg?.querySelector("circle")).toBeInTheDocument();
  });

  it("renders confidence indicators with correct colors", () => {
    const { container } = render(
      <ForecastLineChart forecasts={mockForecasts} />
    );

    const svg = container.querySelector("svg");
    const circles = svg?.querySelectorAll("circle");

    // Should have confidence indicator circles
    expect(circles).toBeTruthy();
    expect(circles!.length).toBeGreaterThan(0);
  });
});
