/** @jest-environment node */

import { createTidePredictor } from "@neaps/tide-predictor";
import harcon from "@/__tests__/fixtures/tides/noaa-9410170-harcon.json";
import datums from "@/__tests__/fixtures/tides/noaa-9410170-datums.json";
import hilo from "@/__tests__/fixtures/tides/noaa-9410170-hilo-20260929.json";
import {
  computeMllwOffsetM,
  FES2022_CITATION,
  getBeachModelTides,
  MODEL_TIDE_SOURCE,
  predictHourlyModelTides,
  predictModelTideExtremes,
  type BeachModelTides,
  type ModelTideConstituent,
} from "@/lib/services/tides/model-tides";

const constituents: ModelTideConstituent[] = harcon.HarmonicConstituents.map((item) => ({
  name: item.name,
  amplitudeM: item.amplitude,
  phaseDeg: item.phase_GMT,
}));
const datumValue = (name: string): number => {
  const datum = datums.datums.find((item) => item.name === name);
  if (!datum) throw new Error(`Missing NOAA datum: ${name}`);
  return datum.value;
};
const mllwOffsetM = datumValue("MSL") - datumValue("MLLW");
const sanDiego: BeachModelTides = {
  beachId: "9410170",
  model: "FES2022",
  mllwOffsetM,
  constituents,
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

describe("model tides", () => {
  it("reproduces NOAA high and low turns from harmonic constants", () => {
    const predicted = predictModelTideExtremes(sanDiego, "2026-09-29T00:00:00Z", "2026-10-07T00:00:00Z");
    const used = new Set<number>();
    const timeErrors: number[] = [];
    const heightErrors: number[] = [];

    expect(predicted).toHaveLength(hilo.predictions.length);
    for (const noaa of hilo.predictions) {
      const noaaTime = Date.parse(`${noaa.t.replace(" ", "T")}:00Z`);
      const type = noaa.type === "H" ? "high" : "low";
      const nearest = predicted
        .map((turn, index) => ({ turn, index, dt: Math.abs(Date.parse(turn.ts) - noaaTime) / 60_000 }))
        .filter(({ turn, index }) => turn.type === type && !used.has(index))
        .sort((a, b) => a.dt - b.dt)[0];

      if (!nearest) throw new Error(`No model turn matched NOAA ${noaa.t} ${noaa.type}`);
      expect(nearest.dt).toBeLessThanOrEqual(180);
      used.add(nearest.index);
      timeErrors.push(nearest.dt);
      heightErrors.push(Math.abs(nearest.turn.tide_height_m - Number(noaa.v)));
    }

    expect(used.size).toBe(hilo.predictions.length);
    expect(median(timeErrors)).toBeLessThanOrEqual(3);
    expect(Math.max(...timeErrors)).toBeLessThanOrEqual(20);
    expect(median(heightErrors)).toBeLessThanOrEqual(0.02);
    expect(Math.max(...heightErrors)).toBeLessThanOrEqual(0.04);
  });

  it("computes a 19-year MLLW offset close to NOAA's datum", () => {
    expect(Math.abs(computeMllwOffsetM(constituents) - mllwOffsetM)).toBeLessThanOrEqual(0.03);
  });

  it("aligns inclusive UTC hours and applies the datum offset with millimetre rounding", () => {
    const result = predictHourlyModelTides(sanDiego, "2026-09-29T10:20:00Z", "2026-09-29T13:00:00Z");
    const direct = createTidePredictor(
      constituents.map(({ name, amplitudeM, phaseDeg }) => ({ name, amplitude: amplitudeM, phase: phaseDeg })),
      { offset: mllwOffsetM }
    ).getTimelinePrediction({
      start: new Date("2026-09-29T11:00:00Z"),
      end: new Date("2026-09-29T13:00:00Z"),
      timeFidelity: 3600,
    });

    expect(result.map(({ ts }) => ts)).toEqual([
      "2026-09-29T11:00:00.000Z",
      "2026-09-29T12:00:00.000Z",
      "2026-09-29T13:00:00.000Z",
    ]);
    expect(result).toEqual(direct.map(({ time, level }) => ({
      ts: time.toISOString(),
      tide_height_m: Math.round(level * 1000) / 1000,
      tide_phase: null,
      source: MODEL_TIDE_SOURCE,
    })));
    expect(predictHourlyModelTides(sanDiego, "2026-09-29T11:00:00Z", "2026-09-29T11:00:00Z")).toHaveLength(1);
    expect(predictHourlyModelTides(sanDiego, "2026-09-29T13:00:00Z", "2026-09-29T11:00:00Z")).toEqual([]);
    expect(predictHourlyModelTides(sanDiego, "invalid", "2026-09-29T11:00:00Z")).toEqual([]);
    expect(predictHourlyModelTides({ ...sanDiego, constituents: [] }, "2026-09-29T11:00:00Z", "2026-09-29T12:00:00Z")).toEqual([]);
  });

  it("reads the empty FES beach catalog and citation", () => {
    expect(getBeachModelTides("unknown-beach")).toBeNull();
    expect(getBeachModelTides("toString")).toBeNull();
    expect(FES2022_CITATION).toBe("The FES2022 Tide product was funded by CNES, produced by LEGOS, NOVELTIS and CLS and made freely available by AVISO.");
  });

  it("accepts all 34 FES2022 constituent names", () => {
    const names = "M2 S2 N2 K2 K1 O1 P1 Q1 2N2 EPS2 J1 L2 LAMBDA2 M3 M4 M6 M8 MF MKS2 MM MN4 MS4 MSF MSQM MTM MU2 N4 NU2 R2 S1 S4 SA SSA T2".split(" ");
    expect(names).toHaveLength(34);
    for (const name of names) {
      const result = predictHourlyModelTides(
        { ...sanDiego, mllwOffsetM: 0, constituents: [{ name, amplitudeM: 0.1, phaseDeg: 0 }] },
        "2026-09-29T00:00:00Z",
        "2026-09-29T01:00:00Z"
      );
      expect(result).toHaveLength(2);
      expect(result.every(({ tide_height_m }) => Number.isFinite(tide_height_m))).toBe(true);
    }
    expect(() => predictHourlyModelTides(
      { ...sanDiego, constituents: [{ name: "UNKNOWN", amplitudeM: 1, phaseDeg: 0 }] },
      "2026-09-29T00:00:00Z",
      "2026-09-29T01:00:00Z"
    )).toThrow("Unsupported tide constituent: UNKNOWN");
  });
});
