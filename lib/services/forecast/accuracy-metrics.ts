export const FORECAST_ACCURACY_HORIZON_BUCKETS = [
  { id: "0-24h", minHours: 0, maxHours: 24 },
  { id: "25-72h", minHours: 25, maxHours: 72 },
  { id: "73h+", minHours: 73, maxHours: null },
] as const;

export type ForecastAccuracyHorizonBucket =
  (typeof FORECAST_ACCURACY_HORIZON_BUCKETS)[number]["id"];

export const FORECAST_ACCURACY_BASELINES = [
  {
    id: "current_display",
    label: "Current display",
    field: "offset_corrected_display_height_m",
  },
  {
    id: "raw_display",
    label: "Raw display",
    field: "raw_display_height_m",
  },
  {
    id: "raw_om",
    label: "Raw OM",
    field: "wave_height_om",
  },
  {
    id: "v5_shadow",
    label: "v5 shadow",
    field: "v5_shadow_height_m",
  },
  {
    id: "proposed_display",
    label: "Proposed display",
    field: "proposed_display_height_m",
  },
] as const;

export type ForecastAccuracyBaseline =
  (typeof FORECAST_ACCURACY_BASELINES)[number]["id"];

type ForecastAccuracyField =
  (typeof FORECAST_ACCURACY_BASELINES)[number]["field"];

export const FORECAST_ACCURACY_GATE_HORIZON_LABEL = "0-72h" as const;

const FORECAST_ACCURACY_GATE_HORIZON_BUCKETS: ForecastAccuracyHorizonBucket[] = [
  "0-24h",
  "25-72h",
];

export interface ForecastAccuracyInputRow {
  observed_m: number | null;
  forecast_horizon_hours: number | null;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
  raw_display_height_m: number | null;
  offset_corrected_display_height_m: number | null;
  wave_height_om: number | null;
  v5_shadow_height_m: number | null;
  proposed_display_height_m?: number | null;
}

export interface ForecastAccuracyMetric {
  horizon_bucket: ForecastAccuracyHorizonBucket;
  baseline: ForecastAccuracyBaseline;
  baseline_label: string;
  sample_count: number;
  mae_m: number;
  bias_m: number;
}

export interface ForecastAccuracyDelta {
  horizon_bucket: ForecastAccuracyHorizonBucket;
  baseline: ForecastAccuracyBaseline;
  baseline_label: string;
  sample_count: number;
  comparison_sample_count: number;
  mae_m: number;
  comparison_mae_m: number;
  delta_mae_m: number;
}

export interface ForecastAccuracyGateMetric {
  horizon_group: typeof FORECAST_ACCURACY_GATE_HORIZON_LABEL;
  baseline: ForecastAccuracyBaseline;
  baseline_label: string;
  sample_count: number;
  mae_m: number;
  bias_m: number;
}

export interface ForecastAccuracyGateDelta {
  horizon_group: typeof FORECAST_ACCURACY_GATE_HORIZON_LABEL;
  baseline: ForecastAccuracyBaseline;
  baseline_label: string;
  sample_count: number;
  comparison_sample_count: number;
  mae_m: number;
  comparison_mae_m: number;
  delta_mae_m: number;
}

interface Accumulator {
  absoluteErrorSum: number;
  signedErrorSum: number;
  sampleCount: number;
}

interface PairedDeltaAccumulator {
  absoluteErrorSum: number;
  comparisonAbsoluteErrorSum: number;
  sampleCount: number;
}

export function getForecastAccuracyHorizonBucket(
  horizonHours: number | null | undefined
): ForecastAccuracyHorizonBucket | null {
  if (horizonHours == null || !Number.isFinite(horizonHours)) {
    return null;
  }

  if (horizonHours >= 0 && horizonHours <= 24) {
    return "0-24h";
  }

  if (horizonHours >= 25 && horizonHours <= 72) {
    return "25-72h";
  }

  if (horizonHours >= 73) {
    return "73h+";
  }

  return null;
}

export function getForecastAccuracyRowHorizonBucket(row: {
  forecast_horizon_hours: number | null | undefined;
  forecast_horizon_bucket?: ForecastAccuracyHorizonBucket | null;
}): ForecastAccuracyHorizonBucket | null {
  if (
    row.forecast_horizon_bucket === "0-24h" ||
    row.forecast_horizon_bucket === "25-72h" ||
    row.forecast_horizon_bucket === "73h+"
  ) {
    return row.forecast_horizon_bucket;
  }

  return getForecastAccuracyHorizonBucket(row.forecast_horizon_hours);
}

export function getForecastAccuracyBaselineLabel(
  baseline: ForecastAccuracyBaseline
): string {
  const definition = FORECAST_ACCURACY_BASELINES.find(
    (candidate) => candidate.id === baseline
  );
  return definition?.label ?? baseline;
}

export function computeForecastAccuracyMetrics(
  rows: ForecastAccuracyInputRow[],
  options: { includeProposed?: boolean } = {}
): ForecastAccuracyMetric[] {
  const baselines = FORECAST_ACCURACY_BASELINES.filter(
    (baseline) => options.includeProposed || baseline.id !== "proposed_display"
  );
  const accumulators = new Map<string, Accumulator>();

  for (const row of rows) {
    if (!isUsableObservation(row.observed_m)) {
      continue;
    }

    const horizonBucket = getForecastAccuracyRowHorizonBucket(row);
    if (!horizonBucket) {
      continue;
    }

    for (const baseline of baselines) {
      const predictedM = row[baseline.field as ForecastAccuracyField];
      if (!isUsablePrediction(predictedM)) {
        continue;
      }

      const key = metricKey(horizonBucket, baseline.id);
      const accumulator = accumulators.get(key) ?? {
        absoluteErrorSum: 0,
        signedErrorSum: 0,
        sampleCount: 0,
      };
      const signedError = predictedM - row.observed_m;
      accumulator.absoluteErrorSum += Math.abs(signedError);
      accumulator.signedErrorSum += signedError;
      accumulator.sampleCount += 1;
      accumulators.set(key, accumulator);
    }
  }

  return FORECAST_ACCURACY_HORIZON_BUCKETS.flatMap((horizon) =>
    baselines.flatMap((baseline) => {
      const accumulator = accumulators.get(metricKey(horizon.id, baseline.id));
      if (!accumulator || accumulator.sampleCount === 0) {
        return [];
      }

      return [
        {
          horizon_bucket: horizon.id,
          baseline: baseline.id,
          baseline_label: baseline.label,
          sample_count: accumulator.sampleCount,
          mae_m: roundMetric(
            accumulator.absoluteErrorSum / accumulator.sampleCount
          ),
          bias_m: roundMetric(
            accumulator.signedErrorSum / accumulator.sampleCount
          ),
        },
      ];
    })
  );
}

export function computeForecastAccuracyDeltas(
  metrics: ForecastAccuracyMetric[],
  comparisonBaseline: ForecastAccuracyBaseline = "current_display"
): ForecastAccuracyDelta[] {
  const byKey = new Map(
    metrics.map((metric) => [
      metricKey(metric.horizon_bucket, metric.baseline),
      metric,
    ])
  );

  return metrics.flatMap((metric) => {
    if (metric.baseline === comparisonBaseline) {
      return [];
    }

    const comparison = byKey.get(
      metricKey(metric.horizon_bucket, comparisonBaseline)
    );
    if (!comparison) {
      return [];
    }
    if (metric.sample_count !== comparison.sample_count) {
      return [];
    }

    return [
      {
        horizon_bucket: metric.horizon_bucket,
        baseline: metric.baseline,
        baseline_label: metric.baseline_label,
        sample_count: metric.sample_count,
        comparison_sample_count: comparison.sample_count,
        mae_m: metric.mae_m,
        comparison_mae_m: comparison.mae_m,
        delta_mae_m: roundMetric(metric.mae_m - comparison.mae_m),
      },
    ];
  });
}

export function computeForecastAccuracyPairedDeltas(
  rows: ForecastAccuracyInputRow[],
  options: {
    includeProposed?: boolean;
    comparisonBaseline?: ForecastAccuracyBaseline;
  } = {}
): ForecastAccuracyDelta[] {
  const comparisonBaseline = options.comparisonBaseline ?? "current_display";
  const comparisonDefinition = getForecastAccuracyBaselineDefinition(
    comparisonBaseline
  );
  if (!comparisonDefinition) {
    return [];
  }

  const baselines = FORECAST_ACCURACY_BASELINES.filter(
    (baseline) =>
      baseline.id !== comparisonBaseline &&
      (options.includeProposed || baseline.id !== "proposed_display")
  );
  const accumulators = new Map<string, PairedDeltaAccumulator>();

  for (const row of rows) {
    if (!isUsableObservation(row.observed_m)) {
      continue;
    }

    const horizonBucket = getForecastAccuracyRowHorizonBucket(row);
    if (!horizonBucket) {
      continue;
    }

    const comparisonPredictedM =
      row[comparisonDefinition.field as ForecastAccuracyField];
    if (!isUsablePrediction(comparisonPredictedM)) {
      continue;
    }

    for (const baseline of baselines) {
      const predictedM = row[baseline.field as ForecastAccuracyField];
      if (!isUsablePrediction(predictedM)) {
        continue;
      }

      const key = metricKey(horizonBucket, baseline.id);
      const accumulator = accumulators.get(key) ?? {
        absoluteErrorSum: 0,
        comparisonAbsoluteErrorSum: 0,
        sampleCount: 0,
      };
      accumulator.absoluteErrorSum += Math.abs(predictedM - row.observed_m);
      accumulator.comparisonAbsoluteErrorSum += Math.abs(
        comparisonPredictedM - row.observed_m
      );
      accumulator.sampleCount += 1;
      accumulators.set(key, accumulator);
    }
  }

  return FORECAST_ACCURACY_HORIZON_BUCKETS.flatMap((horizon) =>
    baselines.flatMap((baseline) => {
      const accumulator = accumulators.get(metricKey(horizon.id, baseline.id));
      if (!accumulator || accumulator.sampleCount === 0) {
        return [];
      }

      const maeM = roundMetric(
        accumulator.absoluteErrorSum / accumulator.sampleCount
      );
      const comparisonMaeM = roundMetric(
        accumulator.comparisonAbsoluteErrorSum / accumulator.sampleCount
      );

      return [
        {
          horizon_bucket: horizon.id,
          baseline: baseline.id,
          baseline_label: baseline.label,
          sample_count: accumulator.sampleCount,
          comparison_sample_count: accumulator.sampleCount,
          mae_m: maeM,
          comparison_mae_m: comparisonMaeM,
          delta_mae_m: roundMetric(maeM - comparisonMaeM),
        },
      ];
    })
  );
}

export function computeForecastAccuracyGateMetrics(
  rows: ForecastAccuracyInputRow[],
  options: { includeProposed?: boolean } = {}
): ForecastAccuracyGateMetric[] {
  const baselines = FORECAST_ACCURACY_BASELINES.filter(
    (baseline) => options.includeProposed || baseline.id !== "proposed_display"
  );
  const accumulators = new Map<ForecastAccuracyBaseline, Accumulator>();

  for (const row of rows) {
    if (!isUsableObservation(row.observed_m)) {
      continue;
    }

    const horizonBucket = getForecastAccuracyRowHorizonBucket(row);
    if (
      !horizonBucket ||
      !FORECAST_ACCURACY_GATE_HORIZON_BUCKETS.includes(horizonBucket)
    ) {
      continue;
    }

    for (const baseline of baselines) {
      const predictedM = row[baseline.field as ForecastAccuracyField];
      if (!isUsablePrediction(predictedM)) {
        continue;
      }

      const accumulator = accumulators.get(baseline.id) ?? {
        absoluteErrorSum: 0,
        signedErrorSum: 0,
        sampleCount: 0,
      };
      const signedError = predictedM - row.observed_m;
      accumulator.absoluteErrorSum += Math.abs(signedError);
      accumulator.signedErrorSum += signedError;
      accumulator.sampleCount += 1;
      accumulators.set(baseline.id, accumulator);
    }
  }

  return baselines.flatMap((baseline) => {
    const accumulator = accumulators.get(baseline.id);
    if (!accumulator || accumulator.sampleCount === 0) {
      return [];
    }

    return [
      {
        horizon_group: FORECAST_ACCURACY_GATE_HORIZON_LABEL,
        baseline: baseline.id,
        baseline_label: baseline.label,
        sample_count: accumulator.sampleCount,
        mae_m: roundMetric(
          accumulator.absoluteErrorSum / accumulator.sampleCount
        ),
        bias_m: roundMetric(
          accumulator.signedErrorSum / accumulator.sampleCount
        ),
      },
    ];
  });
}

export function computeForecastAccuracyGateDeltas(
  metrics: ForecastAccuracyGateMetric[],
  comparisonBaseline: ForecastAccuracyBaseline = "current_display"
): ForecastAccuracyGateDelta[] {
  const byBaseline = new Map(
    metrics.map((metric) => [metric.baseline, metric])
  );

  return metrics.flatMap((metric) => {
    if (metric.baseline === comparisonBaseline) {
      return [];
    }

    const comparison = byBaseline.get(comparisonBaseline);
    if (!comparison) {
      return [];
    }
    if (metric.sample_count !== comparison.sample_count) {
      return [];
    }

    return [
      {
        horizon_group: FORECAST_ACCURACY_GATE_HORIZON_LABEL,
        baseline: metric.baseline,
        baseline_label: metric.baseline_label,
        sample_count: metric.sample_count,
        comparison_sample_count: comparison.sample_count,
        mae_m: metric.mae_m,
        comparison_mae_m: comparison.mae_m,
        delta_mae_m: roundMetric(metric.mae_m - comparison.mae_m),
      },
    ];
  });
}

export function computeForecastAccuracyPairedGateDeltas(
  rows: ForecastAccuracyInputRow[],
  options: {
    includeProposed?: boolean;
    comparisonBaseline?: ForecastAccuracyBaseline;
  } = {}
): ForecastAccuracyGateDelta[] {
  const comparisonBaseline = options.comparisonBaseline ?? "current_display";
  const comparisonDefinition = getForecastAccuracyBaselineDefinition(
    comparisonBaseline
  );
  if (!comparisonDefinition) {
    return [];
  }

  const baselines = FORECAST_ACCURACY_BASELINES.filter(
    (baseline) =>
      baseline.id !== comparisonBaseline &&
      (options.includeProposed || baseline.id !== "proposed_display")
  );
  const accumulators = new Map<ForecastAccuracyBaseline, PairedDeltaAccumulator>();

  for (const row of rows) {
    if (!isUsableObservation(row.observed_m)) {
      continue;
    }

    const horizonBucket = getForecastAccuracyRowHorizonBucket(row);
    if (
      !horizonBucket ||
      !FORECAST_ACCURACY_GATE_HORIZON_BUCKETS.includes(horizonBucket)
    ) {
      continue;
    }

    const comparisonPredictedM =
      row[comparisonDefinition.field as ForecastAccuracyField];
    if (!isUsablePrediction(comparisonPredictedM)) {
      continue;
    }

    for (const baseline of baselines) {
      const predictedM = row[baseline.field as ForecastAccuracyField];
      if (!isUsablePrediction(predictedM)) {
        continue;
      }

      const accumulator = accumulators.get(baseline.id) ?? {
        absoluteErrorSum: 0,
        comparisonAbsoluteErrorSum: 0,
        sampleCount: 0,
      };
      accumulator.absoluteErrorSum += Math.abs(predictedM - row.observed_m);
      accumulator.comparisonAbsoluteErrorSum += Math.abs(
        comparisonPredictedM - row.observed_m
      );
      accumulator.sampleCount += 1;
      accumulators.set(baseline.id, accumulator);
    }
  }

  return baselines.flatMap((baseline) => {
    const accumulator = accumulators.get(baseline.id);
    if (!accumulator || accumulator.sampleCount === 0) {
      return [];
    }

    const maeM = roundMetric(
      accumulator.absoluteErrorSum / accumulator.sampleCount
    );
    const comparisonMaeM = roundMetric(
      accumulator.comparisonAbsoluteErrorSum / accumulator.sampleCount
    );

    return [
      {
        horizon_group: FORECAST_ACCURACY_GATE_HORIZON_LABEL,
        baseline: baseline.id,
        baseline_label: baseline.label,
        sample_count: accumulator.sampleCount,
        comparison_sample_count: accumulator.sampleCount,
        mae_m: maeM,
        comparison_mae_m: comparisonMaeM,
        delta_mae_m: roundMetric(maeM - comparisonMaeM),
      },
    ];
  });
}

function metricKey(
  horizonBucket: ForecastAccuracyHorizonBucket,
  baseline: ForecastAccuracyBaseline
): string {
  return `${horizonBucket}:${baseline}`;
}

function getForecastAccuracyBaselineDefinition(
  baseline: ForecastAccuracyBaseline
): (typeof FORECAST_ACCURACY_BASELINES)[number] | null {
  return (
    FORECAST_ACCURACY_BASELINES.find(
      (definition) => definition.id === baseline
    ) ?? null
  );
}

function isUsableObservation(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function isUsablePrediction(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
