import { render, screen } from "@testing-library/react";
import {
  WavePeriodDisplay,
  SwellComponent,
  WaveBreakdown,
} from "@/components/ui/wave-period-display";

describe("WavePeriodDisplay", () => {
  describe("compact variant (default)", () => {
    it("should render wave data with excellent quality period", () => {
      render(
        <WavePeriodDisplay
          waveHeight="4-6 ft"
          wavePeriod="14s"
          waveDirection="WSW"
        />
      );

      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("14s")).toBeInTheDocument();
      expect(screen.getByText("WSW")).toBeInTheDocument();

      // Period should be colored green for excellent quality (>=12s)
      const periodElement = screen.getByText("14s");
      expect(periodElement).toHaveClass("text-green-600");
    });

    it("should render wave data with good quality period", () => {
      render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="11s"
          waveDirection="W"
        />
      );

      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
      expect(screen.getByText("11s")).toBeInTheDocument();

      // Period should be colored blue for good quality (10-12s)
      const periodElement = screen.getByText("11s");
      expect(periodElement).toHaveClass("text-blue-600");
    });

    it("should render wave data with fair quality period", () => {
      render(
        <WavePeriodDisplay
          waveHeight="2-3 ft"
          wavePeriod="9s"
          waveDirection="SW"
        />
      );

      expect(screen.getByText("2-3 ft")).toBeInTheDocument();
      expect(screen.getByText("9s")).toBeInTheDocument();

      // Period should be colored yellow for fair quality (8-10s)
      const periodElement = screen.getByText("9s");
      expect(periodElement).toHaveClass("text-yellow-600");
    });

    it("should render wave data with choppy quality period", () => {
      render(
        <WavePeriodDisplay
          waveHeight="2-3 ft"
          wavePeriod="7s"
          waveDirection="SW"
        />
      );

      expect(screen.getByText("2-3 ft")).toBeInTheDocument();
      expect(screen.getByText("7s")).toBeInTheDocument();

      // Period should be colored orange for choppy quality (6-8s)
      const periodElement = screen.getByText("7s");
      expect(periodElement).toHaveClass("text-orange-600");
    });

    it("should render wave data with poor quality period", () => {
      render(
        <WavePeriodDisplay
          waveHeight="1-2 ft"
          wavePeriod="4s"
          waveDirection="SW"
        />
      );

      expect(screen.getByText("1-2 ft")).toBeInTheDocument();
      expect(screen.getByText("4s")).toBeInTheDocument();

      // Period should be colored red for poor quality (<6s)
      const periodElement = screen.getByText("4s");
      expect(periodElement).toHaveClass("text-red-600");
    });

    it("should hide direction when showDirection is false", () => {
      render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="10s"
          waveDirection="WSW"
          showDirection={false}
        />
      );

      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
      expect(screen.getByText("10s")).toBeInTheDocument();
      expect(screen.queryByText("WSW")).not.toBeInTheDocument();
    });

    it("should handle missing wave data gracefully", () => {
      render(
        <WavePeriodDisplay
          waveHeight={null}
          wavePeriod={null}
          waveDirection={null}
        />
      );

      // There are multiple N/A elements, so use getAllByText
      const naElements = screen.getAllByText("N/A");
      expect(naElements.length).toBeGreaterThan(0);
    });

    it("should format period without 's' suffix", () => {
      render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="12"
          waveDirection="W"
        />
      );

      expect(screen.getByText("12s")).toBeInTheDocument();
    });
  });

  describe("detailed variant", () => {
    it("should render detailed wave conditions layout", () => {
      render(
        <WavePeriodDisplay
          waveHeight="4-6 ft"
          wavePeriod="14s"
          waveDirection="WSW"
          variant="detailed"
        />
      );

      expect(screen.getByText("Wave Conditions")).toBeInTheDocument();
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("14s")).toBeInTheDocument();
      expect(screen.getByText("Direction: WSW")).toBeInTheDocument();
      expect(screen.getByText("Height")).toBeInTheDocument();
      expect(screen.getByText("Period")).toBeInTheDocument();
    });

    it("should show wave quality description in detailed view", () => {
      render(
        <WavePeriodDisplay
          waveHeight="4-6 ft"
          wavePeriod="14s"
          waveDirection="WSW"
          variant="detailed"
        />
      );

      // Text is split across multiple elements, use partial matches
      expect(screen.getByText(/Wave quality:/)).toBeInTheDocument();
      expect(screen.getByText("excellent")).toBeInTheDocument();
      expect(
        screen.getByText(/(long period, clean waves)/)
      ).toBeInTheDocument();
    });

    it("should show different quality descriptions", () => {
      const { rerender } = render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="11s"
          variant="detailed"
        />
      );
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText(/(well-formed waves)/)).toBeInTheDocument();

      rerender(
        <WavePeriodDisplay
          waveHeight="2-3 ft"
          wavePeriod="9s"
          variant="detailed"
        />
      );
      expect(screen.getByText("fair")).toBeInTheDocument();
      expect(screen.getByText(/(moderate conditions)/)).toBeInTheDocument();

      rerender(
        <WavePeriodDisplay
          waveHeight="2-3 ft"
          wavePeriod="7s"
          variant="detailed"
        />
      );
      expect(screen.getByText("choppy")).toBeInTheDocument();
      expect(screen.getByText(/(short period, bumpy)/)).toBeInTheDocument();

      rerender(
        <WavePeriodDisplay
          waveHeight="1-2 ft"
          wavePeriod="4s"
          variant="detailed"
        />
      );
      expect(screen.getByText("poor")).toBeInTheDocument();
      expect(screen.getByText(/(very choppy conditions)/)).toBeInTheDocument();
    });

    it("should apply appropriate background colors for different periods", () => {
      const { rerender } = render(
        <WavePeriodDisplay
          waveHeight="4-6 ft"
          wavePeriod="14s"
          variant="detailed"
        />
      );

      let periodContainer = screen.getByText("14s").parentElement;
      expect(periodContainer).toHaveClass("bg-green-50", "border-green-200");

      rerender(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="11s"
          variant="detailed"
        />
      );

      periodContainer = screen.getByText("11s").parentElement;
      expect(periodContainer).toHaveClass("bg-blue-50", "border-blue-200");

      rerender(
        <WavePeriodDisplay
          waveHeight="1-2 ft"
          wavePeriod="4s"
          variant="detailed"
        />
      );

      periodContainer = screen.getByText("4s").parentElement;
      expect(periodContainer).toHaveClass("bg-red-50", "border-red-200");
    });
  });

  describe("period formatting", () => {
    it("should add 's' suffix to numeric periods", () => {
      render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="12"
          waveDirection="W"
        />
      );

      expect(screen.getByText("12s")).toBeInTheDocument();
    });

    it("should preserve existing 's' suffix", () => {
      render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="12s"
          waveDirection="W"
        />
      );

      expect(screen.getByText("12s")).toBeInTheDocument();
    });

    it("should handle decimal periods", () => {
      render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="12.5"
          waveDirection="W"
        />
      );

      expect(screen.getByText("12.5s")).toBeInTheDocument();
    });

    it("should handle invalid period values", () => {
      render(
        <WavePeriodDisplay
          waveHeight="3-4 ft"
          wavePeriod="invalid"
          waveDirection="W"
        />
      );

      expect(screen.getByText("invalid")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper semantic structure", () => {
      render(
        <WavePeriodDisplay
          waveHeight="4-6 ft"
          wavePeriod="14s"
          waveDirection="WSW"
        />
      );

      expect(screen.getByText("4-6 ft")).toBeVisible();
      expect(screen.getByText("14s")).toBeVisible();
      expect(screen.getByText("WSW")).toBeVisible();
    });

    it("should have proper heading in detailed variant", () => {
      render(
        <WavePeriodDisplay
          waveHeight="4-6 ft"
          wavePeriod="14s"
          waveDirection="WSW"
          variant="detailed"
        />
      );

      expect(screen.getByText("Wave Conditions")).toBeVisible();
    });
  });
});

describe("SwellComponent", () => {
  describe("primary swell", () => {
    it("should render primary swell component", () => {
      render(
        <SwellComponent
          swellHeight="3.2 ft"
          swellPeriod="12s"
          swellDirection="WSW"
          swellType="primary"
        />
      );

      expect(screen.getByText("Primary Swell")).toBeInTheDocument();
      expect(screen.getByText("3.2 ft")).toBeInTheDocument();
      expect(screen.getByText("Period: 12s")).toBeInTheDocument();
      expect(screen.getByText("Direction: WSW")).toBeInTheDocument();

      // Should have blue styling for primary swell - get the root container
      const container = screen.getByText("Primary Swell").closest("div")
        ?.parentElement?.parentElement;
      expect(container).toHaveClass("bg-blue-50", "border-blue-200");
    });
  });

  describe("secondary swell", () => {
    it("should render secondary swell component", () => {
      render(
        <SwellComponent
          swellHeight="2.1 ft"
          swellPeriod="9s"
          swellDirection="SW"
          swellType="secondary"
        />
      );

      expect(screen.getByText("Secondary Swell")).toBeInTheDocument();
      expect(screen.getByText("2.1 ft")).toBeInTheDocument();
      expect(screen.getByText("Period: 9s")).toBeInTheDocument();
      expect(screen.getByText("Direction: SW")).toBeInTheDocument();

      // Should have green styling for secondary swell - get the root container
      const container = screen.getByText("Secondary Swell").closest("div")
        ?.parentElement?.parentElement;
      expect(container).toHaveClass("bg-green-50", "border-green-200");
    });
  });

  describe("wind waves", () => {
    it("should render wind waves component", () => {
      render(
        <SwellComponent
          swellHeight="1.5 ft"
          swellPeriod="5s"
          swellDirection="W"
          swellType="wind"
        />
      );

      expect(screen.getByText("Wind Waves")).toBeInTheDocument();
      expect(screen.getByText("1.5 ft")).toBeInTheDocument();
      expect(screen.getByText("Period: 5s")).toBeInTheDocument();
      expect(screen.getByText("Direction: W")).toBeInTheDocument();

      // Should have orange styling for wind waves - get the root container
      const container = screen.getByText("Wind Waves").closest("div")
        ?.parentElement?.parentElement;
      expect(container).toHaveClass("bg-orange-50", "border-orange-200");
    });
  });

  describe("partial data", () => {
    it("should render with only height", () => {
      render(
        <SwellComponent
          swellHeight="2.5 ft"
          swellPeriod={null}
          swellDirection={null}
          swellType="primary"
        />
      );

      expect(screen.getByText("Primary Swell")).toBeInTheDocument();
      expect(screen.getByText("2.5 ft")).toBeInTheDocument();
      expect(screen.queryByText("Period:")).not.toBeInTheDocument();
      expect(screen.queryByText("Direction:")).not.toBeInTheDocument();
    });

    it("should render with only period", () => {
      render(
        <SwellComponent
          swellHeight={null}
          swellPeriod="10s"
          swellDirection={null}
          swellType="secondary"
        />
      );

      expect(screen.getByText("Secondary Swell")).toBeInTheDocument();
      expect(screen.getByText("Period: 10s")).toBeInTheDocument();
      expect(screen.queryByText(/ft/)).not.toBeInTheDocument();
      expect(screen.queryByText("Direction:")).not.toBeInTheDocument();
    });

    it("should not render when no data available", () => {
      const { container } = render(
        <SwellComponent
          swellHeight={null}
          swellPeriod={null}
          swellDirection={null}
          swellType="primary"
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      render(
        <SwellComponent
          swellHeight="3.2 ft"
          swellPeriod="12s"
          swellDirection="WSW"
          swellType="primary"
          className="custom-swell-class"
        />
      );

      const container = screen.getByText("Primary Swell").closest("div")
        ?.parentElement?.parentElement;
      expect(container).toHaveClass("custom-swell-class");
    });

    it("should have consistent icon sizing", () => {
      render(
        <SwellComponent
          swellHeight="3.2 ft"
          swellPeriod="12s"
          swellDirection="WSW"
          swellType="primary"
        />
      );

      const icon = screen
        .getByText("Primary Swell")
        .closest("div")
        ?.parentElement?.parentElement?.querySelector("svg");
      expect(icon).toHaveClass("h-4", "w-4");
    });
  });
});

describe("WaveBreakdown", () => {
  const mockWaveData = {
    waveHeight: "4-6 ft",
    wavePeriod: "12s",
    waveDirection: "WSW",
    swell1Height: "3.5 ft",
    swell1Period: "14s",
    swell1Direction: "W",
    swell2Height: "2.1 ft",
    swell2Period: "9s",
    swell2Direction: "SW",
    windWaveHeight: "1.2 ft",
    windWavePeriod: "5s",
    windWaveDirection: "NW",
  };

  describe("complete wave breakdown", () => {
    it("should render main wave display and all swell components", () => {
      render(<WaveBreakdown {...mockWaveData} />);

      // Main wave display
      expect(screen.getByText("Wave Conditions")).toBeInTheDocument();
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("12s")).toBeInTheDocument();

      // Swell components header
      expect(screen.getByText("Swell Components")).toBeInTheDocument();

      // Primary swell
      expect(screen.getByText("Primary Swell")).toBeInTheDocument();
      expect(screen.getByText("3.5 ft")).toBeInTheDocument();

      // Secondary swell
      expect(screen.getByText("Secondary Swell")).toBeInTheDocument();
      expect(screen.getByText("2.1 ft")).toBeInTheDocument();

      // Wind waves
      expect(screen.getByText("Wind Waves")).toBeInTheDocument();
      expect(screen.getByText("1.2 ft")).toBeInTheDocument();
    });
  });

  describe("partial swell data", () => {
    it("should render only components with available data", () => {
      render(
        <WaveBreakdown
          waveHeight="3-4 ft"
          wavePeriod="10s"
          waveDirection="W"
          swell1Height="2.5 ft"
          swell1Period="12s"
          swell1Direction="WSW"
          swell2Height={null}
          swell2Period={null}
          swell2Direction={null}
          windWaveHeight={null}
          windWavePeriod={null}
          windWaveDirection={null}
        />
      );

      expect(screen.getByText("Wave Conditions")).toBeInTheDocument();
      expect(screen.getByText("Swell Components")).toBeInTheDocument();
      expect(screen.getByText("Primary Swell")).toBeInTheDocument();
      expect(screen.getByText("2.5 ft")).toBeInTheDocument();

      // Secondary and wind components should not render without data
      expect(screen.queryByText("Secondary Swell")).not.toBeInTheDocument();
      expect(screen.queryByText("Wind Waves")).not.toBeInTheDocument();
    });

    it("should not render swell components section when no swell data", () => {
      render(
        <WaveBreakdown
          waveHeight="3-4 ft"
          wavePeriod="10s"
          waveDirection="W"
          swell1Height={null}
          swell1Period={null}
          swell1Direction={null}
          swell2Height={null}
          swell2Period={null}
          swell2Direction={null}
          windWaveHeight={null}
          windWavePeriod={null}
          windWaveDirection={null}
        />
      );

      expect(screen.getByText("Wave Conditions")).toBeInTheDocument();
      expect(screen.queryByText("Swell Components")).not.toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <WaveBreakdown {...mockWaveData} className="custom-breakdown-class" />
      );

      const breakdownContainer = container.firstChild as HTMLElement;
      expect(breakdownContainer).toHaveClass("custom-breakdown-class");
    });

    it("should maintain consistent spacing", () => {
      const { container } = render(<WaveBreakdown {...mockWaveData} />);

      const breakdownContainer = container.firstChild as HTMLElement;
      expect(breakdownContainer).toHaveClass("space-y-3");
    });
  });

  describe("edge cases", () => {
    it("should handle all null wave data", () => {
      render(
        <WaveBreakdown
          waveHeight={null}
          wavePeriod={null}
          waveDirection={null}
          swell1Height={null}
          swell1Period={null}
          swell1Direction={null}
          swell2Height={null}
          swell2Period={null}
          swell2Direction={null}
          windWaveHeight={null}
          windWavePeriod={null}
          windWaveDirection={null}
        />
      );

      expect(screen.getByText("Wave Conditions")).toBeInTheDocument();
      // Multiple N/A elements, use getAllByText
      const naElements = screen.getAllByText("N/A");
      expect(naElements.length).toBeGreaterThan(0);
      expect(screen.queryByText("Swell Components")).not.toBeInTheDocument();
    });

    it("should handle mixed valid and invalid data", () => {
      render(
        <WaveBreakdown
          waveHeight="3-4 ft"
          wavePeriod="invalid"
          waveDirection="W"
          swell1Height="2.5 ft"
          swell1Period={null}
          swell1Direction="WSW"
          swell2Height={null}
          swell2Period={null}
          swell2Direction={null}
          windWaveHeight={null}
          windWavePeriod={null}
          windWaveDirection={null}
        />
      );

      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
      expect(screen.getByText("invalid")).toBeInTheDocument();
      expect(screen.getByText("Primary Swell")).toBeInTheDocument();
      expect(screen.getByText("2.5 ft")).toBeInTheDocument();
    });
  });
});
