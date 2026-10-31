import type { SupabaseClient } from "@supabase/supabase-js";

import { localDate } from "@/lib/services/discovery/swell-briefing-input";
import {
  COMPASS,
  beachLineText,
  directionIndex,
  eventStoryText,
  storyEventKey,
  storyEventsFromRegion,
  type RegionalSwellEvent,
} from "@/lib/services/discovery/week-scout-story-candidates";
import { checkWrittenSentence } from "@/lib/services/discovery/week-scout-story-claims";
import { buildRegionGateContext, regionGateHolds, type RegionGateContext } from "@/lib/services/discovery/week-scout-story-region-gate";
import { STORY_SAMPLE_VERSION } from "@/lib/services/discovery/week-scout-story-source";
import { loadLatestStoryEdition, loadStoryInput } from "@/lib/services/discovery/week-scout-story-store";
import type { StoryArtifact, StoryInput } from "@/lib/services/discovery/week-scout-story-types";
import type { Database } from "@/types/database";
import type { RegionBeachRating, RegionSwellEvent } from "@/types/region-swell-events";

import type { RegionBuild } from "./regional";

type Client = SupabaseClient<Database>;

export interface NarrativeEdition {
  input: StoryInput;
  artifact: StoryArtifact;
}

/** Only this generation carries the PC's written sentences. */
const WRITTEN_GENERATION_VERSION = "week-scout-story-2";

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
    && input.provenance.generationInputVersion === STORY_SAMPLE_VERSION;
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
    const input = await loadStoryInput(client, artifact.inputHash);
    return input ? { input, artifact } : null;
  } catch (error) {
    console.warn("[swell-events] story edition read failed", { region, error: String(error) });
    return null;
  }
}

/**
 * The edition's written sentence for a card slot, or null: served only when the edition selected that
 * slot's candidate, the sentence claims nothing the candidate doesn't, and the candidate's gate holds
 * against this request's build.
 */
function writtenLines({ input, artifact }: NarrativeEdition, region: string, context: RegionGateContext): (slot: string) => string | null {
  const selected = new Set(artifact.briefing.selections);
  const facts = new Map(input.copyFacts.map((fact) => [fact.id, fact]));
  const bySlot = new Map((artifact.briefing.written ?? []).map((entry) => [entry.slot, entry]));
  const beachNames = input.beachNames ? Object.values(input.beachNames) : null;
  return (slot) => {
    const entry = bySlot.get(slot);
    const fact = entry && selected.has(entry.basedOn) ? facts.get(entry.basedOn) : undefined;
    if (!entry || !fact || fact.slot !== slot || !beachNames) return null;
    if (!checkWrittenSentence(entry.text, fact, beachNames, [region]).ok) return null;
    return regionGateHolds(fact.gate, context) === true ? entry.text : null;
  };
}

function withoutNarrative(event: RegionSwellEvent): RegionSwellEvent {
  const silent = (rating: RegionBeachRating): RegionBeachRating => ({ ...rating, why: null });
  return {
    ...event,
    story: null,
    here: event.here ? silent(event.here) : null,
    working: event.working.map(silent),
    notWorking: event.notWorking.map(silent),
  };
}

/**
 * Each forecast event's `story` and each of its listed beaches' `why`: the PC's written sentence for
 * that slot when today's edition has one that passes, otherwise the server line from this build.
 * Early looks carry neither. Card slots join the edition by story key, never by the build's event key.
 */
export function narrateRegionEvents(input: {
  build: RegionBuild;
  rated: RegionSwellEvent[];
  edition: NarrativeEdition | null;
  now: Date;
}): RegionSwellEvent[] {
  const { build, rated, edition, now } = input;
  const today = localDate(now, build.timezone);
  const { all } = storyEventsFromRegion(build, today);
  const context = buildRegionGateContext(build, today);
  const byBuildKey = new Map(all.map((event) => [event.regionalKey, event]));
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
  let written: ((slot: string) => string | null) | null = null;
  try {
    written = edition && editionServes(edition, build, now) ? writtenLines(edition, build.region, context) : null;
  } catch (error) {
    unusable(error);
  }
  const writtenFor = (slot: string): string | null => {
    try {
      return written?.(slot) ?? null;
    } catch (error) {
      return unusable(error);
    }
  };

  return rated.map((event) => {
    const story: RegionalSwellEvent | undefined = event.source === "forecast" ? byBuildKey.get(event.key) : undefined;
    if (!story) return withoutNarrative(event);
    const key = storyEventKey(story);
    const first = firstUnderKey.get(key) === story.regionalKey;
    // A later event under a shared key reads its exposure and wind from its own context.
    const own = first ? context : buildRegionGateContext({ ...build, events: build.events.filter((item) => item.key === story.regionalKey) }, today);
    const line = (slot: string, server: string): string => (first && writtenFor(slot)) || server;
    const direction = COMPASS[directionIndex(story.directionDeg)];
    const narrate = (rating: RegionBeachRating): RegionBeachRating => {
      const exposure = own.exposure(key, rating.beachId);
      const wind = own.wind(key, rating.beachId);
      const why = exposure && wind ? line(`event:${key}:beach:${rating.beachId}`, beachLineText(direction, exposure, wind)) : null;
      return { ...rating, why };
    };
    return {
      ...event,
      story: line(`event:${key}:story`, eventStoryText(story, today)),
      here: event.here ? narrate(event.here) : null,
      working: event.working.map(narrate),
      notWorking: event.notWorking.map(narrate),
    };
  });
}
