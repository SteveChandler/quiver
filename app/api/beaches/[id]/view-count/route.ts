import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

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
 * Wrapped with `withBotBlockingAndRateLimit("public-default")` to match
 * sibling `/api/beaches/*` routes (see `app/api/beaches/[id]/route.ts`).
 * A raw exposure let an attacker iterate beach IDs to bypass the CDN
 * cache and force thousands of uncached Supabase reads per cache cycle.
 *
 * Plan: abstract-exploring-phoenix (Commit C) — fix S1 from the
 * code-review pass.
 */
export const dynamic = "force-dynamic";

async function fetchWatchers(beachId: string): Promise<NextResponse> {
  if (!beachId) {
    return NextResponse.json({ watchers: 0 }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

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
    // Return 503 so Sentry + infra alerting surface genuine failures
    // instead of treating them as a normal zero-watcher beach. The
    // client component (BeachWatchersBadge) silent-fails on any non-
    // 200 response, so the UX is identical to a legitimate zero.
    return NextResponse.json(
      { watchers: 0, error: "query_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
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
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const wrappedHandler = withBotBlockingAndRateLimit(
    async () => fetchWatchers(id),
    "public-default"
  );
  return wrappedHandler(request);
}
