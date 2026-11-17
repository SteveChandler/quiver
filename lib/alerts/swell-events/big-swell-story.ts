import type { SupabaseClient } from "@supabase/supabase-js";

import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";
import type { Database } from "@/types/database";

import { buildRegionEvents } from "./regional";
import { prepareRegionNarration, regionEventStory, type RegionEventStory } from "./regional-narrative";

const NO_STORY: RegionEventStory = { story: null, storySource: null };

/**
 * The swell card's sentence for the Big Swells forecast peak: the region event that carries the history line for
 * that peak, so both cards name the same swell in the same words. It matches only when the region reads the same
 * buoy as the card, and an event peaking on the card's peak day carries a history line; otherwise no sentence, and
 * the card keeps its template line. The response is public, so it is always the server's sentence, never a
 * pilot account's written one.
 */
export async function bigSwellForecastStory(args: {
  client: SupabaseClient<Database>;
  region: string;
  timezone: string;
  buoyId: string;
  peakAt: string;
  now: Date;
}): Promise<RegionEventStory> {
  const build = await buildRegionEvents({ client: args.client, region: args.region, now: args.now, timezone: args.timezone });
  if (build.buoy?.id !== args.buoyId) return NO_STORY;
  const peakDate = getLocalDateStr(new Date(args.peakAt), build.timezone);
  const event = build.events.find((item) => item.peakLocalDate === peakDate && item.history !== null);
  if (!event) return NO_STORY;
  return regionEventStory(prepareRegionNarration({ build, edition: null, now: args.now }), event.key);
}
