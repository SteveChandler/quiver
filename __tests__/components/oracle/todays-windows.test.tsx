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

  it("marks the best window time label", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    const bestTimeLabel = screen.getByText("5am");
    expect(bestTimeLabel).toHaveAttribute("data-best", "true");
  });

  it("does not mark non-best window time labels", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    const nonBestLabel = screen.getByText("8am");
    expect(nonBestLabel).not.toHaveAttribute("data-best");
  });

  it("renders condition labels for each window", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    expect(screen.getByText("Best window")).toBeInTheDocument();
    expect(screen.getByText("Still clean")).toBeInTheDocument();
    expect(screen.getByText("Onshore")).toBeInTheDocument();
  });

  it("renders wave heights as Surfline-style face brackets (no 'sets' suffix)", () => {
    render(<TodaysWindows windows={SAMPLE_WINDOWS} preferredTime={null} />);
    // Pre-formatted ranges pass through unchanged. Single-point inputs go
    // through the formatter, which uses floor/ceil on face Hs (no × 1.5
    // expansion) — so "4 ft" → "4ft", not "4-6ft sets".
    expect(screen.getByText("4-5ft")).toBeInTheDocument();
    expect(screen.getByText("4ft")).toBeInTheDocument();
    expect(screen.getByText("3-4ft")).toBeInTheDocument();
  });

  it("marks the preferred time slot", () => {
    const { container } = render(
      <TodaysWindows windows={SAMPLE_WINDOWS} preferredTime="morning" />
    );
    // The 8am row should be marked as the user's preferred slot
    const ringedRow = container.querySelector('[data-preferred="true"]');
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

  it("normalizes broad raw ranges and keeps wave, wind, swell, and tide scannable", () => {
    const windowsWithRawRange: TimeWindow[] = [
      {
        time: "8am",
        label: "Morning glass",
        height: "0.5-5.5 ft",
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
      <TodaysWindows windows={windowsWithRawRange} preferredTime={null} />
    );

    expect(screen.queryByText(/0\.5-5\.5/)).not.toBeInTheDocument();
    expect(screen.getByText("3ft")).toBeInTheDocument();
    expect(screen.getByText("Swell WNW @ 14s")).toBeInTheDocument();
    expect(screen.getByText("Wind NW 8 mph")).toBeInTheDocument();
    expect(screen.getByText("Tide 3.2 ft Rising")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("captures the normal clean-day compact summary hierarchy", () => {
    const cleanDayWindows: TimeWindow[] = [
      {
        time: "6am",
        label: "Clean early",
        height: "3-4 ft",
        quality: 0.86,
        isBest: true,
        swellPeriod: "12s",
        swellDirection: "W",
        windSpeed: "4 mph",
        windDirection: "E",
        tideHeight: "2.8 ft",
        tideStatus: "Incoming",
      },
    ];
    const { container } = render(
      <TodaysWindows windows={cleanDayWindows} preferredTime={null} />
    );

    expect(screen.getByText("3-4 ft")).toBeInTheDocument();
    expect(screen.getByText("Wind E 4 mph")).toBeInTheDocument();
    expect(screen.getByText("Swell W @ 12s")).toBeInTheDocument();
    expect(screen.getByText("Tide 2.8 ft Incoming")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("captures tide-sensitive windows with tide visible in the first summary layer", () => {
    const tideSensitiveWindows: TimeWindow[] = [
      {
        time: "10am",
        label: "Low tide window",
        height: "2-3 ft",
        quality: 0.74,
        isBest: true,
        swellPeriod: "15s",
        swellDirection: "SSW",
        windSpeed: "6 mph",
        windDirection: "NE",
        tideHeight: "0.7 ft",
        tideStatus: "Filling in",
      },
    ];
    const { container } = render(
      <TodaysWindows windows={tideSensitiveWindows} preferredTime={null} />
    );

    expect(screen.getByText("Tide 0.7 ft Filling in")).toBeInTheDocument();
    expect(screen.getByText("Wind NE 6 mph")).toBeInTheDocument();
    expect(screen.getByText("Swell SSW @ 15s")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });
});
