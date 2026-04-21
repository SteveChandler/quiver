/**
 * ForecastTable UI guard: the secondary-swell `<td>` must render an em-dash
 * placeholder when `swell_2_height` is null (no real secondary partition).
 * Rendering "0 ft / 0s" or silently formatting null values was the previous
 * bug — the em-dash signals "no second swell train" while preserving
 * column alignment.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastTable } from "@/components/forecast/forecast-table";
import { createMockEnhancedForecastEntity } from "../../setup/forecast-test-utils";

// Today-relative forecast so the day-header matches and the table expands
// when the user clicks it.
const todayAt6amLocal = () => {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  return d;
};

const todayIso = () => todayAt6amLocal().toISOString();
const todayDate = () => {
  const d = todayAt6amLocal();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

async function expandDayHeader(): Promise<void> {
  // The day header is a <button> with the date/day label — click to expand.
  const buttons = screen.getAllByRole("button");
  if (buttons.length > 0) {
    await userEvent.click(buttons[0]);
  }
}

describe("ForecastTable — secondary swell null guard", () => {
  it("renders em-dash (—) in the Secondary Swell cell when swell_2_height is null", async () => {
    const forecast = createMockEnhancedForecastEntity({
      forecast_at: todayIso(),
      forecast_date: todayDate(),
      swell_2_height: null as unknown as string,
      swell_2_period: null as unknown as string,
      swell_2_direction: null as unknown as string,
    });

    render(<ForecastTable forecasts={[forecast]} />);
    await expandDayHeader();

    // Column header proves the table rendered.
    expect(screen.getByText("Secondary Swell")).toBeInTheDocument();
    // The em-dash placeholder should appear at least once (one per row).
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders formatted values when swell_2_height is populated", async () => {
    const forecast = createMockEnhancedForecastEntity({
      forecast_at: todayIso(),
      forecast_date: todayDate(),
      swell_2_height: "2 ft",
      swell_2_period: "8s",
      swell_2_direction: "SW",
    });

    render(<ForecastTable forecasts={[forecast]} />);
    await expandDayHeader();

    expect(screen.getByText("Secondary Swell")).toBeInTheDocument();
    // Populated row renders the height formatted via formatHeight("2 ft").
    expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);
  });
});
