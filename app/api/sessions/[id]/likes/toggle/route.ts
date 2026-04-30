import { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  validateUuidParam,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { creditAuthorWithXP } from "@/lib/gamification";

interface LikeWithNotificationResult {
  liked: boolean;
  was_existing: boolean;
  event_id: string | null;
  notification_dedup_collision: boolean;
}

/**
 * POST /api/sessions/[id]/likes/toggle - Toggle like status for a session.
 *
 * Writes via the Bearer-aware `supabase` client from the withAuth context so
 * native clients authenticate correctly. The prior implementation delegated
 * to `toggleSessionLike` — a `"use server"` action — which re-authenticated
 * via cookies only and silently failed for mobile callers (the action
 * returned `{ success: false, error: "Authentication required" }` without
 * writing to `session_likes`).
 */
export const POST = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "session");
    if ("error" in uuidResult) return uuidResult.error;
    const sessionId = uuidResult.value;

    const { data: existing, error: selectError } = await supabase
      .from("session_likes")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (selectError && selectError.code !== "PGRST116") {
      throw selectError;
    }

    if (existing) {
      const { error: deleteError } = await supabase
        .from("session_likes")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;

      return createSuccessResponse({
        success: true,
        liked: false,
        message: "Session unliked",
      });
    }

    // Phase 5f: atomic like+notification via Postgres function. Either both
    // the session_likes row AND the notification_events row commit, or neither
    // does. No orphan notifications from a failed mutation; no orphan likes
    // from a failed enqueue. The function is idempotent on (session_id, user_id),
    // catches unique_violation on the notification dedupe_key internally, and
    // suppresses self-like notifications.
    const rpcClient = supabase as unknown as {
      rpc(
        fn: "like_session_with_notification",
        args: { p_session_id: string; p_actor_id: string; p_dedupe_key: string }
      ): Promise<{ data: LikeWithNotificationResult | null; error: { code?: string; message: string } | null }>;
    };
    const { data: rpcData, error: rpcError } = await rpcClient.rpc(
      "like_session_with_notification",
      {
        p_session_id: sessionId,
        p_actor_id: user.id,
        p_dedupe_key: `like:${sessionId}:${user.id}`,
      },
    );
    if (rpcError) throw rpcError;
    const result: LikeWithNotificationResult = rpcData ?? {
      liked: true,
      was_existing: false,
      event_id: null,
      notification_dedup_collision: false,
    };

    // Credit the session author with XP. Idempotent and non-blocking — the
    // like is already persisted, so a credit failure shouldn't fail the POST.
    // Skip when the like already existed (idempotent re-POST).
    if (!result.was_existing) {
      const { data: session } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", sessionId)
        .single();
      if (session && session.user_id && session.user_id !== user.id) {
        void creditAuthorWithXP(session.user_id, "session", sessionId).catch(
          (err) => console.error("Failed to credit author XP:", err),
        );
      }
    }

    return createSuccessResponse({
      success: true,
      liked: true,
      message: "Session liked",
    });
  },
  { errorMessage: "Failed to toggle like" },
);
