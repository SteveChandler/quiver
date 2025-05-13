"use server"

import { createServerClient } from "@/lib/supabase"
import type { Session, SessionWithDetails } from "@/types/database"
import { revalidatePath } from "next/cache"

export async function getUserSessions(userId: string) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        beach:beaches(*),
        board:boards(*)
      `)
      .eq("user_id", userId)
      .order("session_date", { ascending: false })
      .order("session_time", { ascending: false })

    if (error) {
      throw error
    }

    return { success: true, data: data as SessionWithDetails[] }
  } catch (error) {
    console.error("Error fetching user sessions:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getUserSessionsByDateRange(userId: string, startDate: string, endDate: string) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        beach:beaches(*),
        board:boards(*)
      `)
      .eq("user_id", userId)
      .gte("session_date", startDate)
      .lte("session_date", endDate)
      .order("session_date", { ascending: true })
      .order("session_time", { ascending: true })

    if (error) {
      throw error
    }

    return { success: true, data: data as SessionWithDetails[] }
  } catch (error) {
    console.error("Error fetching user sessions by date range:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getSessionById(id: string, userId: string) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        beach:beaches(*),
        board:boards(*)
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    if (error) {
      throw error
    }

    return { success: true, data: data as SessionWithDetails }
  } catch (error) {
    console.error("Error fetching session:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getPublicSessions(limit = 10) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        beach:beaches(*),
        board:boards(*),
        user:profiles(*)
      `)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return { success: true, data: data as SessionWithDetails[] }
  } catch (error) {
    console.error("Error fetching public sessions:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function createSession(
  userId: string,
  sessionData: Omit<Session, "id" | "user_id" | "likes_count" | "comments_count" | "created_at" | "updated_at">,
) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        ...sessionData,
        likes_count: 0,
        comments_count: 0,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // If a board was used, increment its session count
    if (sessionData.board_id) {
      await supabase
        .from("boards")
        .update({
          session_count: supabase.rpc("increment", { row_id: sessionData.board_id }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionData.board_id)
        .eq("user_id", userId)
    }

    revalidatePath("/sessions")
    revalidatePath("/profile")
    return { success: true, data: data as Session }
  } catch (error) {
    console.error("Error creating session:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function updateSession(
  id: string,
  userId: string,
  sessionData: Partial<
    Omit<Session, "id" | "user_id" | "likes_count" | "comments_count" | "created_at" | "updated_at">
  >,
) {
  const supabase = createServerClient()

  try {
    // First, get the current session to check if board_id is changing
    const { data: currentSession, error: fetchError } = await supabase
      .from("sessions")
      .select("board_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    if (fetchError) {
      throw fetchError
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
      .single()

    if (error) {
      throw error
    }

    // Handle board session count updates if board_id changed
    if (sessionData.board_id !== undefined && currentSession.board_id !== sessionData.board_id) {
      // Decrement old board's session count if it exists
      if (currentSession.board_id) {
        await supabase
          .from("boards")
          .update({
            session_count: supabase.rpc("decrement", { row_id: currentSession.board_id }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentSession.board_id)
          .eq("user_id", userId)
      }

      // Increment new board's session count if it exists
      if (sessionData.board_id) {
        await supabase
          .from("boards")
          .update({
            session_count: supabase.rpc("increment", { row_id: sessionData.board_id }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionData.board_id)
          .eq("user_id", userId)
      }
    }

    revalidatePath("/sessions")
    revalidatePath("/profile")
    return { success: true, data: data as Session }
  } catch (error) {
    console.error("Error updating session:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function deleteSession(id: string, userId: string) {
  const supabase = createServerClient()

  try {
    // First, get the session to check if it has a board_id
    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("board_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    if (fetchError) {
      throw fetchError
    }

    // Delete the session
    const { error } = await supabase.from("sessions").delete().eq("id", id).eq("user_id", userId)

    if (error) {
      throw error
    }

    // If the session had a board, decrement its session count
    if (session.board_id) {
      await supabase
        .from("boards")
        .update({
          session_count: supabase.rpc("decrement", { row_id: session.board_id }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.board_id)
        .eq("user_id", userId)
    }

    revalidatePath("/sessions")
    revalidatePath("/profile")
    return { success: true }
  } catch (error) {
    console.error("Error deleting session:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
