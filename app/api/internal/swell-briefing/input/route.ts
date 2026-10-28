import { NextResponse, type NextRequest } from "next/server";

import { withBriefingPublisher } from "@/lib/middleware/api-wrappers/briefing-publisher-wrapper";
import {
  BriefingInputError,
  buildBriefingInput,
} from "@/lib/services/discovery/swell-briefing-input";
import { BriefingStoreError } from "@/lib/services/discovery/swell-briefing-store";
import { buildWeekScoutNotesInput } from "@/lib/services/discovery/week-scout-notes-input";
import {
  BriefingValidationError,
  assertBeachIdsAreUuids,
} from "@/lib/services/discovery/swell-briefing-validate";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Issues the validated input the worker generates from.
 *
 * The snapshot is built from the same forecast rows the app displays, saved,
 * and returned. Saving before returning is what makes an upload checkable: a
 * publish is only accepted against an input this server actually issued.
 *
 * Reissuing is deliberate. When the measurements have not moved, the stored
 * snapshot comes back unchanged, so a refetch does not hand the worker a new
 * hash and make it regenerate an identical edition.
 *
 * `?schema=2` issues Week Scout notes candidates instead of the Outlook
 * briefing. It is opt-in so a deployed worker that only reads schema 1 keeps
 * working until its config is switched.
 */
export const GET = withBriefingPublisher(async (request: NextRequest, { userId, region }) => {
  const schema = request.nextUrl.searchParams.get("schema");
  if (schema !== null && schema !== "1" && schema !== "2") {
    return NextResponse.json({ error: "unsupported_schema_version" }, { status: 400 });
  }

  try {
    if (schema === "2") {
      const notes = await buildWeekScoutNotesInput({
        client: createSupabaseServiceRoleClient(),
        userId,
        regionSlug: region,
        now: new Date(),
      });
      return NextResponse.json(notes);
    }

    const snapshot = await buildBriefingInput({
      client: createSupabaseServiceRoleClient(),
      userId,
      regionSlug: region,
      now: new Date(),
    });

    // The worker must not be able to publish an edition the app would fail to
    // open, so beach references are checked on the way out as well as back in.
    assertBeachIdsAreUuids(snapshot.briefing);

    return NextResponse.json(snapshot);
  } catch (error) {
    if (
      error instanceof BriefingInputError
      || error instanceof BriefingValidationError
      || error instanceof BriefingStoreError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
