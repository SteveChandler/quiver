import { NextRequest, NextResponse } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

/**
 * GET /api/community-stats
 *
 * Returns aggregated community statistics for the landing page social proof bar.
 * Unauthenticated — this is public data.
 *
 * Response cached for 10 minutes (matches ISR revalidation).
 * Protected by bot blocking + rate limiting (4 parallel DB queries per request).
 */
async function communityStatsHandler(_request: NextRequest) {
  try {
    const supabase = await createAPIServerClient();

    // Run all queries in parallel for speed
    const [beachCount, sessionCount, userCount, reportsToday] =
      await Promise.all([
        // Total beaches with any data
        supabase
          .from("beaches")
          .select("id", { count: "exact", head: true }),

        // Total sessions logged by real community members
        supabase
          .from("sessions")
          .select(
            "id, profiles!sessions_user_id_profiles_fkey!inner(is_mock)",
            { count: "exact", head: true }
          )
          .or("is_mock.is.null,is_mock.eq.false", {
            referencedTable: "profiles",
          }),

        // Total registered real users
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .or("is_mock.is.null,is_mock.eq.false"),

        // Conditions reports filed today
        supabase
          .from("intel_posts")
          .select(
            "id, profiles!intel_posts_user_id_fkey!inner(is_mock)",
            { count: "exact", head: true }
          )
          .or("is_mock.is.null,is_mock.eq.false", {
            referencedTable: "profiles",
          })
          .gte(
            "created_at",
            new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
          ),
      ]);

    const stats = {
      totalBeaches: beachCount.count ?? 0,
      totalSessions: sessionCount.count ?? 0,
      totalUsers: userCount.count ?? 0,
      reportsToday: reportsToday.count ?? 0,
    };

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (error) {
    console.error("[community-stats] Error fetching stats:", error);
    // Return fallback stats so the landing page never breaks
    return NextResponse.json(
      {
        totalBeaches: 750,
        totalSessions: 0,
        totalUsers: 0,
        reportsToday: 0,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60",
        },
      }
    );
  }
}

export const GET = withBotBlockingAndRateLimit(communityStatsHandler, "public-default");
