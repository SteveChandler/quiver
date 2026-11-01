import type { SupabaseClient } from "@supabase/supabase-js";

import type { SkillLevel } from "@/lib/domains/user-preferences";
import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";
import { beachRowsByLocalDate, breakerCharacter, type FaceRange } from "@/lib/services/discovery/week-scout-story-facts";
import { localDate } from "@/lib/services/discovery/swell-briefing-input";
import {
  beachLine,
  eventStoryText,
  storyEventKey,
  storyEventsFromRegion,
  type RegionalSwellEvent,
} from "@/lib/services/discovery/week-scout-story-candidates";
import { checkWrittenSentence } from "@/lib/services/discovery/week-scout-story-claims";
import { buildRegionGateContext, regionGateHolds, windBucket, type RegionGateContext } from "@/lib/services/discovery/week-scout-story-region-gate";
import { STORY_SAMPLE_VERSION } from "@/lib/services/discovery/week-scout-story-source";
import { loadLatestStoryEdition, loadStoryInput } from "@/lib/services/discovery/week-scout-story-store";
import type { StoryArtifact, StoryGate, StoryInput } from "@/lib/services/discovery/week-scout-story-types";
import type { Database } from "@/types/database";
import type { RegionBeachRating, RegionSwellEvent, RegionWatchBeach } from "@/types/region-swell-events";

import type { RegionBuild } from "./regional";
import { exposureFactor, exposureLabel, swellWindowForBeach } from "./exposure";
import { BLOWN_OUT, getRatedBeachRatings, isWorking, rateEventBeaches, ratingWindow } from "./regional-rating";

type Client = SupabaseClient<Database>;

export interface NarrativeEdition {
  input: StoryInput;
  artifact: StoryArtifact;
}

/** Only this generation carries the PC's written sentences. */
const WRITTEN_GENERATION_VERSION = "week-scout-story-2";
/** Story inputs are content-addressed by hash, so a loaded one never goes stale; keep the most recent few. */
const MAX_CACHED_INPUTS = 16;
const storyInputs = new Map<string, Promise<StoryInput | null>>();

/** The story input for a hash, read once per process while it stays among the most recently used. Misses and failures aren't kept. */
function cachedStoryInput(client: Client, hash: string): Promise<StoryInput | null> {
  const cached = storyInputs.get(hash);
  if (cached) {
    storyInputs.delete(hash);
    storyInputs.set(hash, cached);
    return cached;
  }
  const input = loadStoryInput(client, hash).then((loaded) => {
    if (!loaded) storyInputs.delete(hash);
    return loaded;
  }, (error: unknown) => {
    storyInputs.delete(hash);
    throw error;
  });
  if (storyInputs.size >= MAX_CACHED_INPUTS) storyInputs.delete(storyInputs.keys().next().value!);
  storyInputs.set(hash, input);
  return input;
}

/** The region's edition for its own today, still valid and already published: prepareStory's conditions, -2 only. */
function isCurrentEdition(artifact: StoryArtifact, timezone: string, now: Date): boolean {
  return artifact.schemaVersion === 3
    && artifact.generationVersion === WRITTEN_GENERATION_VERSION
    && artifact.editionDate === localDate(now, timezone)
    && Date.parse(artifact.validUntil) >= now.getTime()
    && Date.parse(artifact.sourcePublishedAt) <= now.getTime();
}

function editionServes({ artifact, input }: NarrativeEdition, build: RegionBuild, now: Date): boolean {
  return isCurrentEdition(artifact, build.timezone, now)
    && artifact.region === build.region
    && input.inputHash === artifact.inputHash
    && input.provenance.generationInputVersion === STORY_SAMPLE_VERSION
    && input.provenance.fixture !== true;
}

/**
 * The region's latest story edition and its input, when the edition is today's and carries written
 * sentences; otherwise null. A failed read is logged and costs only the written text: the card then
 * shows its server lines.
 */
export async function loadRegionNarrativeEdition(args: { client: Client; region: string; timezone: string; now: Date }): Promise<NarrativeEdition | null> {
  const { client, region, timezone, now } = args;
  try {
    const artifact = await loadLatestStoryEdition(client, region);
    if (!artifact || !isCurrentEdition(artifact, timezone, now)) return null;
    const input = await cachedStoryInput(client, artifact.inputHash);
    return input ? { input, artifact } : null;
  } catch (error) {
    console.warn("[swell-events] story edition read failed", { region, error: String(error) });
    return null;
  }
}

type WrittenLine = (slot: string, accepts?: (gate: StoryGate) => boolean) => string | null;

/**
 * The edition's written sentence for a card slot, or null: served only when the edition selected that
 * slot's candidate, the caller accepts the candidate's gate, the sentence claims nothing the candidate
 * doesn't, and the gate holds against this request's build.
 */
function writtenLines({ input, artifact }: NarrativeEdition, region: string, context: RegionGateContext): WrittenLine {
  if (!Array.isArray(input.copyFacts)) {
    throw new Error("story_candidate_text_invalid");
  }
  const selected = new Set(artifact.briefing.selections);
  const facts = new Map(input.copyFacts.map((fact) => [fact.id, fact]));
  const bySlot = new Map((artifact.briefing.written ?? []).map((entry) => [entry.slot, entry]));
  const beachNames = input.beachNames ? Object.values(input.beachNames) : null;
  return (slot, accepts) => {
    const entry = bySlot.get(slot);
    const fact = entry && selected.has(entry.basedOn) ? facts.get(entry.basedOn) : undefined;
    if (!entry || !fact || fact.slot !== slot || !beachNames) return null;
    if (accepts && !accepts(fact.gate)) return null;
    if (typeof fact.text !== "string") throw new Error("story_candidate_text_invalid");
    const gate = fact.gate;
    const currentFacts = gate.kind === "swell" ? context.eventFacts(gate.regionalEventKey)
      : gate.kind === "beach" ? context.beachDayFacts(gate.regionalEventKey, gate.beachId, gate.localDate) : null;
    const current = { ...fact, facts: currentFacts ?? undefined };
    if (!checkWrittenSentence(fact.text, current, beachNames, [region]).ok
      || !checkWrittenSentence(entry.text, current, beachNames, [region]).ok) return null;
    return regionGateHolds(fact.gate, context) === true ? entry.text : null;
  };
}

/** The rated event with no story and no beach lines: an early look, or any event when the narrative can't be built. */
export function withoutNarrative(event: RegionSwellEvent): RegionSwellEvent {
  const silent = (rating: RegionBeachRating): RegionBeachRating => ({ ...rating, why: null });
  return {
    ...event,
    story: null,
    breaker: event.source === "wam" ? null : breakerCharacter(event.kind, event.periodS),
    here: event.here ? silent(event.here) : null,
    working: event.working.map(silent),
    notWorking: event.notWorking.map(silent),
  };
}

interface EventNarration {
  context: RegionGateContext;
  written: WrittenLine;
}

/** Share memoized facts and one edition warning across card and watch slots. */
function prepareNarration(build: RegionBuild, edition: NarrativeEdition | null, now: Date): {
  all: RegionalSwellEvent[];
  forEvent: (event: RegionalSwellEvent) => EventNarration;
} {
  const today = localDate(now, build.timezone);
  const { all } = storyEventsFromRegion(build, today);
  const context = buildRegionGateContext(build, today);
  // The gate context answers for the first event under a story key, so only that one can take a written sentence.
  const firstUnderKey = new Map<string, string>();
  for (const event of all) {
    const key = storyEventKey(event);
    if (!firstUnderKey.has(key)) firstUnderKey.set(key, event.regionalKey);
  }
  // A malformed stored edition costs only its written text: the card never fails because of the narrative.
  let warned = false;
  const unusable = (error: unknown): null => {
    if (!warned) console.warn("[swell-events] story edition unusable", { region: build.region, error: String(error) });
    warned = true;
    return null;
  };
  let written: WrittenLine | null = null;
  try {
    written = edition && editionServes(edition, build, now) ? writtenLines(edition, build.region, context) : null;
  } catch (error) {
    unusable(error);
  }
  const writtenFor: WrittenLine = (slot, accepts) => {
    try {
      return written?.(slot, accepts) ?? null;
    } catch (error) {
      return unusable(error);
    }
  };

  return { all, forEvent: (event) => {
    const first = firstUnderKey.get(storyEventKey(event)) === event.regionalKey;
    return {
      context: first ? context : buildRegionGateContext({ ...build, events: build.events.filter((item) => item.key === event.regionalKey) }, today),
      written: first ? writtenFor : () => null,
    };
  } };
}

function beachDayLine(
  event: RegionalSwellEvent,
  beachId: string,
  date: string,
  { context, written }: EventNarration,
  key: string,
  wind = context.wind(key, beachId, date),
  blownOut = false,
): string | null {
  const server = beachLine(event, beachId, {
    ...context,
    wind: () => blownOut ? "windy" : wind,
    beachDayFacts: (key, id, localDate) => {
      const facts = context.beachDayFacts(key, id, localDate);
      return facts && blownOut ? { ...facts, windHours: [] } : facts;
    },
  }, date, key);
  if (!server) return null;
  const peakDate = getLocalDateStr(new Date(event.peakAt), event.timezone);
  const accepts = (gate: StoryGate): boolean => gate.kind === "beach" && gate.localDate === date && gate.wind === wind;
  const why = date === peakDate && !blownOut ? written(`event:${key}:beach:${beachId}`, accepts) : null;
  return why ?? server.text;
}

function faceText(range: FaceRange | null): string | null {
  if (!range) return null;
  return range.min === range.max ? `${range.min} ft` : `${range.min}-${range.max} ft`;
}

function watchStanding(build: RegionBuild, directionDeg: number | null, beachIds: readonly string[]): RegionWatchBeach[] {
  const beaches = new Map(build.beaches.map((beach) => [beach.id, beach]));
  return [...new Set(beachIds)].flatMap((id) => {
    const beach = beaches.get(id);
    if (!beach) return [];
    const factor = directionDeg === null ? null : exposureFactor(directionDeg, swellWindowForBeach(beach));
    return [{ beachId: id, beachName: beach.name, exposure: factor === null ? null : exposureLabel(factor), reason: null, days: [] }];
  });
}

interface WatchInput {
  build: RegionBuild;
  event: RegionalSwellEvent;
  rated: Map<string, RegionBeachRating>;
  beachIds: readonly string[];
  edition: NarrativeEdition | null;
  now: Date;
}

function watchWithNarration({ build, event, rated, beachIds, now }: WatchInput, narration: EventNarration): RegionWatchBeach[] {
  const key = storyEventKey(event);
  const today = localDate(now, build.timezone);
  const { startMs, endMs } = ratingWindow(event);
  return watchStanding(build, event.directionDeg, beachIds).map((beach) => {
    const rating = rated.get(beach.beachId);
    const working = rating && isWorking(rating.label);
    const dates = [...beachRowsByLocalDate(build, beach.beachId)].flatMap(([date, rows]) => {
      if (date < today || !rows.some((row) => {
        const at = Date.parse(row.forecast_at);
        return at >= startMs && at < endMs;
      })) return [];
      return [date];
    }).sort();
    const ratingDate = getLocalDateStr(new Date(rating?.windowStartAt ?? event.peakAt), build.timezone);
    return { ...beach, reason: working ? null : rating?.reason ?? null, days: dates.map((date) => {
      const facts = narration.context.beachDayFacts(key, beach.beachId, date);
      const blownOut = rating?.reason === BLOWN_OUT && date === ratingDate;
      return { localDate: date, faceFt: faceText(facts?.faceFt ?? null),
        why: beachDayLine(event, beach.beachId, date, narration, key, undefined, blownOut) };
    }) };
  });
}

/** Use this for an individual inspection; the hot route composes all events through watchRegionEvents. */
export function watchBeaches(input: WatchInput): RegionWatchBeach[] {
  return watchWithNarration(input, prepareNarration(input.build, input.edition, input.now).forEvent(input.event));
}

/** Card and requested watch lines share this build's facts and the edition's per-slot checks. */
export function narrateRegionEvents(input: {
  build: RegionBuild;
  rated: RegionSwellEvent[];
  edition: NarrativeEdition | null;
  now: Date;
  beachIds?: readonly string[];
  skill?: SkillLevel;
}): RegionSwellEvent[] {
  const { build, rated, edition, now, beachIds, skill = "intermediate" } = input;
  const today = localDate(now, build.timezone);
  const narration = prepareNarration(build, edition, now);
  const byBuildKey = new Map(narration.all.map((event) => [event.regionalKey, event]));
  const output = rated.map((event) => {
    const internal = build.events.find((item) => item.key === event.key);
    const story = event.source === "forecast" ? byBuildKey.get(event.key) : undefined;
    const breaker = event.source === "wam" ? null : breakerCharacter(event.kind, event.periodS);
    if (!story) return { ...withoutNarrative(event), breaker,
      ...(beachIds === undefined ? {} : { watch: watchStanding(build, internal?.directionDeg ?? null, beachIds) }),
    };
    const own = narration.forEvent(story);
    const key = storyEventKey(story);
    const narrate = (rating: RegionBeachRating): RegionBeachRating => {
      const startMs = rating.windowStartAt ? Date.parse(rating.windowStartAt) : Number.NaN;
      const endMs = rating.windowEndAt ? Date.parse(rating.windowEndAt) : Number.NaN;
      const date = getLocalDateStr(new Date(rating.windowStartAt ?? story.peakAt), build.timezone);
      const wind = Number.isFinite(startMs) && Number.isFinite(endMs)
        ? windBucket(build.rowsByBeach[rating.beachId] ?? [], startMs, endMs)
        : own.context.wind(key, rating.beachId, date);
      return { ...rating, why: beachDayLine(story, rating.beachId, date, own, key, wind, rating.reason === BLOWN_OUT) };
    };
    return {
      ...event,
      breaker,
      story: own.written(`event:${key}:story`) || eventStoryText(story, today, own.context.eventFacts(key)),
      here: event.here ? narrate(event.here) : null,
      working: event.working.map(narrate),
      notWorking: event.notWorking.map(narrate),
    };
  });
  if (beachIds === undefined) return output;
  const watches = collectRegionWatches({ build, rated, edition, now, beachIds, skill }, narration);
  return output.map((event) => ({ ...event, watch: watches.get(event.key) ?? [] }));
}

interface RegionWatchInput {
  build: RegionBuild;
  rated: RegionSwellEvent[];
  edition: NarrativeEdition | null;
  now: Date;
  beachIds: readonly string[];
  skill?: SkillLevel;
}

function collectRegionWatches(input: RegionWatchInput, narration: ReturnType<typeof prepareNarration>): Map<string, RegionWatchBeach[]> {
  const { build, rated, beachIds, edition, now, skill = "intermediate" } = input;
  const ratingsByEvent = getRatedBeachRatings(rated);
  const watches = new Map<string, RegionWatchBeach[]>();
  for (const event of rated) {
    const internal = build.events.find((item) => item.key === event.key);
    const story = event.source === "forecast" ? narration.all.find((item) => item.regionalKey === event.key) : undefined;
    if (!story) {
      watches.set(event.key, watchStanding(build, internal?.directionDeg ?? null, beachIds));
      continue;
    }
    const ratedBeaches = ratingsByEvent?.get(event.key)
      ?? (internal ? rateEventBeaches(build, internal, beachIds, skill, now) : new Map());
    watches.set(event.key, watchWithNarration({ build, event: story, rated: new Map(ratedBeaches), beachIds, edition, now }, narration.forEvent(story)));
  }
  return watches;
}

/** Requested beach rows for all events. The API calls this after card narration so watch failures stay isolated. */
export function watchRegionEvents(input: RegionWatchInput): Map<string, RegionWatchBeach[]> {
  return collectRegionWatches(input, prepareNarration(input.build, input.edition, input.now));
}
