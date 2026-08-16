import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";
import { fetchRealActivitySignals } from "@/lib/analytics/real-activity-signals";

/**
 * GET /api/beaches/[id]/view-count
 *
 * Returns aggregate real activity signals for a beach. Powers the social-proof
 * badge on beach detail pages.
 *
 * Anonymous-accessible — counts are aggregate and non-sensitive. Uses
 * It returns exact counts from real alert rules, recent non-bot analytics
 * events, and completed sessions. Mock and system accounts are excluded.
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

  const supabase = await createSupabaseServiceRoleClient();
  const signals = await fetchRealActivitySignals(supabase, beachId);

  return NextResponse.json(
    signals,
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
