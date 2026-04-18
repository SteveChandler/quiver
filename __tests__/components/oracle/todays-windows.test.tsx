import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TodaysWindows } from "@/components/oracle/todays-windows";
import type { TimeWindow } from "@/components/oracle/todays-windows";

const SAMPLE_WINDOWS: TimeWindow[] = [
  { time: "5am", label: "Best window", height: "4-5ft", quality: 0.9, isBest: true },
  { time: "8am", label: "Still clean", height: "4 ft", quality: 0.7, isBest: false },
  { time: "11am", label: "Onshore", height: "3-4ft", quality: 0.3, isBest: false },
];

describe("TodaysWindows", () => {
  it("renders the section title", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    expect(screen.getByText("Today's Windows")).toBeInTheDocument();
  });

  it("renders all time slots", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    expect(screen.getByText("5am")).toBeInTheDocument();
    expect(screen.getByText("8am")).toBeInTheDocument();
    expect(screen.getByText("11am")).toBeInTheDocument();
  });

  it("renders the Full forecast link when forecastUrl is provided", () => {
    render(
      <TodaysWindows
        windows={SAMPLE_WINDOWS}
        preferredTime={null}
        forecastUrl="/ca/san-diego/blacks"
      />
    );
    const link = screen.getByRole("link", { name: /full forecast/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/ca/san-diego/blacks");
  });

  it("does not render the Full forecast link when forecastUrl is omitted", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    expect(screen.queryByRole("link", { name: /full forecast/i })).not.toBeInTheDocument();
  });

  it("applies gold text to the best window time label", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    const bestTimeLabel = screen.getByText("5am");
    expect(bestTimeLabel).toHaveClass("text-[#FDB84B]");
  });

  it("applies medium text to non-best window time labels", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    const nonBestLabel = screen.getByText("8am");
    expect(nonBestLabel).toHaveClass("text-medium");
  });

  it("renders condition labels for each window", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    expect(screen.getByText("Best window")).toBeInTheDocument();
    expect(screen.getByText("Still clean")).toBeInTheDocument();
    expect(screen.getByText("Onshore")).toBeInTheDocument();
  });

  it("renders wave heights for each window with consistent sets labeling", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    // Every range gets the "sets" suffix — including pre-formatted inputs
    // that bypass the formatter. Consistency across the list matters more
    // than preserving the caller's original string verbatim.
    expect(screen.getByText("4-5ft sets")).toBeInTheDocument();
    expect(screen.getByText("4-6ft sets")).toBeInTheDocument(); // "4 ft" point value → range
    expect(screen.getByText("3-4ft sets")).toBeInTheDocument();
  });

  it("applies preferred time ring to the matching time slot", () => {
    const { container } = render(
      <TodaysWindows windows={SAMPLE_WINDOWS} preferredTime="morning" />
    );
    // The 8am row should have the preferred-time ring class
    const ringedRow = container.querySelector(".ring-1.ring-\\[\\#FDB84B\\]\\/20");
    expect(ringedRow).toBeInTheDocument();
  });

  it("does not apply preferred time ring when preferredTime is null", () => {
    const { container } = render(
      <TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />
    );
    const ringedRow = container.querySelector(".ring-1.ring-\\[\\#FDB84B\\]\\/20");
    expect(ringedRow).not.toBeInTheDocument();
  });

  it("renders an empty windows list without errors", () => {
    render(<TodaysWindows windows={[]} preferredTime={null} />);
    expect(screen.getByText("Today's Windows")).toBeInTheDocument();
  });

  it("renders conditions inline inside the quality bar (no separate condition sub-line)", () => {
    const windowsWithConditions: TimeWindow[] = [
      {
        time: "8am",
        label: "Morning glass",
        height: "3-4ft",
        quality: 0.8,
        isBest: true,
        swellPeriod: "14s",
        swellDirection: "WNW",
        windSpeed: "8 mph",
        windDirection: "NW",
        tideHeight: "3.2 ft",
        tideStatus: "Rising",
      },
    ];
    const { container } = render(
      <TodaysWindows windows={windowsWithConditions} preferredTime={null} />
    );

    // Conditions span should be a sibling of the label span inside the bar container
    const barContainer = container.querySelector(".relative.flex.min-w-0.flex-1");
    expect(barContainer).toBeInTheDocument();
    // Conditions should render inside the bar container, not outside it
    const conditionSpan = barContainer?.querySelector("span.ml-auto");
    expect(conditionSpan).toBeInTheDocument();
    // The condition text should be present
    expect(screen.getByText(/14s/)).toBeInTheDocument();
  });
});
