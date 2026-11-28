import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";

import TideStationPage from "@/app/tides/station/[slug]/page";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";
import { getStationPageData } from "@/lib/tide-stations/page-data";
import type { StationSeries } from "@/lib/tide-stations/predictions";
import type { TideStationRow } from "@/lib/tide-stations/types";

jest.mock("@/components/tide-stations/nearby-buoys-slot", () => ({ NearbyBuoysSlot: () => null }));
jest.mock("@/lib/posthog-client", () => ({ captureClientPostHogEventAfterConsent: jest.fn() }));
jest.mock("@/lib/tide-stations/page-data", () => ({
  getStationAccess: jest.fn().mockResolvedValue({ kind: "open" }),
  getStationPageData: jest.fn(),
}));
jest.mock("@/lib/tide-stations/queries", () => ({
  getNearbyBeachLinks: jest.fn().mockResolvedValue([]),
  getNearbyTideStations: jest.fn().mockResolvedValue([]),
}));

const station: TideStationRow = {
  id: "noaa:9410230",
  source: "noaa",
  source_station_id: "9410230",
  name: "La Jolla",
  slug: "la-jolla-ca-9410230",
  country_code: "US",
  country_slug: "usa",
  region: "CA",
  region_slug: "ca",
  lat: 32.87,
  lon: -117.26,
  timezone: "America/Los_Angeles",
  station_kind: "reference",
  reference_station_id: null,
  datum_label: "MLLW",
  datum_offset_m: null,
  constituents: null,
  operator: "NOAA CO-OPS",
  licence: "us-public-domain",
  licence_url: "https://www.noaa.gov/",
  attribution: "NOAA CO-OPS",
  commercial_use: true,
  active: true,
};
const predictions: StationSeries = {
  status: "ok",
  hourly: [],
  extremes: [
    { ts: "2026-11-16T12:00:00Z", type: "high", heightM: 1.4 },
    { ts: "2026-11-16T18:00:00Z", type: "low", heightM: 0.3 },
  ],
  windowStart: "2026-11-15T00:00:00Z",
  windowEnd: "2026-11-24T00:00:00Z",
  adjustmentFt: 0,
};
const capture = jest.mocked(captureClientPostHogEventAfterConsent);

function loadPage(stationRow: TideStationRow, series: StationSeries): ReturnType<typeof TideStationPage> {
  jest.mocked(getStationPageData).mockResolvedValueOnce({
    station: stationRow,
    series,
    renderedAtMs: Date.parse("2026-11-16T14:00:00Z"),
  });
  return TideStationPage({ params: Promise.resolve({ slug: stationRow.slug }) });
}

beforeEach(() => jest.clearAllMocks());

it("captures a single event after rendering NOAA predictions, including under Strict Mode", async () => {
  const page = await loadPage(station, predictions);
  expect(capture).not.toHaveBeenCalled();

  render(<StrictMode>{page}</StrictMode>);

  expect(screen.getByRole("heading", { name: "Next 7 days" })).toBeInTheDocument();
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith("tide_station_predictions_rendered", { station_slug: station.slug });
});

it("does not capture a view when a NOAA station has no predictions", async () => {
  render(await loadPage(station, { status: "failed", reason: "noaa-empty" }));

  expect(screen.getByRole("alert")).toHaveTextContent("No tide predictions for this station");
  expect(capture).not.toHaveBeenCalled();
});

it("does not capture a view of a harmonic-model station's predictions", async () => {
  render(await loadPage({ ...station, source: "ticon", station_kind: "harmonic-model" }, predictions));

  expect(screen.getByRole("heading", { name: "Next 7 days" })).toBeInTheDocument();
  expect(capture).not.toHaveBeenCalled();
});
