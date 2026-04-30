import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

interface FollowWithNotificationResult {
  followed: boolean;
  was_existing: boolean;
  event_id: string | null;
  notification_dedup_collision: boolean;
}

/**
 * POST /api/users/[id]/follow/toggle - Toggle follow status for a user.
 *
 * Writes via the Bearer-aware `supabase` client from the withAuth context so
 * native clients authenticate correctly. The prior implementation delegated
 * to a `"use server"` action which re-authenticated via cookies only, which
 * silently failed for mobile callers.
 */
export const POST = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "user");
    if ("error" in uuidResult) return uuidResult.error;
    const targetUserId = uuidResult.value;

    if (user.id === targetUserId) {
      throw new Error("Cannot follow yourself");
    }

    const { data: existing, error: selectError } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (selectError && selectError.code !== "PGRST116") {
      throw selectError;
    }

    if (existing) {
      const { error: deleteError } = await supabase
        .from("user_follows")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;

      revalidatePath("/profile");
      revalidatePath(`/profile/${targetUserId}`);

      return createSuccessResponse({
        success: true,
        following: false,
        message: "Unfollowed",
      });
    }

    // Phase 5f: atomic follow+notification via Postgres function. Either both
    // the user_follows row AND the notification_events row commit, or neither
    // does. Weekly-bucketed dedupe key (`follow:${actor}:${recipient}:${YYYY-Www}`)
    // means rapid unfollow→re-follow within a week stays deduped, but
    // re-engagement after the bucket rolls over re-notifies.
    const isoWeekBucket = formatIsoYearWeek(new Date());
    const rpcClient = supabase as unknown as {
      rpc(
        fn: "follow_user_with_notification",
        args: {
          p_target_user_id: string;
          p_actor_id: string;
          p_dedupe_key: string;
        }
      ): Promise<{ data: FollowWithNotificationResult | null; error: { code?: string; message: string } | null }>;
    };
    const { error: rpcError } = await rpcClient.rpc(
      "follow_user_with_notification",
      {
        p_target_user_id: targetUserId,
        p_actor_id: user.id,
        p_dedupe_key: `follow:${user.id}:${targetUserId}:${isoWeekBucket}`,
      },
    );
    if (rpcError) throw rpcError;

    revalidatePath("/profile");
    revalidatePath(`/profile/${targetUserId}`);

    return createSuccessResponse({
      success: true,
      following: true,
      message: "Now following",
    });
  },
  { errorMessage: "Failed to toggle follow" },
);

export function GET() {
  return methodNotAllowed(["POST"]);
}

/**
 * ISO-8601 year + week (e.g. "2026-W18"). Used as a dedupe-key time bucket so
 * follow notifications only suppress within the same calendar week, not
 * forever. Algorithm per ISO-8601: thursday of the same week determines the
 * year; week 1 contains january 4th.
 */
function formatIsoYearWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
