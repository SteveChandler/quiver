"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Beach } from "@/types/database";
import { withAuthenticatedAction, makeAuthenticatedAction } from "@/lib/server-action-utils";

export async function getFavoriteBeaches(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("favorite_beaches")
      .select(
        `
        id,
        rank,
        beach_id,
        beaches (*)
      `
      )
      .eq("user_id", userId)
      .order("rank", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    // Extract the beaches from the nested structure (preserve order)
    const beaches = (data || [])
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

    // Determine next rank (max + 1)
    const { data: maxRankRows } = await supabase
      .from("favorite_beaches")
      .select("rank")
      .eq("user_id", userId);

    const nextRank = (maxRankRows || [])
      .map((r: any) => r.rank || 0)
      .reduce((max: number, cur: number) => (cur > max ? cur : max), 0) + 1;

    // Add to favorites with rank
    const { error } = await supabase.from("favorite_beaches").insert({
      user_id: userId,
      beach_id: beachId,
      rank: nextRank,
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

// Reorder favorites (assign ranks 1..N in provided order)
export const reorderFavoriteBeaches = makeAuthenticatedAction(
  async (user, supabase, beachIdsInOrder: string[]) => {
    if (!Array.isArray(beachIdsInOrder)) {
      throw new Error("beachIdsInOrder must be an array");
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("favorite_beaches")
      .select("beach_id")
      .eq("user_id", user.id);
    if (fetchErr) throw fetchErr;

    const validSet = new Set((existing || []).map((r: any) => r.beach_id));
    const invalid = beachIdsInOrder.find((b) => !validSet.has(b));
    if (invalid) throw new Error("Invalid beach id in ordering");

    for (let i = 0; i < beachIdsInOrder.length; i++) {
      const beachId = beachIdsInOrder[i];
      const { error } = await supabase
        .from("favorite_beaches")
        .update({ rank: i + 1 })
        .eq("user_id", user.id)
        .eq("beach_id", beachId);
      if (error) throw error;
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  }
);

// Fetch top-ranked favorite beach for a user
export const getTopFavoriteBeach = withAuthenticatedAction(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("favorite_beaches")
    .select("rank, beaches(*)")
    .eq("user_id", userId)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const beach = (data as any)?.beaches as Beach | null;
  return beach || null;
});
