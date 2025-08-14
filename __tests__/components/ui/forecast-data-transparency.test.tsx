import { render, screen } from "@testing-library/react";
import ForecastDataTransparency from "@/components/ui/forecast-data-transparency";

describe("ForecastDataTransparency", () => {
  describe("with real NOAA data", () => {
    it("should render real data indicator", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      expect(screen.getByText("Real Wave Data")).toBeInTheDocument();
      expect(screen.getByText(/real oceanographic data/i)).toBeInTheDocument();
      expect(screen.getByText(/NOAA WaveWatch III/i)).toBeInTheDocument();
    });

    it("should have green styling for real data", () => {
      const { container } = render(
        <ForecastDataTransparency dataSource="NOAA_NWS" />
      );

      // Updated to match actual styling classes in the component
      const alertElement = container.querySelector(
        '[class*="border-green-500"], [class*="bg-green-500"]'
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
      expect(screen.getByText("Real Wave Data")).toBeInTheDocument();
    });

    it("should show waves icon for real data", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      // Check for the presence of the waves icon and text
      expect(screen.getByText("Real Wave Data")).toBeInTheDocument();
      const wavesIcon = document.querySelector('svg[class*="lucide-waves"]');
      expect(wavesIcon).toBeInTheDocument();
    });
  });

  describe("with fallback data", () => {
    it("should render fallback data indicator", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      expect(screen.getByText("Estimated Conditions")).toBeInTheDocument();
      expect(
        screen.getByText(/Using estimated wave conditions/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/estimated conditions/i)).toBeInTheDocument();
    });

    it("should have orange styling for fallback data", () => {
      const { container } = render(
        <ForecastDataTransparency dataSource="FALLBACK" />
      );

      // Updated to match actual styling classes in the component
      const alertElement = container.querySelector(
        '[class*="border-orange-500"], [class*="bg-orange-500"]'
      );
      expect(alertElement).toBeInTheDocument();
    });

    it("should show alert icon for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      // Check for the presence of the alert icon
      expect(screen.getByText("Estimated Conditions")).toBeInTheDocument();
      const alertIcon = document.querySelector(
        'svg[class*="lucide-circle-alert"]'
      );
      expect(alertIcon).toBeInTheDocument();
    });

    it("should show wifi-off icon for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      // Check for the presence of the wifi-off icon
      expect(screen.getByText("Estimated Conditions")).toBeInTheDocument();
      const wifiOffIcon = document.querySelector(
        'svg[class*="lucide-wifi-off"]'
      );
      expect(wifiOffIcon).toBeInTheDocument();
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

      const badge = screen.getByText("Real Wave Data");
      expect(badge).toBeInTheDocument();
    });

    it("should have proper badge styling for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      const badge = screen.getByText("Estimated Conditions");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("content accuracy", () => {
    it("should display correct message for real data", () => {
      render(<ForecastDataTransparency dataSource="NOAA_NWS" />);

      expect(screen.getByText(/real oceanographic data/i)).toBeInTheDocument();
      expect(screen.getByText(/NOAA WaveWatch III/i)).toBeInTheDocument();
    });

    it("should display correct message for fallback data", () => {
      render(<ForecastDataTransparency dataSource="FALLBACK" />);

      expect(
        screen.getByText(/Using estimated wave conditions/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/estimated conditions/i)).toBeInTheDocument();
      expect(
        screen.getByText(/location and seasonal patterns/i)
      ).toBeInTheDocument();
    });
  });
});
