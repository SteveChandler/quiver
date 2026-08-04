import {
  applyModelSwellHeightBlend,
  formatModelSwellHeightBlendFt,
  MODEL_SWELL_HEIGHT_BLEND_MODEL_VERSION,
} from "../model-swell-height-blend";

describe("model-swell height blend", () => {
  it("raises a 0-72h model-swell display 40% toward raw OM", () => {
    const result = applyModelSwellHeightBlend({
      displayHeightFt: 3,
      rawOmHeightM: 1.1,
      waveSource: "model_swell",
      forecastHorizonHours: 24,
      enabled: true,
    });

    expect(result.applied).toBe(true);
    expect(result.heightFt).toBeCloseTo(3.2436, 4);
    expect(result.upliftFt).toBeCloseTo(0.2436, 4);
    expect(formatModelSwellHeightBlendFt(result.heightFt)).toBe("3.2 ft");
    expect(MODEL_SWELL_HEIGHT_BLEND_MODEL_VERSION).toBe(
      "face-Hs-om-blend-v1",
    );
  });

  it.each([
    ["flag disabled", { enabled: false }],
    ["CDIP source", { waveSource: "cdip_sig" as const }],
    ["negative horizon", { forecastHorizonHours: -1 }],
    ["long horizon", { forecastHorizonHours: 73 }],
    ["missing OM", { rawOmHeightM: null }],
    ["flat display", { displayHeightFt: 0 }],
  ])("does not apply for %s", (_label, overrides) => {
    const result = applyModelSwellHeightBlend({
      displayHeightFt: 3,
      rawOmHeightM: 1.1,
      waveSource: "model_swell",
      forecastHorizonHours: 24,
      enabled: true,
      ...overrides,
    });

    expect(result.applied).toBe(false);
    expect(result.heightFt).toBe(
      "displayHeightFt" in overrides ? overrides.displayHeightFt : 3,
    );
  });

  it("never lowers the transformed face height", () => {
    const result = applyModelSwellHeightBlend({
      displayHeightFt: 4,
      rawOmHeightM: 1,
      waveSource: "model_swell",
      forecastHorizonHours: 24,
      enabled: true,
    });

    expect(result).toMatchObject({
      applied: false,
      heightFt: 4,
      upliftFt: 0,
    });
  });

  it("caps the uplift at one foot", () => {
    const result = applyModelSwellHeightBlend({
      displayHeightFt: 1,
      rawOmHeightM: 4,
      waveSource: "model_swell",
      forecastHorizonHours: 72,
      enabled: true,
    });

    expect(result.applied).toBe(true);
    expect(result.heightFt).toBe(2);
    expect(result.upliftFt).toBe(1);
  });
});
