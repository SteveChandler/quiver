import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Board } from "@/types/database";
import { revalidatePath } from "next/cache";
import {
  createSuccessResponse,
  createAuthError,
  handleApiError,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();

    // Get the current user from the authenticated session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("❌ API Route: Authentication error:", userError);
      return createAuthError("Authentication required");
    }

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Board name is required" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare the data to insert
    const insertData = {
      user_id: user.id,
      ...body,
      name: body.name.trim(),
      session_count: 0,
    };

    const { data, error } = await supabase
      .from("boards")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("💥 API Route: Database error:", error);
      return handleApiError(error, "Database error creating board");
    }

    // Revalidate the profile page
    revalidatePath("/profile");

    return createSuccessResponse(data as Board, 201);
  } catch (error) {
    console.error("API Route: Error creating board:", error);
    return handleApiError(error, "Error creating board");
  }
}
