import React from "react";
import { render, screen } from "@testing-library/react";
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";

describe("ForecastDataSourceIndicator - Confidence Badge Fix", () => {
  const defaultProps = {
    confidenceScore: 85,
    dataSources: [],
  };

  describe("when data is unavailable", () => {
    it("should NOT display confidence badge", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="UNKNOWN"
        />
      );

      // Should show "Data unavailable" message
      expect(screen.getByText("Data unavailable")).toBeInTheDocument();

      // Should NOT show confidence badge
      expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    });

    it("should NOT display any metadata (buoy info, last updated, etc.)", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="INVALID"
          lastUpdated="2025-01-15T12:00:00Z"
          nearestBuoyName="Test Buoy"
          nearestBuoyDistance={5}
          nearestBuoyStationId="12345"
          beachLocation={{ latitude: 34.0, longitude: -118.0 }}
        />
      );

      // Should show "Data unavailable" message
      expect(screen.getByText("Data unavailable")).toBeInTheDocument();

      // Should NOT show confidence badge
      expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();

      // Should NOT show buoy info
      expect(screen.queryByText("CDIP 12345")).not.toBeInTheDocument();

      // Should NOT show last updated
      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
    });

    it("should NOT display expandable details button", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="UNKNOWN"
          expandable={true}
        />
      );

      // Should NOT show Details button
      expect(screen.queryByText("Details")).not.toBeInTheDocument();
    });
  });

  describe("when data source is CDIP", () => {
    it("should display confidence badge", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="CDIP"
        />
      );

      // Should show CDIP data source
      expect(screen.getByText("CDIP Buoy Data")).toBeInTheDocument();

      // Should show confidence badge
      expect(screen.getByText("85% confidence")).toBeInTheDocument();
    });

    it("should display metadata when available", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="CDIP"
          lastUpdated="2025-01-15T12:00:00Z"
          isRealTimeData={true}
          nearestBuoyName="Test Buoy"
          nearestBuoyDistance={5}
          nearestBuoyStationId="12345"
          beachLocation={{ latitude: 34.0, longitude: -118.0 }}
        />
      );

      // Should show confidence badge
      expect(screen.getByText("85% confidence")).toBeInTheDocument();

      // Should show live data badge
      expect(screen.getByText("Live Data")).toBeInTheDocument();

      // Should show last updated
      expect(screen.getByText(/updated/i)).toBeInTheDocument();

      // Should show buoy info (compact variant shows "CDIP {stationId}")
      expect(screen.getByText("CDIP 12345")).toBeInTheDocument();
    });
  });

  describe("when data source is NOAA_NWS", () => {
    it("should display confidence badge", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="NOAA_NWS"
        />
      );

      // Should show NOAA data source
      expect(screen.getByText("NOAA Forecast")).toBeInTheDocument();

      // Should show confidence badge
      expect(screen.getByText("85% confidence")).toBeInTheDocument();
    });
  });

  describe("when data source is FALLBACK", () => {
    it("should display confidence badge", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="FALLBACK"
          fallbackLocation="Nearby Beach"
        />
      );

      // Should show fallback data source
      expect(screen.getByText("Fallback Data")).toBeInTheDocument();

      // Should show confidence badge
      expect(screen.getByText("85% confidence")).toBeInTheDocument();
    });

    it("should display stale data warning when available", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="FALLBACK"
          isStaleData={true}
          lastUpdated="2025-01-15T12:00:00Z"
        />
      );

      // Should show confidence badge
      expect(screen.getByText("85% confidence")).toBeInTheDocument();

      // Should show stale data warning
      expect(screen.getByTestId("stale-data-warning")).toBeInTheDocument();
    });
  });

  describe("confidence score levels", () => {
    it("should render high confidence (75+) in green", () => {
      const { container } = render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="CDIP"
          confidenceScore={85}
        />
      );

      const badge = screen.getByText("85% confidence");
      expect(badge).toHaveClass("bg-green-100", "text-green-700");
    });

    it("should render medium confidence (50-74) in yellow", () => {
      const { container } = render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="CDIP"
          confidenceScore={60}
        />
      );

      const badge = screen.getByText("60% confidence");
      expect(badge).toHaveClass("bg-yellow-100", "text-yellow-700");
    });

    it("should render low confidence (<50) in red", () => {
      const { container } = render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="CDIP"
          confidenceScore={30}
        />
      );

      const badge = screen.getByText("30% confidence");
      expect(badge).toHaveClass("bg-red-100", "text-red-700");
    });
  });

  describe("hasValidData flag logic", () => {
    it("should set hasValidData to true for CDIP", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="CDIP"
          expandable={true}
        />
      );

      // Details button should be present (only available with valid data)
      expect(screen.getByText("Details")).toBeInTheDocument();
    });

    it("should set hasValidData to true for NOAA_NWS", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="NOAA_NWS"
          expandable={true}
        />
      );

      // Details button should be present (only available with valid data)
      expect(screen.getByText("Details")).toBeInTheDocument();
    });

    it("should set hasValidData to true for FALLBACK", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="FALLBACK"
          expandable={true}
        />
      );

      // Details button should be present (only available with valid data)
      expect(screen.getByText("Details")).toBeInTheDocument();
    });

    it("should set hasValidData to false for unknown sources", () => {
      render(
        <ForecastDataSourceIndicator
          {...defaultProps}
          dataSource="UNKNOWN_SOURCE"
          expandable={true}
        />
      );

      // Details button should NOT be present (no valid data)
      expect(screen.queryByText("Details")).not.toBeInTheDocument();
    });
  });
});
