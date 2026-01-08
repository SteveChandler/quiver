import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { withAuth, createSuccessResponse, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

const LEVEL_THRESHOLDS = [
  { level: 1, title: "Kook", xp_required: 0 },
  { level: 2, title: "Grom", xp_required: 100 },
  { level: 3, title: "Paddler", xp_required: 300 },
  { level: 4, title: "Wavestorm Warrior", xp_required: 600 },
  { level: 5, title: "Rip Rider", xp_required: 1000 },
  { level: 6, title: "Barrel Hunter", xp_required: 1500 },
  { level: 7, title: "Point Breaker", xp_required: 2200 },
  { level: 8, title: "Lineup Legend", xp_required: 3000 },
  { level: 9, title: "Quiver King/Queen", xp_required: 4000 },
] as const;

function calculateLevel(xpTotal: number) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = LEVEL_THRESHOLDS[i];
    if (xpTotal >= t.xp_required) return t;
  }
  return LEVEL_THRESHOLDS[0];
}

async function ensureUserXpRow(
  userId: string,
  supabase: SupabaseClient<Database>
) {
  const { data: existing } = await supabase
    .from("user_xp")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("user_xp").insert({ user_id: userId, xp_total: 0, level: 1 });
  }
}

/**
 * GET /api/gamification/xp-status - Get current user's XP and level status
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    await ensureUserXpRow(user.id, supabase);

    const { data, error } = await supabase
      .from("user_xp")
      .select("xp_total, level, created_at, updated_at")
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    const { title } = calculateLevel(data.xp_total);

    const currentLevelIndex = LEVEL_THRESHOLDS.findIndex((t) => t.level === data.level);
    const nextLevelThreshold = LEVEL_THRESHOLDS[currentLevelIndex + 1];
    const currentLevelThreshold = LEVEL_THRESHOLDS[Math.max(currentLevelIndex, 0)];

    let progressToNext = 100;
    let xpToNext = 0;
    if (nextLevelThreshold) {
      const xpInCurrentLevel = data.xp_total - currentLevelThreshold.xp_required;
      const xpNeededForLevel = nextLevelThreshold.xp_required - currentLevelThreshold.xp_required;
      progressToNext = Math.round((xpInCurrentLevel / xpNeededForLevel) * 100);
      xpToNext = nextLevelThreshold.xp_required - data.xp_total;
    }

    return createSuccessResponse({
      xp: {
        ...data,
        level_title: title,
        progress_to_next: progressToNext,
        xp_to_next_level: xpToNext,
        next_level_title: nextLevelThreshold?.title || "Max Level",
      },
    });
  },
  { errorMessage: "Failed to load XP status" }
);












