import type { InternalRegionEvent, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { hasHoursLeftToRate, isEventCurrent, localDayDiff } from "@/lib/alerts/swell-events/regional-rating";
import { partOfDay, type PartOfDay } from "./swell-tracking";
import { groupGlanceEvents, onGlanceStrip, type GlanceGroup } from "./week-scout-glance-groups";
import { COMPASS, directionIndex, sizePhrase, storyEventsFromRegion, WEEKDAY, type RegionalSwellEvent } from "./week-scout-story-candidates";
import { eventFactsFromBuild, type CandidateFacts } from "./week-scout-story-facts";
import { getLocalDateStr, getLocalHour } from "./window-selector/time-slot-utils";

export type GlanceRole = "today" | "next" | "long_range";
export interface GlanceSentence { role: GlanceRole; text: string; fingerprint: string; facts: CandidateFacts | null; eventKeys: string[] }
export const MAX_GLANCE_SENTENCES = 6;
export const MAX_NEXT_GROUPS = 4;

// v2: locked swells carry a part of the day, and today's swells say whether they have peaked.
const FINGERPRINT_VERSION = "glance-2";
const NOTHING_TODAY = "No clear swell in the water today.";

type TailEvent = Pick<InternalRegionEvent, "key" | "directionDeg" | "arrivalAt" | "peakAt" | "fadeAt">;

/** A day from the region's today: "today", "tomorrow", the weekday, "a week from …", then "the week after next". */
export function glanceDay(date: string, today: string): string {
  const lead = localDayDiff(today, date);
  if (lead === 0) return "today";
  if (lead === 1) return "tomorrow";
  if (lead === 7) return "a week from today";
  if (lead >= 14) return "the week after next";
  const weekday = WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
  return lead >= 8 ? `a week from ${weekday}` : weekday;
}

function localDate(at: string, timezone: string): string {
  return getLocalDateStr(new Date(at), timezone);
}

function partAt(at: string, timezone: string): PartOfDay | null {
  const hour = getLocalHour(new Date(at), timezone);
  return hour === null ? null : partOfDay(hour % 24);
}

/**
 * A day and part of the day, worded as the Swell Watch card's whenPhrase words a peak ("this afternoon",
 * "early tomorrow morning", "Sunday evening", "last night"). Past a week, or with no hour, the day alone.
 */
export function glanceWhen(at: string, today: string, timezone: string): string {
  const date = localDate(at, timezone);
  const lead = localDayDiff(today, date);
  const part = partAt(at, timezone);
  if (!part || lead < -1 || lead > 6) return glanceDay(date, today);
  if (lead === 0) {
    if (part === "early") return "early this morning";
    if (part === "night") return "tonight";
    return part === "midday" ? "midday today" : `this ${part}`;
  }
  if (lead === -1 && part === "night") return "last night";
  const day = lead === -1 ? "yesterday" : glanceDay(date, today);
  if (part === "early") return `early ${day} morning`;
  // The card's boundaries, but "midday Saturday" reads better than its "Saturday midday".
  return part === "midday" ? `midday ${day}` : `${day} ${part}`;
}

const LATER_THAT_DAY: Record<PartOfDay, string> = {
  early: "early that morning", morning: "that morning", midday: "around midday", afternoon: "that afternoon",
  evening: "that evening", night: "that night",
};

/** The peak after an arrival: "that afternoon" on the arrival's own day, so the day is said once. */
function peakAfter(arrivalAt: string, peakAt: string, today: string, timezone: string): string {
  const peak = glanceWhen(peakAt, today, timezone);
  const part = partAt(peakAt, timezone);
  const lead = localDayDiff(today, localDate(peakAt, timezone));
  if (!part || localDate(arrivalAt, timezone) !== localDate(peakAt, timezone) || lead < 1 || lead > 6) return peak;
  return LATER_THAT_DAY[part];
}

interface GlanceClock { today: string; timezone: string; now: Date }

/** A locked swell's time with its part of the day; a forecast further out keeps the day alone. */
function groupWhen(group: GlanceGroup, at: string, clock: GlanceClock): string {
  return group.confidence === "locked" ? glanceWhen(at, clock.today, clock.timezone) : glanceDay(localDate(at, clock.timezone), clock.today);
}

function hasPeaked(group: GlanceGroup, now: Date): boolean {
  return group.events.every((event) => Date.parse(event.peakAt) <= now.getTime());
}

/** The latest member peak once all have passed, else the earliest still ahead. */
function todayPeakAt(group: GlanceGroup, now: Date): string {
  const peaks = group.events.map((event) => event.peakAt).sort((a, b) => Date.parse(a) - Date.parse(b));
  return hasPeaked(group, now) ? peaks[peaks.length - 1] : peaks.find((peak) => Date.parse(peak) > now.getTime()) ?? peaks[0];
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function withArticle(phrase: string): string {
  return `${/^[aeiou]/i.test(phrase) ? "an" : "a"} ${phrase}`;
}

function sizeClause(facts: CandidateFacts | null, standouts: boolean): string | null {
  if (!facts) return null;
  const most = sizePhrase(facts.faceFt, facts.sizes);
  if (!most) return null;
  const standout = standouts ? sizePhrase(facts.standoutFt ?? null, facts.standoutSizes ?? []) : null;
  return standout && standout !== most ? `${most} at most spots and ${standout} at the standouts` : `${most} at most spots`;
}

function groupSize(group: GlanceGroup): string | null {
  return sizeClause(group.facts, group.confidence !== "on_the_radar");
}

function withSize(size: string | null): string {
  return size ? `, ${size}` : "";
}

function nounPhrase(group: GlanceGroup, adjective: "fresh" | "bigger" | null = null): string {
  return withArticle(`${adjective ? `${adjective} ` : ""}${group.label} ${group.noun}`);
}

/** The time words a group's sentence can say: whether today's swell has peaked and when, or a next one's arrival and peak. */
function timing(role: GlanceRole, group: GlanceGroup, clock: GlanceClock): Array<string | boolean> {
  if (role === "today") return [hasPeaked(group, clock.now), groupWhen(group, todayPeakAt(group, clock.now), clock)];
  return [groupWhen(group, group.arrivalAt, clock), groupWhen(group, group.peakAt, clock)];
}

function fingerprint(role: GlanceRole, groups: readonly GlanceGroup[], fresh: boolean, clock: GlanceClock): string {
  return JSON.stringify([FINGERPRINT_VERSION, role, ...groups.map((group, index) =>
    [group.label, group.noun, group.arrivalDate, group.peakDate, group.fadeDate, group.confidence, index === 0 && fresh,
      ...timing(role, group, clock)])]);
}

function laterFade(groups: readonly GlanceGroup[]): string | null {
  const fades = groups.flatMap((group) => group.fadeDate ? [group.fadeDate] : []);
  return fades.length > 0 ? fades.reduce((late, fade) => fade > late ? fade : late) : null;
}

/** A locked swell's arrival and peak: "arrives tomorrow morning and peaks Sunday morning", each time said once. */
function nextArrival(group: GlanceGroup, clock: GlanceClock): string {
  const arrival = glanceWhen(group.arrivalAt, clock.today, clock.timezone);
  const peak = glanceWhen(group.peakAt, clock.today, clock.timezone);
  if (arrival === peak) return `arrives and peaks ${peak}`;
  return `arrives ${arrival} and peaks ${peakAfter(group.arrivalAt, group.peakAt, clock.today, clock.timezone)}`;
}

function nextText(groups: readonly GlanceGroup[], first: string, clock: GlanceClock): string {
  const { today } = clock;
  const [lead, follow] = groups;
  const peak = capitalise(glanceDay(lead.peakDate, today));
  const size = groupSize(lead);
  if (lead.confidence === "likely") {
    return follow ? `${peak} looks likely to bring ${first} with ${nounPhrase(follow)} behind it${withSize(size)}.`
      : `${peak} looks likely to bring ${first}${withSize(size)}.`;
  }
  if (lead.confidence === "on_the_radar") {
    return follow ? `${peak} brings an early look at ${first} with ${nounPhrase(follow)} behind it${withSize(size)}.`
      : `${peak} brings an early look at ${first}${withSize(size)}.`;
  }
  const opening = `${capitalise(first)} ${nextArrival(lead, clock)}`;
  if (!follow) return `${opening}${withSize(size)}.`;
  const then = `then ${nounPhrase(follow)} follows ${groupWhen(follow, follow.peakAt, clock)}`;
  if (size && size === groupSize(follow)) return `${opening}, ${then}, both ${size}.`;
  // Only the lead's size: the sentence's facts are the lead's, so a second size would fail the claim check.
  return `${opening}${withSize(size)}, ${then}.`;
}

/** Every member's local peak date: `peakDate` is the anchor's alone, and a bigger member may peak later. */
function memberPeakDates(group: GlanceGroup, timezone: string): string[] {
  return group.events.map((event) => localDate(event.peakAt, timezone));
}

/** "peaked this morning", "peaks this afternoon", or a later peak while it is already in the water. */
function todayPredicate(group: GlanceGroup, clock: GlanceClock): string {
  const at = todayPeakAt(group, clock.now);
  const when = groupWhen(group, at, clock);
  if (hasPeaked(group, clock.now)) return `peaked ${when}`;
  if (localDate(at, clock.timezone) === clock.today) return `peaks ${when}`;
  // The peak is a forecast like any next swell's, so it takes the group's certainty words.
  const day = glanceDay(localDate(at, clock.timezone), clock.today);
  if (group.confidence === "likely") return `is already in the water and looks likely to peak ${day}`;
  if (group.confidence === "on_the_radar") return `is already in the water, with an early look at a peak ${day}`;
  return `is already in the water and peaks ${when}`;
}

function todayText(groups: readonly GlanceGroup[], first: string, clock: GlanceClock): string {
  const { today, timezone, now } = clock;
  const fade = laterFade(groups);
  // A fade on the peak day, or today, goes unsaid: a swell never peaks and eases by the same day.
  const latestPeak = groups.flatMap((group) => memberPeakDates(group, timezone))
    .reduce((late, peak) => peak > late ? peak : late, today);
  const ease = fade && fade > latestPeak ? `, easing by ${glanceDay(fade, today)}` : "";
  const [lead, follow] = groups;
  const size = groupSize(lead);
  const peaked = hasPeaked(lead, now);
  // With no fade day to name, a peaked swell says it is easing.
  const easing = (verb: string): string => peaked && !ease ? ` and ${verb} easing${withSize(size)}.` : `${withSize(size)}${ease}.`;
  if (!follow) return `${capitalise(first)} ${todayPredicate(lead, clock)}${easing("is")}`;
  const leadWhen = groupWhen(lead, todayPeakAt(lead, now), clock);
  const when = leadWhen === groupWhen(follow, todayPeakAt(follow, now), clock) ? leadWhen : peaked ? "earlier today" : "today";
  return `${capitalise(first)} and ${nounPhrase(follow)} both ${peaked ? "peaked" : "peak"} ${when}${easing("are")}`;
}

function peaksToday(group: GlanceGroup, clock: GlanceClock): boolean {
  return localDate(todayPeakAt(group, clock.now), clock.timezone) === clock.today;
}

function pairsToday(a: GlanceGroup, b: GlanceGroup, clock: GlanceClock): boolean {
  return peaksToday(a, clock) && peaksToday(b, clock) && hasPeaked(a, clock.now) === hasPeaked(b, clock.now)
    && groupSize(a) === groupSize(b);
}

function pairsNext(a: GlanceGroup, b: GlanceGroup): boolean {
  return Math.abs(localDayDiff(a.peakDate, b.peakDate)) <= 1 && a.confidence === b.confidence;
}

export function buildGlance(args: {
  stored: readonly RegionalSwellEvent[];
  /** In peak order, as `build.events` is: the first qualifying event is the earliest. */
  tail: readonly TailEvent[];
  timezone: string; today: string; todayCovered: boolean;
  /** Swells gone by now are left out, as the Swell Watch drops them. */
  now: Date;
  factsFor: (event: RegionalSwellEvent) => CandidateFacts | null;
}): GlanceSentence[] {
  const { stored: allStored, tail: allTail, timezone, today, todayCovered, now, factsFor } = args;
  const clock: GlanceClock = { today, timezone, now };
  const stored = allStored.filter((event) => isEventCurrent(event, now));
  const tail = allTail.filter((event) => isEventCurrent(event, now));
  const sentences: GlanceSentence[] = [];
  const namedLabels = new Set<string>();
  let namedMax: number | null = null;

  // "fresh" and "bigger" read only groups named in earlier sentences, so a sentence's own second group never counts.
  const write = (role: GlanceRole, groups: readonly GlanceGroup[], text: (first: string) => string): void => {
    const [lead] = groups;
    const fresh = namedLabels.has(lead.label);
    const max = lead.facts?.faceFt?.max ?? null;
    const bigger = max !== null && namedMax !== null && max > namedMax;
    sentences.push({
      role,
      text: text(nounPhrase(lead, bigger ? "bigger" : fresh ? "fresh" : null)),
      // The rule, not the rendered word: "bigger" winning over "fresh" depends on size, which the fingerprint leaves out.
      fingerprint: fingerprint(role, groups, fresh, clock),
      facts: lead.facts,
      eventKeys: groups.flatMap((group) => group.events.map((event) => event.regionalKey)),
    });
    for (const group of groups) {
      namedLabels.add(group.label);
      const groupMax = group.facts?.faceFt?.max;
      if (groupMax !== undefined && (namedMax === null || groupMax > namedMax)) namedMax = groupMax;
    }
  };

  const onStrip = stored.filter((event) => onGlanceStrip(event, today, timezone));
  const todayGroups = groupGlanceEvents(onStrip.filter((event) => localDate(event.arrivalAt, timezone) <= today), timezone, factsFor);
  if (todayGroups.length === 0 && todayCovered) {
    sentences.push({ role: "today", text: NOTHING_TODAY, fingerprint: JSON.stringify([FINGERPRINT_VERSION, "today"]), facts: null, eventKeys: [] });
  }
  for (let index = 0; index < todayGroups.length && sentences.length < MAX_GLANCE_SENTENCES; index += 1) {
    const group = todayGroups[index];
    const pair = todayGroups[index + 1] && pairsToday(group, todayGroups[index + 1], clock) ? [group, todayGroups[index + 1]] : [group];
    write("today", pair, (first) => todayText(pair, first, clock));
    index += pair.length - 1;
  }

  const nextGroups = groupGlanceEvents(onStrip.filter((event) => localDate(event.arrivalAt, timezone) > today), timezone, factsFor);
  const named = nextGroups.slice(0, MAX_NEXT_GROUPS);
  let written = 0;
  for (let index = 0; index < named.length && sentences.length < MAX_GLANCE_SENTENCES; index += 1) {
    const group = named[index];
    const pair = named[index + 1] && pairsNext(group, named[index + 1]) ? [group, named[index + 1]] : [group];
    write("next", pair, (first) => nextText(pair, first, clock));
    index += pair.length - 1;
    written += pair.length;
  }

  if (written < nextGroups.length || sentences.length >= MAX_GLANCE_SENTENCES) return sentences;
  // After every swell named so far, today's included: a today group can peak later than any next one.
  const after = [...todayGroups, ...named].flatMap((group) => memberPeakDates(group, timezone))
    .reduce((late, peak) => peak > late ? peak : late, today);
  const far = tail.find((event) => event.directionDeg !== null && onGlanceStrip(event, today, timezone)
    && localDate(event.peakAt, timezone) > after);
  if (!far || far.directionDeg === null) return sentences;
  const label = COMPASS[directionIndex(far.directionDeg)];
  const peakDate = localDate(far.peakAt, timezone);
  sentences.push({
    role: "long_range",
    text: `Further out, ${withArticle(`${label} swell`)} is on the radar for ${glanceDay(peakDate, today)}, too early to call.`,
    fingerprint: JSON.stringify([FINGERPRINT_VERSION, "long_range", label, peakDate]),
    facts: null,
    eventKeys: [far.key],
  });
  return sentences;
}

/** The glance from a region build: its stored forecast events, its early-look tail, and each event's facts from its rows. */
export function glanceFromBuild(build: RegionBuild, today: string, todayCovered: boolean, now: Date): GlanceSentence[] {
  // Grouping sorts on facts, so each event's facts are read from the build's rows once.
  const facts = new Map<RegionalSwellEvent, CandidateFacts | null>();
  return buildGlance({
    // A swell past its peak that no beach can still rate is off the Swell Watch, so the glance never names it.
    stored: storyEventsFromRegion(build, today).all.filter((event) => hasHoursLeftToRate(build, event, now)),
    tail: build.events.filter((event) => event.source === "wam"),
    timezone: build.timezone,
    today,
    todayCovered,
    now,
    factsFor: (event) => {
      if (!facts.has(event)) facts.set(event, eventFactsFromBuild(build, event));
      return facts.get(event) ?? null;
    },
  });
}
