import { NextResponse, type NextRequest } from "next/server";

import { withBriefingPublisher } from "@/lib/middleware/api-wrappers/briefing-publisher-wrapper";
import {
  BriefingStoreError,
  loadLatestBriefingEdition,
} from "@/lib/services/discovery/swell-briefing-store";
import { WEEK_SCOUT_NOTES_KIND } from "@/lib/services/discovery/swell-briefing-types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Durable readback for the worker.
 *
 * Returns the full stored artifact, including internal provenance, because the
 * worker compares both the id and the briefing contents against what it
 * uploaded before writing its local receipt. This is the publisher-scoped
 * route; native and public readers never reach it and never see provenance.
 *
 * `?schema=2` reads back the newest Week Scout notes edition only.
 */
export const GET = withBriefingPublisher(async (request: NextRequest, { userId, region }) => {
  const schema = request.nextUrl.searchParams.get("schema");
  if (schema !== null && schema !== "1" && schema !== "2") {
    return NextResponse.json({ error: "unsupported_schema_version" }, { status: 400 });
  }

  try {
    const artifact = await loadLatestBriefingEdition(
      createSupabaseServiceRoleClient(),
      userId,
      region,
      schema === "2" ? { kind: WEEK_SCOUT_NOTES_KIND } : {},
    );
    if (artifact === null) return NextResponse.json({ error: "no_edition" }, { status: 404 });
    return NextResponse.json(artifact);
  } catch (error) {
    if (error instanceof BriefingStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
