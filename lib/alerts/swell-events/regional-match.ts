import type { SupabaseClient } from "@supabase/supabase-js";

import type { PushRegionStory } from "@/lib/alerts/swell-outlook/first-sighting";
import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { getWeekScoutStoryAllowlist } from "@/lib/flags/week-scout-story";
import { storyEventKey } from "@/lib/services/discovery/week-scout-story-candidates";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { Database } from "@/types/database";

import { loadRegionForecastEvents, type InternalRegionEvent, type RegionBuild } from "./regional";
import { loadRegionNarrativeEdition, prepareRegionNarration, regionEventStory, type NarrativeEdition } from "./regional-narrative";

/** Peaks this many hours apart or less can be the same swell. */
const MATCH_PEAK_HOURS = 24;
/** A near-beach direction this many degrees from the push's or less can be the same swell. */
const MATCH_DIRECTION_DEG = 45;
const HOUR_MS = 3_600_000;

/** The push's own swell: the beach detector's event key (":s" ends a storm), its beach, peak and near-beach direction. */
export interface PushSwell {
  eventKey: string;
  beachId: string;
  peakAt: string;
  directionDeg: number;
}

/**
 * The region swell behind a push's own swell, so the push and the card name it alike; null when none or more than
 * one matches. Only stored-forecast events of the same kind count. Rule 1: the push beach is a member of the event
 * (`memberFaceFt`) and the peaks are 24 hours apart or less. Rule 2, only when rule 1 finds none: the event's
 * near-beach direction at that beach (`memberDirections`, then `exposureDirectionDeg`) is 45° or less from the
 * push direction, and the peaks are 24 hours apart or less.
 */
export function matchRegionEvent(build: Pick<RegionBuild, "events">, swell: PushSwell): InternalRegionEvent | null {
  const kind = swell.eventKey.endsWith(":s") ? "storm" : "swell";
  const peakMs = Date.parse(swell.peakAt);
  const near = build.events.filter((event) => event.source === "forecast" && event.kind === kind
    && Number.isFinite(peakMs) && Math.abs(Date.parse(event.peakAt) - peakMs) <= MATCH_PEAK_HOURS * HOUR_MS);
  const members = near.filter((event) => event.memberFaceFt?.[swell.beachId] !== undefined);
  if (members.length > 0) return members.length === 1 ? members[0] : null;
  const aligned = near.filter((event) => {
    const direction = event.memberDirections?.[swell.beachId] ?? event.exposureDirectionDeg ?? event.directionDeg;
    return direction !== null && angleDifference(direction, swell.directionDeg) <= MATCH_DIRECTION_DEG;
  });
  return aligned.length === 1 ? aligned[0] : null;
}

/** One run's reads, shared by every push in it: a beach's region, a region's build and its edition. */
export interface PushStoryCache {
  beaches: Map<string, Promise<{ region: string | null; timezone: string | null } | null>>;
  builds: Map<string, Promise<RegionBuild>>;
  editions: Map<string, Promise<NarrativeEdition | null>>;
}

export function createPushStoryCache(): PushStoryCache {
  return { beaches: new Map(), builds: new Map(), editions: new Map() };
}

/** The cached promise for a key; a failed read is dropped so a later push tries again. */
function memo<T>(map: Map<string, Promise<T>>, key: string, read: () => Promise<T>): Promise<T> {
  const cached = map.get(key);
  if (cached) return cached;
  const promise = read().catch((error: unknown) => {
    map.delete(key);
    throw error;
  });
  map.set(key, promise);
  return promise;
}

/**
 * The region swell behind a push, with the card's sentence for it in push wording: the PC worker's sentence only
 * for an account on WEEK_SCOUT_STORY_USER_ALLOWLIST (an empty list names no one here) and only when it names no
 * day word; otherwise the server's sentence with dated days. Null when the beach has no region, no region swell
 * matches, or the match has no sentence.
 */
export async function loadPushRegionStory(args: {
  client: SupabaseClient<Database>;
  userId: string;
  swell: PushSwell;
  now: Date;
  /** The push body states the beach's own size, so the sentence states none (one number per push). */
  withoutSize?: boolean;
  /** Share the reads across the run's pushes; without it, each call reads its own. */
  cache?: PushStoryCache;
}): Promise<PushRegionStory | null> {
  const { client, userId, swell, now } = args;
  const cache = args.cache ?? createPushStoryCache();
  const beach = await memo(cache.beaches, swell.beachId, async () => {
    const { data, error } = await client.from("beaches").select("region, timezone").eq("id", swell.beachId).maybeSingle();
    if (error) throw new Error(`Failed to read the push beach's region: ${error.message}`);
    return data;
  });
  if (!beach?.region) return null;
  const region = beach.region;
  const timezone = resolveBeachTimezone(beach.timezone);
  const build = await memo(cache.builds, region, () => loadRegionForecastEvents({ client, region, now, timezone }));
  const match = matchRegionEvent(build, swell);
  if (!match?.directionLabel || match.periodS === null) return null;
  const edition = getWeekScoutStoryAllowlist().has(userId)
    ? await memo(cache.editions, build.region, () => loadRegionNarrativeEdition({ client, region: build.region, timezone: build.timezone, now }))
    : null;
  const narration = prepareRegionNarration({ build, edition, now });
  const event = narration.all.find((item) => item.regionalKey === match.key);
  const told = regionEventStory(narration, match.key, { datedDays: true, withoutSize: args.withoutSize === true });
  if (!event || told.story === null || told.storySource === null) return null;
  return { regionEventKey: match.key, storyKey: storyEventKey(event), story: told.story, storySource: told.storySource,
    directionLabel: match.directionLabel, kind: match.kind, periodS: match.periodS, peakAt: match.peakAt };
}
