import { render, screen, within } from "@testing-library/react";

import { BuoyMonthTable } from "@/components/best-time-to-surf/buoy-record/buoy-month-table";
import { ScoreExplainer } from "@/components/best-time-to-surf/buoy-record/score-explainer";
import { describeStationSource } from "@/components/best-time-to-surf/buoy-record/source-line";
import { StationMap } from "@/components/best-time-to-surf/buoy-record/station-map";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { makeDataset, station } from "../../lib/climatology/__fixtures__/dataset";

const SCORES = [40, 42, null, 50, 48, 44, 52, 60, 70, 74, 66, 50];
const dataset = makeDataset(SCORES);
const view = buildDataBackedSeasonView(dataset, 9);

describe("BuoyMonthTable", () => {
  it("renders twelve months, a dash for missing data and Peak markers", () => {
    render(<BuoyMonthTable months={view.months} station={view.primary} />);
    const rows = screen.getAllByRole("row").slice(1);

    expect(rows).toHaveLength(12);
    expect(within(rows[2]).getAllByText("—").length).toBeGreaterThanOrEqual(6);
    expect(within(rows[8]).getByText("Peak")).toBeInTheDocument();
    expect(within(rows[8]).getByText("2.4 ft (1.8–3.3)")).toBeInTheDocument();
    expect(within(rows[8]).getByText("78°F")).toBeInTheDocument();
    expect(screen.getByText(/Heights are buoy readings, not surf at the beach/)).toBeInTheDocument();
  });
});

describe("describeStationSource", () => {
  it("credits NDBC buoys as analysis by Quiver", () => {
    expect(describeStationSource(view.primary, "buoy-v1")).toBe(
      "Analysis by Quiver of NOAA NDBC station 41113 (CDIP 143) hourly observations, 2007–2025, 150,000 hours. Method buoy-v1.",
    );
  });

  it("credits the airport archive for ASOS wind", () => {
    const airport = station({ id: "SNA", alias: null, name: "John Wayne Airport", kind: "iem-asos", role: "wind", yearsUsed: [2015, 2025], validHours: 90000 });
    expect(describeStationSource(airport, "buoy-v1")).toBe(
      "Analysis by Quiver of John Wayne Airport (SNA) hourly weather observations from the Iowa Environmental Mesonet ASOS archive, 2015–2025, 90,000 hours. Method buoy-v1.",
    );
  });
});

describe("ScoreExplainer", () => {
  it("lists all four parts and the CSV link when wind is available", () => {
    render(<ScoreExplainer hasWind csvHref="/data/surf-climatology/cocoa-beach.csv" scoreVersion="buoy-v1" />);

    expect(screen.getByText(/45%/)).toBeInTheDocument();
    expect(screen.getByText(/20%: share of mornings/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download the monthly numbers (CSV)" })).toHaveAttribute(
      "href",
      "/data/surf-climatology/cocoa-beach.csv",
    );
  });

  it("explains the rescale and hides the link when there is no wind or CSV", () => {
    render(<ScoreExplainer hasWind={false} csvHref={null} scoreVersion="buoy-v1" />);

    expect(screen.queryByText(/share of mornings/)).not.toBeInTheDocument();
    expect(screen.getByText(/scaled up to fill the score/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("StationMap", () => {
  // next/jest loads .env files, and map-utils falls back to NEXT_PUBLIC_MAPBOX_TOKEN.
  const original = {
    access: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    legacy: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  };
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  });
  // Assigning undefined to process.env stores the string "undefined", so restore by deleting.
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  afterEach(() => {
    restore("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", original.access);
    restore("NEXT_PUBLIC_MAPBOX_TOKEN", original.legacy);
  });

  it("lists places and station distances even without a Mapbox token", () => {
    render(<StationMap places={dataset.places} stations={[view.primary]} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText("Cape Canaveral Nearshore (NDBC 41113): 7.7 km from Cocoa Beach Pier, 26.1 km from Satellite Beach"),
    ).toBeInTheDocument();
  });

  it("draws the static map with lettered places and numbered stations when a token exists", () => {
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test";
    render(<StationMap places={dataset.places} stations={[view.primary]} />);

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toContain("api.mapbox.com");
    // Mapbox's static pin label only accepts lowercase letters.
    expect(image.getAttribute("src")).toContain("pin-s-a+B04E1B");
    expect(image.getAttribute("src")).toContain("pin-s-1+1F5F7A");
    // The legend uppercases the letter for display.
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Map © Mapbox © OpenStreetMap")).toBeInTheDocument();
  });
});
