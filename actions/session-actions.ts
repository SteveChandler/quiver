"use server";

import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type {
  Session,
  SessionWithDetails,
  Board,
  Beach,
  SessionMedia,
} from "@/types/database";

type SessionInput = Omit<
  Session,
  "id" | "created_at" | "updated_at" | "profile_id"
>;
type BoardInput = Omit<Board, "id" | "created_at" | "updated_at" | "user_id">;

// Wrapper to maintain previous API signature used throughout this file
function createServerActionClient(_opts: { cookies: typeof cookies }) {
  return createServerClient();
}

export async function getUserSessions(userId: string) {
  const supabase = createServerActionClient({ cookies });

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
      .eq("profile_id", userId)
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
  const supabase = createServerActionClient({ cookies });

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
      .eq("profile_id", userId)
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
  const supabase = createServerActionClient({ cookies });

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
      .eq("profile_id", userId)
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
  const supabase = createServerActionClient({ cookies });

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

export async function createSession(
  userId: string,
  sessionData: Omit<
    Session,
    | "id"
    | "profile_id"
    | "likes_count"
    | "comments_count"
    | "created_at"
    | "updated_at"
  >
) {
  const supabase = createServerActionClient({ cookies });

  try {
    // Convert session_date and start_time to arrival_time if they exist
    let finalData: any = { ...sessionData };

    if (sessionData.session_date) {
      const sessionDate = sessionData.session_date;
      const startTime = sessionData.start_time || "00:00:00"; // Default to midnight if no time specified

      // Combine date and time into a single timestamp
      const arrivalTime = new Date(`${sessionDate}T${startTime}`);

      // Remove fields that don't exist in the database
      const { session_date, start_time, end_time, ...restData } = finalData;

      finalData = {
        ...restData,
        arrival_time: arrivalTime.toISOString(),
      };
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        profile_id: userId,
        ...finalData,
        likes_count: 0,
        comments_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If a board was used, increment its session count
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

    revalidatePath("/sessions");
    revalidatePath("/profile");
    return { success: true, data: data as Session };
  } catch (error) {
    console.error("Error creating session:", error);
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
      | "profile_id"
      | "likes_count"
      | "comments_count"
      | "created_at"
      | "updated_at"
    >
  >
) {
  const supabase = createServerActionClient({ cookies });

  try {
    // First, get the current session to check if board_id is changing
    const { data: currentSession, error: fetchError } = await supabase
      .from("sessions")
      .select("board_id")
      .eq("id", id)
      .eq("profile_id", userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Convert session_date and start_time to arrival_time if they exist
    let finalData: any = { ...sessionData };

    if (sessionData.session_date) {
      const sessionDate = sessionData.session_date;
      const startTime = sessionData.start_time || "00:00:00"; // Default to midnight if no time specified

      // Combine date and time into a single timestamp
      const arrivalTime = new Date(`${sessionDate}T${startTime}`);

      // Remove fields that don't exist in the database
      const { session_date, start_time, end_time, ...restData } = finalData;

      finalData = {
        ...restData,
        arrival_time: arrivalTime.toISOString(),
      };
    }

    // Update the session
    const { data, error } = await supabase
      .from("sessions")
      .update({
        ...finalData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("profile_id", userId)
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
  const supabase = createServerActionClient({ cookies });

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Convert session_date and start_time to arrival_time if they exist
  let finalData: any = { ...data };

  if (data.session_date) {
    const sessionDate = data.session_date;
    const startTime = data.start_time || "00:00:00"; // Default to midnight if no time specified

    // Combine date and time into a single timestamp
    const arrivalTime = new Date(`${sessionDate}T${startTime}`);

    // Remove fields that don't exist in the database
    const { session_date, start_time, end_time, ...restData } = finalData;

    finalData = {
      ...restData,
      arrival_time: arrivalTime.toISOString(),
    };
  }

  // Update the session
  const { data: session, error } = await supabase
    .from("sessions")
    .update(finalData)
    .eq("id", id)
    .eq("profile_id", user.id) // Make sure user owns this session
    .select()
    .single();

  if (error) {
    console.error("Error updating session:", error);
    throw new Error("Failed to update session");
  }

  revalidatePath("/dashboard");
  return session;
}

export async function deleteSession(id: string, userId: string) {
  const supabase = createServerActionClient({ cookies });

  try {
    // First, get the session to check if it has a board_id
    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("board_id")
      .eq("id", id)
      .eq("profile_id", userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Delete the session
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", id)
      .eq("profile_id", userId);

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
 * Create a new planned surf session
 */
export async function createPlannedSession(data: SessionInput) {
  const supabase = createServerActionClient({ cookies });

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Auth error in createPlannedSession:", userError);
      throw new Error("Authentication error: " + userError.message);
    }

    if (!user) {
      console.error("No user found in createPlannedSession");
      throw new Error("Authentication required - No user found");
    }

    // Ensure a beach has been selected (beach_id is mandatory)
    if (!data.beach_id) {
      throw new Error("Please select a beach before planning a session");
    }

    // Validate session_date as well
    if (!data.session_date) {
      throw new Error("Session date is required");
    }

    // Clean up data by removing undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(
        ([_, v]) => v !== undefined && v !== "$undefined"
      )
    );

    // Convert session_date and start_time to arrival_time timestamp
    const sessionDate = data.session_date;
    const startTime = data.start_time || "00:00:00"; // Default to midnight if no time specified

    // Combine date and time into a single timestamp
    const arrivalTime = new Date(`${sessionDate}T${startTime}`);

    // Remove the separate date and time fields that don't exist in the database
    const { session_date, start_time, end_time, ...restData } = cleanData;

    // Create the session with planned status
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        ...restData,
        profile_id: user.id,
        status: "planned",
        arrival_time: arrivalTime.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating planned session:", error);
      throw new Error("Failed to create planned session: " + error.message);
    }

    revalidatePath("/dashboard");
    return session;
  } catch (error) {
    console.error("Uncaught error in createPlannedSession:", error);
    throw error; // Re-throw to let the client handle it
  }
}

/**
 * Create a new logged (completed) surf session
 */
export async function createLoggedSession(data: SessionInput) {
  const supabase = createServerActionClient({ cookies });

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Auth error in createLoggedSession:", userError);
      throw new Error("Authentication required: " + userError.message);
    }

    if (!user) {
      console.error("No user found in createLoggedSession");
      throw new Error("Authentication required - No user found");
    }

    // Validate required fields
    if (!data.beach_name || !data.session_date) {
      throw new Error("Beach name and session date are required");
    }

    // Clean up data by removing undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(
        ([_, v]) => v !== undefined && v !== "$undefined"
      )
    );

    // Convert session_date and start_time to arrival_time timestamp
    const sessionDate = data.session_date;
    const startTime = data.start_time || "00:00:00"; // Default to midnight if no time specified

    // Combine date and time into a single timestamp
    const arrivalTime = new Date(`${sessionDate}T${startTime}`);

    // Remove the separate date and time fields that don't exist in the database
    const { session_date, start_time, end_time, ...restData } = cleanData;

    // Create the session with completed status
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        ...restData,
        profile_id: user.id,
        status: "completed",
        arrival_time: arrivalTime.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating logged session:", error);
      throw new Error("Failed to create logged session: " + error.message);
    }

    revalidatePath("/dashboard");
    return session;
  } catch (error) {
    console.error("Uncaught error in createLoggedSession:", error);
    throw error; // Re-throw to let the client handle it
  }
}

/**
 * Get all sessions for the current user
 */
export async function getCurrentUserSessions() {
  const supabase = createServerActionClient({ cookies });

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Get all sessions, ordered by date (newest first)
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(
      `
      *,
      beach:beaches(*),
      board:boards(*),
      media:session_media(*)
    `
    )
    .eq("profile_id", user.id)
    .order("arrival_time", { ascending: false });

  if (error) {
    console.error("Error fetching sessions:", error);
    throw new Error("Failed to fetch sessions");
  }

  return sessions;
}

/**
 * Get all user's boards (quiver)
 */
export async function getUserBoards() {
  const supabase = createServerActionClient({ cookies });

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  // Get all boards
  const { data: boards, error } = await supabase
    .from("boards")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.error("Error fetching boards:", error);
    throw new Error("Failed to fetch boards");
  }

  return boards || []; // Return boards or an empty array if null/undefined
}

/**
 * Add a new board to user's quiver
 */
export async function addBoard(data: BoardInput) {
  const supabase = createServerActionClient({ cookies });

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
 * Get all beaches (for selection in forms)
 */
export async function getBeaches() {
  const supabase = createServerActionClient({ cookies });

  // Get all beaches
  const { data: beaches, error } = await supabase
    .from("beaches")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching beaches:", error);
    throw new Error("Failed to fetch beaches");
  }

  return beaches;
}

/**
 * Upload media for a session (photo or video)
 */
export async function uploadSessionMedia(
  sessionId: string,
  file: File,
  mediaType: "image" | "video"
) {
  const supabase = createServerActionClient({ cookies });

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
    .eq("profile_id", user.id)
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
 * Get all sessions for the community tab
 */
export async function getAllSessions(limit = 20) {
  const supabase = createServerActionClient({ cookies });

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
