import { constituents as knownConstituents, createTidePredictor } from "@neaps/tide-predictor";
import fes2022 from "./fes2022-constituents.json";

export const MODEL_TIDE_SOURCE = "fes2022";
export const MODEL_TIDE_STATION_ID = "FES2022";
export const FES2022_CITATION: string = fes2022.citation;

export interface ModelTideConstituent {
  name: string;
  amplitudeM: number;
  phaseDeg: number;
}

export interface BeachModelTides {
  beachId: string;
  model: "FES2022";
  mllwOffsetM: number;
  constituents: ModelTideConstituent[];
}

type HourlyModelTide = {
  ts: string;
  tide_height_m: number;
  tide_phase: null;
  source: typeof MODEL_TIDE_SOURCE;
};

type ModelTideExtreme = {
  ts: string;
  type: "high" | "low";
  tide_height_m: number;
};

function makePredictor(constituents: ModelTideConstituent[], offset: number) {
  return createTidePredictor(
    constituents.map(({ name, amplitudeM, phaseDeg }) => {
      const libraryName = name === "EPS2" ? "eps2" : name;
      if (!knownConstituents[libraryName]) {
        throw new Error(`Unsupported tide constituent: ${name}`);
      }
      return { name: libraryName, amplitude: amplitudeM, phase: phaseDeg };
    }),
    { offset }
  );
}

export function predictHourlyModelTides(
  model: BeachModelTides,
  startIso: string,
  endIso: string
): HourlyModelTide[] {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!model.constituents.length || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return [];
  }

  const hourMs = 3_600_000;
  const firstHourMs = Math.ceil(startMs / hourMs) * hourMs;
  const lastHourMs = Math.floor(endMs / hourMs) * hourMs;
  if (firstHourMs > lastHourMs) return [];

  const start = new Date(firstHourMs);
  const end = new Date(lastHourMs + (firstHourMs === lastHourMs ? hourMs : 0));
  return makePredictor(model.constituents, model.mllwOffsetM)
    .getTimelinePrediction({ start, end, timeFidelity: 3600 })
    .filter(({ time }) => time.getTime() <= lastHourMs)
    .map(({ time, level }) => ({
      ts: time.toISOString(),
      tide_height_m: Math.round(level * 1000) / 1000,
      tide_phase: null,
      source: MODEL_TIDE_SOURCE,
    }));
}

export function predictModelTideExtremes(
  model: BeachModelTides,
  startIso: string,
  endIso: string
): ModelTideExtreme[] {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!model.constituents.length || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  return makePredictor(model.constituents, model.mllwOffsetM)
    .getExtremesPrediction({ start: new Date(startMs), end: new Date(endMs) })
    .map(({ time, level, high }) => ({
      ts: time.toISOString(),
      type: high ? "high" : "low",
      tide_height_m: Math.round(level * 1000) / 1000,
    }));
}

export function computeMllwOffsetM(
  constituents: ModelTideConstituent[],
  options: { start?: Date; years?: number } = {}
): number {
  const start = options.start ?? new Date("2020-01-01T00:00:00.000Z");
  const years = options.years ?? 19;
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(years) || years <= 0) {
    throw new Error("A valid start and positive whole number of years are required");
  }
  if (!constituents.length) throw new Error("Tide constituents are required");

  const predictor = makePredictor(constituents, 0);
  const last = new Date(start);
  last.setUTCFullYear(last.getUTCFullYear() + years);
  const tidalDayMs = 24.8412 * 3_600_000;
  const lowerLows = new Map<number, number>();

  for (let year = 0; year < years; year++) {
    const chunkStart = new Date(start);
    chunkStart.setUTCFullYear(chunkStart.getUTCFullYear() + year);
    const chunkEnd = new Date(start);
    chunkEnd.setUTCFullYear(chunkEnd.getUTCFullYear() + year + 1);

    for (const extreme of predictor.getExtremesPrediction({ start: chunkStart, end: chunkEnd })) {
      if (!extreme.low || extreme.time >= last) continue;
      const day = Math.floor((extreme.time.getTime() - start.getTime()) / tidalDayMs);
      lowerLows.set(day, Math.min(lowerLows.get(day) ?? Infinity, extreme.level));
    }
  }

  if (!lowerLows.size) throw new Error("No low tides predicted for the datum period");
  const mean = [...lowerLows.values()].reduce((sum, low) => sum + low, 0) / lowerLows.size;
  return Math.round(-mean * 1000) / 1000;
}

export function getBeachModelTides(beachId: string): BeachModelTides | null {
  const beaches: Record<string, { mllwOffsetM: number; constituents: ModelTideConstituent[] }> = fes2022.beaches;
  if (!Object.hasOwn(beaches, beachId)) return null;
  const beach = beaches[beachId];
  return { beachId, model: "FES2022", ...beach };
}
