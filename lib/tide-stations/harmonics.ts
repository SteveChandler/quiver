import { constituents as knownConstituents, createTidePredictor } from "@neaps/tide-predictor";

import type { StoredTideConstituent } from "./types";
import type { TideExtremePoint, TideHeightPoint } from "./series";

/** TICON / IHO spellings that @neaps/tide-predictor knows under another name. */
const CONSTITUENT_ALIASES: Readonly<Record<string, string>> = {
  EPS2: "eps2",
  LDA2: "LAMBDA2",
  LAM2: "LAMBDA2",
  SIG1: "SIGMA1",
  THE1: "THETA1",
  ALP2: "ALPHA2",
  DEL2: "DELTA2",
  GAM2: "GAMMA2",
};

/** The library name for a constituent, or null when the predictor cannot model it. */
export function predictorConstituentName(name: string): string | null {
  const candidate = CONSTITUENT_ALIASES[name.toUpperCase()] ?? name;
  if (Object.hasOwn(knownConstituents, candidate)) return candidate;
  if (Object.hasOwn(knownConstituents, candidate.toUpperCase())) return candidate.toUpperCase();
  return null;
}

function makePredictor(constituents: StoredTideConstituent[], offsetM: number) {
  return createTidePredictor(
    constituents.map(({ name, amplitudeM, phaseDeg }) => {
      const libraryName = predictorConstituentName(name);
      if (!libraryName) throw new Error(`Unsupported tide constituent: ${name}`);
      return { name: libraryName, amplitude: amplitudeM, phase: phaseDeg };
    }),
    { offset: offsetM }
  );
}

const roundM = (value: number): number => Math.round(value * 1000) / 1000;

/** Hourly heights from harmonic constants, in metres above the datum `offsetM` puts at zero. */
export function predictHourlyFromConstituents(
  constituents: StoredTideConstituent[],
  offsetM: number,
  start: Date,
  end: Date
): TideHeightPoint[] {
  if (!constituents.length || end <= start) return [];
  return makePredictor(constituents, offsetM)
    .getTimelinePrediction({ start, end, timeFidelity: 3600 })
    .map(({ time, level }) => ({ ts: time.toISOString(), heightM: roundM(level) }));
}

export function predictExtremesFromConstituents(
  constituents: StoredTideConstituent[],
  offsetM: number,
  start: Date,
  end: Date
): TideExtremePoint[] {
  if (!constituents.length || end <= start) return [];
  return makePredictor(constituents, offsetM)
    .getExtremesPrediction({ start, end })
    .map(({ time, level, high }) => ({
      ts: time.toISOString(),
      type: high ? "high" : "low",
      heightM: roundM(level),
    }));
}
