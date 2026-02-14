import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DetailedSwellModal } from "@/components/beach-detail/detailed-swell-modal";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock the UI components
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div
      data-testid="dialog"
      data-open={open}
      onClick={() => onOpenChange(false)}
    >
      {children}
    </div>
  ),
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

jest.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => (
    <div data-testid="accordion">{children}</div>
  ),
  AccordionItem: ({ children }: any) => (
    <div data-testid="accordion-item">{children}</div>
  ),
  AccordionTrigger: ({ children }: any) => (
    <button data-testid="accordion-trigger">{children}</button>
  ),
  AccordionContent: ({ children }: any) => (
    <div data-testid="accordion-content">{children}</div>
  ),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button data-testid="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

describe("DetailedSwellModal", () => {
  const mockForecast = {
    id: "test-id",
    beach_id: "test-beach",
    forecast_at: "2024-08-07T12:00:00Z",
    forecast_date: "2024-08-07",
    forecast_time: "12:00:00",
    wave_height: "3.7 ft",
    wave_period: "10.5s",
    water_temp: "74°F",
    wind_speed: "5 mph",
    wind_direction: "NW",
    weather_condition: "Patchy Fog",
    tide_status: "Rising",
    confidence_score: 65,
    swell_1_height: "2.6 ft",
    swell_1_period: "12.0s",
    swell_1_direction: "SSW",
    swell_2_height: "1.5 ft",
    swell_2_period: "14.4s",
    swell_2_direction: "WSW",
    wind_wave_height: "0.1 ft",
    wind_wave_period: "0.65s",
    wind_wave_direction: "WNW",
    created_at: "2024-08-07T12:00:00Z",
    updated_at: "2024-08-07T12:00:00Z",
    data_source: "CDIP",
    source_buoy_id: null,
    fallback_location: null,
    nearest_buoy_distance: null,
    nearest_buoy_name: null,
    data_quality: "HIGH",
    is_real_time: true,
    is_stale_data: false,
  } as any;

  const defaultProps = {
    forecast: mockForecast,
    isOpen: true,
    onClose: jest.fn(),
    selectedDate: "2024-08-07",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly when open with forecast data", () => {
    render(<DetailedSwellModal {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Detailed Forecast - Wednesday, August 7"
    );
  });

  it("displays forecast information correctly", () => {
    render(<DetailedSwellModal {...defaultProps} />);

    expect(screen.getByText("3.7 ft")).toBeInTheDocument();
    expect(screen.getByText("10.5s")).toBeInTheDocument();
    expect(screen.getByText("74°F")).toBeInTheDocument();
    expect(screen.getByText("5 mph")).toBeInTheDocument();
    expect(screen.getByText("NW")).toBeInTheDocument();
    expect(screen.getByText("Patchy Fog")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("displays swell information correctly", () => {
    render(<DetailedSwellModal {...defaultProps} />);

    // Swell 1
    expect(screen.getByText("2.6 ft")).toBeInTheDocument();
    expect(screen.getByText("12.0s")).toBeInTheDocument();
    expect(screen.getByText("SSW")).toBeInTheDocument();

    // Swell 2
    expect(screen.getByText("1.5 ft")).toBeInTheDocument();
    expect(screen.getByText("14.4s")).toBeInTheDocument();
    expect(screen.getByText("WSW")).toBeInTheDocument();

    // Wind Wave
    expect(screen.getByText("0.1 ft")).toBeInTheDocument();
    expect(screen.getByText("0.65s")).toBeInTheDocument();
    expect(screen.getByText("WNW")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onCloseMock = jest.fn();
    render(<DetailedSwellModal {...defaultProps} onClose={onCloseMock} />);

    const closeButton = screen.getByTestId("button");
    fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalled();
  });

  it("does not render when forecast is null", () => {
    render(<DetailedSwellModal {...defaultProps} forecast={null} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("does not render when selectedDate is null", () => {
    render(<DetailedSwellModal {...defaultProps} selectedDate={null} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<DetailedSwellModal {...defaultProps} isOpen={false} />);

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "false");
  });

  it("handles missing swell data gracefully", () => {
    const forecastWithMissingData = {
      ...mockForecast,
      swell_1_height: null,
      swell_1_period: null,
      swell_1_direction: null,
      wind_wave_height: null,
    };

    render(
      <DetailedSwellModal
        {...defaultProps}
        forecast={forecastWithMissingData}
      />
    );

    expect(screen.getAllByText("N/A")).toHaveLength(4);
  });
});
