import { render, screen, within } from "@testing-library/react";

import { BuoyRecordSections } from "@/components/best-time-to-surf/buoy-record/buoy-record-sections";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { getSeasonCopy } from "@/lib/data/surf-climatology/copy";
import { getSeasonPhotos } from "@/lib/climatology/season-photos";
import { makeDataset, station, windStats } from "../../lib/climatology/__fixtures__/dataset";

const SCORES = [40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50];
// Every month within 10 points of the top (50), so hasClearSeason is false
// and the month table shows no Peak badges — matches Newport's real dataset.
const FLAT_SCORES = [40, 42, 44, 46, 48, 50, 49, 47, 45, 43, 41, 40];

describe("BuoyRecordSections", () => {
  it("renders only the data sections for a city without copy", () => {
    const dataset = makeDataset(SCORES);
    render(
      <BuoyRecordSections
        dataset={dataset}
        view={buildDataBackedSeasonView(dataset, 9)}
        copy={null}
        photos={[]}
        csvHref={null}
      />,
    );

    for (const heading of [
      "Buoy score by month",
      "Month by month at the buoy",
      "How big the buoy reads each month",
      "Where the swell comes from",
      "Where these numbers come from",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.queryByRole("heading", { name: "Wind by time of day" })).not.toBeInTheDocument();
    expect(screen.queryByText("Download the monthly numbers (CSV)")).not.toBeInTheDocument();
    // Score chart, table, wave range and direction each get their own source line.
    expect(screen.getAllByText(/Analysis by Quiver/)).toHaveLength(4);
  });

  it("adds copy, wind, photos and the CSV link for Cocoa", () => {
    const dataset = makeDataset(SCORES, {
      stations: [station(), station({ id: "TRDF1", alias: "CO-OPS 8721604", name: "Trident Pier", role: "wind", lat: 28.416, lon: -80.593, distanceKm: 5.5 })],
    });
    dataset.months = dataset.months.map((month) => ({ ...month, wind: windStats() }));
    const copy = getSeasonCopy("cocoa-beach");

    render(
      <BuoyRecordSections
        dataset={dataset}
        view={buildDataBackedSeasonView(dataset, 9)}
        copy={copy}
        photos={getSeasonPhotos("cocoa-beach")}
        csvHref="/data/surf-climatology/cocoa-beach.csv"
      />,
    );

    expect(screen.getByRole("heading", { name: "What 19 years of the Cape Canaveral buoy show" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Satellite Beach on the same buoy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What the buoy can't tell you about the pier" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wind by time of day" })).toBeInTheDocument();
    expect(screen.getByText("Download the monthly numbers (CSV)")).toBeInTheDocument();
    expect(screen.getByAltText(/Satellite Beach seen from directly above/)).toBeInTheDocument();
    expect(screen.queryByAltText(/rocket launch/)).not.toBeInTheDocument(); // hero renders in the page header
    expect(screen.getByRole("link", { name: "NOAA NDBC: how wave height is measured" })).toBeInTheDocument();
    // The base 4 source lines plus one for the wind chart.
    expect(screen.getAllByText(/Analysis by Quiver/)).toHaveLength(5);
  });

  it("says when a station failed its coverage check", () => {
    const dataset = makeDataset(SCORES, {
      stations: [station(), station({ id: "46224", name: "Oceanside Offshore", role: "comparison-waves", gate: "failed", gateCoverage: 0.81 })],
    });
    render(
      <BuoyRecordSections dataset={dataset} view={buildDataBackedSeasonView(dataset, 9)} copy={null} photos={[]} csvHref={null} />,
    );

    expect(
      screen.getByText("Oceanside Offshore (NDBC 46224) had 81% of hours recorded, below our 90% bar, so this page doesn't use it."),
    ).toBeInTheDocument();
  });

  it("names the sea-breeze check when a well-covered wind record fails", () => {
    const dataset = makeDataset(SCORES, {
      stations: [
        station(),
        station({ id: "SNA", alias: null, name: "John Wayne Airport", kind: "iem-asos", role: "wind", gate: "failed", gateCoverage: 0.97 }),
      ],
    });
    render(
      <BuoyRecordSections dataset={dataset} view={buildDataBackedSeasonView(dataset, 9)} copy={null} photos={[]} csvHref={null} />,
    );

    expect(
      screen.getByText("John Wayne Airport (SNA) didn't show the summer afternoon sea breeze we check wind records for, so this page doesn't use it."),
    ).toBeInTheDocument();
  });

  it("renders Newport's season note with its swell-days chart and Wedge photo, and no Peak badges", () => {
    const dataset = makeDataset(FLAT_SCORES, {
      cityName: "Newport Beach",
      shoreNormalDeg: 217,
      places: [
        { label: "Newport Pier", lat: 33.607328, lon: -117.928942 },
        { label: "Huntington Beach Pier", lat: 33.655093, lon: -118.004193 },
        { label: "Doheny State Beach", lat: 33.460833, lon: -117.678056 },
      ],
    });
    const copy = getSeasonCopy("newport-beach");

    const { container } = render(
      <BuoyRecordSections
        dataset={dataset}
        view={buildDataBackedSeasonView(dataset, 9)}
        copy={copy}
        photos={getSeasonPhotos("newport-beach")}
        csvHref={null}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Why Newport's best days still come in summer" });
    expect(heading).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="swell-days-bar"]').length).toBeGreaterThan(0);

    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByAltText(/A thick green wave pitching at the Wedge/)).toBeInTheDocument();

    expect(screen.queryByText("Peak")).not.toBeInTheDocument();
  });
});
