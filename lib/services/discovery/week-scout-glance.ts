import type { InternalRegionEvent, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { isEventCurrent, localDayDiff } from "@/lib/alerts/swell-events/regional-rating";
import { groupGlanceEvents, onGlanceStrip, type GlanceGroup } from "./week-scout-glance-groups";
import { COMPASS, directionIndex, sizePhrase, storyEventsFromRegion, WEEKDAY, type RegionalSwellEvent } from "./week-scout-story-candidates";
import { eventFactsFromBuild, type CandidateFacts } from "./week-scout-story-facts";
import { getLocalDateStr } from "./window-selector/time-slot-utils";

export type GlanceRole = "today" | "next" | "long_range";
export interface GlanceSentence { role: GlanceRole; text: string; fingerprint: string; facts: CandidateFacts | null; eventKeys: string[] }
export const MAX_GLANCE_SENTENCES = 6;
export const MAX_NEXT_GROUPS = 4;

const FINGERPRINT_VERSION = "glance-1";
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

function fingerprint(role: GlanceRole, groups: readonly GlanceGroup[], fresh: boolean): string {
  return JSON.stringify([FINGERPRINT_VERSION, role, ...groups.map((group, index) =>
    [group.label, group.noun, group.arrivalDate, group.peakDate, group.fadeDate, group.confidence, index === 0 && fresh])]);
}

function laterFade(groups: readonly GlanceGroup[]): string | null {
  const fades = groups.flatMap((group) => group.fadeDate ? [group.fadeDate] : []);
  return fades.length > 0 ? fades.reduce((late, fade) => fade > late ? fade : late) : null;
}

function nextArrival(group: GlanceGroup, today: string): string {
  const peak = glanceDay(group.peakDate, today);
  return group.arrivalDate === group.peakDate ? `arrives and peaks ${peak}` : `arrives ${glanceDay(group.arrivalDate, today)} and peaks ${peak}`;
}

function nextText(groups: readonly GlanceGroup[], first: string, today: string): string {
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
  const opening = `${capitalise(first)} ${nextArrival(lead, today)}`;
  if (!follow) return `${opening}${withSize(size)}.`;
  const then = `then ${nounPhrase(follow)} follows ${glanceDay(follow.peakDate, today)}`;
  if (size && size === groupSize(follow)) return `${opening}, ${then}, both ${size}.`;
  // Only the lead's size: the sentence's facts are the lead's, so a second size would fail the claim check.
  return `${opening}${withSize(size)}, ${then}.`;
}

function todayText(groups: readonly GlanceGroup[], first: string, today: string): string {
  const fade = laterFade(groups);
  // A fade on the peak day goes unsaid, or a swell would peak and ease the same day.
  const latestPeak = groups.reduce((late, group) => group.peakDate > late ? group.peakDate : late, today);
  const ease = fade && fade > latestPeak ? `, easing by ${glanceDay(fade, today)}` : "";
  const [lead, follow] = groups;
  const size = groupSize(lead);
  if (follow) return `${capitalise(first)} and ${nounPhrase(follow)} both peak today${withSize(size)}${ease}.`;
  const predicate = lead.peakDate === today ? "peaks today"
    : lead.peakDate > today ? `is already in the water and peaks ${glanceDay(lead.peakDate, today)}` : "is still in the water";
  return `${capitalise(first)} ${predicate}${withSize(size)}${ease}.`;
}

function pairsToday(a: GlanceGroup, b: GlanceGroup, today: string): boolean {
  return a.peakDate === today && b.peakDate === today && groupSize(a) === groupSize(b);
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
      fingerprint: fingerprint(role, groups, fresh),
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
    const pair = todayGroups[index + 1] && pairsToday(group, todayGroups[index + 1], today) ? [group, todayGroups[index + 1]] : [group];
    write("today", pair, (first) => todayText(pair, first, today));
    index += pair.length - 1;
  }

  const nextGroups = groupGlanceEvents(onStrip.filter((event) => localDate(event.arrivalAt, timezone) > today), timezone, factsFor);
  const named = nextGroups.slice(0, MAX_NEXT_GROUPS);
  let written = 0;
  for (let index = 0; index < named.length && sentences.length < MAX_GLANCE_SENTENCES; index += 1) {
    const group = named[index];
    const pair = named[index + 1] && pairsNext(group, named[index + 1]) ? [group, named[index + 1]] : [group];
    write("next", pair, (first) => nextText(pair, first, today));
    index += pair.length - 1;
    written += pair.length;
  }

  if (written < nextGroups.length || sentences.length >= MAX_GLANCE_SENTENCES) return sentences;
  const after = named.at(-1)?.peakDate ?? today;
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
    stored: storyEventsFromRegion(build, today).all,
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
