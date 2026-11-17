import type { SupabaseClient } from "@supabase/supabase-js";

import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";
import type { Database } from "@/types/database";

import { buildRegionEvents, type InternalRegionEvent } from "./regional";
import { prepareRegionNarration, regionEventStory, type RegionEventStory } from "./regional-narrative";

const NO_STORY: RegionEventStory = { story: null, storySource: null };

/** The offshore height to break a tie: the unrounded value, else the number in "7 ft"; no height never wins. */
function offshoreHeight(event: InternalRegionEvent): number {
  if (typeof event.offshoreHeightFt === "number") return event.offshoreHeightFt;
  const feet = event.offshoreFt === null ? Number.NaN : Number.parseFloat(event.offshoreFt);
  return Number.isNaN(feet) ? Number.NEGATIVE_INFINITY : feet;
}

/**
 * The swell card's sentence for the Big Swells forecast peak, so both cards name the same swell in the same words.
 * It reads only when the region reads the same buoy as the card and its peak day carries a history line. Of the
 * region events peaking that local day, the one whose peak is nearest the card's peak names it; on a tie, the
 * bigger offshore height. Otherwise no sentence, and the card keeps its template line. The response is public, so
 * it is always the server's sentence, never a pilot account's written one.
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
  const peakMs = Date.parse(args.peakAt);
  const peakDate = getLocalDateStr(new Date(args.peakAt), build.timezone);
  const sameDay = build.events.filter((item) => item.peakLocalDate === peakDate);
  if (!sameDay.some((item) => item.history !== null)) return NO_STORY;
  const distance = (item: InternalRegionEvent): number => Math.abs(Date.parse(item.peakAt) - peakMs);
  const event = [...sameDay].sort((a, b) => distance(a) - distance(b) || offshoreHeight(b) - offshoreHeight(a))[0];
  return regionEventStory(prepareRegionNarration({ build, edition: null, now: args.now }), event.key);
}
