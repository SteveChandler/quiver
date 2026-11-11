import { render, screen } from "@testing-library/react";

import { MonthlyGrid } from "@/components/best-time-to-surf/monthly-grid";
import type { MonthlySurfEntry } from "@/actions/city/best-time-actions";

const MONTHLY: MonthlySurfEntry[] = [
  { month: 1, monthName: "January", bestMonthCount: 3, score: 83 },
  { month: 7, monthName: "July", bestMonthCount: 1, score: 73 },
];

describe("MonthlyGrid seasonal gauges", () => {
  it("labels each month's gauge with the band but no immediate-action phrase", () => {
    render(
      <MonthlyGrid
        monthly={MONTHLY}
        waterTempRange="55-68"
        summerWetsuit="3/2mm"
        winterWetsuit="4/3mm"
        peakMonths={[1]}
      />
    );

    expect(screen.getByLabelText("Score: 83, GOOD")).toBeInTheDocument();
    expect(screen.getByLabelText("Score: 73, GOOD")).toBeInTheDocument();
    expect(screen.queryByText("Worth a surf")).not.toBeInTheDocument();
    expect(screen.queryByText("Worth planning")).not.toBeInTheDocument();
  });
});

describe("MonthlyGrid without state monthly data", () => {
  it("hides crowd, wetsuit and water temp rows the city data does not support", () => {
    render(
      <MonthlyGrid
        monthly={[{ month: 4, monthName: "April", bestMonthCount: 2, score: 60 }]}
        waterTempRange={null}
        summerWetsuit={null}
        winterWetsuit={null}
      />
    );

    expect(screen.queryByText("Crowds")).not.toBeInTheDocument();
    expect(screen.queryByText("Wetsuit")).not.toBeInTheDocument();
    expect(screen.queryByText("Water temp")).not.toBeInTheDocument();
    expect(screen.queryByText("3/2mm")).not.toBeInTheDocument();
    expect(screen.getByText("Beaches peaking")).toBeInTheDocument();
  });

  it("keeps the city's own wetsuit and temperature for matching seasons", () => {
    render(
      <MonthlyGrid
        monthly={[{ month: 1, monthName: "January", bestMonthCount: 3, score: 70 }]}
        waterTempRange="55-68"
        summerWetsuit="3/2mm"
        winterWetsuit="4/3mm"
      />
    );

    expect(screen.getByText("4/3mm")).toBeInTheDocument();
    expect(screen.getByText("~55°F")).toBeInTheDocument();
    expect(screen.queryByText("Crowds")).not.toBeInTheDocument();
  });
});
