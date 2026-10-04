import { NextRequest, NextResponse } from "next/server";

import { withProtection } from "@/lib/middleware/api-wrappers";
import type { RouteContext } from "@/lib/middleware/api-wrappers/types";
import { loadSwellShareEvent, parseSwellEventKey } from "@/lib/share/swell-share";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Snapshots change once a day; a short shared cache absorbs a link going round a group chat.
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

/**
 * GET /api/swell/[eventKey]
 *
 * Public, read-only view of one swell event for the share page and the app's
 * share card. Event data is per beach, not per user, so there is no auth.
 */
async function swellEventHandler(
  _request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse> {
  const { eventKey } = (await context?.params) ?? {};
  if (!parseSwellEventKey(eventKey)) {
    return NextResponse.json({ error: "invalid_event_key" }, { status: 400 });
  }

  try {
    const event = await loadSwellShareEvent(
      createSupabaseServiceRoleClient(),
      eventKey,
    );
    if (!event) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(event.payload, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (error) {
    console.error("[api/swell] Failed to load swell event:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const GET = withProtection(swellEventHandler, {
  rateLimit: { key: "public-default" },
});
