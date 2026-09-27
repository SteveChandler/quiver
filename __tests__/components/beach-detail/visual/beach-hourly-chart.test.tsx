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

  it("renders time labels outside the scaling SVG at a readable CSS size", () => {
    render(<BeachHourlyChart chart={CHART} timezone="America/Los_Angeles" />);
    const labels = screen.getByTestId("beach-hourly-time-labels");
    expect(labels).toHaveClass("text-xs");
    expect(labels).toHaveTextContent("10am");
    expect(screen.getByRole("img").querySelector("text")).toHaveTextContent("↑");
    expect(screen.getByRole("img")).not.toHaveTextContent("10am");
  });

  it("fits eight forecast slots on mobile and anchors the edge labels inward", () => {
    const chart = { ...CHART, points: Array.from({ length: 8 }, (_, i) => ({
      ...CHART.points[0], at: new Date(Date.UTC(2026, 8, 27, i * 3)).toISOString(),
    })) };
    render(<BeachHourlyChart chart={chart} timezone="America/Los_Angeles" />);
    const labels = screen.getByTestId("beach-hourly-time-labels");
    expect(labels.parentElement).toHaveStyle({ minWidth: "256px" });
    expect(labels.firstElementChild).toHaveClass("first:text-left");
    expect(labels.lastElementChild).toHaveClass("last:text-right");
  });

  it("renders nothing without points", () => {
    const { container } = render(<BeachHourlyChart chart={{ points: [], maxHeightFt: 0, tideRange: null }} timezone="UTC" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts tide path with M when first point has null tide", () => {
    const chartWithNullFirst: HourlyChart = {
      points: [
        { at: "2026-09-27T17:00:00.000Z", heightFt: 2, tideFt: null, windFromDeg: 290, inBestWindow: false },
        { at: "2026-09-27T18:00:00.000Z", heightFt: 3, tideFt: 3.8, windFromDeg: 290, inBestWindow: true },
      ],
      maxHeightFt: 3,
      tideRange: [3.8, 4.4],
    };
    render(<BeachHourlyChart chart={chartWithNullFirst} timezone="America/Los_Angeles" />);
    const tideLine = document.querySelector("[data-tide-line]");
    expect(tideLine?.getAttribute("d")).toMatch(/^M/);
  });

  it("breaks tide path at null values without connecting across gaps", () => {
    const chartWithGap: HourlyChart = {
      points: [
        { at: "2026-09-27T16:00:00.000Z", heightFt: 2, tideFt: 4.0, windFromDeg: 290, inBestWindow: false },
        { at: "2026-09-27T17:00:00.000Z", heightFt: 2, tideFt: null, windFromDeg: 290, inBestWindow: false },
        { at: "2026-09-27T18:00:00.000Z", heightFt: 3, tideFt: 3.8, windFromDeg: 290, inBestWindow: true },
      ],
      maxHeightFt: 3,
      tideRange: [3.8, 4.0],
    };
    render(<BeachHourlyChart chart={chartWithGap} timezone="America/Los_Angeles" />);
    const tideLine = document.querySelector("[data-tide-line]");
    const d = tideLine?.getAttribute("d") || "";
    const mCount = (d.match(/M/g) || []).length;
    const lCount = (d.match(/L/g) || []).length;
    expect(mCount).toBe(2);
    expect(lCount).toBe(0);
  });

  it("normalizes wind arrow rotation to 0-360 range", () => {
    render(<BeachHourlyChart chart={CHART} timezone="America/Los_Angeles" />);
    const arrows = document.querySelectorAll("text[fill='#F5EEDC']");
    let found = false;
    arrows.forEach((arrow) => {
      const transform = arrow.getAttribute("transform");
      if (transform && transform.includes("rotate(110 ")) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });
});
