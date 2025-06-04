"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Board } from "@/types/database";
import { revalidatePath } from "next/cache";

export async function getUserBoards(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: data as Board[] };
  } catch (error) {
    console.error("Error fetching user boards:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getBoardById(id: string, userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: data as Board };
  } catch (error) {
    console.error("Error fetching board:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function createBoard(
  boardData: Omit<
    Board,
    "id" | "user_id" | "session_count" | "created_at" | "updated_at"
  >
) {
  console.log("🏄‍♂️ Starting createBoard function");
  console.log("📋 Board data received:", boardData);

  const supabase = await createSupabaseServerClient();
  console.log("📡 Supabase client created");

  // Debug: Check if we have cookies
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const supabaseCookies = allCookies.filter((cookie) =>
      cookie.name.includes("supabase")
    );
    console.log("🍪 Supabase cookies found:", supabaseCookies.length);
    console.log(
      "🍪 Cookie names:",
      supabaseCookies.map((c) => c.name)
    );
  } catch (cookieError) {
    console.error("🍪 Error accessing cookies:", cookieError);
  }

  // Get the current user from the authenticated session
  console.log("🔍 Attempting to get user from auth...");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("👤 Auth user check:", {
    hasUser: !!user,
    authUserId: user?.id,
    userEmail: user?.email,
    error: userError,
    errorMessage: userError?.message,
    errorCode: userError?.status,
  });

  if (userError || !user) {
    console.error("❌ Authentication error:", userError);
    return {
      success: false,
      error: "Authentication required",
    };
  }

  try {
    // Prepare the data to insert
    const insertData = {
      user_id: user.id,
      ...boardData,
      session_count: 0,
    };

    console.log("📝 Data to insert:", insertData);

    const { data, error } = await supabase
      .from("boards")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("💥 Database error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log("✅ Board created successfully:", data);
    revalidatePath("/profile");
    return { success: true, data: data as Board };
  } catch (error) {
    console.error("Error creating board:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateBoard(
  id: string,
  boardData: Partial<
    Omit<Board, "id" | "user_id" | "created_at" | "updated_at">
  >
) {
  const supabase = await createSupabaseServerClient();

  // Get the current user from the authenticated session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  try {
    const { data, error } = await supabase
      .from("boards")
      .update({
        ...boardData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
    return { success: true, data: data as Board };
  } catch (error) {
    console.error("Error updating board:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteBoard(id: string) {
  const supabase = await createSupabaseServerClient();

  // Get the current user from the authenticated session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  try {
    const { error } = await supabase
      .from("boards")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Error deleting board:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
