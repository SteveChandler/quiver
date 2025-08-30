"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  withAuthenticatedAction,
  withServerAction,
} from "@/lib/server-action-utils";
import type {
  Session,
  SessionWithDetails,
  Board,
  Beach,
  SessionMedia,
} from "@/types/database";
import type { SessionFormState } from "@/hooks/use-session-form";
import { 
  transformSessionFormStateToDbSchema, 
  sanitizeSessionPayload 
} from "@/lib/utils/session-utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Optional XP tracking - imported dynamically to avoid circular dependency
async function trackXPOptional(action: string, entityId?: string, entityType?: string) {
  try {
    const { trackXP } = await import("@/lib/gamification-actions");
    await trackXP(action as any, entityId, entityType as any);
  } catch (error) {
    console.warn("XP tracking failed:", error);
  }
}

type SessionInput = Omit<
  Session,
  "id" | "created_at" | "updated_at" | "user_id" | "profile_id"
>;
type BoardInput = Omit<Board, "id" | "created_at" | "updated_at" | "user_id">;

/**
 * Remove fields that should not be persisted when they are effectively unset.
 * - Strips keys with values of undefined or the Next.js serialized "$undefined"
 * - Drops empty-string UUIDs for id fields like beach_id/board_id
 * - Never forwards client-provided user_id/profile_id/status; these are set server-side
 */
function sanitizePayload<T extends Record<string, any>>(input: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    // Skip values that are not actually set
    if (value === undefined || value === "$undefined") continue;

    // Remove empty strings for known optional foreign keys
    if ((key === "board_id" || key === "beach_id") && value === "") continue;

    // Security: never trust client-sent ownership/status fields
    if (key === "user_id" || key === "profile_id" || key === "status") continue;

    cleaned[key] = value;
  }
  return cleaned as T;
}

export async function getUserSessions(userId: string, limit?: number) {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    try {
      let query = supabase
        .from("sessions")
        .select(
          `
          *,
          beach:beaches(*),
          board:boards(*),
          user:profiles(*)
        `
        )
        .eq("user_id", userId)
        .order("arrival_time", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SessionWithDetails[];
    } catch (e) {
      // Enhanced fallback: manually resolve beach relationships when joins fail
      let basic = supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("arrival_time", { ascending: false });
      if (limit) basic = basic.limit(limit);
      const { data: basicData } = await basic;
      
      // Manually resolve beach data for each session
      const enhancedSessions = await Promise.all(
        (basicData || []).map(async (session) => {
          let beach = null;
          
          // Try to fetch beach data if beach_id exists
          if (session.beach_id) {
            try {
              const { data: beachData } = await supabase
                .from("beaches")
                .select("*")
                .eq("id", session.beach_id)
                .single();
              beach = beachData;
            } catch (beachError) {
              // Beach fetch failed, continue with null
            }
          }
          
          // Try to fetch user data if user_id exists
          let user = { full_name: "Anonymous Surfer", avatar_url: null };
          if (session.user_id) {
            try {
              const { data: userData } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("id", session.user_id)
                .single();
              if (userData) {
                user = userData;
              }
            } catch (userError) {
              // User fetch failed, continue with default
            }
          }
          
          return {
            ...session,
            beach,
            board: null,
            user,
          };
        })
      );
      
      return enhancedSessions as SessionWithDetails[];
    }
  });
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
        board:boards(*),
        user:profiles(*)
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
        board:boards(*),
        user:profiles(*)
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
  return withAuthenticatedAction(async (user, supabase) => {
    // Update the session
    const { data: session, error } = await supabase
      .from("sessions")
      .update(data)
      .eq("id", id)
      .eq("user_id", user.id) // Make sure user owns this session
      .select()
      .single();

    if (error) {
      throw new Error("Failed to update session");
    }

    revalidatePath("/sessions");
    return session;
  });
}

export async function deleteSession(id: string, userId: string) {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

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
    return true;
  });
}

/**
 * Create a new logged (completed) surf session
 * Accepts either SessionFormState or SessionInput for backward compatibility
 */
export async function createLoggedSession(data: SessionFormState | SessionInput) {
  return withAuthenticatedAction(async (user, supabase) => {

    // Transform SessionFormState to database schema if needed
    let sessionData: Partial<Session>;
    if ('selectedBeach' in data || 'selectedBeachId' in data || 'boardId' in data) {
      // This is SessionFormState, transform it
      sessionData = transformSessionFormStateToDbSchema(data as SessionFormState);
    } else {
      // This is already SessionInput, use as-is
      sessionData = data as SessionInput;
    }

    // Create the session with completed status
    const cleaned = sanitizeSessionPayload(sessionData);
    
    // CRITICAL: Ensure we have a valid beach_id before creating session
    if (!cleaned.beach_id) {
      // If we have beach_name but no beach_id, try to find existing beach only
      if (cleaned.beach_name) {
        
        // Try to find existing beach by name (case-insensitive)
        const { data: existingBeach, error: lookupError } = await supabase
          .from("beaches")
          .select("id")
          .ilike("name", cleaned.beach_name)
          .limit(1)
          .single();
        
        if (lookupError && lookupError.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw new Error(`Failed to lookup beach: ${lookupError.message}`);
        }
        
        if (existingBeach) {
          cleaned.beach_id = existingBeach.id;
        } else {
          // Beach doesn't exist - require user to select from existing beaches
          throw new Error(`Beach "${cleaned.beach_name}" not found. Please select a beach from the dropdown menu.`);
        }
      } else {
        // No beach_id or beach_name provided
        throw new Error("Please select a beach from the dropdown menu.");
      }
    }
    
    const finalPayload = {
      ...cleaned,
      user_id: user.id,
      profile_id: user.id, // Add profile_id to satisfy the constraint
      status: "completed",
    };

    const { data: session, error } = await supabase
      .from("sessions")
      .insert(finalPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Session creation failed: ${error.message || 'Unknown database error'}`);
    }

    // Track XP for logging a completed session
    try {
      await trackXPOptional("plan_session", session.id, "session");
    } catch (xpError) {
      console.error("Failed to track XP for logged session:", xpError);
      // Don't fail the session creation if XP tracking fails
    }

    revalidatePath("/sessions");
    revalidatePath("/profile");
    return session;
  });
}

/**
 * Create a new planned surf session
 * Accepts either SessionFormState or SessionInput for backward compatibility
 */
export async function createPlannedSession(data: SessionFormState | SessionInput) {
  return withAuthenticatedAction(async (user, supabase) => {

    // Transform SessionFormState to database schema if needed
    let sessionData: Partial<Session>;
    if ('selectedBeach' in data || 'selectedBeachId' in data || 'boardId' in data) {
      // This is SessionFormState, transform it
      sessionData = transformSessionFormStateToDbSchema(data as SessionFormState);
    } else {
      // This is already SessionInput, use as-is
      sessionData = data as SessionInput;
    }

    // Create the session with planned status
    const cleaned = sanitizeSessionPayload(sessionData);
    
    // CRITICAL: Ensure we have a valid beach_id before creating session
    if (!cleaned.beach_id) {
      // If we have beach_name but no beach_id, try to find existing beach only
      if (cleaned.beach_name) {
        
        // Try to find existing beach by name (case-insensitive)
        const { data: existingBeach, error: lookupError } = await supabase
          .from("beaches")
          .select("id")
          .ilike("name", cleaned.beach_name)
          .limit(1)
          .single();
        
        if (lookupError && lookupError.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw new Error(`Failed to lookup beach: ${lookupError.message}`);
        }
        
        if (existingBeach) {
          cleaned.beach_id = existingBeach.id;
        } else {
          // Beach doesn't exist - require user to select from existing beaches
          throw new Error(`Beach "${cleaned.beach_name}" not found. Please select a beach from the dropdown menu.`);
        }
      } else {
        // No beach_id or beach_name provided
        throw new Error("Please select a beach from the dropdown menu.");
      }
    }
    
    const finalPayload = {
      ...cleaned,
      user_id: user.id,
      profile_id: user.id, // Add profile_id to satisfy the constraint
      status: "planned",
    };

    const { data: session, error } = await supabase
      .from("sessions")
      .insert(finalPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Session creation failed: ${error.message || 'Unknown database error'}`);
    }

    // Track XP for planning a session
    try {
      await trackXPOptional("plan_session", session.id, "session");
    } catch (xpError) {
      console.error("Failed to track XP for planned session:", xpError);
      // Don't fail the session creation if XP tracking fails
    }

    revalidatePath("/sessions");
    revalidatePath("/profile");
    return session;
  });
}

/**
 * Add a new board to user's quiver
 */
export async function addBoard(data: BoardInput) {
  return withAuthenticatedAction(async (user, supabase) => {
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
      throw new Error("Failed to add board");
    }

    // Track XP for adding a board
    try {
      await trackXPOptional("add_board", board.id, "board");
    } catch (xpError) {
      console.error("Failed to track XP for board addition:", xpError);
      // Don't fail the board creation if XP tracking fails
    }

    revalidatePath("/quiver");
    return board;
  });
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
  return withAuthenticatedAction(async (user, supabase) => {

  // Get sessions with all related data using the correct schema
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

    // Enhanced fallback: get basic sessions and manually resolve relationships
    const { data: basicSessions, error: basicError } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (basicError) {
      throw new Error("Failed to fetch sessions");
    }

    // Manually resolve beach data for each session
    const enhancedSessions = await Promise.all(
      (basicSessions || []).map(async (session) => {
        let beach = null;
        
        // Try to fetch beach data if beach_id exists
        if (session.beach_id) {
          try {
            const { data: beachData } = await supabase
              .from("beaches")
              .select("*")
              .eq("id", session.beach_id)
              .single();
            beach = beachData;
          } catch (beachError) {
            // Beach fetch failed, continue with null
          }
        }
        
        // Try to fetch user data if user_id exists
        let user = { full_name: "Anonymous Surfer", avatar_url: null };
        if (session.user_id) {
          try {
            const { data: userData } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", session.user_id)
              .single();
            if (userData) {
              user = userData;
            }
          } catch (userError) {
            // User fetch failed, continue with default
          }
        }
        
        return {
          ...session,
          beach,
          board: null,
          user,
        };
      })
    );
    
    return enhancedSessions;
  }

  return sessions || [];
  });
}

/**
 * Get a planned session for converting to completed (prefill data)
 */
export async function getPlannedSessionForConversion(sessionId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data: session, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*)
      `
      )
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "planned")
      .single();

    if (error) {
      throw new Error("Planned session not found");
    }

    return session;
  });
}

/**
 * Update a planned session to completed status with additional data
 */
export async function updatePlannedSessionToCompleted(
  sessionId: string,
  completedData: {
    duration_minutes?: number;
    wave_quality?: number;
    water_temp?: string;
    crowd_level?: number;
    parking_ease?: number;
    rating?: number;
    notes?: string;
  }
) {
  return withAuthenticatedAction(async (user, supabase) => {
    // First verify this is a planned session owned by the user
    const { data: existingSession, error: fetchError } = await supabase
      .from("sessions")
      .select("id, status, user_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "planned")
      .single();

    if (fetchError || !existingSession) {
      throw new Error("Planned session not found");
    }

    // Update the session to completed with new data
    const { data: updatedSession, error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        ...completedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    revalidatePath("/sessions");
    revalidatePath("/profile");
    return updatedSession;
  });
}
