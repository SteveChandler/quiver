import type {
  ForecastAccuracyReportStatus,
  ForecastAccuracySummary,
} from "@/actions/ml/forecast-accuracy-actions";

interface ForecastAccuracyDatasetSchemaProps {
  url: string;
  summary: ForecastAccuracySummary;
  generatedAt: string;
}

function buildDescription(status: ForecastAccuracyReportStatus): string {
  if (status === "building") {
    return "Public surf forecast accuracy report showing Quiver's methodology and current metric-building status.";
  }

  return "Public surf forecast accuracy report comparing Quiver wave-height error against the NOAA baseline using buoy-validated observations.";
}

function metricValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

export function ForecastAccuracyDatasetSchema({
  url,
  summary,
  generatedAt,
}: ForecastAccuracyDatasetSchemaProps) {
  if (!url) return null;

  const variableMeasured: Array<Record<string, string>> = [];

  if (summary.noaaBaselineMae !== null) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "NOAA Baseline MAE",
      value: metricValue(summary.noaaBaselineMae),
      unitText: "m",
      description: "Mean absolute wave-height error for the NOAA baseline.",
    });
  }

  if (summary.quiverMae !== null) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "Quiver MAE",
      value: metricValue(summary.quiverMae),
      unitText: "m",
      description: "Mean absolute wave-height error for Quiver's forecast.",
    });
  }

  if (summary.improvementPct !== null) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "MAE Change vs NOAA",
      value: summary.improvementPct.toFixed(1),
      unitText: "%",
      description: summary.canClaimImprovement
        ? "Positive error reduction versus the NOAA baseline."
        : "Measured change versus NOAA; not an accuracy lift claim.",
    });
  }

  if (summary.validatedPairCount > 0) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "Validated Forecast-Buoy Pairs",
      value: String(summary.validatedPairCount),
      description: "Forecast rows matched to buoy observations.",
    });
  }

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Quiver Surf Forecast Accuracy Report",
    description: buildDescription(summary.status),
    url,
    dateModified: summary.lastUpdated ?? generatedAt,
    temporalCoverage:
      summary.periodStart && summary.periodEnd
        ? `${summary.periodStart}/${summary.periodEnd}`
        : undefined,
    spatialCoverage: {
      "@type": "Place",
      name: "Surf beaches with Quiver forecast accuracy metrics",
    },
    measurementTechnique:
      "Mean Absolute Error (MAE) comparing forecast wave height against matched buoy observations.",
    provider: {
      "@type": "Organization",
      name: "Quiver",
      url: "https://www.quiversurf.app",
    },
    license: "https://creativecommons.org/licenses/by/4.0/",
  };

  if (variableMeasured.length > 0) {
    data.variableMeasured = variableMeasured;
  }

  if (!data.temporalCoverage) {
    delete data.temporalCoverage;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
