import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DetailCard } from "@/app/embed/surf-terminal/[slug]/detail-card";
import { createMockEnhancedForecastEntity } from "../../setup/forecast-test-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Helper to build a fully-populated forecast
function makeForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return createMockEnhancedForecastEntity({
    forecast_at: "2026-02-18T14:00:00Z",
    wave_height: "4-6 ft",
    wave_period: "14s",
    wave_direction: "WSW",
    swell_1_height: "3.5 ft",
    swell_1_period: "16s",
    swell_1_direction: "W",
    swell_2_height: "1.5 ft",
    swell_2_period: "9s",
    swell_2_direction: "SW",
    wind_speed: "8 mph",
    wind_direction: "NW",
    tide_status: "Rising",
    tide_height: "3.2 ft",
    next_tide_type: "High",
    next_tide_time: "18:45",
    air_temperature: "72°F",
    water_temp: "65°F",
    weather_condition: "Partly Cloudy",
    confidence_score: 88,
    data_source: "NOAA_NWS",
    ml_corrected_height: "4.2 ft",
    is_ml_calibrated: true,
    ...overrides,
  });
}

const DEFAULT_PROPS = {
  theme: "dark" as const,
  onClose: jest.fn(),
  timezone: "America/Los_Angeles",
};

describe("DetailCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Rendering ────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders nothing when forecast is null", () => {
      const { container } = render(
        <DetailCard forecast={null} {...DEFAULT_PROPS} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders the detail card when forecast is provided", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByTestId("detail-card")).toBeInTheDocument();
    });

    it("renders all condition sections", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("Waves")).toBeInTheDocument();
      expect(screen.getByText("Swell")).toBeInTheDocument();
      expect(screen.getByText("Wind")).toBeInTheDocument();
      expect(screen.getByText("Tide")).toBeInTheDocument();
      expect(screen.getByText("Conditions")).toBeInTheDocument();
    });

    it("displays wave height, period, and direction", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("14s")).toBeInTheDocument();
      expect(screen.getByText("WSW")).toBeInTheDocument();
    });

    it("displays primary swell info", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("3.5 ft @ 16s")).toBeInTheDocument();
      expect(screen.getByText("W")).toBeInTheDocument();
    });

    it("displays secondary swell when available", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("1.5 ft @ 9s")).toBeInTheDocument();
    });

    it("displays wind speed and direction", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("8 mph")).toBeInTheDocument();
      expect(screen.getByText("NW")).toBeInTheDocument();
    });

    it("displays tide status and height", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.getByText("3.2 ft")).toBeInTheDocument();
    });

    it("displays next tide info (fallback to next_tide_time)", () => {
      render(
        <DetailCard
          forecast={makeForecast({ next_tide_type: "High" })}
          {...DEFAULT_PROPS}
        />
      );
      expect(screen.getByText("Next High")).toBeInTheDocument();
      expect(screen.getByText("18:45")).toBeInTheDocument();
    });

    it("formats next_tide_at in the provided timezone instead of showing raw next_tide_time", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            next_tide_type: "High",
            next_tide_at: "2026-02-19T00:00:00Z", // midnight UTC = 4:00 PM PST
            next_tide_time: "12:00 AM", // old UTC-formatted value
          })}
          {...DEFAULT_PROPS}
          timezone="America/Los_Angeles"
        />
      );
      // Should show 4:00 PM (from next_tide_at in PST), NOT "12:00 AM" (raw UTC)
      expect(screen.getByText(/4:00\s*PM/)).toBeInTheDocument();
      expect(screen.queryByText("12:00 AM")).not.toBeInTheDocument();
    });

    it("formats next_tide_at correctly for Hawaii timezone", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            next_tide_type: "Low",
            next_tide_at: "2026-02-19T00:00:00Z", // midnight UTC = 2:00 PM HST (UTC-10)
            next_tide_time: "12:00 AM",
          })}
          {...DEFAULT_PROPS}
          timezone="Pacific/Honolulu"
        />
      );
      expect(screen.getByText(/2:00\s*PM/)).toBeInTheDocument();
    });

    it("displays air temp, water temp, and weather condition", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("72°F")).toBeInTheDocument();
      expect(screen.getByText("65°F")).toBeInTheDocument();
      expect(screen.getByText("Partly Cloudy")).toBeInTheDocument();
    });

    it("displays confidence score as percentage", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("88%")).toBeInTheDocument();
    });

    it("displays data source", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByText("NOAA_NWS")).toBeInTheDocument();
    });
  });

  // ─── Close button ─────────────────────────────────────────────

  describe("close button", () => {
    it("renders a close button", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(screen.getByTestId("detail-card-close")).toBeInTheDocument();
    });

    it("has accessible aria-label", () => {
      render(<DetailCard forecast={makeForecast()} {...DEFAULT_PROPS} />);
      expect(
        screen.getByRole("button", { name: /close details/i })
      ).toBeInTheDocument();
    });

    it("calls onClose when clicked", () => {
      const onClose = jest.fn();
      render(
        <DetailCard
          forecast={makeForecast()}
          {...DEFAULT_PROPS}
          onClose={onClose}
        />
      );
      fireEvent.click(screen.getByTestId("detail-card-close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Theming ──────────────────────────────────────────────────

  describe("theming", () => {
    it("applies dark theme styles", () => {
      render(
        <DetailCard
          forecast={makeForecast()}
          {...DEFAULT_PROPS}
          theme="dark"
        />
      );
      const card = screen.getByTestId("detail-card");
      expect(card.className).toContain("bg-[#1a1a2e]/95");
      expect(card.className).toContain("text-slate-200");
    });

    it("applies light theme styles", () => {
      render(
        <DetailCard
          forecast={makeForecast()}
          {...DEFAULT_PROPS}
          theme="light"
        />
      );
      const card = screen.getByTestId("detail-card");
      expect(card.className).toContain("bg-white/95");
      expect(card.className).toContain("text-slate-800");
    });

    it("dark theme close button uses slate-400 text", () => {
      render(
        <DetailCard
          forecast={makeForecast()}
          {...DEFAULT_PROPS}
          theme="dark"
        />
      );
      const btn = screen.getByTestId("detail-card-close");
      expect(btn.className).toContain("text-slate-400");
    });

    it("light theme close button uses slate-500 text", () => {
      render(
        <DetailCard
          forecast={makeForecast()}
          {...DEFAULT_PROPS}
          theme="light"
        />
      );
      const btn = screen.getByTestId("detail-card-close");
      expect(btn.className).toContain("text-slate-500");
    });
  });

  // ─── Null / missing optional fields ───────────────────────────

  describe("missing data handling", () => {
    it("shows dash for null wave_height", () => {
      render(
        <DetailCard
          forecast={makeForecast({ wave_height: null })}
          {...DEFAULT_PROPS}
        />
      );
      // "Height" appears in both Waves and Tide sections so use getAllByText
      const heightLabels = screen.getAllByText("Height");
      // The first "Height" is in the Waves section
      const waveHeightRow = heightLabels[0].closest("div");
      expect(waveHeightRow).toHaveTextContent("\u2014");
    });

    it("shows dash for missing wave_period", () => {
      render(
        <DetailCard
          forecast={makeForecast({ wave_period: null })}
          {...DEFAULT_PROPS}
        />
      );
      // The Period label row should contain a dash
      const rows = screen.getAllByText("—");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("shows dash for missing wind_speed", () => {
      render(
        <DetailCard
          forecast={makeForecast({ wind_speed: null })}
          {...DEFAULT_PROPS}
        />
      );
      const rows = screen.getAllByText("—");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render secondary swell section when swell_2 is absent", () => {
      render(
        <DetailCard
          forecast={makeForecast({ swell_2_height: null })}
          {...DEFAULT_PROPS}
        />
      );
      expect(screen.queryByText("Secondary")).not.toBeInTheDocument();
    });

    it("does not render next tide row when next_tide_type is absent", () => {
      render(
        <DetailCard
          forecast={makeForecast({ next_tide_type: null })}
          {...DEFAULT_PROPS}
        />
      );
      expect(screen.queryByText(/Next High/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Next Low/)).not.toBeInTheDocument();
    });

    it("does not crash with fully minimal forecast", () => {
      const minimal: EnhancedForecastEntity = {
        id: "min-1",
        beach_id: "beach-1",
        forecast_at: "2026-02-18T14:00:00Z",
        forecast_date: "2026-02-18",
        forecast_time: "14:00",
        wave_height: null,
        water_temp: null,
        confidence_score: null,
        data_source: "FALLBACK",
        created_at: "2026-02-18T00:00:00Z",
        updated_at: "2026-02-18T00:00:00Z",
      };

      expect(() => {
        render(<DetailCard forecast={minimal} {...DEFAULT_PROPS} />);
      }).not.toThrow();

      expect(screen.getByTestId("detail-card")).toBeInTheDocument();
    });

    it("does not render confidence row when confidence_score is null", () => {
      render(
        <DetailCard
          forecast={makeForecast({ confidence_score: null })}
          {...DEFAULT_PROPS}
        />
      );
      expect(screen.queryByText("Confidence")).not.toBeInTheDocument();
    });
  });

  // ─── ML corrected height ──────────────────────────────────────

  describe("ML corrected height", () => {
    it("shows ML adjusted height when available and calibrated", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            ml_corrected_height: "4.2 ft",
            is_ml_calibrated: true,
          })}
          {...DEFAULT_PROPS}
        />
      );
      expect(screen.getByText("ML Adjusted")).toBeInTheDocument();
      expect(screen.getByText("4.2 ft")).toBeInTheDocument();
    });

    it("applies accent styling to ML adjusted value", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            ml_corrected_height: "4.2 ft",
            is_ml_calibrated: true,
          })}
          {...DEFAULT_PROPS}
        />
      );
      // Find the ML Adjusted row value span
      const mlLabel = screen.getByText("ML Adjusted");
      const mlRow = mlLabel.closest("div");
      const valueSpan = mlRow?.querySelector(".text-\\[\\#00d4aa\\]");
      expect(valueSpan).toBeInTheDocument();
    });

    it("does not show ML adjusted when is_ml_calibrated is false", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            ml_corrected_height: "4.2 ft",
            is_ml_calibrated: false,
          })}
          {...DEFAULT_PROPS}
        />
      );
      expect(screen.queryByText("ML Adjusted")).not.toBeInTheDocument();
    });

    it("does not show ML adjusted when ml_corrected_height is null", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            ml_corrected_height: null,
            is_ml_calibrated: true,
          })}
          {...DEFAULT_PROPS}
        />
      );
      expect(screen.queryByText("ML Adjusted")).not.toBeInTheDocument();
    });
  });

  // ─── Time formatting ──────────────────────────────────────────

  describe("time formatting", () => {
    it("formats forecast time using provided timezone", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            forecast_at: "2026-02-18T14:00:00Z",
          })}
          {...DEFAULT_PROPS}
          timezone="America/Los_Angeles"
        />
      );
      // 14:00 UTC = 6:00 AM PST
      // toLocaleString with these options should produce something like
      // "Wed, Feb 18, 6:00 AM"
      const card = screen.getByTestId("detail-card");
      expect(card.textContent).toMatch(/Wed/);
      expect(card.textContent).toMatch(/Feb/);
      expect(card.textContent).toMatch(/6:00/);
    });

    it("formats in a different timezone correctly", () => {
      render(
        <DetailCard
          forecast={makeForecast({
            forecast_at: "2026-02-18T14:00:00Z",
          })}
          {...DEFAULT_PROPS}
          timezone="America/New_York"
        />
      );
      // 14:00 UTC = 9:00 AM EST
      const card = screen.getByTestId("detail-card");
      expect(card.textContent).toMatch(/9:00/);
    });
  });
});
