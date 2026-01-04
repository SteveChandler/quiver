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
      .from("badge_definitions")
      .select("*")
      .order("category", { ascending: true })
      .order("badge_slug", { ascending: true });

    if (error) throw error;

    return createSuccessResponse({ badges: data || [] });
  } catch (error) {
    return handleApiError(error, "Failed to load badge definitions");
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









