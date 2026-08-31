/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { SessionIntelligencePilot } from "@/components/beach-detail/session-intelligence-pilot";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

const NOW = new Date("2026-02-10T15:00:00Z");
const BEACH_ID = "11111111-1111-4111-8111-111111111111";

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: BEACH_ID,
    name: "Blacks",
    slug: "blacks",
    city: "San Diego",
    state: "CA",
    country: "USA",
    region: "Southern California",
    lat: 32.889,
    lon: -117.253,
    is_private: false,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 35,
    preferred_tide_ft_min: 1,
    preferred_tide_ft_max: 4,
    preferred_tide_direction: "rising",
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 45,
    real_takeaways: ["Works when west swell lines up with light wind"],
    ...overrides,
  } as Beach;
}

function makeForecast(
  id: string,
  forecastAt: string,
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id,
    beach_id: BEACH_ID,
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: "09:00",
    wave_height: "2",
    wave_period: "12s",
    wave_direction: "W",
    swell_1_height: "2",
    swell_1_period: "12s",
    swell_1_direction: "270",
    wind_speed: "5",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_status: "Rising",
    tide_height: "2.8",
    next_tide_at: "2026-02-10T20:00:00Z",
    confidence_score: 84,
    data_source: "NOAA_NWS",
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
    ...overrides,
  } as EnhancedForecastEntity;
}

describe("SessionIntelligencePilot", () => {
  it("renders up to three spot surf windows with CTA links", () => {
    render(
      <SessionIntelligencePilot
        beach={makeBeach()}
        forecasts={[
          makeForecast("forecast-1", "2026-02-10T16:00:00Z"),
          makeForecast("forecast-2", "2026-02-11T16:00:00Z"),
          makeForecast("forecast-3", "2026-02-12T16:00:00Z"),
          makeForecast("forecast-4", "2026-02-13T16:00:00Z"),
        ]}
        now={NOW}
        baseUrl="https://example.com"
      />
    );

    expect(screen.getByTestId("session-intelligence-pilot")).toBeInTheDocument();
    expect(screen.getAllByTestId("surf-window-card")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: /best surf windows at blacks/i })).toBeVisible();
    expect(screen.getAllByTestId("app-deep-link-cta")[0]).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/example.com\/app\/spot\/blacks\?window=/)
    );
  });

  it("renders Malibu Surfrider when the canonical path is allowlisted", () => {
    render(
      <SessionIntelligencePilot
        beach={makeBeach({
          name: "Malibu Surfrider First Point",
          slug: "malibu-surfrider-first-point-malibu-ca",
          city: "Malibu",
          state: "CA",
          region: "Malibu",
        })}
        canonicalPath="/ca/malibu/malibu-surfrider-first-point-malibu-ca"
        forecasts={[
          makeForecast("forecast-1", "2026-02-10T16:00:00Z"),
          makeForecast("forecast-2", "2026-02-11T16:00:00Z"),
        ]}
        now={NOW}
        baseUrl="https://www.quiversurf.app"
      />
    );

    expect(screen.getByTestId("session-intelligence-pilot")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /best surf windows at malibu surfrider first point/i,
      })
    ).toBeVisible();

    for (const cta of screen.getAllByTestId("app-deep-link-cta")) {
      expect(cta.getAttribute("href")).not.toContain("/surf-report/malibu-today");
    }
    expect(screen.getAllByTestId("app-deep-link-cta")[0]).toHaveAttribute(
      "href",
      expect.stringContaining(
        "/app/spot/malibu-surfrider-first-point-malibu-ca?window="
      )
    );
  });

  it("does not render for a non-allowlisted spot", () => {
    const { container } = render(
      <SessionIntelligencePilot
        beach={makeBeach({
          name: "Ocean Beach Pier",
          slug: "ocean-beach-pier",
          city: "San Diego",
          state: "CA",
        })}
        canonicalPath="/ca/san-diego/ocean-beach-pier"
        forecasts={[makeForecast("forecast-1", "2026-02-10T16:00:00Z")]}
        now={NOW}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not render a visual block when recommendations are unavailable", () => {
    const { container } = render(
      <SessionIntelligencePilot
        beach={makeBeach()}
        forecasts={[makeForecast("past", "2026-02-09T16:00:00Z")]}
        now={NOW}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not reconstruct windows when authoritative availability is explicitly none", () => {
    const unavailable = {
      recommendationAvailability: {
        state: "none" as const,
        reasonCode: "major_event_hold" as const,
        holdEpoch: "hold-epoch",
      },
    };
    const { container } = render(
      <SessionIntelligencePilot
        beach={makeBeach()}
        forecasts={[makeForecast("forecast-1", "2026-02-10T16:00:00Z")]}
        now={NOW}
        {...unavailable}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("heading", { name: /best surf windows/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it("keeps every rendered window public and explainable", () => {
    render(
      <SessionIntelligencePilot
        beach={makeBeach()}
        forecasts={[makeForecast("forecast-1", "2026-02-10T16:00:00Z")]}
        now={NOW}
        baseUrl="https://example.com"
      />
    );

    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /why this call/i })).toBeVisible();
    expect(screen.getByTestId("app-deep-link-cta")).toHaveAttribute("href");
  });
});
