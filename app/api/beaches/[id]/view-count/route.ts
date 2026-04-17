import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/beaches/[id]/view-count
 *
 * Returns the number of distinct viewers of a beach in the last 7 days.
 * Powers the social-proof "X surfers watching this beach" badge on beach
 * detail pages.
 *
 * Anonymous-accessible — counts are aggregate and non-sensitive. Uses
 * `user_events.beach_view` rows, dedup'd by `user_id` (for authed) and
 * `session_id` (for anon). Bot-flagged rows excluded.
 *
 * Cached at the edge for 5 minutes (s-maxage=300) — refreshing the badge
 * more often than that would burn a Supabase query per beach-page view
 * with no human-readable delta. The 7d window is deliberately rolling so
 * the number feels alive without being realtime.
 *
 * Plan: abstract-exploring-phoenix (Commit C).
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: beachId } = await params;

  if (!beachId) {
    return NextResponse.json({ watchers: 0 }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Fetch the distinct viewer identifiers server-side. Postgres
    // `COUNT(DISTINCT ...)` over a COALESCE would be ideal but requires
    // an RPC; keeping this inline avoids a migration and the row volume
    // per beach per 7d is small (page_view dedup already happens in
    // trackSignupCtaView-style helpers + user_events has no hot path on
    // beach_view writes).
    const { data, error } = await supabase
      .from("user_events")
      .select("user_id, session_id")
      .eq("event_type", "beach_view")
      .eq("beach_id", beachId)
      .gte(
        "created_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .or("bot_flagged.is.null,bot_flagged.eq.false");

    if (error) {
      console.error("[view-count] query failed:", error);
      return NextResponse.json(
        { watchers: 0 },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const distinct = new Set<string>();
    for (const row of data ?? []) {
      const key = row.user_id ?? row.session_id;
      if (key) distinct.add(String(key));
    }

    return NextResponse.json(
      { watchers: distinct.size },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[view-count] error:", err);
    return NextResponse.json(
      { watchers: 0 },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
