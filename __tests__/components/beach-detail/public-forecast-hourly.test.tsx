/**
 * @jest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PublicForecastHourly } from "@/components/beach-detail/public-forecast-hourly";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

const report = {
  verdict: "YES",
  score: 84,
  bestWindowStart: "2026-08-15T14:00:00.000Z",
  bestWindowEnd: "2026-08-15T16:00:00.000Z",
} as SurfCallResult;

const context = {
  timezone: "America/Los_Angeles",
  selectedRowTime: "2026-08-15T15:00:00.000Z",
  displayWindowStart: "2026-08-15T14:00:00.000Z",
  displayWindowEnd: "2026-08-15T16:00:00.000Z",
} as ForecastRecommendationContext;

const forecastHours = [
  {
    forecast_at: "2026-08-15T13:00:00.000Z",
    wave_height: "2 ft",
    swell_1_height: "2 ft",
    swell_1_period: "17s",
    swell_1_direction: "SW",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_speed: "4 mph",
    wind_direction: "N",
    tide_height: "3.0 ft",
    tide_status: "Rising",
    confidence_score: 91,
  },
  {
    forecast_at: "2026-08-15T15:00:00.000Z",
    wave_height: "3 ft",
    swell_1_height: "2 ft",
    swell_1_period: "17s",
    swell_1_direction: "SW",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_speed: "4 mph",
    wind_direction: "N",
    tide_height: "3.2 ft",
    tide_status: "Rising",
    confidence_score: 92,
  },
];

describe("PublicForecastHourly", () => {
  it("marks matching rows without presenting the window score as an hourly score", () => {
    render(
      <PublicForecastHourly
        beachName="Del Mar"
        forecastHours={forecastHours}
        report={report}
        context={context}
        isTomorrow={false}
        forecastDay="today"
      />,
    );

    expect(document.body).not.toHaveTextContent("84/100");
    expect(screen.getByRole("columnheader", { name: "Quiver call" })).toBeInTheDocument();

    const rows = screen.getAllByTestId("public-forecast-hour");
    expect(within(rows[0]).queryByText("Best window")).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("Best window")).toBeInTheDocument();
  });

  it("keeps today's rows separate from a tomorrow recommendation", () => {
    render(
      <PublicForecastHourly
        beachName="Del Mar"
        forecastHours={forecastHours}
        report={report}
        context={context}
        isTomorrow
        forecastDay="today"
      />,
    );

    expect(screen.getByText("Today by time")).toBeInTheDocument();
    expect(screen.queryByText("Best window")).not.toBeInTheDocument();
  });
});
