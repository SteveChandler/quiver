import { render } from "@testing-library/react";

import { ForecastAccuracyDatasetSchema } from "@/components/seo/forecast-accuracy-dataset-schema";
import type { ForecastAccuracySummary } from "@/actions/ml/forecast-accuracy-actions";

function getJsonLdScripts(container: HTMLElement) {
  const scripts = container.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  return Array.from(scripts).map((script) =>
    JSON.parse(script.textContent || "{}")
  );
}

const liveSummary: ForecastAccuracySummary = {
  status: "live",
  beachCount: 1,
  totalPredictions: 80,
  validatedPairCount: 52,
  noaaBaselineMae: 0.5,
  quiverMae: 0.35,
  improvementPct: 30,
  lastUpdated: "2026-06-01T00:00:00.000Z",
  periodStart: "2026-05-19T00:00:00.000Z",
  periodEnd: "2026-06-01T00:00:00.000Z",
  confidence: {
    level: "high",
    label: "High - buoy + model",
    score: 85,
    sources: ["buoy", "model"],
    reason: "The report has a recent, high-volume buoy-matched sample.",
  },
  canClaimImprovement: true,
};

describe("ForecastAccuracyDatasetSchema", () => {
  it("renders live Dataset JSON-LD with measured values", () => {
    const { container } = render(
      <ForecastAccuracyDatasetSchema
        url="https://www.quiversurf.app/forecast-accuracy"
        summary={liveSummary}
        generatedAt="2026-06-02T00:00:00.000Z"
      />
    );

    const schemas = getJsonLdScripts(container);
    expect(schemas).toHaveLength(1);

    const schema = schemas[0];
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.name).toBe("Quiver Surf Forecast Accuracy Report");
    expect(schema.url).toBe("https://www.quiversurf.app/forecast-accuracy");
    expect(schema.dateModified).toBe("2026-06-01T00:00:00.000Z");
    expect(schema.temporalCoverage).toBe(
      "2026-05-19T00:00:00.000Z/2026-06-01T00:00:00.000Z"
    );
    expect(schema.variableMeasured).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "NOAA Baseline MAE",
          value: "0.500",
          unitText: "m",
        }),
        expect.objectContaining({
          name: "Quiver MAE",
          value: "0.350",
          unitText: "m",
        }),
        expect.objectContaining({
          name: "MAE Change vs NOAA",
          value: "30.0",
          unitText: "%",
        }),
        expect.objectContaining({
          name: "Validated Forecast-Buoy Pairs",
          value: "52",
        }),
      ])
    );
  });

  it("renders a minimal building Dataset without fake measurements", () => {
    const buildingSummary: ForecastAccuracySummary = {
      ...liveSummary,
      status: "building",
      beachCount: 0,
      totalPredictions: 0,
      validatedPairCount: 0,
      noaaBaselineMae: null,
      quiverMae: null,
      improvementPct: null,
      lastUpdated: null,
      periodStart: null,
      periodEnd: null,
      canClaimImprovement: false,
    };

    const { container } = render(
      <ForecastAccuracyDatasetSchema
        url="https://www.quiversurf.app/forecast-accuracy"
        summary={buildingSummary}
        generatedAt="2026-06-02T00:00:00.000Z"
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.variableMeasured).toBeUndefined();
    expect(schema.dateModified).toBe("2026-06-02T00:00:00.000Z");
    expect(schema.description).toContain("metric-building status");
  });

  it("returns null when url is empty", () => {
    const { container } = render(
      <ForecastAccuracyDatasetSchema
        url=""
        summary={liveSummary}
        generatedAt="2026-06-02T00:00:00.000Z"
      />
    );

    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });
});
