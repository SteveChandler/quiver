import React from "react";
import { render, screen, within } from "@testing-library/react";

import { BeachTideCards, describeTidePreference } from "@/components/intent/beach-tide-cards";
import { TidePageContent } from "@/components/intent/tide-page-content";
import { buildCityTideView } from "@/lib/tides/city-tide-view";
import type { BeachTidePreference, CityTideDataExpanded } from "@/actions/forecast/intent-forecast-actions";

jest.mock("@/components/city/city-map-view", () => ({ CityMapView: () => null }));
jest.mock("@/components/intent/intent-app-handoff-cta", () => ({ IntentAppHandoffCta: () => null }));
jest.mock("@/components/intent/utility-session-handoff", () => ({ UtilitySessionHandoff: () => null }));
jest.mock("@/components/shared/continue-exploring", () => ({ ContinueExploring: () => null }));

const RENDERED_AT = Date.parse("2026-11-13T02:40:00Z"); // 4:40 PM HST

const EXTREMES = [
  { ts: "2026-11-12T14:55:00Z", type: "high" as const, heightM: 0.52 },
  { ts: "2026-11-12T21:29:00Z", type: "low" as const, heightM: 0.1 },
  { ts: "2026-11-13T02:19:00Z", type: "high" as const, heightM: 0.14 },
  { ts: "2026-11-13T06:28:00Z", type: "low" as const, heightM: 0.04 },
  { ts: "2026-11-13T15:38:00Z", type: "high" as const, heightM: 0.49 },
];

function pref(overrides: Partial<BeachTidePreference>): BeachTidePreference {
  return {
    beachName: "Laniakea",
    beachSlug: "laniakea",
    preferredTideMin: 1,
    preferredTideMax: 3,
    preferredDirection: "rising",
    skillLevel: "intermediate-advanced",
    ...overrides,
  };
}

type StationOverride = { name: string; slug: string; sourceStationId: string } | null;

function tideData(station: boolean, adjustmentFt = 0, stationOverride?: StationOverride): CityTideDataExpanded {
  return {
    tidePoints: [],
    currentStatus: "Falling",
    currentHeight: "0.5 ft",
    nextTideType: "Low",
    nextTideTime: "8:28 PM",
    nextTideHeight: "0.1 ft",
    beachName: "Chun's Reef",
    tideStation: station ? "Haleiwa, Waialua Bay" : null,
    sevenDayExtrema: [],
    hourlyPoints: [],
    beachTidePreferences: [pref({}), pref({ beachName: "Pipeline", beachSlug: "pipeline", preferredTideMin: null, preferredTideMax: null })],
    view: buildCityTideView({
      timeZone: "Pacific/Honolulu",
      renderedAtMs: RENDERED_AT,
      station:
        stationOverride !== undefined
          ? stationOverride
          : station
            ? { name: "Haleiwa, Waialua Bay", slug: "haleiwa-waialua-bay-hi-1612668", sourceStationId: "1612668" }
            : null,
      adjustmentFt,
      hourly: [],
      extremes: EXTREMES,
    }),
  };
}

function renderPage(station: boolean, adjustmentFt = 0, stationOverride?: StationOverride) {
  return render(
    <TidePageContent
      cityName="Haleiwa"
      citySlug="haleiwa"
      stateSlug="hi"
      stateName="Hawaii"
      regionLabel="Haleiwa, Hawaii"
      pageContent={{ title: "t", description: "d", heading: "Tide conditions for Haleiwa surf spots", intro: "A foot of tide swing matters here." } as never}
      tideData={tideData(station, adjustmentFt, stationOverride)}
      spots={[]}
      baseUrl="https://www.quiversurf.app"
    />
  );
}

const LA_JOLLA = {
  name: "La Jolla (Scripps Institution Wharf)",
  slug: "la-jolla-scripps-institution-wharf-ca-9410230",
  sourceStationId: "9410230",
};

describe("city tide page", () => {
  beforeAll(() => {
    jest.spyOn(Date, "now").mockReturnValue(RENDERED_AT);
  });

  it("names the station, links its page, and leaks no internal labels", () => {
    renderPage(true);
    expect(
      screen.getByText(/Predicted tides from the NOAA gauge at Haleiwa, Waialua Bay\. Times are local \(GMT-10\)\. Not live water levels\./)
    ).toBeInTheDocument();
    const card = screen.getByTestId("city-tide-station");
    expect(within(card).getByRole("link", { name: /Full station tides/ })).toHaveAttribute(
      "href",
      "/tides/station/haleiwa-waialua-bay-hi-1612668"
    );
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Cached Tide Data|Refreshed hourly|30 minutes|-0\.0/);
  });

  it("shows the same next low in the hero and under the chart", () => {
    renderPage(true);
    expect(screen.getByTestId("tide-station-now")).toHaveTextContent("Next low 8:28 PM, 0.1 ft");
    expect(screen.getByTestId("tide-panel-chart")).toHaveTextContent("Low 0.1 ft · 8:28 PM");
  });

  it("has no station card or link when the series is the beach's stored one", () => {
    renderPage(false);
    expect(screen.queryByTestId("city-tide-station")).toBeNull();
    expect(screen.getByText(/Predicted tides from NOAA\. Times are local/)).toBeInTheDocument();
  });
});

describe("city tide page source line", () => {
  beforeAll(() => {
    jest.spyOn(Date, "now").mockReturnValue(RENDERED_AT);
  });

  it("names Quiver's sea-level adjustment and links NOAA's own table on an adjusted station", () => {
    renderPage(true, 1.5, LA_JOLLA);
    const source = screen.getByTestId("city-tide-source");
    expect(source).toHaveTextContent(
      "Predicted tides from the NOAA gauge at La Jolla (Scripps Institution Wharf), plus Quiver's +1.5 ft sea-level adjustment. Times are local"
    );
    expect(source).toHaveTextContent("Not live water levels.");
    expect(within(source).getByRole("link", { name: "NOAA's own predictions for 9410230 →" })).toHaveAttribute(
      "href",
      "https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9410230"
    );
  });

  it("claims no adjustment on an unadjusted station but still links NOAA's table", () => {
    renderPage(true, 0);
    const source = screen.getByTestId("city-tide-source");
    expect(source.textContent).not.toMatch(/adjustment/);
    expect(within(source).getByRole("link", { name: "NOAA's own predictions for 1612668 →" })).toHaveAttribute(
      "href",
      "https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=1612668"
    );
  });

  it("names the adjustment on the stored series without a station link", () => {
    renderPage(false, 1.5);
    const source = screen.getByTestId("city-tide-source");
    expect(source).toHaveTextContent("Predicted tides from NOAA, plus Quiver's +1.5 ft sea-level adjustment. Times are local");
    expect(within(source).queryByRole("link")).toBeNull();
  });

  it("calls the tides predicted, not real-time, in the FAQ", () => {
    renderPage(true, 1.5, LA_JOLLA);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/Quiver shows predicted tide times and heights next to the surf conditions/);
    expect(text).not.toMatch(/real-time/i);
  });
});

describe("city tide page with an empty series", () => {
  it("hides the tide modules instead of showing 'no data'", () => {
    const data = tideData(false);
    data.view = buildCityTideView({ timeZone: "Pacific/Honolulu", renderedAtMs: RENDERED_AT, station: null, adjustmentFt: 0, hourly: [], extremes: [] });
    render(
      <TidePageContent
        cityName="Haleiwa"
        citySlug="haleiwa"
        stateSlug="hi"
        stateName="Hawaii"
        regionLabel="Haleiwa, Hawaii"
        pageContent={{ title: "t", description: "d", heading: "Tide conditions for Haleiwa surf spots", intro: "Intro." } as never}
        tideData={data}
        spots={[]}
        baseUrl="https://www.quiversurf.app"
      />
    );
    expect(screen.queryByTestId("tide-station-now")).toBeNull();
    expect(screen.queryByTestId("tide-panel-chart")).toBeNull();
    expect(document.body.textContent).not.toMatch(/no data|No upcoming tide/);
  });
});

describe("tide by spot", () => {
  it("describes the water, not the surfer", () => {
    render(<BeachTideCards beaches={[pref({})]} citySlug="haleiwa" stateSlug="hi" cityName="Haleiwa" />);
    expect(screen.getByText("1.0–3.0 ft · rising")).toBeInTheDocument();
    expect(screen.queryByText(/intermediate/i)).toBeNull();
  });

  it("reads 'Rising tide' with a direction only, and hides spots with no notes", () => {
    expect(describeTidePreference(pref({ preferredTideMin: null, preferredTideMax: null }))).toBe("Rising tide");
    expect(describeTidePreference(pref({ preferredTideMin: null, preferredTideMax: null, preferredDirection: "either" }))).toBeNull();
    const { container } = render(
      <BeachTideCards
        beaches={[pref({ preferredTideMin: null, preferredTideMax: null, preferredDirection: null })]}
        citySlug="haleiwa"
        stateSlug="hi"
        cityName="Haleiwa"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
