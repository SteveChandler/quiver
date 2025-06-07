"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Session,
  SessionWithDetails,
  Board,
  Beach,
  SessionMedia,
} from "@/types/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type SessionInput = Omit<
  Session,
  "id" | "created_at" | "updated_at" | "user_id"
>;
type BoardInput = Omit<Board, "id" | "created_at" | "updated_at" | "user_id">;

export async function getUserSessions(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*)
      `
      )
      .eq("user_id", userId)
      .order("arrival_time", { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: data as SessionWithDetails[] };
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getUserSessionsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*)
      `
      )
      .eq("user_id", userId)
      .gte("arrival_time", startDate)
      .lte("arrival_time", endDate)
      .order("arrival_time", { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: data as SessionWithDetails[] };
  } catch (error) {
    console.error("Error fetching user sessions by date range:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getSessionById(id: string, userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*)
      `
      )
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: data as SessionWithDetails };
  } catch (error) {
    console.error("Error fetching session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getPublicSessions(limit = 10) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*),
        user:profiles(*)
      `
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return { success: true, data: data as SessionWithDetails[] };
  } catch (error) {
    console.error("Error fetching public sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateSession(
  id: string,
  userId: string,
  sessionData: Partial<
    Omit<
      Session,
      | "id"
      | "user_id"
      | "likes_count"
      | "comments_count"
      | "created_at"
      | "updated_at"
    >
  >
) {
  const supabase = await createSupabaseServerClient();

  try {
    // First, get the current session to check if board_id is changing
    const { data: currentSession, error: fetchError } = await supabase
      .from("sessions")
      .select("board_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Update the session
    const { data, error } = await supabase
      .from("sessions")
      .update({
        ...sessionData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Handle board session count updates if board_id changed
    if (
      sessionData.board_id !== undefined &&
      currentSession.board_id !== sessionData.board_id
    ) {
      // Decrement old board's session count if it exists
      if (currentSession.board_id) {
        await supabase
          .from("boards")
          .update({
            session_count: supabase.rpc("decrement", {
              row_id: currentSession.board_id,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentSession.board_id)
          .eq("user_id", userId);
      }

      // Increment new board's session count if it exists
      if (sessionData.board_id) {
        await supabase
          .from("boards")
          .update({
            session_count: supabase.rpc("increment", {
              row_id: sessionData.board_id,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionData.board_id)
          .eq("user_id", userId);
      }
    }

    revalidatePath("/sessions");
    revalidatePath("/profile");
    return { success: true, data: data as Session };
  } catch (error) {
    console.error("Error updating session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update an existing session
 */
export async function updateSessionForm(
  id: string,
  data: Partial<SessionInput>
) {
  const supabase = await createSupabaseServerClient();

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Update the session
  const { data: session, error } = await supabase
    .from("sessions")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id) // Make sure user owns this session
    .select()
    .single();

  if (error) {
    console.error("Error updating session:", error);
    throw new Error("Failed to update session");
  }

  revalidatePath("/sessions");
  return session;
}

export async function deleteSession(id: string, userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // First, get the session to check if it has a board_id
    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("board_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Delete the session
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    // If the session had a board, decrement its session count
    if (session.board_id) {
      await supabase
        .from("boards")
        .update({
          session_count: supabase.rpc("decrement", {
            row_id: session.board_id,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.board_id)
        .eq("user_id", userId);
    }

    revalidatePath("/sessions");
    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Error deleting session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new logged (completed) surf session
 */
export async function createLoggedSession(data: SessionInput, userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Authentication required");
    }

    // Verify the passed userId matches the authenticated user
    if (user.id !== userId) {
      throw new Error("User ID mismatch");
    }

    // Create the session with completed status
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        ...data,
        user_id: user.id,
        status: "completed",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/sessions");
    return { success: true, data: session };
  } catch (error) {
    console.error("Error creating logged session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new planned surf session
 */
export async function createPlannedSession(data: SessionInput, userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Authentication required");
    }

    // Verify the passed userId matches the authenticated user
    if (user.id !== userId) {
      throw new Error("User ID mismatch");
    }

    // Create the session with planned status
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        ...data,
        user_id: user.id,
        status: "planned",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/sessions");
    return { success: true, data: session };
  } catch (error) {
    console.error("Error creating planned session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Add a new board to user's quiver
 */
export async function addBoard(data: BoardInput) {
  const supabase = await createSupabaseServerClient();

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Add the board
  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      ...data,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding board:", error);
    throw new Error("Failed to add board");
  }

  revalidatePath("/quiver");
  return board;
}

/**
 * Upload media for a session (photo or video)
 */
export async function uploadSessionMedia(
  sessionId: string,
  file: File,
  mediaType: "image" | "video"
) {
  const supabase = await createSupabaseServerClient();

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Verify user owns this session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    throw new Error("Session not found or access denied");
  }

  // Upload the file to storage
  const fileName = `${sessionId}/${Date.now()}-${file.name}`;
  const filePath = `session-media/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("media")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading file:", uploadError);
    throw new Error("Failed to upload file");
  }

  // Add media record to database
  const { data: media, error: mediaError } = await supabase
    .from("session_media")
    .insert({
      session_id: sessionId,
      storage_path: filePath,
      media_type: mediaType,
    })
    .select()
    .single();

  if (mediaError) {
    console.error("Error recording media:", mediaError);
    throw new Error("Failed to record media");
  }

  revalidatePath(`/sessions/${sessionId}`);
  return media;
}

/**
 * Get sessions for a specific beach
 */
export async function getSessionsByBeach(beachId: string, limit = 10) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*),
        user:profiles(*)
      `
      )
      .eq("beach_id", beachId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return { success: true, data: data as SessionWithDetails[] };
  } catch (error) {
    console.error("Error fetching beach sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all sessions for the community tab
 */
export async function getAllSessions(limit = 20) {
  const supabase = await createSupabaseServerClient();

  // Get all sessions, ordered by date (newest first)
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(
      `
      *,
      beach:beaches(*),
      board:boards(*),
      user:profiles(*)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching community sessions:", error);
    throw new Error("Failed to fetch community sessions");
  }

  return sessions;
}
