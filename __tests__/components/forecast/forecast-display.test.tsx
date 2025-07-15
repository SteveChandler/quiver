import { render, screen } from "@testing-library/react";
import { ForecastDisplay } from "@/components/forecast/forecast-display";
import { EnhancedForecastEntity } from "@/types/forecast";
import {
  createForecastDisplayProps,
  createMockBeach,
  createMultipleMockForecastEntities,
} from "../../setup/forecast-test-utils";

describe("ForecastDisplay", () => {
  const defaultProps = createForecastDisplayProps();

  it("should render beach name and title", () => {
    render(<ForecastDisplay {...defaultProps} />);

    expect(screen.getByText("Test Beach")).toBeInTheDocument();
    expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
  });

  it("should render MultiDayForecastTable when forecasts are available", () => {
    render(<ForecastDisplay {...defaultProps} />);

    // Check for table structure from MultiDayForecastTable
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Surf (ft)")).toBeInTheDocument();
    expect(screen.getByText("Primary Swell")).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
  });

  it("should render ForecastDataTransparency with NOAA_NWS data source when forecasts are available", () => {
    render(<ForecastDisplay {...defaultProps} />);

    // Check for ForecastDataTransparency real content
    expect(screen.getByText("Real Wave Data")).toBeInTheDocument();
    expect(screen.getByText(/real oceanographic data/)).toBeInTheDocument();
  });

  it("should render no data message when no forecasts", () => {
    render(<ForecastDisplay {...defaultProps} forecasts={[]} />);

    expect(screen.getByText("No forecast data available")).toBeInTheDocument();
  });

  it("should render loading state", () => {
    render(<ForecastDisplay {...defaultProps} loading={true} />);

    expect(screen.getByText("Loading forecasts...")).toBeInTheDocument();
    expect(screen.getByText("Test Beach")).toBeInTheDocument();
    expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
  });

  it("should render error state", () => {
    render(
      <ForecastDisplay
        {...defaultProps}
        error="Failed to load forecasts"
        loading={false}
      />
    );

    expect(screen.getByText("Error loading forecasts")).toBeInTheDocument();
    expect(screen.getByText("Failed to load forecasts")).toBeInTheDocument();
  });

  it("should render no data state when forecasts array is empty", () => {
    render(<ForecastDisplay {...defaultProps} forecasts={[]} />);

    expect(screen.getByText("No forecast data available")).toBeInTheDocument();
  });

  it("should render no data state when forecasts is null", () => {
    render(<ForecastDisplay {...defaultProps} forecasts={null as any} />);

    expect(screen.getByText("No forecast data available")).toBeInTheDocument();
  });

  it("should render beach name even when beach is null", () => {
    render(<ForecastDisplay {...defaultProps} beach={null} />);

    expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
    expect(screen.queryByText("Test Beach")).not.toBeInTheDocument();
  });

  it("should maintain proper component hierarchy", () => {
    render(<ForecastDisplay {...defaultProps} />);

    // Check that the main container exists
    const mainContainer = screen.getByText("Test Beach").closest("div");
    expect(mainContainer).toBeInTheDocument();

    // Check that data transparency and table components are both rendered
    expect(screen.getByText("Real Wave Data")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument(); // Table header
  });
});
