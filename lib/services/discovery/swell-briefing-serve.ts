import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSwellBriefingRegion, isSwellBriefingEnabled } from "@/lib/flags/swell-briefing";
import { loadLatestBriefingEdition } from "./swell-briefing-store";
import type { BriefingFreshness, SwellBriefing } from "./swell-briefing-types";

type Client = SupabaseClient<Database>;

const HOUR_MS = 60 * 60 * 1000;
/** Up to this old still reads as current; beyond it the edition says its age. */
const FRESH_HOURS = 12;
const AGING_HOURS = 36;

/**
 * Freshness is recomputed when the edition is served, never read from the saved
 * row. A briefing saved this morning is stale by tomorrow, and the native app
 * states the age rather than presenting an old edition as current.
 */
export function freshnessFor(dataAt: string, now: Date): BriefingFreshness {
  const parsed = Date.parse(dataAt);
  if (!Number.isFinite(parsed)) return "stale";
  const hours = (now.getTime() - parsed) / HOUR_MS;
  if (hours < 0) return "stale";
  if (hours <= FRESH_HOURS) return "fresh";
  if (hours <= AGING_HOURS) return "aging";
  return "stale";
}

/**
 * The saved briefing for one account, ready to attach to the outlook response.
 *
 * Returns null for every failure. The briefing is additive: a reader without
 * one keeps the existing swell list, so a storage fault must degrade the screen
 * rather than fail the request.
 *
 * Internal provenance is dropped here. Only the native `SwellBriefing` object
 * crosses this boundary.
 */
export async function loadBriefingForOutlook(args: {
  client: Client;
  userId: string;
  now: Date;
}): Promise<SwellBriefing | null> {
  if (!isSwellBriefingEnabled()) return null;

  try {
    const artifact = await loadLatestBriefingEdition(
      args.client,
      args.userId,
      getSwellBriefingRegion(),
    );
    if (artifact === null) return null;

    // An edition whose validity has lapsed is not shown; the swell list stands.
    const validUntil = Date.parse(artifact.validUntil);
    if (Number.isFinite(validUntil) && validUntil < args.now.getTime()) return null;

    return {
      ...artifact.briefing,
      freshness: freshnessFor(artifact.briefing.dataAt, args.now),
    };
  } catch {
    return null;
  }
}
