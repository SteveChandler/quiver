import React from "react";
import { render, screen } from "@testing-library/react";
import { ForecastDisplayWithTransparency } from "@/components/forecast/forecast-display-with-transparency";

describe("ForecastDisplayWithTransparency (smoke)", () => {
  it("renders empty state without throwing when no forecasts", () => {
    render(
      <ForecastDisplayWithTransparency
        forecasts={[]}
        beach={null}
        loading={false}
        error={null}
      />
    );

    expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
    expect(screen.getByText("No forecast data available")).toBeInTheDocument();
  });
});
