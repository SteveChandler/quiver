"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";

export interface LocalActivityItem {
  id: string;
  userName: string;
  action: string;
  createdAt: string;
  type: "session" | "intel";
}

/**
 * Fetch recent activity at user's home beach (last 24h), excluding the
 * current user's own entries. Returns up to 5 items sorted newest-first.
 */
export async function getLocalActivity(beachId: string) {
  return withAuthenticatedAction<LocalActivityItem[]>(async (user, supabase) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions } = await supabase
      .from("sessions")
      .select(
        `id, created_at, user_id,
        profiles!sessions_user_id_fkey(display_name, full_name)`
      )
      .eq("beach_id", beachId)
      .neq("user_id", user.id)
      .gte("created_at", since)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: intel } = await supabase
      .from("intel_posts")
      .select(
        `id, created_at, user_id,
        profiles!intel_posts_user_id_fkey(display_name, full_name)`
      )
      .eq("beach_id", beachId)
      .neq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);

    const items: LocalActivityItem[] = [
      ...(sessions || []).map((s: any) => ({
        id: s.id,
        userName:
          s.profiles?.display_name || s.profiles?.full_name || "Someone",
        action: "logged a session",
        createdAt: s.created_at,
        type: "session" as const,
      })),
      ...(intel || []).map((i: any) => ({
        id: i.id,
        userName:
          i.profiles?.display_name || i.profiles?.full_name || "Someone",
        action: "posted intel",
        createdAt: i.created_at,
        type: "intel" as const,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);

    return items;
  });
}

/**
 * Persist the user's preferred session time on their profile.
 */
export async function updatePreferredSessionTime(time: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const validTimes = [
      "dawn_patrol",
      "morning",
      "lunch",
      "afternoon",
      "evening",
      "any",
    ];
    if (!validTimes.includes(time)) {
      throw new Error(`Invalid session time: ${time}`);
    }

    const { error } = await supabase
      .from("profiles")
      .update({ preferred_session_time: time })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    return { success: true };
  });
}
