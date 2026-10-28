import { addDays } from "./swell-briefing-input";
import type { StoryCandidate, StoryGate } from "./week-scout-story-types";

export interface RegionalDaySignal {
  localDate: string;
  complete: boolean;
  sampleBeaches: number;
  meanHeightFt: number | null;
  qualityScore?: number | null;
  directionDeg: number | null;
  periodS: number | null;
  sourceSeries: string;
  forecastRevision: string;
  wind?: { bucket: "morning" | "midday" | "evening"; fromWindClass: "offshore" | "onshore"; windClass: "offshore" | "onshore"; selectorConfirmed: boolean; turnConfirmed: boolean };
  tide?: { bucket: "morning" | "midday" | "evening"; tidePhase: string; windowOrder: "opens" | "closes"; selectorConfirmed: boolean; orderingConfirmed: boolean };
  exposure?: { kind: "open" | "partial" | "shadowed"; sampleBeaches: number };
}

export interface VerifiedOrigin {
  sourceAreaId: string;
  sourceLat: number;
  sourceLon: number;
  trackRevision: string;
  arrivalOrder: number;
  matchedRegionalEventKey: string;
  confidence: "likely" | "locked";
}

const MAX_FACTS = 100;
const MAX_LENGTH = 240;
const DIGIT = /\d/;
const DIRECTION = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

export function directionSector(degrees: number): number {
  return Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
}

export function periodBand(seconds: number): number {
  return Math.floor(seconds / 3);
}

function add(facts: StoryCandidate[], id: string, slot: string, text: string, gate: StoryGate): void {
  if (facts.length >= MAX_FACTS || text.length > MAX_LENGTH || DIGIT.test(text)) return;
  facts.push({ id, slot, text, gate });
}

/** Only source-backed physical claims enter the model's choice set. */
export function buildStoryCandidates(days: readonly RegionalDaySignal[], origin: VerifiedOrigin | null = null): StoryCandidate[] {
  if (days.length !== 7 || days.some((day, index) => !day.complete || day.localDate !== addDays(days[0].localDate, index))) return [];
  const facts: StoryCandidate[] = [];
  const pulseDays = days.filter((day) => day.meanHeightFt !== null && day.meanHeightFt >= 2
    && day.directionDeg !== null && day.periodS !== null && day.periodS >= 9);
  if (pulseDays.length === 0 && days.some((day) => day.meanHeightFt !== null && day.meanHeightFt >= 2)) return [];
  const peak = [...pulseDays].sort((a, b) => (b.meanHeightFt ?? 0) - (a.meanHeightFt ?? 0))[0];
  if (peak && peak.directionDeg !== null && peak.periodS !== null) {
    const first = pulseDays[0];
    const last = pulseDays[pulseDays.length - 1];
    const sector = directionSector(peak.directionDeg);
    const band = periodBand(peak.periodS);
    const key = `${sector}-${band}-${peak.localDate}`;
    const gate: StoryGate = {
      kind: "swell", regionalEventKey: key, directionSector: sector, periodBand: band,
      arrivalLocalDate: first.localDate, peakLocalDate: peak.localDate, fadeLocalDate: last.localDate,
      confidence: "on_the_radar", minimumBeaches: Math.min(3, peak.sampleBeaches),
    };
    add(facts, "cover-pulse", "cover", `A ${DIRECTION[sector]} swell shapes the coast.`, gate);
    add(facts, "lead-pulse", "story:lead", "The swell pulse shapes the week.", gate);
    add(facts, `swell-${key}`, `swell:${key}`, "The swell builds toward its peak, then eases.", gate);
    if (peak.exposure?.kind === "open" && peak.exposure.sampleBeaches >= 3) {
      add(facts, `exposure-${key}`, `swell:${key}`, "Open breaks should feel the pulse first.", {
        kind: "exposure", regionalEventKey: key, directionSector: sector,
        exposure: peak.exposure.kind, minimumBeaches: peak.exposure.sampleBeaches,
      });
    }
    if (origin && origin.matchedRegionalEventKey === key && origin.sourceAreaId && origin.trackRevision
      && Number.isFinite(origin.sourceLat) && Math.abs(origin.sourceLat) <= 90
      && Number.isFinite(origin.sourceLon) && Math.abs(origin.sourceLon) <= 180 && origin.arrivalOrder >= 0) {
      add(facts, `origin-${key}`, `swell:${key}`, "The verified source track points toward this coast.", {
        kind: "origin", regionalEventKey: key, sourceAreaId: origin.sourceAreaId,
        sourceLat: origin.sourceLat, sourceLon: origin.sourceLon,
        trackRevision: origin.trackRevision, arrivalOrder: origin.arrivalOrder,
        confidence: origin.confidence,
      });
    }
  } else {
    const completeDates = days.map((day) => day.localDate);
    const gate: StoryGate = { kind: "quiet", fromDate: completeDates[0], toDate: completeDates[6], completeDates };
    add(facts, "cover-quiet", "cover", "A quieter stretch along the coast.", gate);
    add(facts, "quiet-week", `quiet:${completeDates[0]}..${completeDates[6]}`, "No clear regional pulse through this stretch.", gate);
  }

  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const current = days[index];
    if (previous.sourceSeries === current.sourceSeries && previous.qualityScore != null && current.qualityScore != null) {
      const change = current.qualityScore - previous.qualityScore;
      if (Math.abs(change) >= 15) {
        add(facts, `change-${current.localDate}`, `day:${current.localDate}`,
          change > 0 ? "Conditions look better than yesterday." : "Conditions look worse than yesterday.", {
            kind: "change", fromDate: previous.localDate, toDate: current.localDate,
            direction: change > 0 ? "better" : "worse", minimumScoreChange: 15,
            sourceSeries: current.sourceSeries,
          });
      }
    }
    if (current.wind?.selectorConfirmed && current.wind.turnConfirmed
      && current.wind.fromWindClass !== current.wind.windClass) {
      add(facts, `wind-${current.localDate}`, `day:${current.localDate}`,
        current.wind.windClass === "offshore" ? "A wind turn may open a window." : "Wind may close the cleaner window.", {
          kind: "wind", localDate: current.localDate, bucket: current.wind.bucket,
          fromWindClass: current.wind.fromWindClass,
          windClass: current.wind.windClass, forecastRevision: current.forecastRevision,
        });
    }
    if (current.tide?.selectorConfirmed && current.tide.orderingConfirmed) {
      add(facts, `tide-${current.localDate}`, `day:${current.localDate}`, "The tide may open a window.", {
        kind: "tide", localDate: current.localDate, bucket: current.tide.bucket,
        tidePhase: current.tide.tidePhase, windowOrder: current.tide.windowOrder,
        forecastRevision: current.forecastRevision,
      });
    }
  }
  return facts;
}
