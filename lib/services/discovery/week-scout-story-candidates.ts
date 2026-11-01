import type { InternalRegionEvent, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { confidenceFor, localDayDiff, rateRegionEvents } from "@/lib/alerts/swell-events/regional-rating";
import { addDays, localDate } from "./swell-briefing-input";
import type { RegionGateContext } from "./week-scout-story-region-gate";
import { LIGHT_WIND_MPH, type CandidateFacts, type FaceRange, type SizeWord, type WindHour } from "./week-scout-story-facts";
import type { StoryCandidate, StoryGate } from "./week-scout-story-types";

type Bucket = "morning" | "midday" | "evening";
type Exposure = "open" | "partial" | "shadowed";
type BeachGate = Extract<StoryGate, { kind: "beach" }>;
type Wind = BeachGate["wind"];

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
  surfBeaches?: Array<{ beachId: string; beachName: string; facts: CandidateFacts }>;
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
/** The 16 compass points as every candidate text names them; no candidate abbreviates a direction. */
export const COMPASS = ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"];
export const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  if (kind === "storm") return seconds >= 10 ? "mid-period storm swell" : "short-period storm swell";
  if (seconds >= 13) return "long-period groundswell";
  if (seconds >= 10) return "mid-period swell";
  return "short-period windswell";
}

/** "west long-period groundswell", "west short-period storm swell". */
function namedSwell(direction: string, seconds: number, kind: RegionalSwellEvent["kind"]): string {
  return `${direction} ${periodWords(seconds, kind)}`;
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

function add(facts: StoryCandidate[], id: string, slot: string, text: string, gate: StoryGate, candidateFacts: CandidateFacts | null = null): void {
  if (facts.length >= MAX_FACTS || text.length > MAX_LENGTH || DIGIT.test(text.replace(/\bonshore by (?:9|10|11|12)\b/g, ""))) return;
  facts.push({ id, slot, text, gate, rank: facts.length, ...(candidateFacts ? { facts: candidateFacts } : {}) });
}

export function sizePhrase(range: FaceRange | null, sizes: SizeWord[]): string | null {
  if (!range || sizes.length === 0) return null;
  const words = sizes.filter((word) => word !== "shoulder" || !sizes.includes("chest"));
  const low = words[0];
  const high = words[words.length - 1];
  const single = (word: SizeWord): string => word.includes("overhead") ? word : `${word}-high`;
  if (low === high) return single(low);
  if (high.includes("overhead")) return `${single(low)} to ${single(high)}`;
  return `${low}-to-${high}${high === "head" ? "-high" : ""}`;
}

export function windTimingPhrase(hours: WindHour[]): string | null {
  const holds = (from: number, to: number, kind: "offshore" | "onshore" | "light", all = false): boolean => {
    const rows = hours.filter((row) => row.hour >= from && row.hour < to);
    return rows.length > 0 && rows.every((row) => kind === "light"
      ? row.mph !== null && row.mph < LIGHT_WIND_MPH : row.relation === kind)
      && (!all || (rows.some((row) => row.hour <= Math.max(from, 6) + 2)
        && rows.some((row) => row.hour >= Math.min(to, 18) - 2)));
  };
  if (holds(0, 24, "offshore", true)) return "offshore all day";
  if (holds(0, 12, "offshore", true) && holds(13, 24, "onshore")) return "offshore all morning, sea breeze after lunch";
  if (holds(0, 9, "offshore")) {
    const firstOnshore = hours.filter((row) => row.relation === "onshore").sort((a, b) => a.hour - b.hour)[0];
    if (firstOnshore && firstOnshore.hour >= 9 && firstOnshore.hour <= 12 && holds(firstOnshore.hour, 13, "onshore")) {
      return `offshore early, onshore by ${firstOnshore.hour === 12 ? "noon" : firstOnshore.hour}`;
    }
  }
  if (holds(0, 9, "light") && holds(13, 24, "onshore")) return "glassy early, sea breeze after lunch";
  if (holds(0, 9, "offshore")) return "offshore early";
  if (holds(0, 9, "light")) return "glassy early";
  const onshoreHour = hours.filter((row) => row.relation === "onshore").sort((a, b) => a.hour - b.hour)[0]?.hour;
  if (onshoreHour !== undefined && onshoreHour >= 9 && onshoreHour <= 12
    && hours.some((row) => row.hour < onshoreHour && row.relation !== "onshore")
    && holds(onshoreHour, 13, "onshore")) return `onshore by ${onshoreHour === 12 ? "noon" : onshoreHour}`;
  return null;
}

function feelPhrase(facts: CandidateFacts): string | null {
  return facts.breaker?.feel ?? (facts.breaker?.character === "crumbly" ? "crumbly" : null);
}

function withRegionalSize(text: string, facts: CandidateFacts | null): string {
  const size = facts && sizePhrase(facts.faceFt, facts.sizes);
  if (!size || !facts) return text;
  const standout = facts.standoutFt && facts.faceFt && facts.standoutFt.max > facts.faceFt.max
    ? sizePhrase(facts.standoutFt, facts.standoutSizes ?? []) : null;
  return `${text.slice(0, -1)}: ${size} at most spots${standout && standout !== size ? `, ${standout} at the standouts` : ""}.`;
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
  firstDate: string, lastDate: string, gate: StoryGate, idPrefix = "", candidateFacts: CandidateFacts | null = null): void {
  const { key, arrivalDate, peakDate } = swell;
  const direction = COMPASS[swell.directionIndex];
  const period = periodWords(swell.periodS, swell.kind);
  const arrival = windowDay(arrivalDate, firstDate, lastDate);
  const peakDay = windowDay(peakDate, firstDate, lastDate);
  const arrivalPast = arrivalDate < firstDate;
  // Phrasings that open with the day, or follow "by", only read with a real weekday.
  const namedDays = arrivalDate >= firstDate && arrivalDate <= lastDate && peakDate >= firstDate && peakDate <= lastDate;
  add(facts, `cover-${idPrefix}pulse-${key}`, "cover", withRegionalSize(arrivalPast
    ? `A ${period} from the ${direction} is already in the water and peaks ${peakDay}.`
    : region
      ? `A ${period} from the ${direction} reaches ${region} ${arrival} and peaks ${peakDay}.`
      : `A ${period} from the ${direction} arrives ${arrival} and peaks ${peakDay}.`, candidateFacts), gate, candidateFacts);
  if (namedDays && region) add(facts, `cover-${idPrefix}pulse-alt-${key}`, "cover", withRegionalSize(`${region} gets ${withArticle(namedSwell(direction, swell.periodS, swell.kind))} by ${arrival}, with the most swell ${peakDay}.`, candidateFacts), gate, candidateFacts);
  add(facts, `lead-${idPrefix}pulse-${key}`, "story:lead", arrivalPast
    ? `The ${direction} pulse is already in the water and peaks ${peakDay}.`
    : `The ${direction} pulse builds from ${arrival} into ${peakDay}.`, gate, candidateFacts);
  if (namedDays) add(facts, `lead-${idPrefix}pulse-alt-${key}`, "story:lead", `${arrival} starts the ${direction} swell's run toward a ${peakDay} peak.`, gate, candidateFacts);
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

function joinClauses(clauses: readonly string[]): string {
  return clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
}

/**
 * The card's story line for one event and whether it names a fade day, from the region's local today.
 * Each day is named once: "arrives Thursday, peaks Friday and fades Saturday", "arrives and peaks Friday,
 * then fades Saturday", "comes and goes Friday"; a fade on the peak day goes unsaid.
 */
function eventStoryParts(event: RegionalSwellEvent, today: string): { text: string; namesFade: boolean } {
  const arrival = eventLocalDate(event.arrivalAt, event.timezone);
  const peak = eventLocalDate(event.peakAt, event.timezone);
  const fade = event.fadeAt ? eventLocalDate(event.fadeAt, event.timezone) : null;
  // Words, not dates, decide: two days past two weeks both read "later on", so the second goes unsaid.
  const arrivalDay = cardDay(arrival, today);
  const peakDay = cardDay(peak, today);
  const fadeDay = fade !== null ? cardDay(fade, today) : null;
  const fadeClause = fade !== null && fadeDay !== peakDay ? `${fade < today ? "faded" : "fades"} ${fadeDay}` : null;
  let predicate: string;
  let namesFade = fadeClause !== null;
  if (arrival < today) {
    predicate = joinClauses(["is already in the water", `${peak < today ? "peaked" : "peaks"} ${peakDay}`, ...(fadeClause ? [fadeClause] : [])]);
  } else if (arrivalDay === peakDay && fadeDay === peakDay) {
    predicate = `comes and goes ${peakDay}`;
    namesFade = true;
  } else if (arrivalDay === peakDay) {
    predicate = `arrives and peaks ${peakDay}${fadeClause ? `, then ${fadeClause}` : ""}`;
  } else {
    predicate = joinClauses([`arrives ${arrivalDay}`, `peaks ${peakDay}`, ...(fadeClause ? [fadeClause] : [])]);
  }
  const sentence = `${withArticle(namedSwell(directionWords(event.directionDeg), event.periodS, event.kind))} ${predicate}.`;
  return { text: sentence.charAt(0).toUpperCase() + sentence.slice(1), namesFade };
}

/**
 * The card's story line for one event: direction, kind and period, then its days. "A west short-period
 * storm swell arrives Thursday, peaks Friday and fades Saturday."
 */
export function eventStoryText(event: RegionalSwellEvent, today: string, facts: CandidateFacts | null = null): string {
  return withRegionalSize(eventStoryParts(event, today).text, facts);
}

/** The story line and its swell gate, which claims a fade day only when the line names one. */
export function eventStory(event: RegionalSwellEvent, today: string, facts: CandidateFacts | null = null): { text: string; gate: Extract<StoryGate, { kind: "swell" }> } {
  const { text, namesFade } = eventStoryParts(event, today);
  const gate = eventSwellGate(event);
  return { text: withRegionalSize(text, facts), gate: namesFade ? gate : { ...gate, fadeLocalDate: null } };
}

/** The swell a beach line names, by kind and period class: a storm's swell, a groundswell, a mid-period swell or a windswell. */
const BEACH_SWELL_NOUN = { storm: "storm swell", long: "groundswell", mid: "mid-period swell", short: "windswell" } as const;
/** How a beach line says an open beach faces a swell dead on; the words vary with the swell so one beach's lines differ across events. */
const DEAD_ON_PHRASE = { storm: "head on", long: "dead on", mid: "straight on", short: "straight on" } as const;

export interface BeachLineFacts {
  direction: string;
  kind: RegionalSwellEvent["kind"];
  periodClass: BeachGate["periodClass"];
  exposure: Exposure | null;
  facing: BeachGate["facing"];
  wind: Wind | null;
}

/**
 * Why a listed beach does or doesn't work for an event, from facts its gate pins and that don't depend
 * on the user's skill. Every word that carries a claim is in a closed word set of
 * week-scout-story-claims.ts, so a rewrite can't swap it for its opposite.
 */
export function beachLineText(facts: BeachLineFacts, candidateFacts: CandidateFacts | null = null): string {
  const family = facts.kind === "storm" ? "storm" : facts.periodClass;
  const swell = `the ${facts.direction} ${BEACH_SWELL_NOUN[family]}`;
  const open = facts.exposure === "open";
  const lead = facts.exposure === null ? null : facts.exposure === "shadowed" ? `Sheltered from ${swell}`
    : facts.exposure === "partial" ? `Partly sheltered from ${swell}`
      : `Faces ${swell} ${facts.facing === "angled" ? "at an angle" : DEAD_ON_PHRASE[family]}`;
  const wind = facts.wind === null ? null : facts.wind === "light" ? "with light wind in its window"
    : facts.wind === "breezy" ? `${open ? "but" : "and"} it's breezy in its window`
      : `${open ? "but" : "and"} the wind is up in its window`;
  const size = candidateFacts && sizePhrase(candidateFacts.faceFt, candidateFacts.sizes);
  const feel = size && candidateFacts ? feelPhrase(candidateFacts) : null;
  const timing = windTimingPhrase(candidateFacts?.windHours ?? []);
  const useTiming = timing !== null && (facts.wind === "light" || /onshore by|sea breeze/.test(timing));
  const surf = [size, feel].filter(Boolean).join(" and ");
  const windPhrase = useTiming ? timing : wind;
  if (lead === null) {
    const noLeadWind = useTiming ? timing : facts.wind === null ? null : facts.wind === "light"
      ? "with light wind in its window" : facts.wind === "breezy" ? "with breezy wind in its window" : "with the wind up in its window";
    const body = surf || noLeadWind;
    if (!body) return "";
    const sentence = `${body.charAt(0).toUpperCase()}${body.slice(1)}${surf && noLeadWind ? `, ${noLeadWind}` : ""}.`;
    return sentence;
  }
  return `${lead}${facts.exposure === "shadowed" ? "" : surf ? `: ${surf}` : ""}${windPhrase ? `, ${windPhrase}` : ""}.`;
}

/**
 * A listed beach's line for an event and the gate pinning every fact it names; the one derivation the
 * Week Scout input and the card share. The date defaults to the peak day. A missing exposure still
 * produces a size or wind line with no exposure lead. The key's "-s" pins the kind.
 */
export function beachLine(event: RegionalSwellEvent, beachId: string, context: RegionGateContext,
  localDate: string = eventLocalDate(event.peakAt, event.timezone)): { text: string; gate: BeachGate; facts: CandidateFacts | null } | null {
  const key = storyEventKey(event);
  const exposure = context.exposure(key, beachId);
  const facing = context.facing(key, beachId);
  const wind = context.wind(key, beachId, localDate);
  const facts = context.beachDayFacts(key, beachId, localDate);
  if ((exposure === "open") !== (facing !== null)) return null;
  const gate: BeachGate = { kind: "beach", localDate, regionalEventKey: key, beachId, directionIndex: directionIndex(event.directionDeg),
    periodClass: periodClass(event.periodS), exposure, facing, wind };
  const text = beachLineText({ direction: directionWords(event.directionDeg), kind: event.kind, periodClass: gate.periodClass, exposure, facing, wind }, facts);
  return text ? { text, gate, facts } : null;
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
    const story = eventStory(event, today, context.eventFacts(key));
    add(facts, `event-${key}-story`, `event:${key}:story`, story.text, story.gate, context.eventFacts(key));
  }
  for (const key of keys) {
    const event = events.find((item) => storyEventKey(item) === key)!;
    const listing = rated.get(event.regionalKey);
    const listed = listing ? [listing.here, ...listing.working, ...listing.notWorking] : [];
    // The gate's values are the ones the region build proves at serve time; the rating only picks the beaches.
    const lines = [...new Set(listed.flatMap((rating) => (rating ? [rating.beachId] : [])))]
      .flatMap((beachId) => beachLine(event, beachId, context) ?? []).slice(0, MAX_BEACH_LINES);
    for (const { text, gate, facts: beachFacts } of lines) {
      add(facts, `event-${key}-beach-${gate.beachId}`, `event:${key}:beach:${gate.beachId}`, text, gate, beachFacts);
    }
  }
  return facts.map((fact) => ({ ...fact, rank: 0 }));
}

/**
 * The swell chapter's phases from the day words it names, each word once, as in eventStoryText: "arrives
 * Thursday and peaks Friday before easing Saturday", "arrives and peaks next week", "comes and goes Thursday".
 * Words, not dates, decide: two days past the window both read "next week", so a fade there goes unsaid.
 */
export function swellChapterPhases(arrival: string, peak: string, fade: string | null, arrivalPast = false): string {
  const easing = fade !== null && fade !== peak ? ` before easing ${fade}` : "";
  if (arrivalPast) return `is already in the water and peaks ${peak}${easing}`;
  if (arrival !== peak) return `arrives ${arrival} and peaks ${peak}${easing}`;
  return fade === peak ? `comes and goes ${peak}` : `arrives and peaks ${peak}${easing}`;
}

/** Candidate order is the fallback rank; every claim has a live gate. */
export function buildStoryCandidates(days: readonly RegionalDaySignal[], region = "the coast", events: readonly RegionalSwellEvent[] = [],
  factsFor: (event: RegionalSwellEvent) => CandidateFacts | null = () => null): StoryCandidate[] {
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
    const eventFacts = factsFor(event);
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
      arrivalDate, peakDate }, region, firstDate, lastDate, { ...gate, fadeLocalDate: null }, "", eventFacts);
    const chapter = swellChapterPhases(arrival, peakDay, fadeDate ? windowDay(fadeDate, firstDate, lastDate) : null,
      arrivalDate < firstDate);
    add(facts, `swell-${key}`, `swell:${key}`, withRegionalSize(`The ${period} ${chapter}.`, eventFacts), gate, eventFacts);
    if (namedDays) add(facts, `swell-${key}-alt`, `swell:${key}`, withRegionalSize(`${peakDay} is the peak of this ${direction} pulse.`, eventFacts), gate, eventFacts);
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
    const fadeDay = fadeDate && fadeDate > peakDate ? windowDay(fadeDate, firstDate, lastDate) : null;
    if (fadeDay && fadeDay !== peakDay) {
      add(facts, `turn-fade-${key}`, "story:turn", `After ${peakDay}, the ${direction} swell eases into ${fadeDay}.`, gate, eventFacts);
      add(facts, `turn-fade-alt-${key}`, "story:turn", `The ${direction} swell peaks ${peakDay} before fading toward ${fadeDay}.`, gate, eventFacts);
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
    for (const [beachIndex, beach] of (current.surfBeaches ?? []).entries()) {
      const { facts: surf } = beach;
      if (!surf.faceFt || !beach.beachName || DIGIT.test(beach.beachName)) continue;
      const size = sizePhrase(surf.faceFt, surf.sizes);
      const feel = size ? feelPhrase(surf) : null;
      const wind = windTimingPhrase(surf.windHours ?? []);
      const description = [size, feel].filter(Boolean).join(" and ");
      const id = `surf-${current.localDate}-${beach.beachId}`;
      add(facts, id, `day:${current.localDate}`,
        `On ${day}, ${beach.beachName} runs${description ? ` ${description}` : ""}${wind ? `, ${wind}` : ""}.`,
        { kind: "day_surf", localDate: current.localDate, beachId: beach.beachId, faceFt: surf.faceFt }, surf);
      const added = facts[facts.length - 1];
      if (added?.id === id) added.rank = 50 + beachIndex;
    }
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
    if (fact.slot.startsWith("day:") && fact.gate.kind !== "day_surf") fact.rank = fact.gate.kind === "change" ? 100 + (fact.rank ?? 0)
      : fact.gate.kind === "tide" ? 200 + (fact.rank ?? 0) : 300 + (fact.rank ?? 0);
  }
  return facts;
}
