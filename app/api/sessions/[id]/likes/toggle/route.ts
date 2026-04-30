import { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  validateUuidParam,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { creditAuthorWithXP } from "@/lib/gamification";
import { enqueueNotification } from "@/lib/notifications/enqueue";

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

    const { error: insertError } = await supabase
      .from("session_likes")
      .insert({ session_id: sessionId, user_id: user.id });
    if (insertError) throw insertError;

    // Credit the session author with XP. Idempotent (keyed on xp_events
    // (user_id, action, related_entity_id)) and non-blocking — the like is
    // already persisted so if the credit fails we shouldn't fail the POST.
    // creditAuthorWithXP uses a service-role client internally so it bypasses
    // RLS regardless of which client context we're in.
    const { data: session } = await supabase
      .from("sessions")
      .select("user_id, beach_name")
      .eq("id", sessionId)
      .single();

    if (session && session.user_id && session.user_id !== user.id) {
      void creditAuthorWithXP(session.user_id, "session", sessionId).catch(
        (err) => console.error("Failed to credit author XP:", err),
      );

      // Dedupe is permanent on (recipient, type, key): if you like → unlike →
      // re-like, the recipient gets exactly one notification, not two. The
      // worker still applies notif_likes/notif_push_enabled/notif_inapp_enabled
      // and quiet hours.
      void enqueueNotification({
        type: "like",
        recipientUserId: session.user_id,
        actorUserId: user.id,
        entityType: "session",
        entityId: sessionId,
        payload: {
          session_id: sessionId,
          beach_name: session.beach_name ?? null,
        },
        dedupeKey: `like:${sessionId}:${user.id}`,
      })
        .then((result) => {
          if (!result.enqueued && result.reason !== "duplicate") {
            console.error("[likes] enqueue failed", { sessionId, result });
          }
        })
        .catch((err) => {
          console.error("[likes] enqueue threw", { sessionId, err });
        });
    }

    return createSuccessResponse({
      success: true,
      liked: true,
      message: "Session liked",
    });
  },
  { errorMessage: "Failed to toggle like" },
);
