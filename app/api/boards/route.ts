import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Board } from "@/types/database";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("🏄‍♂️ API Route: Creating board with data:", body);

    const supabase = await createSupabaseServerClient();

    // Get the current user from the authenticated session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("👤 API Route: Auth user check:", {
      hasUser: !!user,
      authUserId: user?.id,
      userEmail: user?.email,
      error: userError,
    });

    if (userError || !user) {
      console.error("❌ API Route: Authentication error:", userError);
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Prepare the data to insert
    const insertData = {
      user_id: user.id,
      ...body,
      session_count: 0,
    };

    console.log("📝 API Route: Data to insert:", insertData);

    const { data, error } = await supabase
      .from("boards")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("💥 API Route: Database error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.log("✅ API Route: Board created successfully:", data);

    // Revalidate the profile page
    revalidatePath("/profile");

    return NextResponse.json({
      success: true,
      data: data as Board,
    });
  } catch (error) {
    console.error("API Route: Error creating board:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
