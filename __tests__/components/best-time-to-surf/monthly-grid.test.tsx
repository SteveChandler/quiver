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

    expect(screen.getByLabelText("Score: 83, EPIC")).toBeInTheDocument();
    expect(screen.getByLabelText("Score: 73, GOOD")).toBeInTheDocument();
    expect(screen.queryByText("Go now!")).not.toBeInTheDocument();
    expect(screen.queryByText("Go surf!")).not.toBeInTheDocument();
  });
});
