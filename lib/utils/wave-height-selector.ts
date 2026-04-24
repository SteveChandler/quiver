import { metersToFeet } from "@/lib/utils/wave-formatters";

const SMALL_WAVE_GATE_M = 0.95;

export interface WaveHeightSelectorInput {
  om_m: number | null;
  fallback_ft_string: string | null;
}

/**
 * OM-primary wave-height selector. Raw Open-Meteo Hs at >=0.95m beats
 * v3-corrected by 35% MAE (n=10,599 matched). Below the gate, OM overshoots
 * <0.5m observed by +0.45m, so we fall back to the existing face-height
 * string derived from NOAA/CDIP/buoy inputs.
 */
export function selectWaveHeightFormatted(
  input: WaveHeightSelectorInput,
): string | null {
  const { om_m, fallback_ft_string } = input;
  if (om_m != null && Number.isFinite(om_m) && om_m >= SMALL_WAVE_GATE_M) {
    const feet = metersToFeet(om_m);
    if (feet == null) return fallback_ft_string;
    return `${feet.toFixed(1)} ft`;
  }
  return fallback_ft_string;
}
