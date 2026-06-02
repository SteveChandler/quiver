import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";

import { AccuracyBuildingRows } from "@/components/forecast-accuracy/accuracy-building-rows";
import { AccuracyHero } from "@/components/forecast-accuracy/accuracy-hero";
import { BeachAccuracyLeaderboard } from "@/components/forecast-accuracy/beach-accuracy-leaderboard";
import { NOAAComparisonBar } from "@/components/forecast-accuracy/noaa-comparison-bar";
import type {
  ForecastAccuracyBuildingRow,
  ForecastAccuracyConfidence,
} from "@/actions/ml/forecast-accuracy-actions";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Area: () => null,
    Bar: Passthrough,
    BarChart: Passthrough,
    CartesianGrid: () => null,
    Cell: () => null,
    ComposedChart: Passthrough,
    Line: () => null,
    ResponsiveContainer: Passthrough,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const highConfidence: ForecastAccuracyConfidence = {
  level: "high",
  label: "High - buoy + model",
  score: 85,
  sources: ["buoy", "model"],
  reason: "The report has a recent, high-volume buoy-matched sample.",
};

const modelOnlyConfidence: ForecastAccuracyConfidence = {
  level: "low",
  label: "Model only",
  score: 25,
  sources: ["model"],
  reason: "No validated buoy matches are ready for this report yet.",
};

describe("forecast accuracy page states", () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it("renders live summary metrics with backed confidence language", () => {
    render(
      <AccuracyHero
        status="live"
        avgImprovementPct={30}
        beachCount={1}
        totalPredictions={52}
        latestValidatedDate="2026-06-01T00:00:00.000Z"
        confidence={highConfidence}
        canClaimImprovement
      />
    );

    expect(
      screen.getByRole("heading", { name: "Forecast accuracy receipts." })
    ).toBeInTheDocument();
    expect(screen.getByText("High - buoy + model")).toBeInTheDocument();
    expect(screen.getAllByText("30%").length).toBeGreaterThan(0);
    expect(screen.getByText("Beaches with rows")).toBeInTheDocument();
    expect(screen.getByText("Validated pairs")).toBeInTheDocument();
  });

  it("renders a building summary without claiming accuracy improvement", () => {
    render(
      <AccuracyHero
        status="building"
        avgImprovementPct={null}
        beachCount={0}
        totalPredictions={0}
        latestValidatedDate={null}
        confidence={modelOnlyConfidence}
        canClaimImprovement={false}
      />
    );

    expect(screen.getByText("Model only")).toBeInTheDocument();
    expect(screen.getByText("Building")).toBeInTheDocument();
    expect(
      screen.getByText("Accuracy rows are building; Quiver is not claiming lift yet.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/better in the latest buoy check/i)).not.toBeInTheDocument();
  });

  it("renders building rows instead of empty content", () => {
    const rows: ForecastAccuracyBuildingRow[] = [
      {
        id: "validated-pairs",
        label: "Validated forecast-buoy pairs",
        status: "Building",
        detail: "Waiting for enough IOOS buoy matches.",
        confidenceLabel: "Low - sparse data",
      },
      {
        id: "noaa-comparison",
        label: "NOAA baseline comparison",
        status: "Queued",
        detail: "Waiting for baseline and Quiver MAE.",
        confidenceLabel: "Model only",
      },
    ];

    render(<AccuracyBuildingRows rows={rows} />);

    expect(screen.getByText("Accuracy rows are being verified.")).toBeInTheDocument();
    expect(screen.getByText("Validated forecast-buoy pairs")).toBeInTheDocument();
    expect(screen.getByText("NOAA baseline comparison")).toBeInTheDocument();
    expect(screen.getByText("Low - sparse data")).toBeInTheDocument();
    expect(screen.getByText("Model only")).toBeInTheDocument();
  });

  it("renders beach rows with every required live metric", () => {
    render(
      <BeachAccuracyLeaderboard
        beaches={[
          {
            beachId: "beach-live",
            beachName: "Live Metrics Beach",
            slug: "live-metrics-beach",
            city: "San Diego",
            state: "CA",
            country: "USA",
            noaaBaselineMae: 0.5,
            quiverMae: 0.35,
            improvementPct: 30,
            validatedPairCount: 52,
            lastUpdated: "2026-06-01T00:00:00.000Z",
            confidence: highConfidence,
            canClaimImprovement: true,
          },
        ]}
      />
    );

    expect(screen.getByText("Live Metrics Beach")).toBeInTheDocument();
    expect(screen.getByText("0.500m")).toBeInTheDocument();
    expect(screen.getByText("0.350m")).toBeInTheDocument();
    expect(screen.getByText("+30%")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText("High - buoy + model")).toBeInTheDocument();
    expect(screen.getByText("Last updated Jun 1")).toBeInTheDocument();
  });

  it("tracks forecast accuracy table views with row context", async () => {
    render(
      <BeachAccuracyLeaderboard
        beaches={[
          {
            beachId: "beach-live",
            beachName: "Live Metrics Beach",
            slug: "live-metrics-beach",
            city: "San Diego",
            state: "CA",
            country: "USA",
            noaaBaselineMae: 0.5,
            quiverMae: 0.35,
            improvementPct: 30,
            validatedPairCount: 52,
            lastUpdated: "2026-06-01T00:00:00.000Z",
            confidence: highConfidence,
            canClaimImprovement: true,
          },
        ]}
      />
    );

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("forecast_accuracy_table_viewed", {
        metadata: expect.objectContaining({
          surface: "forecast_accuracy",
          row_count: 1,
          claimable_row_count: 1,
          top_beach_id: "beach-live",
          top_beach_slug: "live-metrics-beach",
        }),
        debounceMs: 5000,
      });
    });
  });

  it("does not show a positive result for non-positive improvement rows", () => {
    render(
      <BeachAccuracyLeaderboard
        beaches={[
          {
            beachId: "beach-negative",
            beachName: "Negative Lift Beach",
            slug: null,
            city: "San Diego",
            state: "CA",
            country: "USA",
            noaaBaselineMae: 0.4,
            quiverMae: 0.5,
            improvementPct: -25,
            validatedPairCount: 40,
            lastUpdated: "2026-06-01T00:00:00.000Z",
            confidence: highConfidence,
            canClaimImprovement: false,
          },
        ]}
      />
    );

    expect(screen.getByText("No lift yet")).toBeInTheDocument();
    expect(screen.queryByText("-25%")).not.toBeInTheDocument();
  });

  it("does not use better-than-NOAA copy when the comparison is not claimable", () => {
    render(
      <NOAAComparisonBar
        rawMae={0.5}
        correctedMae={0.35}
        canClaimImprovement={false}
      />
    );

    expect(
      screen.getByText(/No accuracy lift claim is shown until Quiver MAE is lower/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/better than the NOAA baseline/i)).not.toBeInTheDocument();
  });
});
