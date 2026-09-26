import { angleDifference } from "@/lib/domains/shared/angle-utils";

export const SWELL_EVENT_DETECTOR_VERSION = "swell-events.v1";

export const SWELL_EVENT_THRESHOLDS = {
  minPeakFaceHeightFt: 3,
  minPeriodS: 11,
  minFaceRiseFt: 2,
  minEnergyRatio: 2.5,
  exposureTaperDeg: 20,
  trackDirectionDeg: 45,
  trackPeriodS: 3,
  daylightStartHour: 6,
  daylightEndHour: 19,
  maxHorizonDays: 9,
  crossingMinPeriodS: 7,
  crossingMinAngleDeg: 60,
  crossingMinEnergyShare: 0.35,
} as const;

export interface SwellWindow {
  centerDeg: number;
  halfWidthDeg: number;
}

/** 1 inside the window; cos² taper to 0 over exposureTaperDeg outside it; null when the beach has no window. */
export function exposureFactor(
  directionDeg: number,
  window: SwellWindow | null,
): number | null {
  if (
    !window ||
    !Number.isFinite(window.centerDeg) ||
    !Number.isFinite(window.halfWidthDeg) ||
    window.halfWidthDeg <= 0
  ) {
    return null;
  }
  if (!Number.isFinite(directionDeg)) return 0;

  const distance = angleDifference(directionDeg, window.centerDeg);
  if (distance <= window.halfWidthDeg) return 1;

  const beyond = distance - window.halfWidthDeg;
  const taper = SWELL_EVENT_THRESHOLDS.exposureTaperDeg;
  if (beyond >= taper) return 0;

  const cos = Math.cos(((beyond / taper) * Math.PI) / 2);
  return cos * cos;
}

export function exposureLabel(factor: number): "open" | "partial" | "shadowed" {
  if (factor >= 0.75) return "open";
  if (factor >= 0.25) return "partial";
  return "shadowed";
}

export function swellWindowForBeach(beach: {
  swell_window_center_deg?: number | null;
  swell_window_halfwidth_deg?: number | null;
}): SwellWindow | null {
  const centerDeg = beach.swell_window_center_deg;
  const halfWidthDeg = beach.swell_window_halfwidth_deg;
  if (
    typeof centerDeg !== "number" ||
    typeof halfWidthDeg !== "number" ||
    !Number.isFinite(centerDeg) ||
    !Number.isFinite(halfWidthDeg) ||
    halfWidthDeg <= 0
  ) {
    return null;
  }
  return { centerDeg, halfWidthDeg };
}
