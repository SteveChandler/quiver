"use server";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  withAuthenticatedAction,
  withServerAction,
} from "@/lib/server-action-utils";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import type {
  Session,
  SessionWithDetails,
  Board,
  Beach,
  SessionMedia,
  SessionInsert,
  Database,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionFormState } from "@/hooks/use-session-form";
import { 
  transformSessionFormStateToDbSchema, 
  sanitizeSessionPayload 
} from "@/lib/utils/session-utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BoardSnapshot } from "@/types/personalization";

// Optional XP tracking - imported dynamically to avoid circular dependency
async function trackXPOptional(action: string, entityId?: string, entityType?: string) {
  try {
    const { trackXP } = await import("@/lib/gamification");
    await trackXP(action as any, entityId, entityType as any);
  } catch (error) {
    console.warn("XP tracking failed:", error);
  }
}

// Session writes should be typed like INSERT payloads (not Row), since Row types
// include many non-nullable database-managed fields that callers should not supply.
type SessionInput = Partial<SessionInsert>;
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

/**
 * Capture board snapshot for session history preservation
 *
 * Creates a snapshot of board details at session time to preserve the exact
 * board configuration even if the board is later modified or deleted.
 *
 * @param supabase - Supabase client
 * @param boardId - Board ID to snapshot
 * @returns BoardSnapshot object or null if no board
 */
async function captureBoardSnapshot(
  supabase: SupabaseClient<Database>,
  boardId: string | null | undefined
): Promise<BoardSnapshot | null> {
  if (!boardId) return null;

  try {
    const { data: board, error } = await supabase
      .from('boards')
      .select('name, board_type, size, volume, dimensions')
      .eq('id', boardId)
      .single();

    if (error) {
      console.warn('Failed to capture board snapshot:', error);
      return null;
    }

    if (!board) return null;

    return {
      name: board.name,
      board_type: board.board_type,
      size: board.size,
      volume: board.volume,
      dimensions: board.dimensions,
    };
  } catch (error) {
    console.error('Error capturing board snapshot:', error);
    return null;
  }
}

type SupabaseClientType = SupabaseClient<Database>;

export async function addFeaturedPhotoToSessions<T extends { id: string; featured_photo_url?: string | null; image_url?: string | null }>(
  supabase: SupabaseClientType,
  sessions: T[]
): Promise<T[]> {
  if (!sessions || sessions.length === 0) {
    return sessions;
  }

  const sessionIds = sessions.map((session) => session.id).filter(Boolean);
  if (sessionIds.length === 0) {
    return sessions;
  }

  try {
    const { data, error } = await supabase
      .from("session_media")
      .select("session_id, public_url, media_type, created_at")
      .in("session_id", sessionIds)
      .in("media_type", ["photo"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch session photos for enrichment:", error);
      return sessions;
    }

    const featuredPhotoMap = new Map<string, string>();
    for (const row of data ?? []) {
      const sessionId = row.session_id;
      if (!sessionId || featuredPhotoMap.has(sessionId)) continue;
      if (row.public_url) {
        featuredPhotoMap.set(sessionId, row.public_url);
      }
    }

    return sessions.map((session) => {
      if (session.featured_photo_url) {
        return session;
      }
      const photoFromMedia = featuredPhotoMap.get(session.id);
      return {
        ...session,
        featured_photo_url: photoFromMedia ?? session.image_url ?? null,
      };
    });
  } catch (error) {
    console.error("Unexpected error enriching sessions with photos:", error);
    return sessions;
  }
}

export async function addFeaturedPhotoToSession<T extends { id: string; featured_photo_url?: string | null; image_url?: string | null }>(
  supabase: SupabaseClientType,
  session: T | null
): Promise<T | null> {
  if (!session) return session;
  const [enriched] = await addFeaturedPhotoToSessions(supabase, [session]);
  return enriched ?? session;
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
          session_date:arrival_time,
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
      const sessions = (data || []) as SessionWithDetails[];
      return await addFeaturedPhotoToSessions(supabase, sessions);
    } catch (e) {
      // Enhanced fallback: manually resolve beach relationships when joins fail
      trackFallback({ domain: 'sessions', field: 'join_enrichment', fallbackValue: 'manual-resolution', context: { userId } });
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
            session_date: session.arrival_time ?? null,
            beach,
            board: null,
            user,
          };
        })
      );
      
      return (await addFeaturedPhotoToSessions(
        supabase,
        enhancedSessions as SessionWithDetails[]
      )) as SessionWithDetails[];
    }
  });
}

/**
 * Get session metadata for SEO (works for both public and private sessions)
 * Returns minimal data needed for page metadata generation
 */
export async function getSessionMetadata(sessionId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        id,
        beach_name,
        arrival_time,
        rating,
        status,
        is_public,
        user:profiles!sessions_user_id_fkey(full_name, username),
        beach:beaches(name)
      `
      )
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      return { success: false as const, error: error?.message || "Session not found" };
    }

    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
      const formData = data as SessionFormState;
      sessionData = transformSessionFormStateToDbSchema(formData);
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
          // Dev-only fallback for mock users: use TEST_BEACH_ID when allowed
          try {
            const allow = (process.env.ALLOW_E2E_MUTATIONS_DEV === '1' || (process.env.ALLOW_E2E_MUTATIONS_DEV || '').toLowerCase() === 'true');
            if (allow) {
              const { data: me } = await supabase.from('profiles').select('is_mock').eq('id', user.id).single();
              const fallbackId = process.env.TEST_BEACH_ID;
              if (me?.is_mock && fallbackId) {
                cleaned.beach_id = fallbackId as any;
              }
            }
          } catch (e) { console.error('[SessionAction] fallback failed:', e); }
          if (!cleaned.beach_id) {
            throw new Error(`Beach "${cleaned.beach_name}" not found. Please select a beach from the dropdown menu.`);
          }
        }
      } else {
        // No beach_id or beach_name provided
        throw new Error("Please select a beach from the dropdown menu.");
      }
    }

    // Capture board snapshot for personalization insights
    const boardSnapshot = await captureBoardSnapshot(supabase, cleaned.board_id);

    const finalPayload = {
      ...cleaned,
      user_id: user.id,
      profile_id: user.id,
      status: "completed",
      board_snapshot: boardSnapshot,
    };

    // Choose write client: allow dev E2E mutations for mock users via service role
    let writeClient = supabase as any;
    try {
      if (
        (process.env.ALLOW_E2E_MUTATIONS_DEV === "1" ||
          (process.env.ALLOW_E2E_MUTATIONS_DEV || "").toLowerCase() === "true")
      ) {
        const { data: me } = await supabase
          .from("profiles")
          .select("is_mock")
          .eq("id", user.id)
          .single();
        if (me?.is_mock === true) {
          writeClient = createSupabaseServiceRoleClient();
        }
      }
    } catch (e) { console.error('[SessionAction] fallback failed:', e); }

    const { data: session, error } = await writeClient
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

    // Fire-and-forget milestone check (first_session_logged, wave_range_learned, etc.)
    import("@/lib/services/personalization-milestone-service")
      .then(({ checkAndRecordMilestones }) => checkAndRecordMilestones(user.id))
      .catch(() => {});

    // Create forecast snapshot for condition tracking
    try {
      const { createForecastSnapshotForSession } = await import("@/lib/utils/forecast-snapshot-utils");
      await createForecastSnapshotForSession(
        session.id,
        session.beach_id,
        session.arrival_time,
        session.user_id
      );
    } catch (snapshotError) {
      console.error("Failed to create forecast snapshot:", snapshotError);
      // Don't fail the session creation if snapshot creation fails
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
          // Dev-only fallback for mock users: use TEST_BEACH_ID when allowed
          try {
            const allow = (process.env.ALLOW_E2E_MUTATIONS_DEV === '1' || (process.env.ALLOW_E2E_MUTATIONS_DEV || '').toLowerCase() === 'true');
            if (allow) {
              const { data: me } = await supabase.from('profiles').select('is_mock').eq('id', user.id).single();
              const fallbackId = process.env.TEST_BEACH_ID;
              if (me?.is_mock && fallbackId) {
                cleaned.beach_id = fallbackId as any;
              }
            }
          } catch (e) { console.error('[SessionAction] fallback failed:', e); }
          if (!cleaned.beach_id) {
            throw new Error(`Beach "${cleaned.beach_name}" not found. Please select a beach from the dropdown menu.`);
          }
        }
      } else {
        // No beach_id or beach_name provided
        throw new Error("Please select a beach from the dropdown menu.");
      }
    }

    // Capture board snapshot for personalization insights
    const boardSnapshot = await captureBoardSnapshot(supabase, cleaned.board_id);

    const finalPayload = {
      ...cleaned,
      user_id: user.id,
      profile_id: user.id, // Add profile_id to satisfy the constraint
      status: "planned",
      board_snapshot: boardSnapshot,
    };

    // Choose write client: allow dev E2E mutations for mock users via service role
    let writeClient = supabase as any;
    try {
      if (
        (process.env.ALLOW_E2E_MUTATIONS_DEV === "1" ||
          (process.env.ALLOW_E2E_MUTATIONS_DEV || "").toLowerCase() === "true")
      ) {
        const { data: me } = await supabase
          .from("profiles")
          .select("is_mock")
          .eq("id", user.id)
          .single();
        if (me?.is_mock === true) {
          writeClient = createSupabaseServiceRoleClient();
        }
      }
    } catch (e) { console.error('[SessionAction] fallback failed:', e); }

    const { data: session, error } = await writeClient
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
    
    return await addFeaturedPhotoToSessions(
      supabase,
      enhancedSessions as SessionWithDetails[]
    );
  }

  const hydratedSessions = (sessions || []) as SessionWithDetails[];
  return await addFeaturedPhotoToSessions(supabase, hydratedSessions);
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
      .select("id, status, user_id, board_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "planned")
      .single();

    if (fetchError || !existingSession) {
      throw new Error("Planned session not found");
    }

    // Capture board snapshot for personalization insights when converting to completed
    const boardSnapshot = await captureBoardSnapshot(supabase, existingSession.board_id);

    // Update the session to completed with new data
    const { data: updatedSession, error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        ...completedData,
        board_snapshot: boardSnapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Track XP for adding a reflection if notes/rating-like fields provided
    try {
      if ((completedData?.notes && completedData.notes.trim().length > 0) ||
          typeof completedData?.rating === 'number' ||
          typeof completedData?.wave_quality === 'number') {
        await trackXPOptional("write_reflection", sessionId, "session");
      }
    } catch (xpError) {
      // Non-blocking
    }

    // Track XP for recording water temperature when provided on completion
    try {
      if (completedData?.water_temp && String(completedData.water_temp).trim().length > 0) {
        await trackXPOptional("record_temperature", sessionId, "session");
      }
    } catch (xpError) {
      // Non-blocking
    }

    // Create forecast snapshot for condition tracking
    // Note: This should also be triggered by the database trigger, but we add it here
    // for redundancy and to ensure it works even if the trigger fails
    try {
      const { createForecastSnapshotForSession } = await import("@/lib/utils/forecast-snapshot-utils");
      await createForecastSnapshotForSession(
        updatedSession.id,
        updatedSession.beach_id,
        updatedSession.arrival_time,
        updatedSession.user_id
      );
    } catch (snapshotError) {
      console.error("Failed to create forecast snapshot:", snapshotError);
      // Don't fail the session update if snapshot creation fails
    }

    revalidatePath("/sessions");
    revalidatePath("/profile");
    return updatedSession;
  });
}
