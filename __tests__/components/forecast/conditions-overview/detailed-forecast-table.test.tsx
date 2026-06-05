import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailedForecastTable } from "@/components/forecast/conditions-overview/detailed-forecast-table";
import { createMockEnhancedForecastEntity } from "../../../setup/forecast-test-utils";

describe("DetailedForecastTable", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-04T22:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows the initially expanded current day to collapse", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const forecast = createMockEnhancedForecastEntity({
      forecast_at: "2026-06-04T16:00:00Z",
      forecast_date: "2026-06-04",
      forecast_time: "16:00",
      weather_condition: "Partly cloudy",
      air_temperature: "61°F",
    });

    render(
      <DetailedForecastTable
        forecasts={[forecast]}
        beachTimezone="America/Los_Angeles"
      />,
    );

    expect(screen.getByText("Partly cloudy 61°F")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /today, thu, jun 4/i }),
    );

    expect(screen.queryByText("Partly cloudy 61°F")).not.toBeInTheDocument();
  });
});
