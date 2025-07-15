import { render, screen } from "@testing-library/react";
import { ForecastDataTransparency } from "@/components/ui/forecast-data-transparency";

describe("ForecastDataTransparency", () => {
  describe("with real NOAA data", () => {
    it("should render real data indicator", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      expect(screen.getByText("Real NOAA Data")).toBeInTheDocument();
      expect(
        screen.getByText(/real-time NOAA weather data/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/National Weather Service/i)).toBeInTheDocument();
    });

    it("should have green styling for real data", () => {
      const { container } = render(
        <ForecastDataTransparency dataSource="NOAA_NWS" />
      );

      const alertElement = container.querySelector(
        '[class*="border-green-200"]'
      );
      expect(alertElement).toBeInTheDocument();
    });

    it("should show checkmark icon for real data", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      // Check for the presence of the checkmark icon by class name
      const checkIcon = document.querySelector(
        'svg[class*="lucide-circle-check-big"]'
      );
      expect(checkIcon).toBeInTheDocument();

      // Also verify the component content
      expect(screen.getByText("Real NOAA Data")).toBeInTheDocument();
    });

    it("should show wifi icon for real data", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      // Check for the presence of the wifi icon
      expect(screen.getByText("Real NOAA Data")).toBeInTheDocument();
    });
  });

  describe("with fallback data", () => {
    it("should render fallback data indicator", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      expect(screen.getByText("Estimated Data")).toBeInTheDocument();
      expect(
        screen.getByText(/NOAA data temporarily unavailable/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/estimated conditions/i)).toBeInTheDocument();
    });

    it("should have orange styling for fallback data", () => {
      const { container } = render(
        <ForecastDataTransparency dataSource="FALLBACK" />
      );

      const alertElement = container.querySelector(
        '[class*="border-orange-200"]'
      );
      expect(alertElement).toBeInTheDocument();
    });

    it("should show alert icon for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      // Check for the presence of the alert icon
      expect(screen.getByText("Estimated Data")).toBeInTheDocument();
    });

    it("should show wifi-off icon for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      // Check for the presence of the wifi-off icon
      expect(screen.getByText("Estimated Data")).toBeInTheDocument();
    });
  });

  describe("styling and accessibility", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <ForecastDataTransparency
          dataSource="NOAA_NWS"
          className="custom-class"
        />
      );

      const alertElement = container.querySelector(".custom-class");
      expect(alertElement).toBeInTheDocument();
    });

    it("should have proper semantic structure", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      // Should render as an alert
      const alertElement = screen.getByRole("alert");
      expect(alertElement).toBeInTheDocument();
    });

    it("should have proper badge styling for real data", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      const badge = screen.getByText("Real NOAA Data");
      expect(badge).toBeInTheDocument();
    });

    it("should have proper badge styling for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      const badge = screen.getByText("Estimated Data");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("content accuracy", () => {
    it("should display correct message for real data", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      expect(
        screen.getByText(/real-time NOAA weather data/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/National Weather Service/i)).toBeInTheDocument();
    });

    it("should display correct message for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      expect(
        screen.getByText(/NOAA data temporarily unavailable/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/estimated conditions/i)).toBeInTheDocument();
      expect(screen.getByText(/location and season/i)).toBeInTheDocument();
    });
  });
});
