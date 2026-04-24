import { render, screen } from "@testing-library/react";
import { SpotSurfReport } from "@/components/spots/spot-surf-report";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

function makeReport(overrides: Partial<SurfCallResult> = {}): SurfCallResult {
  return {
    verdict: "YES",
    bestWindowStart: "2025-01-15T13:00:00Z",
    bestWindowEnd: "2025-01-15T15:00:00Z",
    windowMinutes: 120,
    shortWindow: false,
    waveHeight: "3-5 ft",
    windDescription: "Light offshore",
    windSpeed: "5-8 mph",
    windCompass: "NE",
    windType: "offshore",
    tideDescription: "Rising",
    tidePhase: "rising",
    tideHeight: null,
    nextTideType: "high",
    nextTideAt: "2025-01-15T14:30:00Z",
    whySentence: "Clean conditions with light offshore winds.",
    forecastConfidence: 0.85,
    lowForecastConfidence: false,
    score: 75,
    peakTime: null,
    trendTags: [],
    updatedAt: "2025-01-15T10:00:00Z",
    isCalibrated: true,
    rideableWavesPerHour: null,
    dominantBeatIntervalS: null,
    ...overrides,
  };
}

describe("SpotSurfReport", () => {
  describe("Conditions rendering", () => {
    it("renders conditions data when report has wave/wind/tide", () => {
      render(
        <SpotSurfReport
          report={makeReport()}
          spotName="Blacks Beach"
        />
      );

      expect(screen.getByText("3-5 ft")).toBeInTheDocument();
    });

    it("does not render conditions row when no conditions data exists", () => {
      const { container } = render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: null,
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: null,
            whySentence: "",
          })}
          spotName="Test"
        />
      );

      // No condition items should appear
      expect(screen.queryByText("Best window")).not.toBeInTheDocument();
      expect(container.querySelector(".mt-3, .mt-4")).toBeNull();
    });

    it("renders why sentence when only whySentence is present", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: null,
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: null,
            whySentence: "Conditions are poor today.",
          })}
          spotName="Test"
        />
      );

      expect(screen.getByText("Conditions are poor today.")).toBeInTheDocument();
    });
  });

  describe("Best window display based on verdict", () => {
    it("shows Best window label when verdict is YES", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "YES" })} spotName="Swamis" />
      );

      expect(screen.getByText("Best window")).toBeInTheDocument();
    });

    it("shows Best window label when verdict is MAYBE", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "MAYBE" })} spotName="Swamis" />
      );

      expect(screen.getByText("Best window")).toBeInTheDocument();
    });

    it("hides Best window label when verdict is NO", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "NO" })} spotName="Swamis" />
      );

      expect(screen.queryByText("Best window")).not.toBeInTheDocument();
    });

    it("still shows wave height when verdict is NO", () => {
      render(
        <SpotSurfReport
          report={makeReport({ verdict: "NO", waveHeight: "1-2 ft" })}
          spotName="Swamis"
        />
      );

      expect(screen.getByText("1-2 ft")).toBeInTheDocument();
    });

    it("still shows wind info when verdict is NO", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            windSpeed: "15-20 mph",
            windCompass: "SW",
            windType: "onshore",
          })}
          spotName="Swamis"
        />
      );

      expect(screen.getByText("SW 15-20 mph (onshore)")).toBeInTheDocument();
    });

    it("still shows tide info when verdict is NO", () => {
      render(
        <SpotSurfReport
          report={makeReport({ verdict: "NO", tidePhase: "falling" })}
          spotName="Swamis"
        />
      );

      expect(screen.getByText(/Falling/)).toBeInTheDocument();
    });
  });

  describe("Separator rendering", () => {
    it("renders no separators when only wave height exists", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: "3-4 ft",
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: null,
          })}
          spotName="Test"
        />
      );

      // WaveHeightDisplay preserves existing range strings unchanged
      expect(screen.getByTestId("primary-wave-height")).toHaveTextContent(
        "3-4 ft"
      );
      expect(screen.queryByText("·")).not.toBeInTheDocument();
    });

    it("renders separator between wave height and wind", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: "3-4 ft",
            windSpeed: "10 mph",
            windCompass: "N",
            windType: null,
            tidePhase: null,
          })}
          spotName="Test"
        />
      );

      expect(screen.getByTestId("primary-wave-height")).toHaveTextContent(
        "3-4 ft"
      );
      expect(screen.getByText("N 10 mph")).toBeInTheDocument();
      expect(screen.getAllByText("·")).toHaveLength(1);
    });

    it("renders no leading separator when only wind exists with NO verdict", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: "2025-01-15T13:00:00Z",
            bestWindowEnd: "2025-01-15T15:00:00Z",
            waveHeight: null,
            windSpeed: "10 mph",
            windCompass: "N",
            windType: null,
            tidePhase: null,
          })}
          spotName="Test"
        />
      );

      expect(screen.getByText("N 10 mph")).toBeInTheDocument();
      expect(screen.queryByText("·")).not.toBeInTheDocument();
    });

    it("renders no leading separator when only tide exists with NO verdict", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: "2025-01-15T13:00:00Z",
            bestWindowEnd: "2025-01-15T15:00:00Z",
            waveHeight: null,
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: "rising",
            nextTideType: null,
            nextTideAt: null,
          })}
          spotName="Test"
        />
      );

      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.queryByText("·")).not.toBeInTheDocument();
    });

    it("renders separators between all items for YES verdict", () => {
      render(
        <SpotSurfReport
          report={makeReport({ verdict: "YES" })}
          spotName="Test"
        />
      );

      // Best window + wave height + wind + tide = 3 separators
      expect(screen.getAllByText("·")).toHaveLength(3);
    });
  });

  describe("General rendering", () => {
    it("renders the verdict badge", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "YES" })} spotName="Test" />
      );

      expect(screen.getByText("YES")).toBeInTheDocument();
    });

    it("renders why sentence", () => {
      render(
        <SpotSurfReport
          report={makeReport({ whySentence: "Good conditions expected." })}
          spotName="Test"
        />
      );

      expect(screen.getByText("Good conditions expected.")).toBeInTheDocument();
    });

    it("renders tomorrow heading when isTomorrow is true", () => {
      render(
        <SpotSurfReport
          report={makeReport()}
          spotName="Test"
          isTomorrow={true}
        />
      );

      expect(screen.getByText("Tomorrow\u2019s Surf Call")).toBeInTheDocument();
    });

    it("renders today heading by default", () => {
      render(
        <SpotSurfReport report={makeReport()} spotName="Test" />
      );

      expect(screen.getByText("Today\u2019s Surf Call")).toBeInTheDocument();
    });

    it("does not render conditions row when no data exists", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: null,
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: null,
            whySentence: "",
          })}
          spotName="Test"
        />
      );

      // Only heading and verdict should exist, no conditions row
      expect(screen.queryByText("Best window")).not.toBeInTheDocument();
      expect(screen.queryByText("·")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Calibration honesty layer
  // ==========================================================================
  //
  // SpotSurfReport is the anonymous landing surface for /{state}/{city}/{beachSlug}
  // beach detail pages. The isCalibrated flag flows from
  // `beach.shoaling_factors != null` through computeSurfCall into the report,
  // and the conditions row uses WaveHeightDisplay to render the honesty layer
  // visuals. Spec: docs/design/calibration-honesty-spec.md.
  describe("calibration honesty layer", () => {
    it("renders 'Face height' label when report.isCalibrated is true", () => {
      render(
        <SpotSurfReport
          report={makeReport({ isCalibrated: true, waveHeight: "3-4 ft" })}
          spotName="Blacks"
        />
      );

      const label = screen.getByTestId("wave-height-label");
      expect(label).toHaveTextContent("Face height");
      expect(screen.queryByText("Forecast height")).toBeNull();
    });

    it("renders 'Forecast height' label + ~ prefix when report.isCalibrated is false", () => {
      const { container } = render(
        <SpotSurfReport
          report={makeReport({ isCalibrated: false, waveHeight: "3-4 ft" })}
          spotName="Bolinas"
        />
      );

      const label = screen.getByTestId("wave-height-label");
      expect(label).toHaveTextContent("Forecast height");
      // ~ prefix is rendered as an aria-hidden sibling of the number
      expect(screen.getByText("~")).toBeInTheDocument();
      // Dotted underline is the load-bearing visual marker
      expect(container.querySelector(".border-dotted")).not.toBeNull();
    });
  });
});
