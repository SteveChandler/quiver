import { addDays } from "./swell-briefing-input";
import type { StoryCandidate, StoryGate } from "./week-scout-story-types";

type Bucket = "morning" | "midday" | "evening";
type Exposure = "open" | "partial" | "shadowed";

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
  exposure?: { kind: Exposure; sampleBeaches: number };
  exposedBeaches?: Array<{ beachId: string; beachName: string; exposure: Exposure }>;
  wind?: { bucket: Bucket; fromWindClass: "offshore" | "onshore"; windClass: "offshore" | "onshore"; selectorConfirmed: boolean; turnConfirmed: boolean; beachId?: string; fromBucket?: Bucket; fromDirection?: string; toDirection?: string };
  tide?: { bucket: Bucket; tidePhase: string; windowOrder: "opens" | "closes"; selectorConfirmed: boolean; orderingConfirmed: boolean; beachId?: string };
}

const MAX_FACTS = 100;
const MAX_LENGTH = 240;
const DIGIT = /\d/;
const COMPASS = ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function directionSector(degrees: number): number {
  return Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
}

export function periodBand(seconds: number): number {
  return Math.floor(seconds / 3);
}

function weekday(date: string): string {
  return WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

function directionWords(degrees: number): string {
  return COMPASS[directionIndex(degrees)];
}

export function directionIndex(degrees: number): number {
  return Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
}

function add(facts: StoryCandidate[], id: string, slot: string, text: string, gate: StoryGate): void {
  if (facts.length >= MAX_FACTS || text.length > MAX_LENGTH || DIGIT.test(text)) return;
  facts.push({ id, slot, text, gate, rank: facts.length });
}

/** Candidate order is the fallback rank; every claim has a live gate. */
export function buildStoryCandidates(days: readonly RegionalDaySignal[], region = "the coast"): StoryCandidate[] {
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
      kind: "swell", regionalEventKey: key, directionSector: sector, directionIndex: directionIndex(peak.directionDeg),
      periodBand: band, periodClass: peak.periodS >= 13 ? "long" : "short",
      arrivalLocalDate: first.localDate, peakLocalDate: peak.localDate, fadeLocalDate: last.localDate,
      confidence: "on_the_radar", minimumBeaches: Math.min(3, peak.sampleBeaches),
    };
    const direction = directionWords(peak.directionDeg);
    const sectorDirection = COMPASS[sector * 2];
    const period = peak.periodS >= 13 ? "long-period groundswell" : "short-period swell";
    const alternatePeriod = peak.periodS >= 13 ? "short-period swell" : "long-period groundswell";
    const sectorGate: StoryGate = { ...gate, directionIndex: undefined, periodClass: undefined };
    const arrival = weekday(first.localDate);
    const peakDay = weekday(peak.localDate);
    add(facts, "cover-pulse", "cover", `A ${period} from the ${direction} reaches ${region} ${arrival} and peaks ${peakDay}.`, gate);
    add(facts, "cover-pulse-alt", "cover", `${region} gets a ${sectorDirection} ${period} by ${arrival}, with the most swell ${peakDay}.`,
      { ...gate, directionIndex: undefined });
    add(facts, "cover-pulse-other-period", "cover", `A ${alternatePeriod} from the ${sectorDirection} reaches ${region} ${arrival} and peaks ${peakDay}.`,
      { ...gate, directionIndex: undefined, periodClass: peak.periodS >= 13 ? "short" : "long" });
    add(facts, "lead-pulse", "story:lead", `${peakDay} carries the strongest ${direction} pulse of the week.`, gate);
    add(facts, "lead-pulse-alt", "story:lead", `The ${sectorDirection} swell builds from ${arrival} into ${peakDay}.`, sectorGate);
    add(facts, `swell-${key}`, `swell:${key}`, `The ${period} arrives ${arrival}, builds into ${peakDay}, then eases.`, gate);
    add(facts, `swell-${key}-alt`, `swell:${key}`, `${peakDay} is the peak of this ${sectorDirection} pulse.`, sectorGate);
    const named = peak.exposedBeaches?.filter((beach) => beach.beachName && !DIGIT.test(beach.beachName)) ?? [];
    const open = named.filter((beach) => beach.exposure === "open");
    const shadowed = named.filter((beach) => beach.exposure === "shadowed");
    if (open.length >= 2 && shadowed.length >= 1) {
      const selected = [...open.slice(0, 2), shadowed[0]];
      const exposureGate: StoryGate = { kind: "exposure", regionalEventKey: key, directionSector: sector,
        exposure: "open", minimumBeaches: 2, beaches: selected.map(({ beachId, exposure }) => ({ beachId, exposure })) };
      add(facts, `exposure-${key}`, `swell:${key}:exposure`, `${selected[0].beachName} and ${selected[1].beachName} face this swell better than ${selected[2].beachName}, which sits in the shadow.`, exposureGate);
      add(facts, `exposure-${key}-alt`, `swell:${key}:exposure`, `${selected[0].beachName} and ${selected[1].beachName} get the cleaner angle; ${selected[2].beachName} is more sheltered.`, exposureGate);
    }
    if (last.localDate > peak.localDate) {
      add(facts, "turn-fade", "story:turn", `After ${peakDay}, the ${sectorDirection} swell eases into ${weekday(last.localDate)}.`, sectorGate);
      add(facts, "turn-fade-alt", "story:turn", `The swell peaks ${peakDay} before fading toward ${weekday(last.localDate)}.`, sectorGate);
    }
  } else {
    const completeDates = days.map((day) => day.localDate);
    const gate: StoryGate = { kind: "quiet", fromDate: completeDates[0], toDate: completeDates[6], completeDates };
    add(facts, "cover-quiet", "cover", "A quieter stretch along the coast.", gate);
    add(facts, "quiet-week", `quiet:${completeDates[0]}..${completeDates[6]}`, "No clear regional pulse through this stretch.", gate);
  }

  for (let index = 0; index < days.length; index += 1) {
    const current = days[index];
    const day = weekday(current.localDate);
    if (current.wind?.selectorConfirmed && current.wind.turnConfirmed
      && current.wind.fromWindClass !== current.wind.windClass) {
      const wind = current.wind;
      const gate: StoryGate = { kind: "wind", localDate: current.localDate, bucket: wind.bucket,
        fromWindClass: wind.fromWindClass, windClass: wind.windClass, forecastRevision: current.forecastRevision,
        ...(wind.beachId ? { beachId: wind.beachId } : {}),
        ...(wind.fromBucket ? { fromBucket: wind.fromBucket } : {}),
        ...(wind.fromDirection ? { fromDirection: wind.fromDirection } : {}),
        ...(wind.toDirection ? { toDirection: wind.toDirection } : {}),
      };
      const turn = wind.windClass === "onshore" ? "The onshore fills in after the cleaner morning." : "The wind turns offshore and cleans up later.";
      add(facts, `wind-${current.localDate}`, `day:${current.localDate}`, `${day}: ${turn}`, gate);
      add(facts, `wind-${current.localDate}-alt`, `day:${current.localDate}`, `${day} starts ${wind.fromWindClass}, then turns ${wind.windClass} by ${wind.bucket}.`, gate);
    }
    if (current.tide?.selectorConfirmed && current.tide.orderingConfirmed) {
      const tide = current.tide;
      const gate: StoryGate = { kind: "tide", localDate: current.localDate, bucket: tide.bucket,
        tidePhase: tide.tidePhase, windowOrder: tide.windowOrder, forecastRevision: current.forecastRevision,
        ...(tide.beachId ? { beachId: tide.beachId } : {}) };
      add(facts, `tide-${current.localDate}`, `day:${current.localDate}`, `${day}'s ${tide.bucket} window sits on a ${tide.tidePhase} tide.`, gate);
      add(facts, `tide-${current.localDate}-alt`, `day:${current.localDate}`, `A ${tide.tidePhase} tide meets the ${tide.bucket} window ${day}.`, gate);
    }
    if (index > 0) {
      const previous = days[index - 1];
      for (const direction of ["better", "worse"] as const) {
        const gate: StoryGate = { kind: "change", fromDate: previous.localDate, toDate: current.localDate,
          direction, minimumScoreChange: 15, sourceSeries: current.sourceSeries };
        add(facts, `change-${direction}-${current.localDate}`, `day:${current.localDate}`,
          `${day} looks ${direction} than ${weekday(previous.localDate)} for the best regional window.`, gate);
      }
    }
    for (const bucket of ["morning", "midday", "evening"] as const) {
      add(facts, `day-${current.localDate}-${bucket}`, `day:${current.localDate}`,
        `${day}'s ${bucket} window has light wind and a safe shot at the surf.`,
        { kind: "day", localDate: current.localDate, bucket, reason: "light_wind" });
    }
  }
  return facts;
}
