import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type FavoriteAction = "added" | "removed";
type FavoriteWriteClient = AuthenticatedContext["supabase"];

// Mirrors the DB/native free-tier contract. Derive from entitlements metadata later.
const FREE_FAVORITES_LIMIT = 3;

function isE2EMutationsDevEnabled(): boolean {
  return (
    process.env.ALLOW_E2E_MUTATIONS_DEV === "1" ||
    (process.env.ALLOW_E2E_MUTATIONS_DEV || "").toLowerCase() === "true"
  );
}

async function shouldUseManualE2EFavoritePath(
  supabase: FavoriteWriteClient,
  userId: string
): Promise<boolean> {
  if (!isE2EMutationsDevEnabled()) return false;

  try {
    const { data: me } = await supabase
      .from("profiles")
      .select("is_mock")
      .eq("id", userId)
      .single();

    return me?.is_mock === true;
  } catch {
    return false;
  }
}

function revalidateFavoriteSurfaces(): void {
  try {
    revalidatePath("/profile");
    revalidatePath("/");
  } catch {}
}

function isFavoriteAction(action: string | null): action is FavoriteAction {
  return action === "added" || action === "removed";
}

function isFavoriteQuotaError(error: unknown): boolean {
  const quotaError = error as
    | { message?: string; details?: string; detail?: string }
    | null
    | undefined;
  const message = quotaError?.message ?? "";
  const details = quotaError?.details ?? quotaError?.detail ?? "";

  return (
    message.includes("favorite_quota_exceeded") ||
    details.includes("free_favorites_limit")
  );
}

async function toggleFavoriteManually(
  writeClient: FavoriteWriteClient,
  userId: string,
  beachId: string
): Promise<FavoriteAction> {
  const { data: existing, error: checkError } = await writeClient
    .from("favorite_beaches")
    .select("id")
    .eq("user_id", userId)
    .eq("beach_id", beachId)
    .maybeSingle();

  if (checkError) {
    throw new Error(checkError.message || "Failed to check favorite");
  }

  if (existing) {
    const { error: delErr } = await writeClient
      .from("favorite_beaches")
      .delete()
      .eq("user_id", userId)
      .eq("beach_id", beachId);

    if (delErr) {
      throw new Error(delErr.message || "Failed to remove favorite");
    }

    return "removed";
  }

  const { data: ranksRows, error: rankErr } = await writeClient
    .from("favorite_beaches")
    .select("rank")
    .eq("user_id", userId);

  if (rankErr) {
    throw new Error(rankErr.message || "Failed to fetch ranks");
  }

  const nextRank =
    (ranksRows || [])
      .map((row) => row.rank || 0)
      .reduce((max, cur) => (cur > max ? cur : max), 0) + 1;

  const { error: insErr } = await writeClient.from("favorite_beaches").insert({
    user_id: userId,
    beach_id: beachId,
    rank: nextRank,
  });

  if (insErr) {
    throw new Error(insErr.message || "Failed to add favorite");
  }

  return "added";
}

// Toggle favorite for a beach for the authenticated user
export const POST = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "beach");
    if ("error" in uuidResult) return uuidResult.error;

    const beachId = uuidResult.value;

    if (await shouldUseManualE2EFavoritePath(supabase, user.id)) {
      const action = await toggleFavoriteManually(
        createSupabaseServiceRoleClient(),
        user.id,
        beachId
      );
      revalidateFavoriteSurfaces();
      return createSuccessResponse({ action });
    }

    const { data: action, error } = await supabase.rpc(
      "toggle_favorite_beach_guarded",
      { p_beach_id: beachId }
    );

    if (isFavoriteQuotaError(error)) {
      return createErrorResponse(
        "Favorite quota exceeded",
        { code: "favorite_quota_exceeded", limit: FREE_FAVORITES_LIMIT },
        403
      );
    }

    if (error) {
      throw new Error(error.message || "Failed to toggle favorite");
    }

    if (!isFavoriteAction(action)) {
      throw new Error("Failed to toggle favorite");
    }

    revalidateFavoriteSurfaces();
    return createSuccessResponse({ action });
  },
  { errorMessage: "Failed to toggle favorite" }
);
