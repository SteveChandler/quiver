import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { withAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";

/**
 * GET /api/gamification/badge-definitions - Get all available badge definitions
 */
export const GET = withAuth(
  async (_request: NextRequest, { supabase }: { supabase: SupabaseClient<Database> }) => {
    const { data, error } = await supabase
      .from("badge_definitions")
      .select("badge_slug, category, created_at, description, icon, name, xp_reward")
      .order("category", { ascending: true })
      .order("badge_slug", { ascending: true });

    if (error) throw error;

    return createSuccessResponse({ badges: data || [] });
  },
  { errorMessage: "Failed to load badge definitions" }
);











