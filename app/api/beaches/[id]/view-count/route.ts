import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

/**
 * GET /api/beaches/[id]/view-count
 *
 * Returns the number of distinct all-time viewers of a beach. Powers
 * the social-proof "X surfers checked this spot" badge on beach detail
 * pages.
 *
 * Anonymous-accessible — counts are aggregate and non-sensitive. Uses
 * `user_events.beach_view` rows, dedup'd by `user_id` (for authed) and
 * `session_id` (for anon). Bot-flagged rows excluded.
 *
 * Practical ceiling: ~90 days. `user_events` has a TTL via `expires_at`
 * cleanup, so "all-time" really means "everything still in the table".
 * If traffic ever warrants a true persistent counter, a per-beach
 * rollup table populated by trigger or daily cron would be the
 * follow-up.
 *
 * Cached at the edge for 5 minutes (s-maxage=300) — refreshing the badge
 * more often than that would burn a Supabase query per beach-page view
 * with no human-readable delta.
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

  // All-time distinct viewers. The practical ceiling is ~90 days
  // because `user_events` rows are pruned via `expires_at`; if we ever
  // need a true persistent counter (across the TTL boundary), build a
  // per-beach rollup table (trigger or daily cron). Until then the
  // count covers everything still in the table.
  const { data, error } = await supabase
    .from("user_events")
    .select("user_id, session_id")
    .eq("event_type", "beach_view")
    .eq("beach_id", beachId)
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
