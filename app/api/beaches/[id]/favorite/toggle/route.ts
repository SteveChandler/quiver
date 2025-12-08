import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createAPIServerClient,
  getAuthenticatedAPIClient,
  validateSupabaseConfig,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

// Toggle favorite for a beach for the authenticated user
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const beachId = params.id;

  const cfg = validateSupabaseConfig();
  if (!cfg.valid) {
    return NextResponse.json({ success: false, error: cfg.error }, { status: 500 });
  }

  try {
    const { supabase, user, error } = await getAuthenticatedAPIClient();
    if (error || !supabase || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    // Dev-only bypass: if mock user and ALLOW_E2E_MUTATIONS_DEV enabled, use service role
    let writeClient = supabase;
    try {
      if (
        (process.env.ALLOW_E2E_MUTATIONS_DEV === "1" ||
          (process.env.ALLOW_E2E_MUTATIONS_DEV || "").toLowerCase() === "true")
      ) {
        const { data: me } = await supabase
          .from("profiles")
          .select("is_mock")
          .eq("id", user.id)
          .single();
        if (me?.is_mock === true) {
          writeClient = createSupabaseServiceRoleClient();
        }
      }
    } catch {}

    // Check if already favorited
    const { data: existing, error: checkError } = await writeClient
      .from("favorite_beaches")
      .select("id")
      .eq("user_id", user.id)
      .eq("beach_id", beachId)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json(
        { success: false, error: checkError.message || "Failed to check favorite" },
        { status: 500 }
      );
    }

    if (existing) {
      // Remove favorite
      const { error: delErr } = await writeClient
        .from("favorite_beaches")
        .delete()
        .eq("user_id", user.id)
        .eq("beach_id", beachId);

      if (delErr) {
        return NextResponse.json(
          { success: false, error: delErr.message || "Failed to remove favorite" },
          { status: 500 }
        );
      }

      // Revalidate pages that show favorites
      try {
        revalidatePath("/profile");
        revalidatePath("/");
      } catch {}

      return NextResponse.json({ success: true, action: "removed" });
    }

    // Add favorite with next rank
    const { data: ranksRows, error: rankErr } = await writeClient
      .from("favorite_beaches")
      .select("rank")
      .eq("user_id", user.id);

    if (rankErr) {
      return NextResponse.json(
        { success: false, error: rankErr.message || "Failed to fetch ranks" },
        { status: 500 }
      );
    }

    const nextRank = (ranksRows || [])
      .map((r: any) => r.rank || 0)
      .reduce((max: number, cur: number) => (cur > max ? cur : max), 0) + 1;

    const { error: insErr } = await writeClient.from("favorite_beaches").insert({
      user_id: user.id,
      beach_id: beachId,
      rank: nextRank,
    });

    if (insErr) {
      return NextResponse.json(
        { success: false, error: insErr.message || "Failed to add favorite" },
        { status: 500 }
      );
    }

    try {
      revalidatePath("/profile");
      revalidatePath("/");
    } catch {}

    return NextResponse.json({ success: true, action: "added" });
  } catch (err: unknown) {
    console.error("/api/beaches/[id]/favorite/toggle error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

