"use server";

import {
  withDatabaseOperation,
  withAuthenticatedAction,
} from "@/lib/server-action-utils";
import { validateRequired } from "@/lib/database-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Board } from "@/types/database";
import { revalidatePath } from "next/cache";

export async function getUserBoards(userId: string) {
  return withDatabaseOperation<Board[]>(async (supabase) => {
    return supabase
      .from("boards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
  });
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
  // Validate required fields
  const validationError = validateRequired(boardData, ["name", "board_type"]);
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  return withAuthenticatedAction<Board>(async (user, supabase) => {
    console.log("🏄‍♂️ Creating board for user:", user.id);
    console.log("📋 Board data:", boardData);

    // Prepare the data to insert
    const insertData = {
      user_id: user.id,
      ...boardData,
      session_count: 0,
    };

    const { data, error } = await supabase
      .from("boards")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("💥 Database error:", error);
      throw error;
    }

    console.log("✅ Board created successfully:", data);
    revalidatePath("/profile");
    return data as Board;
  });
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
