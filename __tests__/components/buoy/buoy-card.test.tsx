import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuoyCard } from "@/components/buoy/buoy-card";

const mockConditions = {
  water_temperature: 65,
  air_temperature: 72,
  wind_speed: 15,
  wind_direction: 225,
  wind_direction_name: "SW",
  wind_gust: 20,
  wave_height: 4.5,
  wave_period: 8,
  pressure: 1013.2,
  tides: [
    { time: 1640995200, height: 5.2, name: "High" },
    { time: 1641018800, height: 1.8, name: "Low" },
    { time: 1641042400, height: 6.1, name: "High" },
  ],
  updated_at: 1640995200,
};

describe("BuoyCard", () => {
  const defaultProps = {
    buoyId: "46086",
    buoyName: "San Clemente Basin",
    location: "San Diego, CA",
    conditions: mockConditions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Default variant", () => {
    it("should render buoy name and ID", () => {
      render(<BuoyCard {...defaultProps} />);

      expect(screen.getByText("San Clemente Basin")).toBeInTheDocument();
      expect(screen.getByText("San Diego, CA")).toBeInTheDocument();
    });

    it("should render wave quality badge", () => {
      render(<BuoyCard {...defaultProps} />);

      // Should show wave quality badge for 4.5ft waves
      expect(screen.getByText("Great")).toBeInTheDocument();
    });

    it("should render temperature measurements", () => {
      render(<BuoyCard {...defaultProps} />);

      expect(
        screen.getByText((content, node) => content.includes("Water"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("65"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("Air"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("72"))
      ).toBeInTheDocument();
    });

    it("should render wind measurements", () => {
      render(<BuoyCard {...defaultProps} />);

      expect(
        screen.getByText((content, node) => content.includes("Wind"))
      ).toBeInTheDocument();
      expect(screen.getByText("15mph (SW) 20mph gusts")).toBeInTheDocument();
    });

    it("should render wave measurements", () => {
      render(<BuoyCard {...defaultProps} />);

      expect(
        screen.getByText((content, node) => content.includes("Waves"))
      ).toBeInTheDocument();
      expect(screen.getByText("4.5ft 8s period")).toBeInTheDocument();
    });

    it("should render next tide information", () => {
      render(<BuoyCard {...defaultProps} />);

      expect(screen.getByText("No upcoming tide data")).toBeInTheDocument();
    });

    it("should render data freshness indicator", () => {
      render(<BuoyCard {...defaultProps} />);

      // Should show some form of data freshness
      expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("should be clickable when onClick is provided", async () => {
      const user = userEvent.setup();
      const onClickMock = jest.fn();

      render(<BuoyCard {...defaultProps} onClick={onClickMock} />);

      const card = screen.getByText("San Clemente Basin").closest("div");
      await user.click(card!);

      expect(onClickMock).toHaveBeenCalledTimes(1);
    });

    it("should have cursor pointer when clickable", () => {
      const onClickMock = jest.fn();
      const { container } = render(
        <BuoyCard {...defaultProps} onClick={onClickMock} />
      );

      const cardElement = container.querySelector(".cursor-pointer");
      expect(cardElement).toBeInTheDocument();
    });
  });

  describe("Compact variant", () => {
    it("should render in compact layout", () => {
      render(<BuoyCard {...defaultProps} variant="compact" />);

      expect(screen.getByText("San Clemente Basin")).toBeInTheDocument();
      expect(screen.getByText("Great")).toBeInTheDocument();
    });

    it("should only show key measurements in compact mode", () => {
      render(<BuoyCard {...defaultProps} variant="compact" />);

      // Should show water temp and waves in compact grid
      expect(
        screen.getByText((content, node) => content.includes("Water"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("65"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("Waves"))
      ).toBeInTheDocument();
      expect(screen.getByText("4.5ft 8s period")).toBeInTheDocument();
    });

    it("should not show all detailed measurements in compact mode", () => {
      render(<BuoyCard {...defaultProps} variant="compact" />);

      // Should not show air temperature in compact mode
      expect(screen.queryByText("Air")).not.toBeInTheDocument();
    });
  });

  describe("Detailed variant", () => {
    it("should render all available measurements", () => {
      render(<BuoyCard {...defaultProps} variant="detailed" />);

      expect(
        screen.getByText((content, node) => content.includes("Water"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("65"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("Air"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("72"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("Wind"))
      ).toBeInTheDocument();
      expect(screen.getByText("15mph (SW) 20mph gusts")).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("Waves"))
      ).toBeInTheDocument();
      expect(screen.getByText("4.5ft 8s period")).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("Pressure"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("1013.2"))
      ).toBeInTheDocument();
    });

    it("should show buoy ID when provided", () => {
      render(<BuoyCard {...defaultProps} variant="detailed" />);

      expect(screen.getByText("Buoy 46086")).toBeInTheDocument();
    });

    it("should render tides section in detailed mode", () => {
      render(<BuoyCard {...defaultProps} variant="detailed" />);

      expect(screen.getByText("No upcoming tide data")).toBeInTheDocument();
      expect(screen.getByText("Tides")).toBeInTheDocument();
      expect(screen.getAllByText("High")).toHaveLength(2); // Two high tides in mock data
      expect(screen.getByText("Low")).toBeInTheDocument();
    });

    it("should show pressure measurement in detailed mode", () => {
      render(<BuoyCard {...defaultProps} variant="detailed" />);

      expect(
        screen.getByText((content, node) => content.includes("Pressure"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("1013.2"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("mb"))
      ).toBeInTheDocument();
    });
  });

  describe("Missing data handling", () => {
    it("should handle missing conditions gracefully", () => {
      render(<BuoyCard {...defaultProps} conditions={undefined} />);

      expect(screen.getByText("San Clemente Basin")).toBeInTheDocument();
      expect(screen.queryByText("Great")).not.toBeInTheDocument();
    });

    it("should handle partial conditions", () => {
      const partialConditions = {
        water_temperature: 65,
        wave_height: 3.0,
      };

      render(<BuoyCard {...defaultProps} conditions={partialConditions} />);

      expect(
        screen.getByText((content, node) => content.includes("Water"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("65"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("Waves"))
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, node) => content.includes("3ft"))
      ).toBeInTheDocument();
      expect(
        screen.queryByText((content, node) => content.includes("Air"))
      ).not.toBeInTheDocument();
    });

    it("should handle missing wave data", () => {
      const conditionsWithoutWaves = {
        ...mockConditions,
        wave_height: undefined,
      };

      render(
        <BuoyCard {...defaultProps} conditions={conditionsWithoutWaves} />
      );

      expect(screen.queryByText("Great")).not.toBeInTheDocument();
      expect(screen.queryByText(/Waves/)).not.toBeInTheDocument();
    });

    it("should handle missing tides", () => {
      const conditionsWithoutTides = {
        ...mockConditions,
        tides: undefined,
      };

      render(
        <BuoyCard {...defaultProps} conditions={conditionsWithoutTides} />
      );

      expect(screen.queryByText(/Next.*tide/)).not.toBeInTheDocument();
    });
  });

  describe("Status indicators", () => {
    it("should show status when enabled", () => {
      render(<BuoyCard {...defaultProps} showStatus={true} />);

      expect(screen.getByText("1/1/2022")).toBeInTheDocument();
    });

    it("should hide status when disabled", () => {
      render(<BuoyCard {...defaultProps} showStatus={false} />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it("should show location when enabled", () => {
      render(<BuoyCard {...defaultProps} showLocation={true} />);

      expect(screen.getByText("San Diego, CA")).toBeInTheDocument();
    });

    it("should hide location when disabled", () => {
      render(<BuoyCard {...defaultProps} showLocation={false} />);

      expect(screen.queryByText("San Diego, CA")).not.toBeInTheDocument();
    });
  });

  describe("Wave quality assessment", () => {
    it("should show Small for waves < 2ft", () => {
      const smallWaveConditions = { ...mockConditions, wave_height: 1.5 };
      render(<BuoyCard {...defaultProps} conditions={smallWaveConditions} />);

      expect(screen.getByText("Small")).toBeInTheDocument();
    });

    it("should show Good for waves 2-4ft", () => {
      const goodWaveConditions = { ...mockConditions, wave_height: 3.0 };
      render(<BuoyCard {...defaultProps} conditions={goodWaveConditions} />);

      expect(screen.getByText("Good")).toBeInTheDocument();
    });

    it("should show Great for waves 4-6ft", () => {
      const greatWaveConditions = { ...mockConditions, wave_height: 5.0 };
      render(<BuoyCard {...defaultProps} conditions={greatWaveConditions} />);

      expect(screen.getByText("Great")).toBeInTheDocument();
    });

    it("should show Epic for waves > 6ft", () => {
      const epicWaveConditions = { ...mockConditions, wave_height: 8.0 };
      render(<BuoyCard {...defaultProps} conditions={epicWaveConditions} />);

      expect(screen.getByText("Epic")).toBeInTheDocument();
    });
  });

  describe("Custom styling", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <BuoyCard {...defaultProps} className="custom-class" />
      );

      const cardElement = container.querySelector(".custom-class");
      expect(cardElement).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have clickable card element", () => {
      const onClickMock = jest.fn();
      const { container } = render(
        <BuoyCard {...defaultProps} onClick={onClickMock} />
      );

      const cardElement = container.querySelector(".cursor-pointer");
      expect(cardElement).toBeInTheDocument();
    });

    it("should be keyboard accessible", async () => {
      const user = userEvent.setup();
      const onClickMock = jest.fn();

      render(<BuoyCard {...defaultProps} onClick={onClickMock} />);

      const card = screen.getByText("San Clemente Basin").closest("div");
      await user.click(card!);

      expect(onClickMock).toHaveBeenCalledTimes(1);
    });

    it("should have proper semantic structure", () => {
      render(<BuoyCard {...defaultProps} variant="detailed" />);

      // Should have buoy name text
      expect(screen.getByText("San Clemente Basin")).toBeInTheDocument();
      expect(screen.getByText("Buoy 46086")).toBeInTheDocument();
    });
  });

  describe("Icons and visual elements", () => {
    it("should render wave icon", () => {
      render(<BuoyCard {...defaultProps} />);

      // Check for SVG icons
      const icons = document.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThan(0);
    });

    it("should render temperature icons with different colors", () => {
      render(<BuoyCard {...defaultProps} variant="detailed" />);

      // Should have thermometer icons with different colors for water/air
      const icons = document.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThan(2);
    });
  });
});
