import { NextRequest, NextResponse } from "next/server";

import { withProtection } from "@/lib/middleware/api-wrappers";
import type { RouteContext } from "@/lib/middleware/api-wrappers/types";
import {
  buildSwellCard,
  loadSwellShareEvent,
  parseSwellEventKey,
  parseSwellKind,
  parseSwellTitleId,
} from "@/lib/share/swell-share";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Snapshots change once a day; a short shared cache absorbs a link going round a group chat.
// The body varies by the k and t query params; shared caches key on the full URL, query included.
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

/**
 * GET /api/swell/[eventKey]
 *
 * Public, read-only view of one swell event for the share page and the app's
 * share card. Event data is per beach, not per user, so there is no auth.
 * Optional `k` (kind) and `t` (title id) are validated like /api/og/swell and
 * select the `card` object, which is built by the same function as the page
 * and both images.
 */
async function swellEventHandler(
  request: NextRequest,
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
    const { searchParams } = request.nextUrl;
    const card = buildSwellCard({
      event,
      kind: parseSwellKind(searchParams.get("k")),
      titleId: parseSwellTitleId(searchParams.get("t")),
    });
    return NextResponse.json({ ...event.payload, card }, {
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
