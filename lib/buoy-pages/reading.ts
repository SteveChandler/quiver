/**
 * Deterministic plain-language read of a buoy observation. Every sentence
 * comes from fixed thresholds on the numbers, so the same data always reads
 * the same way. It describes the buoy, never surf height at a beach.
 */

import type { WaveObservationValues } from "@/lib/services/wave-stations/types";
import { compassPoint, formatHeightFt, formatPeriod, metersToFeetRounded } from "./format";
import type { HeightTrend } from "./series";

/** Below this the buoy is close to flat (about 1 ft). */
const FLAT_BELOW_M = 0.3;
/** Wind waves under this do not change the read of a swell-led sea. */
const MINOR_COMPONENT_BELOW_M = 0.3;

type PeriodClass = "groundswell" | "mid-period" | "short-period" | "wind-chop";

/** 13 s and up: groundswell; 10-13 s: mid-period; 7-10 s: short-period; under 7 s: wind chop. */
export function classifyPeriod(seconds: number): PeriodClass {
  if (seconds >= 13) return "groundswell";
  if (seconds >= 10) return "mid-period";
  if (seconds >= 7) return "short-period";
  return "wind-chop";
}

const PERIOD_PHRASES: Record<PeriodClass, string> = {
  groundswell: "long-period groundswell",
  "mid-period": "mid-period swell",
  "short-period": "short-period swell",
  "wind-chop": "short-period wind chop",
};

function describePeriodClass(seconds: number): string {
  return PERIOD_PHRASES[classifyPeriod(seconds)];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** "3.3 ft [of noun] at 14 s from the W", leaving out parts the buoy did not send. */
function component(heightM: number, periodS: number | null, directionDeg: number | null, noun?: string): string {
  const parts = [noun ? `${formatHeightFt(heightM)} of ${noun}` : formatHeightFt(heightM)];
  const period = formatPeriod(periodS);
  if (period) parts.push(`at ${period}`);
  const from = compassPoint(directionDeg);
  if (from) parts.push(`from the ${from}`);
  return parts.join(" ");
}

function trendSentence(trend: HeightTrend | null): string | null {
  if (!trend) return null;
  const deltaFt = Math.abs(metersToFeetRounded(trend.deltaM)).toFixed(1);
  if (trend.direction === "building") return `Building over the last 6 hours, up ${deltaFt} ft.`;
  if (trend.direction === "fading") return `Fading over the last 6 hours, down ${deltaFt} ft.`;
  return "Holding steady over the last 6 hours.";
}

type ReadingInput = Pick<
  WaveObservationValues,
  | "wave_height_m"
  | "dominant_period_s"
  | "mean_wave_direction_deg"
  | "swell_height_m"
  | "swell_period_s"
  | "swell_direction_deg"
  | "wind_wave_height_m"
  | "wind_wave_period_s"
  | "wind_wave_direction_deg"
>;

/**
 * One to three short sentences. Rules, in order:
 * 1. No height: no read.
 * 2. Height under 0.3 m: "Close to flat at the buoy".
 * 3. Swell split present: the larger component leads; the period class of the
 *    swell names it; wind waves under 0.3 m read as "little wind wave on top".
 * 4. No split: the dominant period class names the sea.
 * 5. Add the six-hour trend when there is one.
 */
export function buildReadingSentence(
  observation: ReadingInput | null,
  trend: HeightTrend | null,
): string | null {
  if (!observation || !finite(observation.wave_height_m)) return null;
  const sentences: string[] = [];
  const hs = observation.wave_height_m;

  if (hs < FLAT_BELOW_M) {
    sentences.push(`Close to flat at the buoy: ${formatHeightFt(hs)} of total wave height.`);
  } else if (finite(observation.swell_height_m) && finite(observation.wind_wave_height_m)) {
    const swellKind = finite(observation.swell_period_s)
      ? describePeriodClass(observation.swell_period_s)
      : "swell";
    const swellArgs = [observation.swell_height_m, observation.swell_period_s, observation.swell_direction_deg] as const;
    const windArgs = [
      observation.wind_wave_height_m,
      observation.wind_wave_period_s,
      observation.wind_wave_direction_deg,
    ] as const;

    if (observation.swell_height_m >= observation.wind_wave_height_m) {
      const windPart = observation.wind_wave_height_m < MINOR_COMPONENT_BELOW_M
        ? "little wind wave on top"
        : `${component(...windArgs, "wind waves")} on top`;
      sentences.push(`${capitalize(swellKind)} leads: ${component(...swellArgs)}, with ${windPart}.`);
    } else {
      sentences.push(`Wind waves lead: ${component(...windArgs)}, over ${component(...swellArgs, swellKind)}.`);
    }
  } else {
    const kind = finite(observation.dominant_period_s)
      ? describePeriodClass(observation.dominant_period_s)
      : "waves";
    sentences.push(
      `${capitalize(kind)}: ${component(hs, observation.dominant_period_s, observation.mean_wave_direction_deg)}.`,
    );
  }

  const trendText = trendSentence(trend);
  if (trendText) sentences.push(trendText);
  return sentences.join(" ");
}
