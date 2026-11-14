import type { SupabaseClient } from "@supabase/supabase-js";

import { localDate } from "@/lib/services/discovery/local-date";
import { activeStoryRegions } from "@/lib/services/discovery/week-scout-story-store";
import { WRITTEN_GENERATION_VERSIONS } from "@/lib/services/discovery/week-scout-story-types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Home region of the accounts on the story allowlist (quiver#1418). It must have today's edition
 * whatever the count elsewhere: on a day with 20 good regions, this is the one that matters most.
 */
export const STORY_SENTINEL_REGION = "San Diego";
const STORY_SENTINEL_TIMEZONE = "America/Los_Angeles";

type ActiveRegion = { region: string; timezone: string };

export interface StoryStalenessReads {
  activeRegions(): Promise<ActiveRegion[]>;
  /** True when the region has at least one edition with written sentences for that local date. */
  hasEdition(region: string, editionDate: string): Promise<boolean>;
}

type StoryStalenessReason = "no_active_regions" | "read_failed" | "too_few_editions" | "sentinel_stale";

type StoryStalenessResult =
  | { healthy: true; activeRegions: number; freshRegions: number; staleRegions: string[] }
  | { healthy: false; reason: StoryStalenessReason; detail: string; staleRegions: string[] };

// The tables are not in the generated types; the story store uses the same cast.
type EditionsDb = {
  from: (table: "week_scout_story_editions") => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        eq: (col: string, value: string) => {
          in: (col: string, values: string[]) => {
            limit: (n: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
};

export function supabaseStoryStalenessReads(
  client: SupabaseClient<Database> = createSupabaseServiceRoleClient(),
): StoryStalenessReads {
  return {
    activeRegions: () => activeStoryRegions(client),
    hasEdition: async (region, editionDate) => {
      const { data, error } = await (client as unknown as EditionsDb)
        .from("week_scout_story_editions")
        .select("region")
        .eq("region", region)
        .eq("edition_date", editionDate)
        // The server serves only these generations; a -1 edition still leaves phones on fallback text.
        .in("generation_version", [...WRITTEN_GENERATION_VERSIONS])
        .limit(1);
      if (error) throw new Error("story_edition_read_failed");
      return Array.isArray(data) && data.length > 0;
    },
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Whether the PC worker published today's story editions. The server serves an edition only on
 * the region's own local date, so a sleeping PC, an expired token or a blocked domain leaves every
 * phone on the server's fallback text. Some regions never get a story (no candidates), so the
 * check is red below half of the active regions, or when the sentinel region has none.
 */
export async function checkWeekScoutStoryStaleness(
  reads: StoryStalenessReads = supabaseStoryStalenessReads(),
  now: Date = new Date(),
): Promise<StoryStalenessResult> {
  let regions: ActiveRegion[];
  try {
    regions = await reads.activeRegions();
  } catch (error) {
    return { healthy: false, reason: "read_failed", detail: `active regions: ${message(error)}`, staleRegions: [] };
  }
  if (regions.length === 0) {
    return { healthy: false, reason: "no_active_regions", detail: "the active story region list is empty", staleRegions: [] };
  }

  const checked = regions.some(({ region }) => region === STORY_SENTINEL_REGION)
    ? regions
    : [...regions, { region: STORY_SENTINEL_REGION, timezone: STORY_SENTINEL_TIMEZONE }];
  let fresh: Map<string, boolean>;
  try {
    const found = await Promise.all(checked.map(async ({ region, timezone }) =>
      [region, await reads.hasEdition(region, localDate(now, timezone))] as const));
    fresh = new Map(found);
  } catch (error) {
    return { healthy: false, reason: "read_failed", detail: `editions: ${message(error)}`, staleRegions: [] };
  }

  // Counts use the active list; the missing list also names San Diego when it is off that list.
  const freshRegions = regions.filter(({ region }) => fresh.get(region)).length;
  const staleRegions = checked.filter(({ region }) => !fresh.get(region)).map(({ region }) => region).sort();

  if (freshRegions * 2 < regions.length) {
    return {
      healthy: false,
      reason: "too_few_editions",
      detail: `${freshRegions} of ${regions.length} active regions have today's edition; missing: ${staleRegions.join(", ")}`,
      staleRegions,
    };
  }
  if (!fresh.get(STORY_SENTINEL_REGION)) {
    const sentinelDate = localDate(now, checked.find(({ region }) => region === STORY_SENTINEL_REGION)!.timezone);
    return {
      healthy: false,
      reason: "sentinel_stale",
      detail: `${STORY_SENTINEL_REGION} has no edition for ${sentinelDate}; ${freshRegions} of ${regions.length} active regions have today's edition; missing: ${staleRegions.join(", ")}`,
      staleRegions,
    };
  }
  return { healthy: true, activeRegions: regions.length, freshRegions, staleRegions };
}
