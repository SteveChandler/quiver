"use server"

import { createServerClient } from "@/lib/supabase"
import type { Board } from "@/types/database"
import { revalidatePath } from "next/cache"
import { createProfile, getProfile } from "./profile-actions"

export async function getUserBoards(userId: string) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return { success: true, data: data as Board[] }
  } catch (error) {
    console.error("Error fetching user boards:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getBoardById(id: string, userId: string) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase.from("boards").select("*").eq("id", id).eq("user_id", userId).single()

    if (error) {
      throw error
    }

    return { success: true, data: data as Board }
  } catch (error) {
    console.error("Error fetching board:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function createBoard(
  userId: string,
  boardData: Omit<Board, "id" | "user_id" | "session_count" | "created_at" | "updated_at">,
) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("boards")
      .insert({
        user_id: userId,
        ...boardData,
        session_count: 0,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    revalidatePath("/profile")
    return { success: true, data: data as Board }
  } catch (error) {
    console.error("Error creating board:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function updateBoard(
  id: string,
  userId: string,
  boardData: Partial<Omit<Board, "id" | "user_id" | "created_at" | "updated_at">>,
) {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from("boards")
      .update({
        ...boardData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    revalidatePath("/profile")
    return { success: true, data: data as Board }
  } catch (error) {
    console.error("Error updating board:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function deleteBoard(id: string, userId: string) {
  const supabase = createServerClient()

  try {
    const { error } = await supabase.from("boards").delete().eq("id", id).eq("user_id", userId)

    if (error) {
      throw error
    }

    revalidatePath("/profile")
    return { success: true }
  } catch (error) {
    console.error("Error deleting board:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// New function to get board templates
export async function getBoardTemplates() {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase.from("board_templates").select("*").order("name")

    if (error) {
      throw error
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error fetching board templates:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Completely revised function to copy board templates to user's account
export async function copyBoardTemplates(userId: string) {
  // This function will be called from the client, so we need to be extra careful
  if (!userId) {
    console.error("No user ID provided to copyBoardTemplates")
    return { success: false, error: "No user ID provided" }
  }

  try {
    // First, ensure the profile exists
    const profileResult = await getProfile(userId)

    if (!profileResult.success || !profileResult.data) {
      // Profile doesn't exist, create it
      const createResult = await createProfile(userId)
      if (!createResult.success) {
        return { success: false, error: "Failed to create profile" }
      }
    }

    // Now get the board templates
    const templatesResult = await getBoardTemplates()
    if (!templatesResult.success || !templatesResult.data || templatesResult.data.length === 0) {
      return { success: true, message: "No templates available" }
    }

    // Create a new server client for each operation to avoid any session issues
    const supabase = createServerClient()

    // Check if user already has boards - simplified approach
    const { count, error: countError } = await supabase
      .from("boards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    if (countError) {
      console.error("Error counting boards:", countError)
      return { success: false, error: "Error checking existing boards" }
    }

    // If user already has boards, don't copy templates
    if (count && count > 0) {
      return { success: true, message: "User already has boards" }
    }

    // Prepare boards data
    const boardsData = templatesResult.data.map((template) => ({
      user_id: userId,
      name: template.name,
      board_type: template.board_type,
      dimensions: template.dimensions,
      description: template.description,
      image_url: template.image_url,
      session_count: 0,
    }))

    // Insert boards one by one to avoid potential issues
    const results = []
    for (const boardData of boardsData) {
      try {
        const { error: insertError } = await supabase.from("boards").insert(boardData)

        if (insertError) {
          console.error("Error inserting board:", insertError)
          results.push({ success: false, error: insertError.message })
        } else {
          results.push({ success: true })
        }
      } catch (err) {
        console.error("Exception inserting board:", err)
        results.push({ success: false, error: err instanceof Error ? err.message : "Unknown error" })
      }

      // Add a small delay between inserts to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Check if all inserts were successful
    const allSuccessful = results.every((r) => r.success)

    revalidatePath("/profile")
    return {
      success: allSuccessful,
      message: allSuccessful ? "All boards copied successfully" : "Some boards failed to copy",
      results,
    }
  } catch (error) {
    console.error("Error in copyBoardTemplates:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error in copyBoardTemplates",
    }
  }
}
