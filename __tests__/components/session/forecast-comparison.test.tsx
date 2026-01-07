/**
 * Tests for ForecastComparison Component
 *
 * Tests the forecast vs actual comparison display in session detail view.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ForecastComparison } from "@/components/session/forecast-comparison";
import type { ParsedForecastSnapshot } from "@/types/forecast-snapshot";

// Mock cn utility
jest.mock("@/lib/utils", () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" "),
}));

describe("ForecastComparison", () => {
  const mockSnapshotWithDiffs: ParsedForecastSnapshot = {
    forecast_snapshot: {
      wave_height: 3.5,
      wind_speed_mph: 10,
      wind_direction: "NW",
      tide_height: 2.8,
      tide_status: "rising",
      water_temp: 60,
    },
    actual_conditions: {
      wave_height_ft: 5.0,
      wind_speed_mph: 12,
      wind_direction: "W",
      tide_height_ft: 3.2,
      tide_status: "rising",
      water_temp: 62,
    },
    forecast_vs_actual: {
      wave_height_ft: { forecast: 3.5, actual: 5.0, diff: 1.5 },
      wind_speed_mph: { forecast: 10, actual: 12, diff: 2 },
      wind_direction: { forecast: "NW", actual: "W" },
      tide_height_ft: { forecast: 2.8, actual: 3.2, diff: 0.4 },
      water_temp: { forecast: 60, actual: 62, diff: 2 },
    },
    forecast_confidence_score: 85,
    data_source: "CDIP",
  };

  const mockSnapshotNoDiffs: ParsedForecastSnapshot = {
    forecast_snapshot: {
      wave_height: 3.5,
      wind_speed_mph: 10,
      wind_direction: "NW",
      tide_height: 2.8,
      tide_status: "rising",
      water_temp: 60,
    },
    actual_conditions: {
      wave_height_ft: 3.5,
      wind_speed_mph: 10,
      wind_direction: "NW",
      tide_height_ft: 2.8,
      tide_status: "rising",
      water_temp: 60,
    },
    forecast_vs_actual: null,
    forecast_confidence_score: 90,
    data_source: "NOAA",
  };

  const mockSnapshotPartialData: ParsedForecastSnapshot = {
    forecast_snapshot: {
      wave_height: 4.0,
    },
    actual_conditions: {
      wave_height_ft: 4.5,
    },
    forecast_vs_actual: {
      wave_height_ft: { forecast: 4.0, actual: 4.5, diff: 0.5 },
    },
    forecast_confidence_score: null,
    data_source: null,
  };

  describe("Rendering", () => {
    it("renders the component with title", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("Conditions at Time of Session")).toBeInTheDocument();
    });

    it("renders confidence score badge when present", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("85% confidence")).toBeInTheDocument();
    });

    it("renders data source badge when present", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("CDIP")).toBeInTheDocument();
    });

    it("does not render confidence badge when null", () => {
      render(<ForecastComparison snapshot={mockSnapshotPartialData} />);

      expect(screen.queryByText(/% confidence/)).not.toBeInTheDocument();
    });

    it("does not render data source badge when null", () => {
      render(<ForecastComparison snapshot={mockSnapshotPartialData} />);

      // Should not find data source badge (CDIP or NOAA)
      expect(screen.queryByText("CDIP")).not.toBeInTheDocument();
      expect(screen.queryByText("NOAA")).not.toBeInTheDocument();
    });
  });

  describe("Comparison rows", () => {
    it("renders wave height comparison", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("Wave Height")).toBeInTheDocument();
    });

    it("renders wind speed comparison", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("Wind Speed")).toBeInTheDocument();
    });

    it("renders wind direction comparison", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      // Two "Wind Direction" labels may appear, but we just check it exists
      const windLabels = screen.getAllByText("Wind Direction");
      expect(windLabels.length).toBeGreaterThanOrEqual(1);
    });

    it("renders tide height comparison", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("Tide Height")).toBeInTheDocument();
    });

    it("renders tide status comparison", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("Tide Status")).toBeInTheDocument();
    });

    it("renders water temp comparison", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(screen.getByText("Water Temp")).toBeInTheDocument();
    });
  });

  describe("Diff display", () => {
    it("shows diff description when diffs exist", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(
        screen.getByText("Showing differences between forecast and your reported conditions")
      ).toBeInTheDocument();
    });

    it("does not show diff description when no diffs", () => {
      render(<ForecastComparison snapshot={mockSnapshotNoDiffs} />);

      expect(
        screen.queryByText("Showing differences between forecast and your reported conditions")
      ).not.toBeInTheDocument();
    });
  });

  describe("Footer", () => {
    it("renders the footer note", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      expect(
        screen.getByText("Your condition reports help improve forecast accuracy for this spot")
      ).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles snapshot with only partial data", () => {
      render(<ForecastComparison snapshot={mockSnapshotPartialData} />);

      // Should render without errors
      expect(screen.getByText("Conditions at Time of Session")).toBeInTheDocument();
      expect(screen.getByText("Wave Height")).toBeInTheDocument();
    });

    it("returns null when no data to display", () => {
      const emptySnapshot: ParsedForecastSnapshot = {
        forecast_snapshot: {},
        actual_conditions: {},
        forecast_vs_actual: null,
        forecast_confidence_score: null,
        data_source: null,
      };

      const { container } = render(<ForecastComparison snapshot={emptySnapshot} />);

      // Should render nothing (null)
      expect(container.firstChild).toBeNull();
    });

    it("handles string wave height values", () => {
      const snapshotWithStringHeight: ParsedForecastSnapshot = {
        forecast_snapshot: {
          wave_height: "3.5", // string format
        },
        actual_conditions: {
          wave_height_ft: 4.0,
        },
        forecast_vs_actual: {
          wave_height_ft: { forecast: 3.5, actual: 4.0, diff: 0.5 },
        },
        forecast_confidence_score: 75,
        data_source: "CDIP",
      };

      render(<ForecastComparison snapshot={snapshotWithStringHeight} />);

      expect(screen.getByText("Wave Height")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("uses semantic HTML structure", () => {
      render(<ForecastComparison snapshot={mockSnapshotWithDiffs} />);

      // Card structure should be present
      const card = screen.getByText("Conditions at Time of Session").closest('[class*="overflow-hidden"]');
      expect(card).toBeInTheDocument();
    });
  });
});

describe("parseForecastSnapshot", () => {
  // Import the function for testing
  const { parseForecastSnapshot } = require("@/types/forecast-snapshot");

  it("returns null for null input", () => {
    expect(parseForecastSnapshot(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseForecastSnapshot(undefined)).toBeNull();
  });

  it("parses valid raw snapshot", () => {
    const raw = {
      forecast_snapshot: { wave_height: 3.5 },
      actual_conditions: { wave_height_ft: 4.0 },
      forecast_vs_actual: { wave_height_ft: { forecast: 3.5, actual: 4.0, diff: 0.5 } },
      forecast_confidence_score: 85,
      data_source: "CDIP",
    };

    const parsed = parseForecastSnapshot(raw);

    expect(parsed).toEqual({
      forecast_snapshot: { wave_height: 3.5 },
      actual_conditions: { wave_height_ft: 4.0 },
      forecast_vs_actual: { wave_height_ft: { forecast: 3.5, actual: 4.0, diff: 0.5 } },
      forecast_confidence_score: 85,
      data_source: "CDIP",
    });
  });
});

describe("hasDifferences", () => {
  const { hasDifferences } = require("@/types/forecast-snapshot");

  it("returns false for null snapshot", () => {
    expect(hasDifferences(null)).toBe(false);
  });

  it("returns false when forecast_vs_actual is null", () => {
    const snapshot = {
      forecast_snapshot: {},
      actual_conditions: {},
      forecast_vs_actual: null,
      forecast_confidence_score: null,
      data_source: null,
    };
    expect(hasDifferences(snapshot)).toBe(false);
  });

  it("returns false when forecast_vs_actual is empty", () => {
    const snapshot = {
      forecast_snapshot: {},
      actual_conditions: {},
      forecast_vs_actual: {},
      forecast_confidence_score: null,
      data_source: null,
    };
    expect(hasDifferences(snapshot)).toBe(false);
  });

  it("returns true when differences exist", () => {
    const snapshot = {
      forecast_snapshot: { wave_height: 3.5 },
      actual_conditions: { wave_height_ft: 4.0 },
      forecast_vs_actual: { wave_height_ft: { forecast: 3.5, actual: 4.0, diff: 0.5 } },
      forecast_confidence_score: 85,
      data_source: "CDIP",
    };
    expect(hasDifferences(snapshot)).toBe(true);
  });
});
