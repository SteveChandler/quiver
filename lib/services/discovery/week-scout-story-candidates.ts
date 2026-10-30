import type { InternalRegionEvent, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { confidenceFor, localDayDiff, rateRegionEvents } from "@/lib/alerts/swell-events/regional-rating";
import { addDays, localDate } from "./swell-briefing-input";
import type { RegionGateContext } from "./week-scout-story-region-gate";
import type { StoryCandidate, StoryGate } from "./week-scout-story-types";

type Bucket = "morning" | "midday" | "evening";
type Exposure = "open" | "partial" | "shadowed";
type Wind = "light" | "breezy" | "windy";

interface ExposedBeach {
  beachId: string;
  beachName: string;
  exposure: Exposure;
  qualityScore: number | null;
}

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
  /** Each event peaking this day, by story event key: every region beach's exposure to that event's direction. */
  exposedBeaches?: Record<string, ExposedBeach[]>;
  wind?: { bucket: Bucket; fromWindClass: "offshore" | "onshore"; windClass: "offshore" | "onshore"; selectorConfirmed: boolean; turnConfirmed: boolean; beachId?: string; fromBucket?: Bucket; fromDirection?: string; toDirection?: string };
  tide?: { bucket: Bucket; tidePhase: string; windowOrder: "opens" | "closes"; selectorConfirmed: boolean; orderingConfirmed: boolean; beachId?: string };
}

export interface RegionalSwellEvent {
  directionDeg: number;
  periodS: number;
  arrivalAt: string;
  peakAt: string;
  fadeAt: string | null;
  timezone: string;
  confidence: "on_the_radar" | "likely" | "locked";
  minimumBeaches: number;
  kind: "swell" | "storm";
  /** The region build event's key. */
  regionalKey: string;
}

/** The most candidates one story input offers, story and card lines together. */
export const MAX_FACTS = 200;
/** The card lists at most five working and three not-working beaches, plus the beach it was rated for. */
const MAX_BEACH_LINES = 8;
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

function windowDay(date: string, first: string, last: string): string {
  if (date < first) return "earlier in the week";
  if (date > last) return "next week";
  return weekday(date);
}

function eventLocalDate(at: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

function periodWords(seconds: number, kind: RegionalSwellEvent["kind"]): string {
  if (kind === "storm") return seconds >= 10 ? "stormy mid-period swell" : "stormy short-period swell";
  if (seconds >= 13) return "long-period groundswell";
  if (seconds >= 10) return "mid-period swell";
  return "short-period windswell";
}

/** "west long-period groundswell"; a storm's "stormy" leads the direction: "stormy west short-period swell". */
function namedSwell(direction: string, seconds: number, kind: RegionalSwellEvent["kind"]): string {
  const period = periodWords(seconds, kind);
  return kind === "storm" ? `stormy ${direction} ${period.replace(/^stormy /, "")}` : `${direction} ${period}`;
}

function withArticle(phrase: string): string {
  return `${/^[aeiou]/i.test(phrase) ? "an" : "a"} ${phrase}`;
}

function directionWords(degrees: number): string {
  return COMPASS[directionIndex(degrees)];
}

export function directionIndex(degrees: number): number {
  return Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
}

/** The period class a sentence's words name: long-period from 13 s, mid-period from 10 s. */
export function periodClass(seconds: number): "long" | "mid" | "short" {
  return seconds >= 13 ? "long" : seconds >= 10 ? "mid" : "short";
}

function add(facts: StoryCandidate[], id: string, slot: string, text: string, gate: StoryGate): void {
  if (facts.length >= MAX_FACTS || text.length > MAX_LENGTH || DIGIT.test(text)) return;
  facts.push({ id, slot, text, gate, rank: facts.length });
}

export interface HeadlineSwell {
  key: string;
  kind: RegionalSwellEvent["kind"];
  directionIndex: number;
  periodS: number;
  arrivalDate: string;
  peakDate: string;
}

/**
 * Cover and lead sentences for one swell; they name no fade day. Without a
 * region the cover claims only the swell itself, not where it reaches.
 */
export function addSwellHeadlines(facts: StoryCandidate[], swell: HeadlineSwell, region: string | null,
  firstDate: string, lastDate: string, gate: StoryGate, idPrefix = ""): void {
  const { key, arrivalDate, peakDate } = swell;
  const direction = COMPASS[swell.directionIndex];
  const period = periodWords(swell.periodS, swell.kind);
  const arrival = windowDay(arrivalDate, firstDate, lastDate);
  const peakDay = windowDay(peakDate, firstDate, lastDate);
  // Phrasings that open with the day, or follow "by", only read with a real weekday.
  const namedDays = arrivalDate >= firstDate && arrivalDate <= lastDate && peakDate >= firstDate && peakDate <= lastDate;
  add(facts, `cover-${idPrefix}pulse-${key}`, "cover", region
    ? `A ${period} from the ${direction} reaches ${region} ${arrival} and peaks ${peakDay}.`
    : arrivalDate < firstDate
      ? `A ${period} from the ${direction} is already in the water and peaks ${peakDay}.`
      : `A ${period} from the ${direction} arrives ${arrival} and peaks ${peakDay}.`, gate);
  if (namedDays && region) add(facts, `cover-${idPrefix}pulse-alt-${key}`, "cover", `${region} gets ${withArticle(namedSwell(direction, swell.periodS, swell.kind))} by ${arrival}, with the most swell ${peakDay}.`, gate);
  add(facts, `lead-${idPrefix}pulse-${key}`, "story:lead", `The ${direction} pulse builds from ${arrival} into ${peakDay}.`, gate);
  if (namedDays) add(facts, `lead-${idPrefix}pulse-alt-${key}`, "story:lead", `${arrival} starts the ${direction} swell's run toward a ${peakDay} peak.`, gate);
}

/**
 * The story's key for an event: direction sector, period band and local peak date, with "-s" for a
 * storm, so a storm and a swell in the same sector, band and day stay two events.
 */
export function storyEventKey(event: RegionalSwellEvent): string {
  const key = `${directionSector(event.directionDeg)}-${periodBand(event.periodS)}-${eventLocalDate(event.peakAt, event.timezone)}`;
  return event.kind === "storm" ? `${key}-s` : key;
}

/** The swell gate for a sentence naming this event's direction, period class and days, fade included when it has one. */
export function eventSwellGate(event: RegionalSwellEvent): Extract<StoryGate, { kind: "swell" }> {
  return {
    kind: "swell", regionalEventKey: storyEventKey(event), directionSector: directionSector(event.directionDeg),
    directionIndex: directionIndex(event.directionDeg), periodBand: periodBand(event.periodS), periodClass: periodClass(event.periodS),
    arrivalLocalDate: eventLocalDate(event.arrivalAt, event.timezone), peakLocalDate: eventLocalDate(event.peakAt, event.timezone),
    fadeLocalDate: event.fadeAt ? eventLocalDate(event.fadeAt, event.timezone) : null,
    confidence: event.confidence, minimumBeaches: event.minimumBeaches,
  };
}

const STORY_CONFIDENCE = { on_the_way: "locked", likely: "likely", early_look: "on_the_radar" } as const;

type ForecastRegionEvent = InternalRegionEvent & { directionDeg: number; periodS: number; arrivalAt: string };

/** Detected events always carry a direction, period and arrival; only WAM early looks lack them. */
function isForecastEvent(event: InternalRegionEvent): event is ForecastRegionEvent {
  return event.source === "forecast" && event.directionDeg !== null && event.periodS !== null && event.arrivalAt !== null;
}

/**
 * The region build's forecast events as story events. `all` is every one, chronological; `week`
 * is those arriving or peaking in the edition's seven days, at most three.
 */
export function storyEventsFromRegion(build: RegionBuild, editionDate: string): { week: RegionalSwellEvent[]; all: RegionalSwellEvent[] } {
  const all: RegionalSwellEvent[] = build.events.filter(isForecastEvent)
    .sort((a, b) => Date.parse(a.peakAt) - Date.parse(b.peakAt))
    .map((event) => ({
      directionDeg: event.directionDeg, periodS: event.periodS, arrivalAt: event.arrivalAt, peakAt: event.peakAt,
      fadeAt: event.fadeAt, timezone: build.timezone,
      confidence: STORY_CONFIDENCE[confidenceFor(Math.max(0, localDayDiff(editionDate, event.peakLocalDate)))],
      minimumBeaches: Math.min(3, event.memberCount), kind: event.kind, regionalKey: event.key,
    }));
  // Out-of-week events (a spike that already passed) must not use up the three slots.
  const week = all.filter((event) => [event.arrivalAt, event.peakAt].some((at) => {
    const date = localDate(new Date(at), build.timezone);
    return date >= editionDate && date <= addDays(editionDate, 6);
  })).slice(0, 3);
  return { week, all };
}

/**
 * A day as the card names it from the region's today: the weekday within six days either side,
 * "a week from" one up to thirteen days ahead.
 */
function cardDay(date: string, today: string): string {
  const lead = localDayDiff(today, date);
  if (lead === 7) return "a week from today";
  if (lead > 7 && lead <= 13) return `a week from ${weekday(date)}`;
  if (lead > 13) return "later on";
  return lead < -6 ? "earlier" : weekday(date);
}

/**
 * The card's story line for one event, from the region's local today: direction, kind and period,
 * then arrival, peak and (when it has one) fade days. "A stormy west short-period swell arrives
 * Thursday, peaks Friday and fades Saturday."
 */
export function eventStoryText(event: RegionalSwellEvent, today: string): string {
  const arrival = eventLocalDate(event.arrivalAt, event.timezone);
  const peak = eventLocalDate(event.peakAt, event.timezone);
  const fade = event.fadeAt ? eventLocalDate(event.fadeAt, event.timezone) : null;
  const clauses = [
    arrival < today ? "is already in the water" : `arrives ${cardDay(arrival, today)}`,
    `${peak < today ? "peaked" : "peaks"} ${peak === arrival && arrival >= today ? "the same day" : cardDay(peak, today)}`,
    ...(fade ? [`${fade < today ? "faded" : "fades"} ${fade === peak ? "the same day" : cardDay(fade, today)}`] : []),
  ];
  const sentence = `${withArticle(namedSwell(directionWords(event.directionDeg), event.periodS, event.kind))} `
    + `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** Why a rated beach does or doesn't work for an event, from its exposure to the event's direction and its wind. */
export function beachLineText(direction: string, exposure: Exposure, wind: Wind): string {
  if (exposure === "shadowed") return `Sheltered from the ${direction}, so it stays small.`;
  if (exposure === "partial") return `Partly sheltered from the ${direction}, so it runs smaller and cleaner.`;
  return wind === "light"
    ? `Faces the ${direction} swell straight on, with light wind in its window.`
    : `Takes the ${direction} swell head on, but the wind is up in its window.`;
}

/**
 * The card's lines: a story line per forecast event and a line per beach the card lists for it (the
 * region's first beach, the working and the not-working beaches, at most eight). Each is the only
 * candidate in its `event:` slot. These slots are the card's alone; the Week Scout story never serves them.
 */
export function buildEventCandidates(build: RegionBuild, events: readonly RegionalSwellEvent[], context: RegionGateContext, now: Date): StoryCandidate[] {
  const first = build.beaches[0];
  const rated = new Map((first ? rateRegionEvents(build, { beachId: first.id, skill: "intermediate", now }) : [])
    .map((event) => [event.key, event]));
  const today = localDate(now, build.timezone);
  const facts: StoryCandidate[] = [];
  const keys = new Set<string>();
  for (const event of events) {
    const key = storyEventKey(event);
    // The first event under a key, as the gate context keeps the first.
    if (keys.has(key)) continue;
    keys.add(key);
    add(facts, `event-${key}-story`, `event:${key}:story`, eventStoryText(event, today), eventSwellGate(event));
    const listing = rated.get(event.regionalKey);
    const listed = listing ? [listing.here, ...listing.working, ...listing.notWorking] : [];
    const direction = directionWords(event.directionDeg);
    const lines = [...new Set(listed.flatMap((rating) => (rating ? [rating.beachId] : [])))].flatMap((beachId) => {
      // The gate's values are the ones the region build proves at serve time.
      const exposure = context.exposure(key, beachId);
      const wind = context.wind(key, beachId);
      return exposure && wind ? [{ beachId, exposure, wind }] : [];
    }).slice(0, MAX_BEACH_LINES);
    for (const { beachId, exposure, wind } of lines) {
      add(facts, `event-${key}-beach-${beachId}`, `event:${key}:beach:${beachId}`, beachLineText(direction, exposure, wind),
        { kind: "beach", regionalEventKey: key, beachId, exposure, wind });
    }
  }
  return facts.map((fact) => ({ ...fact, rank: 0 }));
}

/** Candidate order is the fallback rank; every claim has a live gate. */
export function buildStoryCandidates(days: readonly RegionalDaySignal[], region = "the coast", events: readonly RegionalSwellEvent[] = []): StoryCandidate[] {
  if (days.length !== 7 || days.some((day, index) => !day.complete || day.localDate !== addDays(days[0].localDate, index))) return [];
  const facts: StoryCandidate[] = [];
  const pulse = days.some((day) => day.meanHeightFt !== null && day.meanHeightFt >= 2);
  // Every in-week event gets candidates: the earliest can be a spike that has
  // already passed, which the live chart drops, while a later one is still on it.
  const weekEvents = [...events].sort((a, b) => Date.parse(a.peakAt) - Date.parse(b.peakAt))
    .filter((item) => days.some((day) => day.localDate === eventLocalDate(item.peakAt, item.timezone)
      || day.localDate === eventLocalDate(item.arrivalAt, item.timezone)));
  if (pulse && weekEvents.length === 0) return [];
  const keys = new Set<string>();
  for (const event of pulse ? weekEvents : []) {
    const arrivalDate = eventLocalDate(event.arrivalAt, event.timezone);
    const peakDate = eventLocalDate(event.peakAt, event.timezone);
    const fadeDate = event.fadeAt ? eventLocalDate(event.fadeAt, event.timezone) : null;
    const peak = days.find((day) => day.localDate === peakDate);
    const sector = directionSector(event.directionDeg);
    const key = storyEventKey(event);
    if (keys.has(key)) continue;
    keys.add(key);
    const gate = eventSwellGate(event);
    const direction = directionWords(event.directionDeg);
    const period = periodWords(event.periodS, event.kind);
    const firstDate = days[0].localDate;
    const lastDate = days[6].localDate;
    const arrival = windowDay(arrivalDate, firstDate, lastDate);
    const peakDay = windowDay(peakDate, firstDate, lastDate);
    // Phrasings that open with the day, or follow "by", only read with a real weekday.
    const namedDays = arrivalDate >= firstDate && arrivalDate <= lastDate && peakDate >= firstDate && peakDate <= lastDate;
    // Cover and lead name no fade day, so they don't require the chart's fade to agree.
    addSwellHeadlines(facts, { key, kind: event.kind, directionIndex: directionIndex(event.directionDeg), periodS: event.periodS,
      arrivalDate, peakDate }, region, firstDate, lastDate, { ...gate, fadeLocalDate: null });
    add(facts, `swell-${key}`, `swell:${key}`, `The ${period} arrives ${arrival} and peaks ${peakDay}${fadeDate ? ` before easing ${windowDay(fadeDate, firstDate, lastDate)}` : ""}.`, gate);
    if (namedDays) add(facts, `swell-${key}-alt`, `swell:${key}`, `${peakDay} is the peak of this ${direction} pulse.`, gate);
    const named = peak?.exposedBeaches?.[key]?.filter((beach) => beach.beachName && !DIGIT.test(beach.beachName)) ?? [];
    const byQuality = (a: typeof named[number], b: typeof named[number]): number =>
      (b.qualityScore ?? -1) - (a.qualityScore ?? -1) || a.beachName.localeCompare(b.beachName);
    const open = named.filter((beach) => beach.exposure === "open").sort(byQuality);
    const shadowed = named.filter((beach) => beach.exposure === "shadowed").sort(byQuality);
    if (open.length >= 2 && shadowed.length >= 1) {
      const selected = [...open.slice(0, 2), shadowed[0]];
      const exposureGate: StoryGate = { kind: "exposure", regionalEventKey: key, directionSector: sector,
        exposure: "open", minimumBeaches: 2, beaches: selected.map(({ beachId, exposure }) => ({ beachId, exposure })) };
      add(facts, `exposure-${key}`, `swell:${key}:exposure`, `${selected[0].beachName} and ${selected[1].beachName} face this swell better than ${selected[2].beachName}, which sits in the shadow.`, exposureGate);
      add(facts, `exposure-${key}-alt`, `swell:${key}:exposure`, `${selected[0].beachName} and ${selected[1].beachName} get the cleaner angle; ${selected[2].beachName} is more sheltered.`, exposureGate);
    }
    if (fadeDate && fadeDate > peakDate) {
      add(facts, `turn-fade-${key}`, "story:turn", `After ${peakDay}, the ${direction} swell eases into ${windowDay(fadeDate, firstDate, lastDate)}.`, gate);
      add(facts, `turn-fade-alt-${key}`, "story:turn", `The ${direction} swell peaks ${peakDay} before fading toward ${windowDay(fadeDate, firstDate, lastDate)}.`, gate);
    }
  }
  if (!pulse || weekEvents.length === 0) {
    const completeDates = days.map((day) => day.localDate);
    const gate: StoryGate = { kind: "quiet", fromDate: completeDates[0], toDate: completeDates[6], completeDates };
    add(facts, "cover-quiet", "cover", "A quieter stretch along the coast.", gate);
    add(facts, "quiet-week", `quiet:${completeDates[0]}..${completeDates[6]}`, "No clear regional pulse through this stretch.", gate);
  }

  const turns = days.filter((day) => day.wind?.selectorConfirmed && day.wind.turnConfirmed
    && day.wind.fromWindClass !== day.wind.windClass);
  const turnGroups = new Map<string, RegionalDaySignal[]>();
  for (const day of turns) {
    const wind = day.wind!;
    const key = `${wind.fromWindClass}:${wind.windClass}:${wind.bucket}`;
    turnGroups.set(key, [...(turnGroups.get(key) ?? []), day]);
  }
  const repeated = [...turnGroups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  const pattern = repeated.length >= 3 ? repeated : [];
  if (pattern.length >= 3) {
    for (let index = facts.length - 1; index >= 0; index -= 1) {
      if (facts[index].slot === "story:turn") facts.splice(index, 1);
    }
    const wind = pattern[0].wind!;
    const gates: Array<Extract<StoryGate, { kind: "wind" }>> = pattern.map((day) => ({ kind: "wind", localDate: day.localDate, bucket: wind.bucket,
      fromWindClass: wind.fromWindClass, windClass: wind.windClass, forecastRevision: day.forecastRevision,
      beachId: day.wind?.beachId, fromBucket: day.wind?.fromBucket, fromDirection: day.wind?.fromDirection,
      toDirection: day.wind?.toDirection }));
    const span = pattern.length === days.length ? "through the week" : "on several days";
    add(facts, "turn-wind-pattern", "story:turn", wind.windClass === "onshore"
      ? `Mornings stay cleaner ${span}; the onshore fills in by ${wind.bucket}.`
      : `Mornings stay onshore ${span}; offshore wind cleans up by ${wind.bucket}.`,
    { kind: "wind_pattern", days: gates });
  }
  for (let index = 0; index < days.length; index += 1) {
    const current = days[index];
    const day = weekday(current.localDate);
    if (!pattern.includes(current) && current.wind?.selectorConfirmed && current.wind.turnConfirmed
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
      add(facts, `wind-${current.localDate}`, `day:${current.localDate}`, `On ${day}, ${turn.charAt(0).toLowerCase()}${turn.slice(1)}`, gate);
      add(facts, `wind-${current.localDate}-alt`, `day:${current.localDate}`, `On ${day}, the wind starts ${wind.fromWindClass}, then turns ${wind.windClass} by ${wind.bucket}.`, gate);
    }
    if (current.tide?.selectorConfirmed && current.tide.orderingConfirmed) {
      const tide = current.tide;
      const gate: StoryGate = { kind: "tide", localDate: current.localDate, bucket: tide.bucket,
        tidePhase: tide.tidePhase, windowOrder: tide.windowOrder, forecastRevision: current.forecastRevision,
        ...(tide.beachId ? { beachId: tide.beachId } : {}) };
      add(facts, `tide-${current.localDate}`, `day:${current.localDate}`, `On ${day}, the ${tide.bucket} window sits on a ${tide.tidePhase} tide.`, gate);
      add(facts, `tide-${current.localDate}-alt`, `day:${current.localDate}`, `On ${day}, a ${tide.tidePhase} tide meets the ${tide.bucket} window.`, gate);
    }
    if (index > 0) {
      const previous = days[index - 1];
      for (const direction of ["better", "worse"] as const) {
        const gate: StoryGate = { kind: "change", fromDate: previous.localDate, toDate: current.localDate,
          direction, minimumScoreChange: 15, sourceSeries: current.sourceSeries };
        add(facts, `change-${direction}-${current.localDate}`, `day:${current.localDate}`,
          `The best regional window looks ${direction} on ${day} than on ${weekday(previous.localDate)}.`, gate);
      }
    }
  }
  for (const fact of facts) {
    if (fact.id === "turn-wind-pattern") fact.rank = -1;
    if (fact.slot.startsWith("day:")) fact.rank = fact.gate.kind === "change" ? 100 + (fact.rank ?? 0)
      : fact.gate.kind === "tide" ? 200 + (fact.rank ?? 0) : 300 + (fact.rank ?? 0);
  }
  return facts;
}
