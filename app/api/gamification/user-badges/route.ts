import { NextRequest } from "next/server";
import {
  createAuthError,
  createSuccessResponse,
  handleApiError,
  methodNotAllowed,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return createAuthError();

    const { data, error } = await supabase
      .from("user_badges")
      .select(
        `
        badge_slug,
        unlocked_at,
        context,
        badge_definitions (
          name,
          description,
          icon,
          category,
          xp_reward
        )
      `
      )
      .eq("user_id", user.id)
      .order("unlocked_at", { ascending: false });

    if (error) throw error;

    return createSuccessResponse({ badges: data || [] });
  } catch (error) {
    return handleApiError(error, "Failed to load user badges");
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}

export function PUT() {
  return methodNotAllowed(["GET"]);
}

export function PATCH() {
  return methodNotAllowed(["GET"]);
}

export function DELETE() {
  return methodNotAllowed(["GET"]);
}









