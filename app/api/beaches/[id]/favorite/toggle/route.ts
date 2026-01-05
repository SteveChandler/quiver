import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { withAuth, validateUuidParam, createSuccessResponse, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Toggle favorite for a beach for the authenticated user
export const POST = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "beach");
    if ("error" in uuidResult) return uuidResult.error;

    const beachId = uuidResult.value;

    // Dev-only bypass: if mock user and ALLOW_E2E_MUTATIONS_DEV enabled, use service role
    let writeClient = supabase;
    try {
      if (
        process.env.ALLOW_E2E_MUTATIONS_DEV === "1" ||
        (process.env.ALLOW_E2E_MUTATIONS_DEV || "").toLowerCase() === "true"
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
      throw new Error(checkError.message || "Failed to check favorite");
    }

    if (existing) {
      // Remove favorite
      const { error: delErr } = await writeClient
        .from("favorite_beaches")
        .delete()
        .eq("user_id", user.id)
        .eq("beach_id", beachId);

      if (delErr) {
        throw new Error(delErr.message || "Failed to remove favorite");
      }

      // Revalidate pages that show favorites
      try {
        revalidatePath("/profile");
        revalidatePath("/");
      } catch {}

      return createSuccessResponse({ action: "removed" });
    }

    // Add favorite with next rank
    const { data: ranksRows, error: rankErr } = await writeClient
      .from("favorite_beaches")
      .select("rank")
      .eq("user_id", user.id);

    if (rankErr) {
      throw new Error(rankErr.message || "Failed to fetch ranks");
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
      throw new Error(insErr.message || "Failed to add favorite");
    }

    try {
      revalidatePath("/profile");
      revalidatePath("/");
    } catch {}

    return createSuccessResponse({ action: "added" });
  },
  { errorMessage: "Failed to toggle favorite" }
);

