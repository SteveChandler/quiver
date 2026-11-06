import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveEcmwfHybridScale } from "@/lib/utils/ecmwf-hybrid-scale";
import { ECMWF_HYBRID_K_FACTORS } from "@/lib/utils/ecmwf-hybrid-k-factors";
import { MODEL_SWELL_CALIBRATION_FACTORS } from "@/lib/utils/model-swell-calibration-factors";
import {
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
  type SwellComponentInput,
} from "@/lib/utils/wave-height-transformer";
import { toFaceHeightFeetDecomposedWithDebug } from "@/lib/utils/wave-formatters";
import {
  parseForecastDisplayReplayContext,
  replayForecastDisplayHeightM,
} from "@/lib/utils/forecast-display-replay";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

const CHURCH = "a0332432-4877-48c5-855d-b30fd097ba38"; // hybrid k 1.53, production 1.82
const HB_PIER = "071db1df-b5ee-4af6-a022-ea8a09667cbe"; // station 215, production 1.60
const COMPONENTS: SwellComponentInput[] = [
  { heightFt: 3, periodS: 14, directionDeg: 220 },
  { heightFt: 4, periodS: 11, directionDeg: 260 },
];
const RSS_FT = 5;
const hsMForR = (r: number): number => (r * RSS_FT) / METERS_TO_FEET;

interface GoldenRow {
  name: string;
  beachId: string;
  predictedAt: string;
  beach: BeachTerrainConfig;
  input: { rawHeightFt: number; periodS: number | null; swellDirectionDeg: number | null; components: Array<SwellComponentInput | null> };
  ecmwfHsM: number;
  replay: { uncal: number; rRss: number; hybRssCap: number; kHybrid: number };
}
const golden: GoldenRow[] = JSON.parse(
  readFileSync(path.join(__dirname, "__fixtures__/ecmwf-hybrid-replay-golden.json"), "utf8"),
);

describe("resolveEcmwfHybridScale", () => {
  const prev = process.env.ECMWF_HYBRID_SCALE_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.ECMWF_HYBRID_SCALE_ENABLED;
    else process.env.ECMWF_HYBRID_SCALE_ENABLED = prev;
  });
  const resolve = (ecmwfHsM: number | null, beachId = CHURCH, source: "model_swell" | "model_hs" = "model_swell") =>
    resolveEcmwfHybridScale({ beachId, source, components: [...COMPONENTS, null], ecmwfHsM });

  it("computes r = ECMWF Hs / RSS of the components, with the beach's hybrid k", () => {
    const scale = resolve(hsMForR(1.3))!;
    expect(scale.r).toBeCloseTo(1.3, 10);
    expect(scale.rRaw).toBeCloseTo(1.3, 10);
    expect(scale.k).toBe(1.53);
  });

  it("clamps r to 0.5-2.0 and keeps the raw value", () => {
    expect(resolve(hsMForR(2.6))).toMatchObject({ r: 2 });
    expect(resolve(hsMForR(2.6))!.rRaw).toBeCloseTo(2.6, 10);
    expect(resolve(hsMForR(0.3))).toMatchObject({ r: 0.5 });
  });

  it.each([null, 0, Number.NaN, -1])("returns null (production path) for ECMWF Hs %s", (hs) => {
    expect(resolve(hs)).toBeNull();
  });

  it("returns null with no component energy", () => {
    expect(resolveEcmwfHybridScale({ beachId: CHURCH, source: "model_swell", components: [null, null, null], ecmwfHsM: 1 })).toBeNull();
  });

  it("returns null off the table, for other sources, and when the kill switch is off", () => {
    expect(resolve(1, HB_PIER)).toBeNull();
    expect(resolve(1, "not-a-beach")).toBeNull();
    expect(resolve(1, CHURCH, "model_hs")).toBeNull();
    process.env.ECMWF_HYBRID_SCALE_ENABLED = "false";
    expect(resolve(1)).toBeNull();
    process.env.ECMWF_HYBRID_SCALE_ENABLED = "true";
    expect(resolve(1)).not.toBeNull();
  });
});

describe("ECMWF_HYBRID_K_FACTORS", () => {
  it("is exactly the 56 beaches in scripts/hybrid-k-eligible.json", () => {
    const eligible = JSON.parse(
      readFileSync(path.join(__dirname, "../../../scripts/hybrid-k-eligible.json"), "utf8"),
    ) as { beaches: Array<{ id: string; stn: string; k_hybrid_rss: number }> };
    expect(eligible.beaches).toHaveLength(56);
    expect(ECMWF_HYBRID_K_FACTORS).toEqual(Object.fromEntries(eligible.beaches.map((b) => [b.id, b.k_hybrid_rss])));
    expect(eligible.beaches.some((b) => b.stn === "215")).toBe(false);
  });
});

describe("transformToFaceHeightDecomposed with the hybrid scale", () => {
  const beach: BeachTerrainConfig = { id: CHURCH };
  const base = { beach, source: "model_swell" as const, rawHeightFt: 3, periodS: 14, swellDirectionDeg: 220, components: [...COMPONENTS, null] };

  it("scales components by r and applies k in place of the production factor", () => {
    const uncalScaled = transformToFaceHeightDecomposed({
      ...base,
      beach: {},
      rawHeightFt: 3 * 1.2,
      components: COMPONENTS.map((c) => ({ ...c, heightFt: c.heightFt * 1.2 })),
    }).faceHeightFt;
    const result = transformToFaceHeightDecomposed({ ...base, ecmwfHybrid: { r: 1.2, k: 1.53 } });
    expect(result.faceHeightFt).toBe(Math.round(uncalScaled * 1.53 * 10) / 10);
    expect(result.ecmwfHybrid).toEqual({ r: 1.2, k: 1.53 });
    expect(result.modelCalibrationFactor).toBeUndefined();
    expect(MODEL_SWELL_CALIBRATION_FACTORS[CHURCH]).toBe(1.82);
  });

  it("ignores the hybrid scale for a non-model_swell source", () => {
    const plain = transformToFaceHeightDecomposed({ ...base, source: "model_hs" });
    expect(transformToFaceHeightDecomposed({ ...base, source: "model_hs", ecmwfHybrid: { r: 1.5, k: 2 } })).toEqual(plain);
  });
});

describe("toFaceHeightFeetDecomposedWithDebug", () => {
  const params = (beachId: string, ecmwfWamHsM?: number | null) => ({
    modelSwellM: 1,
    beach: { id: beachId },
    periodS: 14,
    swellDirectionDeg: 220,
    components: [...COMPONENTS, null],
    ...(ecmwfWamHsM !== undefined ? { ecmwfWamHsM } : {}),
  });

  it("leaves a beach off the table byte-identical", () => {
    expect(toFaceHeightFeetDecomposedWithDebug(params(HB_PIER, hsMForR(1.4)))).toEqual(
      toFaceHeightFeetDecomposedWithDebug(params(HB_PIER)),
    );
  });

  it("leaves an eligible beach on the production path when ECMWF is null", () => {
    const prod = toFaceHeightFeetDecomposedWithDebug(params(CHURCH));
    expect(toFaceHeightFeetDecomposedWithDebug(params(CHURCH, null))).toEqual(prod);
    expect(prod.debug.modelCalibrationFactor).toBe(1.82);
    expect(prod.debug.replayInput).not.toHaveProperty("ecmwfHybrid");
  });

  it("records r and k in the debug and the replay input, with unscaled components", () => {
    const out = toFaceHeightFeetDecomposedWithDebug(params(CHURCH, hsMForR(1.25)));
    expect(out.debug.ecmwfHybrid).toMatchObject({ r: expect.closeTo(1.25, 10), k: 1.53, ecmwfHsM: hsMForR(1.25) });
    expect(out.debug.modelCalibrationFactor).toBeUndefined();
    expect(out.debug.replayInput?.ecmwfHybrid).toEqual({ r: out.debug.ecmwfHybrid!.r, k: 1.53 });
    expect(out.debug.replayInput?.components[0]?.heightFt).toBe(3);
  });
});

describe("display replay context with the hybrid scale", () => {
  const input = toFaceHeightFeetDecomposedWithDebug({
    modelSwellM: 1, beach: { id: CHURCH }, periodS: 14, swellDirectionDeg: 220,
    components: [...COMPONENTS, null], ecmwfWamHsM: hsMForR(1.25),
  });
  const ctx = (version: number) => JSON.parse(JSON.stringify({
    version, generatedAt: "2026-11-06T00:00:00.000Z", forecastAt: "2026-11-07T00:00:00.000Z",
    base: { input: input.debug.replayInput, supported: true }, handoff: null, unsupportedReason: null,
  }));

  it("replays a v2 context to the issued height", () => {
    expect(parseForecastDisplayReplayContext(ctx(2))?.base.input.ecmwfHybrid?.k).toBe(1.53);
    const issuedFt = Number.parseFloat(input.value!);
    expect(replayForecastDisplayHeightM(ctx(2))).toBe(Math.round((issuedFt / METERS_TO_FEET) * 1000) / 1000);
  });

  it("rejects a v1 context that carries the hybrid scale", () => {
    expect(parseForecastDisplayReplayContext(ctx(1))).toBeNull();
  });
});

describe("golden: code reproduces the Nov 2026 hybrid replay rows", () => {
  it.each(golden.map((row) => [row.name, row] as const))("%s", (_name, row) => {
    const beach = { ...row.beach, id: row.beachId };
    const input = { ...row.input, beach, source: "model_swell" as const };
    // The fixture is valid: the uncalibrated transform matches the replay's `uncal`.
    expect(transformToFaceHeightDecomposed({ ...input, beach: row.beach }).faceHeightFt).toBe(row.replay.uncal);

    const scale = resolveEcmwfHybridScale({
      beachId: row.beachId, source: "model_swell", components: row.input.components, ecmwfHsM: row.ecmwfHsM,
    })!;
    expect(scale.rRaw).toBeCloseTo(row.replay.rRss, 10);
    expect(scale.k).toBe(row.replay.kHybrid);

    // hybRssCap is the replay's capped-r face before k; production rounds the × k step to 0.1 ft.
    const face = transformToFaceHeightDecomposed({ ...input, ecmwfHybrid: { r: scale.r, k: scale.k } }).faceHeightFt;
    expect(Math.abs(face - row.replay.hybRssCap * row.replay.kHybrid)).toBeLessThanOrEqual(0.05);
    expect(transformToFaceHeightDecomposed({ ...input, beach: row.beach, ecmwfHybrid: { r: scale.r, k: 1 } }).faceHeightFt)
      .toBe(row.replay.hybRssCap);
  });
});
