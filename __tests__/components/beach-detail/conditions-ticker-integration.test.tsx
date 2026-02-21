import { render, screen, within } from "@testing-library/react";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock the AnimatedWaveIcon to avoid SVG complexity in tests
jest.mock("@/components/ui/animated-wave-icon", () => ({
  AnimatedWaveIcon: () => <span data-testid="wave-icon" />,
}));

function makeForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "test-id",
    beach_id: "beach-1",
    forecast_at: "2026-02-18T08:00:00Z",
    forecast_date: "2026-02-18",
    forecast_time: "08:00",
    wave_height: "3-5ft",
    wave_period: "12s",
    wave_direction: "SSW",
    wind_speed: "8 mph",
    wind_direction: "NW",
    water_temp: "62°F",
    tide_status: "Rising",
    tide_height: "3.2ft",
    confidence_score: 85,
    data_source: "NOAA_NWS",
    created_at: "2026-02-18T00:00:00Z",
    updated_at: "2026-02-18T00:00:00Z",
    ...overrides,
  };
}

describe("ConditionsTicker in beach detail context", () => {
  it("renders conditions from a forecast entity via mapper", () => {
    const forecast = makeForecast();
    const data = forecastToConditionsData(forecast);
    render(
      <ConditionsTicker data={data} theme="light" beachName="Blacks Beach" />
    );

    const track = within(screen.getByTestId("ticker-content"));
    expect(track.getByText("3-5ft")).toBeInTheDocument();
    expect(track.getByText("8 mph NW")).toBeInTheDocument();
    expect(track.getByText("62°F")).toBeInTheDocument();
    expect(screen.getByRole("region")).toHaveAttribute(
      "aria-label",
      "Blacks Beach current conditions"
    );
  });

  it("returns null when forecast has no displayable data", () => {
    const forecast = makeForecast({
      wave_height: null,
      wave_period: null,
      wave_direction: null,
      wind_speed: null,
      wind_direction: null,
      water_temp: null,
      tide_status: null,
      tide_height: null,
    });
    const data = forecastToConditionsData(forecast);
    const { container } = render(
      <ConditionsTicker data={data} theme="light" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("uses light theme by default in beach detail context", () => {
    const forecast = makeForecast();
    const data = forecastToConditionsData(forecast);
    render(<ConditionsTicker data={data} theme="light" beachName="Blacks" />);
    const region = screen.getByRole("region");
    expect(region.className).toContain("bg-white");
    const track = within(screen.getByTestId("ticker-content"));
    expect(track.getByText("3-5ft")).toBeInTheDocument();
  });
});
