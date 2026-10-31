import {
  modelSwellCalibrationFactor,
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
} from "@/lib/utils/wave-height-transformer";
import {
  MODEL_SWELL_CALIBRATION_FACTORS,
  MODEL_SWELL_FACTOR_MAX,
  MODEL_SWELL_FACTOR_MIN,
  MODEL_SWELL_FACTOR_MIN_EFFECT,
} from "@/lib/utils/model-swell-calibration-factors";

const [calibratedId, calibratedK] = Object.entries(
  MODEL_SWELL_CALIBRATION_FACTORS,
).find(([, k]) => k > 1.2)!;

const input = (
  beach: BeachTerrainConfig,
  source: "model_swell" | "model_hs" | "cdip_sig",
) => ({
  components: [
    {
      heightFt: 3,
      periodS: 14,
      directionDeg: 220,
      partition: "swell" as const,
    },
  ],
  beach,
  source,
  rawHeightFt: 3,
  periodS: 14,
  swellDirectionDeg: 220,
});

describe("per-beach model_swell calibration", () => {
  it("keeps every shipped factor inside the clamp and above the minimum effect", () => {
    for (const k of Object.values(MODEL_SWELL_CALIBRATION_FACTORS)) {
      expect(k).toBeGreaterThanOrEqual(MODEL_SWELL_FACTOR_MIN);
      expect(k).toBeLessThanOrEqual(MODEL_SWELL_FACTOR_MAX);
      expect(Math.abs(k - 1)).toBeGreaterThanOrEqual(
        MODEL_SWELL_FACTOR_MIN_EFFECT - 1e-9,
      );
    }
  });

  it("scales model_swell face height by the beach factor and reports it", () => {
    const plain = transformToFaceHeightDecomposed(input({}, "model_swell"));
    const calibrated = transformToFaceHeightDecomposed(
      input({ id: calibratedId }, "model_swell"),
    );
    expect(calibrated.faceHeightFt).toBeCloseTo(
      plain.faceHeightFt * calibratedK,
      1,
    );
    expect(calibrated.modelCalibrationFactor).toBe(calibratedK);
    expect(plain.modelCalibrationFactor).toBeUndefined();
  });

  it("applies on the legacy fallback path too", () => {
    const legacy = {
      ...input({ id: calibratedId }, "model_swell"),
      components: [null],
    };
    const result = transformToFaceHeightDecomposed(legacy);
    expect(result.path).toBe("legacy");
    expect(result.modelCalibrationFactor).toBe(calibratedK);
  });

  it.each(["model_hs", "cdip_sig"] as const)(
    "leaves %s untouched",
    (source) => {
      expect(modelSwellCalibrationFactor(source, { id: calibratedId })).toBe(1);
      const result = transformToFaceHeightDecomposed(
        input({ id: calibratedId }, source),
      );
      expect(result.modelCalibrationFactor).toBeUndefined();
    },
  );

  it("returns 1 for beaches without an entry", () => {
    expect(
      modelSwellCalibrationFactor("model_swell", { id: "not-a-beach" }),
    ).toBe(1);
    expect(modelSwellCalibrationFactor("model_swell", {})).toBe(1);
  });
});
