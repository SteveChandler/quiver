/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PublicForecastAnswer } from "@/components/beach-detail/public-forecast-answer";
import type { Beach } from "@/types/database";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";

const beach = {
  id: "beach-1",
  name: "Oceanside Harbor",
  city: "Oceanside",
  state: "CA",
  timezone: "America/Los_Angeles",
} as Beach;

const context: ForecastRecommendationContext = {
  beachId: "beach-1",
  localDate: "2026-08-09",
  recommendationType: "best_window",
  contextType: "best_window",
  startTime: "2026-08-09T18:00:00.000Z",
  endTime: "2026-08-09T20:00:00.000Z",
  selectedWindowStart: "2026-08-09T18:00:00.000Z",
  selectedWindowEnd: "2026-08-09T20:00:00.000Z",
  displayWindowStart: "2026-08-09T18:00:00.000Z",
  displayWindowEnd: "2026-08-09T20:00:00.000Z",
  displayTimeLabel: "Best window: 11:00 AM-1:00 PM",
  selectedRowTime: "2026-08-09T19:00:00.000Z",
  waveHeight: "3 ft",
  waveHeightFt: 3,
  waveHeightRangeLabel: "2-3 ft",
  swellPeriod: "12s",
  periodSec: 12,
  swellDirection: "SW",
  primarySwellHeight: "2.5 ft",
  secondarySwellHeight: "1 ft",
  secondarySwellPeriod: "8s",
  secondarySwellDirection: "W",
  windSpeed: "5 mph",
  windDirection: "E",
  score: 78,
  confidence: 82,
  primaryDataSource: "NOAA_NWS",
  sourceDataUpdatedAt: "2026-08-09T17:00:00.000Z",
  contributingSources: ["NOAA_NWS", "NOAA_CO-OPS"],
  resolverUsed: "surf-call",
  source: "looking_ahead",
  timezone: "America/Los_Angeles",
};

describe("PublicForecastAnswer", () => {
  it("renders the selected tomorrow state and truthful provenance in server HTML", () => {
    render(
      <PublicForecastAnswer
        beach={beach}
        report={null}
        context={context}
        isTomorrow
        headingLevel="h1"
      />,
    );

    expect(screen.getByTestId("public-forecast-answer")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow's surf forecast")).toBeInTheDocument();
    expect(screen.getByText(/Oceanside Harbor Surf Forecast for/)).toBeInTheDocument();
    expect(screen.getByText("2-3 ft")).toBeInTheDocument();
    expect(screen.getByText(/NOAA NWS, NOAA CO-OPS/)).toBeInTheDocument();
  });

  it("keeps the exact-query heading when forecast details are unavailable", () => {
    render(
      <PublicForecastAnswer
        beach={beach}
        report={null}
        context={null}
        isTomorrow={false}
        headingLevel="h1"
      />,
    );

    expect(screen.getByRole("heading", {
      level: 1,
      name: "Oceanside Harbor Surf Forecast",
    })).toBeInTheDocument();
    expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Forecast valid at/)).not.toBeInTheDocument();
  });
});
