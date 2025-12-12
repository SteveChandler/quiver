import type {
  SessionForecastSnapshot,
  BeachForecastAccuracy,
} from "@/types/database";

/**
 * Forecast accuracy analytics utilities
 * Provides functions for calculating and analyzing forecast accuracy metrics
 */

interface AccuracyMetric {
  name: string;
  forecast: number;
  actual: number;
  delta: number;
  relativeError: number; // Percentage error
  accuracy: number; // 0-100 score
}

interface AccuracyAnalysis {
  overallAccuracy: number;
  metrics: AccuracyMetric[];
  confidenceCorrelation: number; // How well confidence scores predict accuracy
  dataQuality: "high" | "medium" | "low";
  recommendations: string[];
}

interface TrendPoint {
  date: string;
  accuracy: number;
  sessionCount: number;
  avgConfidence: number;
  avgWaveHeight: number;
}

/** Shape of forecast/actual conditions stored as JSON */
interface ConditionsSnapshot {
  wave_height?: string | number;
  wind_speed?: string | number;
  water_temp?: string | number;
  [key: string]: unknown;
}

/**
 * Extract numerical value from forecast/actual condition strings
 */
export function extractNumericValue(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;

  // Extract first number from string (e.g., "3-4 ft" -> 3.5, "10 mph" -> 10)
  const match = value.toString().match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;

  // Handle ranges like "3-4 ft" by taking the average
  const rangeMatch = value.toString().match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }

  return parseFloat(match[1]);
}

/**
 * Calculate accuracy score for a single metric
 * Returns a score from 0-100 where 100 is perfect accuracy
 */
export function calculateAccuracyScore(
  forecast: number,
  actual: number,
  tolerance: number = 1.0,
  maxPenalty: number = 100
): number {
  const delta = Math.abs(forecast - actual);

  // Linear penalty based on delta and tolerance
  const penalty = Math.min(maxPenalty, (delta / tolerance) * 20);

  return Math.max(0, 100 - penalty);
}

/**
 * Analyze accuracy for a single session forecast snapshot
 */
export function analyzeSessionAccuracy(
  snapshot: SessionForecastSnapshot
): AccuracyAnalysis {
  const forecast = snapshot.forecast_snapshot as ConditionsSnapshot | null;
  const actual = snapshot.actual_conditions as ConditionsSnapshot | null;
  const metrics: AccuracyMetric[] = [];

  // Wave Height Analysis
  if (forecast?.wave_height && actual?.wave_height) {
    const forecastHeight = extractNumericValue(forecast.wave_height);
    const actualHeight = extractNumericValue(actual.wave_height);
    const delta = actualHeight - forecastHeight;
    const relativeError =
      actualHeight === 0 ? 0 : Math.abs(delta / actualHeight) * 100;
    const accuracy = calculateAccuracyScore(forecastHeight, actualHeight, 1.0);

    metrics.push({
      name: "wave_height",
      forecast: forecastHeight,
      actual: actualHeight,
      delta,
      relativeError,
      accuracy,
    });
  }

  // Wind Speed Analysis
  if (forecast?.wind_speed && actual?.wind_speed) {
    const forecastWind = extractNumericValue(forecast.wind_speed);
    const actualWind = extractNumericValue(actual.wind_speed);
    const delta = actualWind - forecastWind;
    const relativeError =
      actualWind === 0 ? 0 : Math.abs(delta / actualWind) * 100;
    const accuracy = calculateAccuracyScore(forecastWind, actualWind, 5.0);

    metrics.push({
      name: "wind_speed",
      forecast: forecastWind,
      actual: actualWind,
      delta,
      relativeError,
      accuracy,
    });
  }

  // Water Temperature Analysis (if available)
  if (forecast?.water_temp && actual?.water_temp) {
    const forecastTemp = extractNumericValue(forecast.water_temp);
    const actualTemp = extractNumericValue(actual.water_temp);
    const delta = actualTemp - forecastTemp;
    const relativeError =
      actualTemp === 0 ? 0 : Math.abs(delta / actualTemp) * 100;
    const accuracy = calculateAccuracyScore(forecastTemp, actualTemp, 3.0);

    metrics.push({
      name: "water_temp",
      forecast: forecastTemp,
      actual: actualTemp,
      delta,
      relativeError,
      accuracy,
    });
  }

  // Calculate overall accuracy
  const overallAccuracy =
    metrics.length > 0
      ? metrics.reduce((sum, metric) => sum + metric.accuracy, 0) /
        metrics.length
      : 0;

  // Assess confidence correlation
  const confidenceScore = snapshot.forecast_confidence_score || 50;
  const confidenceCorrelation = calculateConfidenceCorrelation(
    confidenceScore,
    overallAccuracy
  );

  // Determine data quality
  const dataQuality = assessDataQuality(metrics, snapshot);

  // Generate recommendations
  const recommendations = generateRecommendations(
    metrics,
    overallAccuracy,
    confidenceScore
  );

  return {
    overallAccuracy,
    metrics,
    confidenceCorrelation,
    dataQuality,
    recommendations,
  };
}

/**
 * Calculate confidence correlation score
 * Measures how well forecast confidence predicts actual accuracy
 */
export function calculateConfidenceCorrelation(
  confidence: number,
  accuracy: number
): number {
  // Simple correlation: higher confidence should correlate with higher accuracy
  const expectedAccuracy = confidence; // Confidence is already 0-100
  const delta = Math.abs(expectedAccuracy - accuracy);

  // Perfect correlation = 100, no correlation = 0
  return Math.max(0, 100 - delta);
}

/**
 * Assess data quality based on available metrics and completeness
 */
export function assessDataQuality(
  metrics: AccuracyMetric[],
  snapshot: SessionForecastSnapshot
): "high" | "medium" | "low" {
  let score = 0;

  // Base score for having metrics
  score += metrics.length * 20; // Up to 60 for 3 metrics

  // Bonus for having confidence score
  if (snapshot.forecast_confidence_score) score += 20;

  // Bonus for known data source
  if (snapshot.data_source && snapshot.data_source !== "FALLBACK") score += 20;

  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

/**
 * Generate recommendations based on accuracy analysis
 */
export function generateRecommendations(
  metrics: AccuracyMetric[],
  overallAccuracy: number,
  confidenceScore: number
): string[] {
  const recommendations: string[] = [];

  if (overallAccuracy < 70) {
    recommendations.push(
      "Consider using multiple forecast sources for this location"
    );
  }

  if (overallAccuracy >= 85) {
    recommendations.push("Forecast quality is excellent for this spot");
  }

  // Check specific metrics
  const waveMetric = metrics.find((m) => m.name === "wave_height");
  if (waveMetric && waveMetric.accuracy < 70) {
    recommendations.push(
      "Wave height forecasts need improvement - consider local buoy data"
    );
  }

  const windMetric = metrics.find((m) => m.name === "wind_speed");
  if (windMetric && windMetric.accuracy < 70) {
    recommendations.push(
      "Wind forecasts are less reliable - check local conditions"
    );
  }

  // Confidence analysis
  if (confidenceScore > 80 && overallAccuracy < 70) {
    recommendations.push("Forecast confidence may be overestimated");
  }

  if (confidenceScore < 60 && overallAccuracy > 80) {
    recommendations.push("Forecast confidence may be underestimated");
  }

  return recommendations;
}

/**
 * Calculate accuracy trends over time
 */
export function calculateAccuracyTrends(
  snapshots: SessionForecastSnapshot[]
): TrendPoint[] {
  // Group snapshots by date
  const dailyData = snapshots.reduce((acc, snapshot) => {
    const date = snapshot.session_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(snapshot);
    return acc;
  }, {} as Record<string, SessionForecastSnapshot[]>);

  // Calculate daily metrics
  return Object.entries(dailyData)
    .map(([date, daySnapshots]: [string, SessionForecastSnapshot[]]) => {
      const analyses = daySnapshots.map(analyzeSessionAccuracy);
      const avgAccuracy =
        analyses.reduce((sum: number, analysis: AccuracyAnalysis) => sum + analysis.overallAccuracy, 0) /
        analyses.length;
      const avgConfidence =
        daySnapshots.reduce(
          (sum: number, s: SessionForecastSnapshot) => sum + (s.forecast_confidence_score || 50),
          0
        ) / daySnapshots.length;

      // Calculate average wave height for the day
      const avgWaveHeight =
        daySnapshots.reduce((sum: number, s: SessionForecastSnapshot) => {
          const height = extractNumericValue(
            (s.actual_conditions as Record<string, unknown>)?.wave_height || 0
          );
          return sum + height;
        }, 0) / daySnapshots.length;

      return {
        date,
        accuracy: Math.round(avgAccuracy),
        sessionCount: daySnapshots.length,
        avgConfidence: Math.round(avgConfidence),
        avgWaveHeight: Math.round(avgWaveHeight * 10) / 10, // Round to 1 decimal
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Calculate beach-specific accuracy statistics
 */
export function calculateBeachAccuracyStats(
  snapshots: SessionForecastSnapshot[]
): (Partial<BeachForecastAccuracy> & {
  wave_height_accuracy?: number | null
  wind_accuracy?: number | null
  calculation_date?: string
}) {
  if (snapshots.length === 0) {
    return {
      total_sessions_count: 0,
      last_30_days_count: 0,
      last_7_days_count: 0,
      overall_accuracy_score: null,
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Filter by time periods
  const last30Days = snapshots.filter(
    (s) => new Date(s.session_date) >= thirtyDaysAgo
  );
  const last7Days = snapshots.filter(
    (s) => new Date(s.session_date) >= sevenDaysAgo
  );

  // Calculate accuracy metrics
  const analyses = snapshots.map(analyzeSessionAccuracy);
  const waveHeightDeltas: number[] = [];
  const windSpeedDeltas: number[] = [];
  const accuracyScores: number[] = [];

  analyses.forEach((analysis) => {
    accuracyScores.push(analysis.overallAccuracy);

    const waveMetric = analysis.metrics.find((m) => m.name === "wave_height");
    if (waveMetric) {
      waveHeightDeltas.push(Math.abs(waveMetric.delta));
    }

    const windMetric = analysis.metrics.find((m) => m.name === "wind_speed");
    if (windMetric) {
      windSpeedDeltas.push(Math.abs(windMetric.delta));
    }
  });

  const avgWaveHeightDelta =
    waveHeightDeltas.length > 0
      ? waveHeightDeltas.reduce((sum, delta) => sum + delta, 0) /
        waveHeightDeltas.length
      : null;

  const avgWindSpeedDelta =
    windSpeedDeltas.length > 0
      ? windSpeedDeltas.reduce((sum, delta) => sum + delta, 0) /
        windSpeedDeltas.length
      : null;

  const overallAccuracyScore =
    accuracyScores.length > 0
      ? accuracyScores.reduce((sum, score) => sum + score, 0) /
        accuracyScores.length
      : null;

  // Calculate specific accuracy metrics
  const waveAccuracy =
    waveHeightDeltas.length > 0
      ? Math.max(0, 100 - avgWaveHeightDelta! * 20) // 20% penalty per foot of error
      : null;

  const windAccuracy =
    windSpeedDeltas.length > 0
      ? Math.max(0, 100 - avgWindSpeedDelta! * 4) // 4% penalty per mph of error
      : null;

  return {
    avg_wave_height_delta: avgWaveHeightDelta
      ? Math.round(avgWaveHeightDelta * 100) / 100
      : null,
    avg_wind_speed_delta: avgWindSpeedDelta
      ? Math.round(avgWindSpeedDelta * 100) / 100
      : null,
    total_sessions_count: snapshots.length,
    last_30_days_count: last30Days.length,
    last_7_days_count: last7Days.length,
    overall_accuracy_score: overallAccuracyScore
      ? Math.round(overallAccuracyScore * 100) / 100
      : null,
    wave_height_accuracy: waveAccuracy
      ? Math.round(waveAccuracy * 100) / 100
      : null,
    wind_accuracy: windAccuracy ? Math.round(windAccuracy * 100) / 100 : null,
    calculation_date: new Date().toISOString().split("T")[0],
  };
}

/**
 * Compare forecast sources and their relative accuracy
 */
export function compareDataSources(snapshots: SessionForecastSnapshot[]) {
  const sourceStats = snapshots.reduce((acc, snapshot) => {
    const source = snapshot.data_source || "unknown";
    if (!acc[source]) {
      acc[source] = {
        count: 0,
        totalAccuracy: 0,
        avgConfidence: 0,
      };
    }

    const analysis = analyzeSessionAccuracy(snapshot);
    acc[source].count++;
    acc[source].totalAccuracy += analysis.overallAccuracy;
    acc[source].avgConfidence += snapshot.forecast_confidence_score || 50;

    return acc;
  }, {} as Record<string, { count: number; totalAccuracy: number; avgConfidence: number }>);

  type SourceStats = { count: number; totalAccuracy: number; avgConfidence: number };
  return Object.entries(sourceStats).map(([source, stats]: [string, SourceStats]) => ({
    source,
    sessionCount: stats.count,
    avgAccuracy: Math.round(stats.totalAccuracy / stats.count),
    avgConfidence: Math.round(stats.avgConfidence / stats.count),
    reliability:
      stats.count >= 10 ? "high" : stats.count >= 5 ? "medium" : "low",
  }));
}
