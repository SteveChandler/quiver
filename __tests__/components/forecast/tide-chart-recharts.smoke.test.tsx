import React from "react";
import { render, screen } from "@testing-library/react";
import { TideChart } from "@/components/forecast/tide-chart-recharts";

// Recharts and responsive container often need a DOM size; JSDOM lacks layout.
// Provide a basic mock for getBoundingClientRect to avoid zero-size issues.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    return {
      width: 800,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 800,
    } as DOMRect;
  };
});

describe("TideChart (smoke)", () => {
  it("renders card and title with empty data without throwing", () => {
    render(<TideChart data={[]} forecasts={[]} hourly={[]} events={[]} />);
    expect(screen.getByText("Tide Forecast")).toBeInTheDocument();
    expect(screen.getByText("No tide data available")).toBeInTheDocument();
  });
});
