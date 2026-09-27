import { render, screen } from "@testing-library/react";
import { BeachHourlyChart } from "@/components/beach-detail/visual/beach-hourly-chart";
import type { HourlyChart } from "@/lib/utils/beach-hourly-chart";

const CHART: HourlyChart = {
  points: [
    { at: "2026-09-27T17:00:00.000Z", heightFt: 2, tideFt: 4.4, windFromDeg: 290, inBestWindow: false },
    { at: "2026-09-27T18:00:00.000Z", heightFt: 3, tideFt: 3.8, windFromDeg: 290, inBestWindow: true },
  ],
  maxHeightFt: 3,
  tideRange: [3.8, 4.4],
};

describe("BeachHourlyChart", () => {
  it("draws one bar per hour and highlights the best window", () => {
    render(<BeachHourlyChart chart={CHART} timezone="America/Los_Angeles" />);
    const chart = screen.getByTestId("beach-hourly-chart");
    expect(chart.querySelectorAll("[data-bar]")).toHaveLength(2);
    expect(chart.querySelectorAll('[data-bar="best"]')).toHaveLength(1);
    expect(chart.querySelector("[data-tide-line]")).not.toBeNull();
  });

  it("describes itself for screen readers", () => {
    render(<BeachHourlyChart chart={CHART} timezone="America/Los_Angeles" />);
    expect(screen.getByRole("img", { name: /surf height by hour/i })).toBeInTheDocument();
  });

  it("renders nothing without points", () => {
    const { container } = render(<BeachHourlyChart chart={{ points: [], maxHeightFt: 0, tideRange: null }} timezone="UTC" />);
    expect(container).toBeEmptyDOMElement();
  });
});
