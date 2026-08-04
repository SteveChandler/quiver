import type { WaveHeightSourceTag } from "@/lib/utils/wave-height-source";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

export const MODEL_SWELL_HEIGHT_BLEND_MODEL_VERSION =
  "face-Hs-om-blend-v1";
export const MODEL_SWELL_HEIGHT_BLEND_OM_WEIGHT = 0.4;

const MAX_HORIZON_HOURS = 72;
const MAX_UPLIFT_FT = 1;
const MAX_DISPLAY_HEIGHT_FT = 15;

export type ModelSwellHeightBlendResult = {
  heightFt: number;
  applied: boolean;
  originalHeightFt: number;
  rawOmHeightFt: number | null;
  upliftFt: number;
};

export function isModelSwellHeightBlendEnabled(): boolean {
  return process.env.MODEL_SWELL_HEIGHT_BLEND_ENABLED === "true";
}

export function applyModelSwellHeightBlend(args: {
  displayHeightFt: number;
  rawOmHeightM: number | null | undefined;
  waveSource: WaveHeightSourceTag | null;
  forecastHorizonHours: number;
  enabled?: boolean;
}): ModelSwellHeightBlendResult {
  const {
    displayHeightFt,
    rawOmHeightM,
    waveSource,
    forecastHorizonHours,
    enabled = isModelSwellHeightBlendEnabled(),
  } = args;
  const unchanged: ModelSwellHeightBlendResult = {
    heightFt: displayHeightFt,
    applied: false,
    originalHeightFt: displayHeightFt,
    rawOmHeightFt: null,
    upliftFt: 0,
  };

  if (!enabled || waveSource !== "model_swell") return unchanged;
  if (!Number.isFinite(displayHeightFt) || displayHeightFt <= 0) {
    return unchanged;
  }
  if (
    !Number.isFinite(forecastHorizonHours) ||
    forecastHorizonHours < 0 ||
    forecastHorizonHours > MAX_HORIZON_HOURS
  ) {
    return unchanged;
  }
  if (
    typeof rawOmHeightM !== "number" ||
    !Number.isFinite(rawOmHeightM) ||
    rawOmHeightM <= 0
  ) {
    return unchanged;
  }

  const rawOmHeightFt = rawOmHeightM * METERS_TO_FEET;
  if (rawOmHeightFt <= displayHeightFt) {
    return { ...unchanged, rawOmHeightFt };
  }

  const requestedUpliftFt =
    (rawOmHeightFt - displayHeightFt) * MODEL_SWELL_HEIGHT_BLEND_OM_WEIGHT;
  const upliftFt = Math.min(requestedUpliftFt, MAX_UPLIFT_FT);
  const heightFt = Math.min(
    displayHeightFt + upliftFt,
    MAX_DISPLAY_HEIGHT_FT,
  );
  const appliedUpliftFt = heightFt - displayHeightFt;

  return {
    heightFt,
    applied: appliedUpliftFt > 1e-9,
    originalHeightFt: displayHeightFt,
    rawOmHeightFt,
    upliftFt: appliedUpliftFt,
  };
}

export function formatModelSwellHeightBlendFt(heightFt: number): string {
  const rounded = Math.round(heightFt * 10) / 10;
  return `${rounded} ft`;
}
