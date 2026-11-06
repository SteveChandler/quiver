import type { RegionalSwellEvent } from "../../week-scout-story-candidates";
import { sizeWordsFor, type CandidateFacts, type FaceRange } from "../../week-scout-story-facts";

const today = "2026-11-05";
const timezone = "America/Los_Angeles";

type Row = [id: string, directionDeg: number, periodS: number, kind: RegionalSwellEvent["kind"],
  arrivalAt: string, peakAt: string, fadeAt: string, confidence: RegionalSwellEvent["confidence"],
  faceFt: FaceRange, standoutFt: FaceRange | null];

const rows: Row[] = [
  ["w-today", 270, 16, "swell", "2026-11-04T14:00:00Z", "2026-11-05T18:00:00Z", "2026-11-07T18:00:00Z", "locked", { min: 3, max: 5 }, { min: 8, max: 10 }],
  ["ssw-today", 202, 14, "swell", "2026-11-04T20:00:00Z", "2026-11-05T20:00:00Z", "2026-11-07T20:00:00Z", "locked", { min: 3, max: 5 }, { min: 8, max: 10 }],
  ["ssw-sun", 200, 14, "swell", "2026-11-08T16:00:00Z", "2026-11-08T23:00:00Z", "2026-11-09T23:00:00Z", "locked", { min: 3, max: 5 }, null],
  ["wnw-mon", 292, 11, "swell", "2026-11-09T16:00:00Z", "2026-11-09T22:00:00Z", "2026-11-10T22:00:00Z", "locked", { min: 3, max: 5 }, null],
  ["wnw-fri", 292, 16, "swell", "2026-11-12T16:00:00Z", "2026-11-13T17:00:00Z", "2026-11-15T17:00:00Z", "likely", { min: 4, max: 5 }, null],
  ["w-fri", 270, 10, "swell", "2026-11-12T20:00:00Z", "2026-11-13T22:00:00Z", "2026-11-15T00:00:00Z", "likely", { min: 5, max: 6 }, { min: 8, max: 10 }],
  ["w-storm-sat", 268, 10, "storm", "2026-11-13T12:00:00Z", "2026-11-14T14:00:00Z", "2026-11-15T14:00:00Z", "likely", { min: 4, max: 5 }, null],
  ["ssw-sat", 205, 14, "swell", "2026-11-13T16:00:00Z", "2026-11-14T20:00:00Z", "2026-11-16T20:00:00Z", "likely", { min: 4, max: 5 }, null],
];

const stored: RegionalSwellEvent[] = rows.map(([regionalKey, directionDeg, periodS, kind, arrivalAt, peakAt, fadeAt, confidence]) => ({
  directionDeg, periodS, arrivalAt, peakAt, fadeAt, timezone, confidence, minimumBeaches: 3, kind, regionalKey,
}));

const factsById = new Map<string, CandidateFacts>(rows.map(([id, , , , , , , , faceFt, standoutFt]) => [id, {
  faceFt, sizes: sizeWordsFor(faceFt), breaker: null,
  ...(standoutFt ? { standoutFt, standoutSizes: sizeWordsFor(standoutFt) } : {}),
}]));

function factsFor(event: RegionalSwellEvent): CandidateFacts | null {
  return factsById.get(event.regionalKey) ?? null;
}

/** San Diego's stored swells on Nov 5 2026, the morning of the approved At a glance mockup. */
export const glanceSanDiego = { today, timezone, stored, factsFor };

export const glanceSanDiegoSentences: readonly string[] = [
  "A west groundswell and a south-southwest groundswell both peak today, chest-high at most spots and overhead at the standouts, easing by Saturday.",
  "A fresh south-southwest groundswell arrives and peaks Sunday, then a west-northwest mid-period swell follows Monday, both chest-high at most spots.",
  "A week from Friday looks likely to bring a bigger west swell with a south-southwest groundswell behind it, head-high at most spots and overhead at the standouts.",
];
