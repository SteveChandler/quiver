import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ForecastFallbackMessaging } from "@/components/forecast/forecast-fallback-messaging";

describe("ForecastFallbackMessaging", () => {
  describe("Fallback Scenarios", () => {
    it("should show nearest beach fallback message", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_beach"
          originalLocation="Malibu"
          fallbackLocation="Huntington Beach"
          distance={45.2}
          reason="No forecast data available for Malibu"
        />
      );

      expect(
        screen.getByText(/Using forecast from Huntington Beach/)
      ).toBeInTheDocument();
      expect(screen.getByText(/45.2 miles away/)).toBeInTheDocument();
      expect(
        screen.getByText(/No forecast data available for Malibu/)
      ).toBeInTheDocument();
    });

    it("should show nearest buoy fallback message", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_buoy"
          originalLocation="La Jolla Shores"
          fallbackLocation="La Jolla Buoy"
          distance={3.1}
          reason="Beach-specific data unavailable"
        />
      );

      expect(
        screen.getByText(/Using buoy data from La Jolla Buoy/)
      ).toBeInTheDocument();
      expect(screen.getByText(/3.1 miles away/)).toBeInTheDocument();
      expect(
        screen.getByText(/Beach-specific data unavailable/)
      ).toBeInTheDocument();
    });

    it("should show regional fallback message", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="regional"
          originalLocation="Palos Verdes"
          fallbackLocation="Southern California Coast"
          reason="Limited data coverage for this area"
        />
      );

      expect(screen.getByText(/Using regional forecast/)).toBeInTheDocument();
      expect(screen.getByText(/Southern California Coast/)).toBeInTheDocument();
      expect(
        screen.getByText(/Limited data coverage for this area/)
      ).toBeInTheDocument();
    });

    it("should show out-of-area message for unsupported regions", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="out_of_area"
          originalLocation="Tampico, Mexico"
          fallbackLocation="Huntington Beach"
          reason="Outside supported forecast area"
          isOutOfArea={true}
        />
      );

      expect(screen.getByText(/Outside forecast coverage/)).toBeInTheDocument();
      expect(
        screen.getByText(/Tampico, Mexico is outside our supported area/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Showing Huntington Beach as reference/)
      ).toBeInTheDocument();
    });
  });

  describe("Data Quality Indicators", () => {
    it("should show accuracy reduction for distant fallbacks", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_beach"
          originalLocation="Santa Barbara"
          fallbackLocation="Ventura"
          distance={25.7}
          accuracyImpact="medium"
          confidenceReduction={15}
        />
      );

      expect(
        screen.getByText(/Forecast accuracy may be reduced/)
      ).toBeInTheDocument();
      expect(screen.getByText(/~15% less confident/)).toBeInTheDocument();
      expect(screen.getByText(/25.7 miles difference/)).toBeInTheDocument();
    });

    it("should show minimal impact for nearby fallbacks", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_buoy"
          originalLocation="Del Mar"
          fallbackLocation="Scripps Pier Buoy"
          distance={1.2}
          accuracyImpact="low"
          confidenceReduction={3}
        />
      );

      expect(
        screen.getByText(/Minimal impact on accuracy/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Very close data source/)).toBeInTheDocument();
      expect(screen.getByText(/~3% confidence reduction/)).toBeInTheDocument();
    });

    it("should show high impact warning for far fallbacks", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="regional"
          originalLocation="Big Sur"
          fallbackLocation="Central California"
          accuracyImpact="high"
          confidenceReduction={35}
        />
      );

      expect(
        screen.getByText(/Significant accuracy reduction/)
      ).toBeInTheDocument();
      expect(screen.getByText(/~35% less confident/)).toBeInTheDocument();
      expect(screen.getByTestId("high-impact-warning")).toBeInTheDocument();
    });
  });

  describe("User Actions", () => {
    it("should show request data option for missing locations", () => {
      const mockRequestData = jest.fn();

      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_beach"
          originalLocation="Capitola"
          fallbackLocation="Santa Cruz"
          distance={5.5}
          reason=""
          showRequestDataOption={true}
          onRequestData={mockRequestData}
        />
      );

      const requestButton = screen.getByRole("button", {
        name: /Request forecast for Capitola/,
      });
      expect(requestButton).toBeInTheDocument();
    });

    it("should show alternative locations", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="out_of_area"
          originalLocation="Oregon Coast"
          fallbackLocation="Huntington Beach"
          alternatives={[
            { name: "Santa Cruz", distance: 320 },
            { name: "San Francisco", distance: 290 },
            { name: "Half Moon Bay", distance: 310 },
          ]}
        />
      );

      expect(
        screen.getByText(/Try nearby supported locations:/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Santa Cruz \(320 mi\)/)).toBeInTheDocument();
      expect(screen.getByText(/San Francisco \(290 mi\)/)).toBeInTheDocument();
      expect(screen.getByText(/Half Moon Bay \(310 mi\)/)).toBeInTheDocument();
    });

    it("should provide refresh option for temporary issues", () => {
      const mockRefresh = jest.fn();

      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_beach"
          originalLocation="Ocean Beach"
          fallbackLocation="Mission Beach"
          distance={8.1}
          reason="Temporary data outage"
          isTemporary={true}
          onRefresh={mockRefresh}
        />
      );

      const refreshButton = screen.getByRole("button", { name: /Try again/ });
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe("Visual Styling", () => {
    it("should use warning styling for medium impact fallbacks", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_beach"
          originalLocation="Seal Beach"
          fallbackLocation="Newport Beach"
          distance={12.5}
          accuracyImpact="medium"
        />
      );

      const message = screen.getByTestId("fallback-message");
      expect(message).toHaveClass("border-yellow-200", "bg-yellow-50");
    });

    it("should use error styling for high impact fallbacks", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="out_of_area"
          originalLocation="Hawaii"
          fallbackLocation="Huntington Beach"
          accuracyImpact="high"
        />
      );

      const message = screen.getByTestId("fallback-message");
      expect(message).toHaveClass("border-red-200", "bg-red-50");
    });

    it("should use info styling for low impact fallbacks", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_buoy"
          originalLocation="Cardiff"
          fallbackLocation="Solana Beach Buoy"
          distance={2.8}
          accuracyImpact="low"
        />
      );

      const message = screen.getByTestId("fallback-message");
      expect(message).toHaveClass("border-blue-200", "bg-blue-50");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for warnings", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="out_of_area"
          originalLocation="International"
          fallbackLocation="Huntington Beach"
          accuracyImpact="high"
        />
      );

      const warning = screen.getByRole("alert");
      expect(warning).toHaveAttribute(
        "aria-label",
        "Using alternative forecast data"
      );
    });

    it("should be screen reader friendly", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_beach"
          originalLocation="Encinitas"
          fallbackLocation="Cardiff"
          distance={4.2}
          reason="Beach-specific data temporarily unavailable"
        />
      );

      expect(
        screen.getByLabelText(/Using alternative forecast data/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Cardiff/)).toBeInTheDocument();
      expect(screen.getByText(/4.2 miles away/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing distance gracefully", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="regional"
          originalLocation="Unknown Location"
          fallbackLocation="General Southern California"
          reason="Location not recognized"
        />
      );

      expect(screen.getByText(/Using regional forecast/)).toBeInTheDocument();
      expect(screen.queryByText(/miles away/)).not.toBeInTheDocument();
    });

    it("should handle unknown fallback types", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="unknown"
          originalLocation="Test Location"
          fallbackLocation="Default Location"
          reason="Unknown error"
        />
      );

      expect(
        screen.getByText(/Using alternative forecast/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Default Location/)).toBeInTheDocument();
    });

    it("should show fallback chain for multiple fallbacks", () => {
      render(
        <ForecastFallbackMessaging
          fallbackType="nearest_beach"
          originalLocation="Redondo Beach"
          fallbackLocation="Manhattan Beach"
          fallbackChain={[
            { location: "Redondo Beach", status: "failed", reason: "No data" },
            { location: "Hermosa Beach", status: "failed", reason: "Outdated" },
            {
              location: "Manhattan Beach",
              status: "active",
              reason: "Current data",
            },
          ]}
        />
      );

      expect(screen.getByText(/Tried multiple sources:/)).toBeInTheDocument();
      expect(screen.getByText(/Redondo Beach/)).toBeInTheDocument();
      expect(screen.getByText(/No data/)).toBeInTheDocument();
      expect(screen.getByText(/Hermosa Beach/)).toBeInTheDocument();
      expect(screen.getByText(/Outdated/)).toBeInTheDocument();
      expect(screen.getAllByText(/Manhattan Beach/)[0]).toBeInTheDocument();
      expect(screen.getByText(/Current data/)).toBeInTheDocument();
    });
  });
});
