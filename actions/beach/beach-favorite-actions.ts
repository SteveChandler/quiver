"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Beach } from "@/types/database";

export async function getFavoriteBeaches(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("favorite_beaches")
      .select(
        `
        beach_id,
        beaches (*)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Extract the beaches from the nested structure
    const beaches = data
      .map((item: any) => item.beaches)
      .filter((beach: any) => beach !== null) as Beach[];

    return { success: true, data: beaches };
  } catch (error) {
    console.error("Error fetching favorite beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function addFavoriteBeach(userId: string, beachId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Check if already favorited
    const { data: existing, error: checkError } = await supabase
      .from("favorite_beaches")
      .select("id")
      .eq("user_id", userId)
      .eq("beach_id", beachId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    // If already favorited, return success
    if (existing) {
      return { success: true, message: "Beach already in favorites" };
    }

    // Add to favorites
    const { error } = await supabase.from("favorite_beaches").insert({
      user_id: userId,
      beach_id: beachId,
    });

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error adding favorite beach:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function removeFavoriteBeach(userId: string, beachId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase
      .from("favorite_beaches")
      .delete()
      .eq("user_id", userId)
      .eq("beach_id", beachId);

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error removing favorite beach:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
