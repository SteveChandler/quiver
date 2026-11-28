jest.mock("@/lib/tide-stations/kept-station-slugs.json", () => ({
  _source: "test",
  linked: ["la-jolla-ca-9410230"],
  visited: [],
  searched: [],
}));

import { render, screen } from "@testing-library/react";

import { TideStationSlot } from "@/components/buoys/station-sections";
import { TideHubList } from "@/components/tide-stations/tide-hub-list";

const original = process.env.TIDE_STATION_PRUNE;
beforeEach(() => delete process.env.TIDE_STATION_PRUNE);
afterAll(() => {
  if (original === undefined) delete process.env.TIDE_STATION_PRUNE;
  else process.env.TIDE_STATION_PRUNE = original;
});

describe("links to closed tide stations", () => {
  it("hub list prints an item without href as text, so the count still matches the list", () => {
    render(
      <TideHubList
        label="Tide stations"
        items={[
          { key: "a", name: "La Jolla", href: "/tides/station/la-jolla-ca-9410230" },
          { key: "b", name: "Antioch" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "La Jolla" })).toHaveAttribute("href", "/tides/station/la-jolla-ca-9410230");
    expect(screen.getByText("Antioch")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Antioch" })).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("buoy page links an open nearest station", () => {
    render(<TideStationSlot tideStation={{ slug: "la-jolla-ca-9410230", name: "La Jolla", distanceKm: 4 }} />);
    expect(screen.getByRole("link", { name: "La Jolla" })).toHaveAttribute("href", "/tides/station/la-jolla-ca-9410230");
  });

  it("buoy page names a closed nearest station without a link", () => {
    render(<TideStationSlot tideStation={{ slug: "antioch-ca-9415064", name: "Antioch", distanceKm: 9 }} />);
    expect(screen.getByText("Antioch")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("buoy page links a closed station again when TIDE_STATION_PRUNE is false", () => {
    process.env.TIDE_STATION_PRUNE = "false";
    render(<TideStationSlot tideStation={{ slug: "antioch-ca-9415064", name: "Antioch", distanceKm: 9 }} />);
    expect(screen.getByRole("link", { name: "Antioch" })).toBeInTheDocument();
  });
});
