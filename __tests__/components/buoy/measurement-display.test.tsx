import { render, screen } from "@testing-library/react";
import {
  Measurement,
  TemperatureMeasurement,
  WindMeasurement,
  WaveMeasurement,
  PressureMeasurement,
} from "@/components/buoy/measurement-display";

describe("Measurement Components", () => {
  describe("Measurement", () => {
    it("should render with basic props", () => {
      render(
        <Measurement
          value={25}
          unit="°C"
          label="Temperature"
          icon={<span data-testid="test-icon">🌡️</span>}
        />
      );

      expect(screen.getByText("Temperature:")).toBeInTheDocument();
      expect(screen.getByText("25°C")).toBeInTheDocument();
      expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    });

    it("should render without icon", () => {
      render(<Measurement value={100} unit="%" label="Humidity" />);

      expect(screen.getByText("Humidity:")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("should render without unit", () => {
      render(<Measurement value="Clear" label="Conditions" />);

      expect(screen.getByText("Conditions:")).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <Measurement value={50} label="Test" className="custom-measurement" />
      );

      expect(container.firstChild).toHaveClass("custom-measurement");
    });

    describe("Variants", () => {
      it("should apply compact variant styles", () => {
        const { container } = render(
          <Measurement value={25} label="Test" variant="compact" />
        );

        expect(container.querySelector(".text-xs")).toBeInTheDocument();
      });

      it("should apply default variant styles", () => {
        const { container } = render(
          <Measurement value={25} label="Test" variant="default" />
        );

        expect(container.querySelector(".text-sm")).toBeInTheDocument();
      });

      it("should apply large variant styles", () => {
        const { container } = render(
          <Measurement value={25} label="Test" variant="large" />
        );

        expect(container.querySelector(".text-base")).toBeInTheDocument();
      });
    });
  });

  describe("TemperatureMeasurement", () => {
    it("should render water temperature with blue thermometer", () => {
      render(<TemperatureMeasurement value={65} type="water" />);

      expect(screen.getByText("Water:")).toBeInTheDocument();
      expect(screen.getByText("65°")).toBeInTheDocument();

      // Check for thermometer icon with blue color
      const icon = document.querySelector(".text-blue-500");
      expect(icon).toBeInTheDocument();
    });

    it("should render air temperature with orange thermometer", () => {
      render(<TemperatureMeasurement value={72} type="air" />);

      expect(screen.getByText("Air:")).toBeInTheDocument();
      expect(screen.getByText("72°")).toBeInTheDocument();

      // Check for thermometer icon with orange color
      const icon = document.querySelector(".text-orange-500");
      expect(icon).toBeInTheDocument();
    });

    it("should default to water type", () => {
      render(<TemperatureMeasurement value={68} />);

      expect(screen.getByText("Water:")).toBeInTheDocument();
      expect(screen.getByText("68°")).toBeInTheDocument();
    });

    it("should handle decimal values", () => {
      render(<TemperatureMeasurement value={65.7} type="water" />);

      expect(screen.getByText("65.7°")).toBeInTheDocument();
    });

    it("should apply variant styles", () => {
      const { container } = render(
        <TemperatureMeasurement value={65} type="water" variant="compact" />
      );

      expect(container.querySelector(".text-xs")).toBeInTheDocument();
    });
  });

  describe("WindMeasurement", () => {
    it("should render wind speed only", () => {
      render(<WindMeasurement speed={15} />);

      expect(screen.getByText("Wind:")).toBeInTheDocument();
      expect(screen.getByText("15mph")).toBeInTheDocument();
    });

    it("should render wind with direction", () => {
      render(<WindMeasurement speed={20} direction="SW" />);

      expect(screen.getByText("Wind:")).toBeInTheDocument();
      expect(screen.getByText("20mph (SW)")).toBeInTheDocument();
    });

    it("should render wind with gusts", () => {
      render(<WindMeasurement speed={15} gust={25} />);

      expect(screen.getByText("Wind:")).toBeInTheDocument();
      expect(screen.getByText("15mph 25mph gusts")).toBeInTheDocument();
    });

    it("should render wind with direction and gusts", () => {
      render(<WindMeasurement speed={18} direction="NW" gust={28} />);

      expect(screen.getByText("Wind:")).toBeInTheDocument();
      expect(screen.getByText("18mph (NW) 28mph gusts")).toBeInTheDocument();
    });

    it("should render wind icon with gray color", () => {
      render(<WindMeasurement speed={12} />);

      const icon = document.querySelector(".text-gray-600");
      expect(icon).toBeInTheDocument();
    });

    it("should handle zero wind speed", () => {
      render(<WindMeasurement speed={0} />);

      expect(screen.getByText("0mph")).toBeInTheDocument();
    });
  });

  describe("WaveMeasurement", () => {
    it("should render wave height only", () => {
      render(<WaveMeasurement height={4.5} />);

      expect(screen.getByText("Waves:")).toBeInTheDocument();
      expect(screen.getByText("4.5ft")).toBeInTheDocument();
    });

    it("should render wave height with period", () => {
      render(<WaveMeasurement height={6} period={8} />);

      expect(screen.getByText("Waves:")).toBeInTheDocument();
      expect(screen.getByText("6ft 8s period")).toBeInTheDocument();
    });

    it("should render wave icon with blue color", () => {
      render(<WaveMeasurement height={3} />);

      const icon = document.querySelector(".text-blue-600");
      expect(icon).toBeInTheDocument();
    });

    it("should handle decimal wave heights", () => {
      render(<WaveMeasurement height={2.8} period={7.5} />);

      expect(screen.getByText("2.8ft 7.5s period")).toBeInTheDocument();
    });

    it("should handle zero wave height", () => {
      render(<WaveMeasurement height={0} />);

      expect(screen.getByText("0ft")).toBeInTheDocument();
    });
  });

  describe("PressureMeasurement", () => {
    it("should render pressure with mb unit", () => {
      render(<PressureMeasurement value={1013.2} />);

      expect(screen.getByText("Pressure:")).toBeInTheDocument();
      expect(screen.getByText("1013.2 mb")).toBeInTheDocument();
    });

    it("should render pressure icon with purple color", () => {
      render(<PressureMeasurement value={1020} />);

      const icon = document.querySelector(".text-purple-600");
      expect(icon).toBeInTheDocument();
    });

    it("should handle integer pressure values", () => {
      render(<PressureMeasurement value={1015} />);

      expect(screen.getByText("1015 mb")).toBeInTheDocument();
    });

    it("should apply variant styles", () => {
      const { container } = render(
        <PressureMeasurement value={1013} variant="large" />
      );

      expect(container.querySelector(".text-base")).toBeInTheDocument();
    });
  });

  describe("Icon sizes based on variants", () => {
    it("should use compact icon size for compact variant", () => {
      const { container } = render(
        <TemperatureMeasurement value={65} variant="compact" />
      );

      const icon = container.querySelector(".h-3.w-3");
      expect(icon).toBeInTheDocument();
    });

    it("should use default icon size for default variant", () => {
      const { container } = render(
        <TemperatureMeasurement value={65} variant="default" />
      );

      const icon = container.querySelector(".h-4.w-4");
      expect(icon).toBeInTheDocument();
    });

    it("should use large icon size for large variant", () => {
      const { container } = render(
        <TemperatureMeasurement value={65} variant="large" />
      );

      const icon = container.querySelector(".h-5.w-5");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", () => {
      render(<TemperatureMeasurement value={65} type="water" />);

      // Should use strong for emphasis on values
      const strongElement = document.querySelector("strong");
      expect(strongElement).toBeInTheDocument();
      expect(strongElement).toHaveTextContent("65°");
    });

    it("should have descriptive labels", () => {
      render(<WindMeasurement speed={15} direction="SW" gust={25} />);

      expect(screen.getByText(/Wind:/)).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle very large numbers", () => {
      render(<PressureMeasurement value={9999.99} />);

      expect(screen.getByText("9999.99 mb")).toBeInTheDocument();
    });

    it("should handle very small numbers", () => {
      render(<WaveMeasurement height={0.1} period={0.5} />);

      expect(screen.getByText("0.1ft 0.5s period")).toBeInTheDocument();
    });

    it("should handle negative values", () => {
      render(<TemperatureMeasurement value={-5} type="air" />);

      expect(screen.getByText("-5°")).toBeInTheDocument();
    });
  });
});
