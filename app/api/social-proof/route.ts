import { NextRequest, NextResponse } from "next/server";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";
import { countRealSurfers } from "@/lib/social-proof/count-real-surfers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUCCESS_CACHE_CONTROL =
  "public, s-maxage=600, stale-while-revalidate=1200";
const FALLBACK_CACHE_CONTROL = "public, s-maxage=30";

async function socialProofHandler(
  _request: NextRequest
): Promise<NextResponse> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const counts = await countRealSurfers(supabase);

    return NextResponse.json(counts, {
      headers: {
        "Cache-Control": SUCCESS_CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error("[social-proof] Failed to fetch social proof counts:", error);

    return NextResponse.json(
      { totalSurfers: 0, joinedLast7d: 0 },
      {
        status: 200,
        headers: {
          "Cache-Control": FALLBACK_CACHE_CONTROL,
        },
      }
    );
  }
}

export const GET = withBotBlockingAndRateLimit(
  socialProofHandler,
  "public-default"
);
