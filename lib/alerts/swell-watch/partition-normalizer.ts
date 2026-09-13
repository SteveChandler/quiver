import type { ForecastProvider } from "@/lib/services/noaa-wavewatch/types";

const FORECAST_PROVIDERS = new Set<ForecastProvider>(["noaa", "open_meteo"]);

export interface SwellPartitionInput {
  provider: string;
  evaluationId: string;
  forecastAt: string;
  sourceSlot: "s1" | "s2";
  heightM: unknown;
  periodS: unknown;
  directionDeg: unknown;
}

export interface SwellPartitionObservation {
  provider: ForecastProvider;
  evaluationId: string;
  forecastAt: string;
  sourceSlot: "s1" | "s2";
  heightM: number;
  periodS: number;
  directionDeg: number;
  completeness: "complete";
}

type SwellPartitionNormalization =
  | { kind: "observations"; observations: SwellPartitionObservation[] }
  | {
      kind: "suppressed";
      reason: "unknown_provider" | "incomplete_tuple" | "contradictory_tuple";
    };

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeSwellPartitions(
  inputs: SwellPartitionInput[]
): SwellPartitionNormalization {
  const observations: SwellPartitionObservation[] = [];
  const seen = new Map<string, SwellPartitionObservation>();

  for (const input of inputs) {
    if (!FORECAST_PROVIDERS.has(input.provider as ForecastProvider)) {
      return { kind: "suppressed", reason: "unknown_provider" };
    }
    if (
      !finiteNumber(input.heightM) ||
      !finiteNumber(input.periodS) ||
      !finiteNumber(input.directionDeg)
    ) {
      return { kind: "suppressed", reason: "incomplete_tuple" };
    }

    const observation: SwellPartitionObservation = {
      provider: input.provider as ForecastProvider,
      evaluationId: input.evaluationId,
      forecastAt: input.forecastAt,
      sourceSlot: input.sourceSlot,
      heightM: input.heightM,
      periodS: input.periodS,
      directionDeg: input.directionDeg,
      completeness: "complete",
    };
    const key = `${observation.provider}:${observation.evaluationId}:${observation.forecastAt}:${observation.sourceSlot}`;
    const prior = seen.get(key);
    if (
      prior &&
      (prior.heightM !== observation.heightM ||
        prior.periodS !== observation.periodS ||
        prior.directionDeg !== observation.directionDeg)
    ) {
      return { kind: "suppressed", reason: "contradictory_tuple" };
    }
    seen.set(key, observation);
    observations.push(observation);
  }

  return { kind: "observations", observations };
}
