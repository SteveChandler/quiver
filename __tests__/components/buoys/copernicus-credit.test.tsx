import { render, screen, within } from "@testing-library/react";

import { HubFootnote } from "@/components/buoys/hub-sections";
import { StationFacts } from "@/components/buoys/station-sections";
import { buildReadingSentence } from "@/lib/buoy-pages/reading";
import { classifyStationStatus, liveLimitMs } from "@/lib/buoy-pages/status";
import type { WaveStationRow } from "@/lib/services/wave-stations/types";

const westhinder: WaveStationRow = {
  id: "copernicus:WesthinderBuoy",
  source: "copernicus",
  source_station_id: "WesthinderBuoy",
  name: "Westhinder - Buoy",
  slug: "westhinder-buoy-westhinderbuoy",
  country_code: "BE",
  region: null,
  lat: 51.3811,
  lon: 2.4358,
  station_type: "buoy",
  owner: "Agency for Maritime Services and Coast- Department Coast",
  program: "Copernicus Marine In Situ",
  cdip_station_id: null,
  wmo_id: null,
  duplicate_of: null,
  has_wave: true,
  has_swell_split: false,
  has_met: false,
  license: "copernicus-marine",
  attribution:
    "E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00036. Data from Agency for Maritime Services and Coast- Department Coast",
  active: true,
  first_seen_at: "2026-11-11T00:00:00Z",
  last_observed_at: "2026-11-11T13:00:00Z",
  last_wave_observed_at: "2026-11-11T13:00:00Z",
  spec_checked_at: null,
  spec_last_modified: null,
  spec_last_observed_at: null,
  txt_checked_at: null,
  txt_last_modified: null,
  txt_last_observed_at: null,
  created_at: "2026-11-11T00:00:00Z",
  updated_at: "2026-11-11T00:00:00Z",
};

describe("Copernicus credit and licence on the buoy page", () => {
  it("shows the required credit with the DOI as a link, the licence link and the change note", () => {
    render(<StationFacts station={westhinder} timeZone="Europe/Brussels" explainer={[]} />);
    const credit = screen.getByTestId("buoy-attribution");
    expect(credit.textContent).toContain(
      "Source: E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00036. Data from Agency for Maritime Services and Coast- Department Coast.",
    );
    expect(within(credit).getByRole("link", { name: "https://doi.org/10.48670/moi-00036" })).toHaveAttribute(
      "href",
      "https://doi.org/10.48670/moi-00036",
    );
    expect(within(credit).getByRole("link", { name: "Copernicus Marine Service licence" })).toHaveAttribute(
      "href",
      "https://marine.copernicus.eu/user-corner/service-commitments-and-licence",
    );
    expect(credit.textContent).toContain("Changes: Quiver converts the units");
    expect(screen.getByText("No, whole-sea numbers only")).toBeInTheDocument();
  });

  it("lists every source, with the Copernicus DOI link, in the hub credits", () => {
    render(<HubFootnote />);
    const credits = screen.getByTestId("buoy-hub-credits");
    expect(credits.textContent).toMatch(/NOAA National Data Buoy Center.*Marine Institute.*Australian Ocean Data Network.*Finnish Meteorological Institute.*SMHI.*E\.U\. Copernicus Marine Service Information/);
    expect(within(credits).getByRole("link")).toHaveAttribute("href", "https://doi.org/10.48670/moi-00036");
  });
});

describe("Copernicus freshness and degraded readings", () => {
  it("counts a reading as Live for 5.5 h (measured latency 210 min + two hourly runs)", () => {
    const limit = liveLimitMs({ source: "copernicus", owner: null });
    expect(limit).toBe(330 * 60 * 1000);
    const now = Date.parse("2026-11-11T18:00:00Z");
    expect(classifyStationStatus("2026-11-11T13:00:00Z", now, limit)).toBe("fresh");
    expect(classifyStationStatus("2026-11-11T12:00:00Z", now, limit)).toBe("stale");
  });

  it("reads a buoy without period or direction as plain waves", () => {
    const empty = {
      dominant_period_s: null,
      mean_wave_direction_deg: null,
      swell_height_m: null,
      swell_period_s: null,
      swell_direction_deg: null,
      wind_wave_height_m: null,
      wind_wave_period_s: null,
      wind_wave_direction_deg: null,
    };
    expect(buildReadingSentence({ ...empty, wave_height_m: 0.77 }, null)).toBe("Waves: 2.5 ft.");
    expect(buildReadingSentence({ ...empty, wave_height_m: 2.4, dominant_period_s: 11.6 }, null)).toBe(
      "Mid-period swell: 7.9 ft at 12 s.",
    );
  });
});
