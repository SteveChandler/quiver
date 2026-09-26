import { render, screen } from "@testing-library/react";

import { DirectionMixChart } from "@/components/best-time-to-surf/buoy-record/direction-mix-chart";
import { ScoreByMonthChart } from "@/components/best-time-to-surf/buoy-record/score-by-month-chart";
import { SwellDaysChart } from "@/components/best-time-to-surf/buoy-record/swell-days-chart";
import { WaveRangeChart } from "@/components/best-time-to-surf/buoy-record/wave-range-chart";
import { WindByTimeChart } from "@/components/best-time-to-surf/buoy-record/wind-by-time-chart";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { makeDataset, windStats } from "../../lib/climatology/__fixtures__/dataset";

const SCORES = [40, 42, null, 50, 48, 44, 52, 60, 70, 74, 66, 50];
const view = buildDataBackedSeasonView(makeDataset(SCORES), 9);

describe("ScoreByMonthChart", () => {
  it("draws peak bars, marks missing months and states the numbers in its title", () => {
    const { container } = render(
      <ScoreByMonthChart months={view.months} stationName="Cape Canaveral Nearshore" chartId="score" />,
    );

    expect(container.querySelectorAll('[data-testid="score-bar-peak"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="score-bar-missing"]')).toHaveLength(1);
    expect(container.querySelector("title")?.textContent).toBe(
      "Buoy score by month, Cape Canaveral Nearshore: Jan 40, Feb 42, Mar n/a, Apr 50, May 48, Jun 44, Jul 52, Aug 60, Sep 70, Oct 74, Nov 66, Dec 50",
    );
    expect(screen.getByText("Peak band: within 10 points of the top month")).toBeInTheDocument();
  });

  it("drops the peak swatch and names no season when no month stands out", () => {
    const flatView = buildDataBackedSeasonView(
      makeDataset([84, 81, 81, 84, 86, 88, 91, 88, 87, 88, 84, 83]),
      1,
    );
    render(<ScoreByMonthChart months={flatView.months} stationName="Cape Canaveral Nearshore" chartId="score-flat" />);

    expect(
      screen.getByText("No month stands out: every month scores within 10 points of the top."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Peak band/)).not.toBeInTheDocument();
  });
});

describe("WaveRangeChart", () => {
  it("draws a median dot for each month with data", () => {
    const { container } = render(
      <WaveRangeChart months={view.months} stationName="Cape Canaveral Nearshore" chartId="waves" />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(11);
    expect(screen.getAllByText("n/a")).toHaveLength(1);
    expect(container.querySelector("title")?.textContent).toContain("Sep median 2.4 ft");
    expect(screen.getByText(/not surf height at the beach/)).toBeInTheDocument();
  });
});

describe("DirectionMixChart", () => {
  it("draws one panel per station and labels shares of 5% or more", () => {
    const mix = { N: 0.1, NE: 0.3, E: 0.3, SE: 0.2, S: 0.05, SW: 0, W: 0, NW: 0.05 };
    render(
      <DirectionMixChart
        chartId="dir"
        rows={[
          { stationName: "San Pedro South", seasons: [{ label: "Jun–Aug", mix }] },
          { stationName: "Oceanside Offshore", seasons: [{ label: "Jun–Aug", mix: null }] },
        ]}
      />,
    );

    expect(screen.getByText("San Pedro South")).toBeInTheDocument();
    expect(screen.getByText("Oceanside Offshore")).toBeInTheDocument();
    expect(screen.getAllByText("30%")).toHaveLength(2);
    expect(screen.getByText("n/a")).toBeInTheDocument();
  });
});

describe("WindByTimeChart", () => {
  it("draws three stacked bars per month and a legend", () => {
    const months = view.months.map((m) => ({ month: m.month, abbrev: m.abbrev, wind: m.month === 3 ? null : windStats() }));
    const { container } = render(<WindByTimeChart months={months} stationName="Trident Pier" chartId="wind" />);

    expect(container.querySelectorAll('[data-testid="wind-bar"]')).toHaveLength(33);
    expect(screen.getByText("Offshore")).toBeInTheDocument();
    expect(screen.getByText("Light (under 6 kt)")).toBeInTheDocument();
    expect(container.querySelector("title")?.textContent).toContain("Jan 50%");
  });
});

describe("SwellDaysChart", () => {
  it("draws two bars per month with data, marks gaps, and labels both series", () => {
    const south = [0.04, 0.05, 0.07, 0.15, 0.26, 0.21, 0.26, 0.18, 0.24, 0.2, 0.09, null];
    const west = [0.46, 0.38, 0.36, 0.35, 0.21, 0.17, 0.04, 0.07, 0.08, 0.13, 0.23, null];
    const { container } = render(
      <SwellDaysChart
        abbrevs={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
        primary={{ label: "3 ft+ days, mostly south or southwest swell", values: south }}
        secondary={{ label: "3 ft+ days, mostly west or northwest swell", values: west }}
        stationName="San Pedro South"
        chartId="swell-days"
      />,
    );

    expect(container.querySelectorAll('[data-testid="swell-days-bar"]')).toHaveLength(22);
    expect(screen.getByText("n/a")).toBeInTheDocument();
    expect(screen.getByText("3 ft+ days, mostly south or southwest swell")).toBeInTheDocument();
    expect(container.querySelector("title")?.textContent).toContain("Jul 26% / 4%");
  });
});
