import { render, screen } from "@testing-library/react";

import {
  SourceConfidenceBadge,
  getSurfWindowSourceLabels,
} from "@/components/session-intelligence";
import type {
  SurfWindowConfidence,
  SurfWindowSourceFlags,
} from "@/types/session-intelligence";

function makeConfidence(
  overrides: Partial<SurfWindowConfidence> = {}
): SurfWindowConfidence {
  return {
    level: "high",
    score: 84,
    summary: "High confidence",
    reasons: ["Forecast model row is present"],
    ...overrides,
  };
}

function makeSources(
  overrides: Partial<SurfWindowSourceFlags> = {}
): SurfWindowSourceFlags {
  return {
    forecastModel: true,
    tide: true,
    buoy: true,
    cam: false,
    userReport: false,
    localSpotIntel: true,
    ...overrides,
  };
}

describe("SourceConfidenceBadge", () => {
  it("renders high confidence with buoy and model sources", () => {
    render(
      <SourceConfidenceBadge
        confidence={makeConfidence()}
        sources={makeSources()}
      />
    );

    expect(screen.getByText("High - buoy + model")).toBeInTheDocument();
    expect(
      screen.getByLabelText("High confidence, sources: buoy, model, tide, spot intel")
    ).toBeInTheDocument();
  });

  it("renders model and tide without inventing buoy or cam sources", () => {
    render(
      <SourceConfidenceBadge
        confidence={makeConfidence({ level: "medium", score: 62 })}
        sources={makeSources({
          buoy: false,
          cam: false,
          userReport: false,
          localSpotIntel: false,
        })}
      />
    );

    expect(screen.getByText("Medium - model + tide")).toBeInTheDocument();
    expect(screen.queryByText(/buoy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cam/i)).not.toBeInTheDocument();
  });

  it("renders model-only state", () => {
    render(
      <SourceConfidenceBadge
        confidence={makeConfidence({ level: "medium", score: 55 })}
        sources={makeSources({
          tide: false,
          buoy: false,
          cam: false,
          userReport: false,
          localSpotIntel: false,
        })}
      />
    );

    expect(screen.getByText("Model only")).toBeInTheDocument();
  });

  it("renders sparse low-confidence state without unavailable source labels", () => {
    render(
      <SourceConfidenceBadge
        confidence={makeConfidence({ level: "low", score: 28 })}
        sources={makeSources({
          forecastModel: true,
          tide: false,
          buoy: false,
          cam: false,
          userReport: false,
          localSpotIntel: false,
        })}
      />
    );

    expect(screen.getByText("Low - sparse data")).toBeInTheDocument();
    expect(screen.queryByText(/user report/i)).not.toBeInTheDocument();
  });

  it("returns only true source labels", () => {
    expect(
      getSurfWindowSourceLabels(
        makeSources({
          tide: false,
          buoy: false,
          cam: true,
          userReport: false,
          localSpotIntel: false,
        })
      )
    ).toEqual(["model", "cam"]);
  });
});
