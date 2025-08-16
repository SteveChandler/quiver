import React from "react";
import { render, screen } from "@testing-library/react";
import { TodaysForecast } from "@/components/beach-detail/todays-forecast";

jest.mock("@/hooks/use-forecast-calibration", () => ({
  useForecastCalibration: () => ({ beachAccuracy: null }),
}));

describe("TodaysForecast (smoke)", () => {
  it("renders header and empty state without throwing when no forecast", () => {
    render(<TodaysForecast forecast={undefined as any} />);
    expect(screen.getByText("Today's Forecast")).toBeInTheDocument();
    expect(
      screen.getByText("No forecast data available for today")
    ).toBeInTheDocument();
  });
});
