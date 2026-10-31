import { NextRequest, NextResponse } from "next/server";

import { buildRegionEvents, rateRegionEvents } from "@/lib/alerts/swell-events/regional";
import { loadRegionNarrativeEdition, narrateRegionEvents, withoutNarrative } from "@/lib/alerts/swell-events/regional-narrative";
import type { SkillLevel } from "@/lib/domains/user-preferences";
import { handleApiError, withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import type { OptionalAuthContext } from "@/lib/middleware/api-wrappers/types";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { RegionSwellEventsResponse } from "@/types/region-swell-events";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Below this a region has no "which beaches are working" to show.
const MIN_REGION_BEACHES = 3;
// The story's default for a visitor with no skill set.
const DEFAULT_SKILL: SkillLevel = "intermediate";

function emptyRegion(region: string | null, beachCount: number): RegionSwellEventsResponse {
  return { region, buoy: null, beachCount, events: [] };
}

// GET /api/beaches/[id]/swell-events - every swell and storm in the beach's region, out 15 days,
// rated for this user's skill. withAuth({ optional }) resolves native Bearer and web cookie
// sessions; that client is used only for the skill read. Region data comes from the cookie-free
// service-role client, because buildRegionEvents caches it with unstable_cache.
async function swellEventsHandler(_request: NextRequest, { params, user, supabase }: OptionalAuthContext): Promise<NextResponse> {
  const id = params.id;
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return NextResponse.json({ success: false, error: "Invalid beach id" }, { status: 400 });
  }

  try {
    const serviceClient = createSupabaseServiceRoleClient();
    const { data: beach, error } = await serviceClient
      .from("beaches")
      .select("region, timezone")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return handleApiError(error, "Failed to fetch beach");
    if (!beach) {
      return NextResponse.json({ success: false, error: "Beach not found" }, { status: 404 });
    }
    if (!beach.region) {
      return NextResponse.json({ success: true, data: emptyRegion(null, 0) });
    }

    const now = new Date();
    const built = await buildRegionEvents({
      client: serviceClient,
      region: beach.region,
      now,
      timezone: resolveBeachTimezone(beach.timezone),
    });
    if (built.beaches.length < MIN_REGION_BEACHES) {
      return NextResponse.json({ success: true, data: emptyRegion(beach.region, built.beaches.length) });
    }

    // Today's story edition is read beside the skill; a failed read costs only the PC's written sentences.
    // Only stored-forecast events carry a narrative, so without one there is nothing to read.
    const narrated = built.events.some((event) => event.source === "forecast");
    const [profileSkill, edition] = await Promise.all([
      user ? getProfileExperienceLevel(supabase, user.id) : null,
      narrated ? loadRegionNarrativeEdition({ client: serviceClient, region: built.region, timezone: built.timezone, now }) : null,
    ]);
    const rated = rateRegionEvents(built, { beachId: id, skill: profileSkill ?? DEFAULT_SKILL, now });
    // The card never fails because of its narrative: without it, the rated events go out with no story or lines.
    let events: RegionSwellEventsResponse["events"];
    try {
      events = narrateRegionEvents({ build: built, rated, edition, now });
    } catch (narrativeError) {
      console.warn("[swell-events] narrative failed", { region: built.region, error: String(narrativeError) });
      events = rated.map(withoutNarrative);
    }
    const data: RegionSwellEventsResponse = {
      region: built.region,
      buoy: built.buoy,
      beachCount: built.beaches.length,
      events,
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, "Failed to load swell events");
  }
}

export const GET = withRateLimit(
  withAuth(swellEventsHandler, { optional: true, errorMessage: "Failed to load swell events" }),
  { key: "public-default" },
);
