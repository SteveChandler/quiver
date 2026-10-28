"use server";

import {
  withDatabaseOperation,
  withAuthenticatedAction,
} from "@/lib/server-action-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Board, BoardInsert } from "@/types/database";
import { revalidatePath } from "next/cache";

// Optional XP tracking - imported dynamically to avoid circular dependency
async function trackXPOptional(action: string, entityId?: string, entityType?: string) {
  try {
    const { trackXP } = await import("@/lib/gamification");
    await trackXP(action as any, entityId, entityType as any);
  } catch (error) {
    // Non-blocking: log and continue
    console.warn("XP tracking failed:", error);
  }
}

export async function getUserBoards(userId: string) {
  return withDatabaseOperation<Board[]>(async (supabase) => {
    return supabase
      .from("boards")
      .select("*")
      .eq("user_id", userId)
      .is("retired_at", null)
      .order("created_at", { ascending: false });
  });
}

export async function createBoard(
  boardData: Omit<
    BoardInsert,
    "id" | "user_id" | "session_count" | "created_at" | "updated_at"
  >
) {
  // Validate required fields locally
  if (!boardData.name) {
    return {
      success: false,
      error: "name is required",
    };
  }
  if (!boardData.board_type) {
    return {
      success: false,
      error: "board_type is required",
    };
  }

  return withAuthenticatedAction<Board>(async (user, supabase) => {
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

    // Track XP for adding a board (non-blocking)
    try {
      await trackXPOptional("add_board", (data as Board).id, "board");
    } catch (xpError) {
      // Do not fail the flow on XP issues
    }

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

/**
 * Retires the board rather than deleting it: sessions reference boards(id) with no
 * ON DELETE action, so a hard delete fails for any board with a logged session.
 */
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
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("boards")
      .update({ retired_at: now, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Error retiring board:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
