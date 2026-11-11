import { render, screen } from "@testing-library/react";
import { ForecastTable } from "@/components/forecast/forecast-table";

describe("ForecastTable without NWS weather", () => {
  it("shows the empty mark for a null weather and air temperature, not a sun icon or a blank line", () => {
    const now = new Date();
    render(
      <ForecastTable
        beachTimezone="UTC"
        forecasts={[{
          id: "row-1",
          beach_id: "beach-1",
          forecast_at: now.toISOString(),
          forecast_date: now.toISOString().slice(0, 10),
          forecast_time: now.toISOString().slice(11, 19),
          wave_height: "3 ft",
          wave_period: "10 s",
          wind_speed: null,
          wind_direction: null,
          water_temp: "64°F",
          air_temperature: null,
          weather_condition: null,
        } as never]}
      />,
    );

    expect(screen.queryByText("🌤️")).toBeNull();
    expect(screen.getByText("64°F").previousElementSibling).toHaveTextContent("—");
  });
});
