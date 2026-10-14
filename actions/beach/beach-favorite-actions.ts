"use server";

import { revalidatePath } from "next/cache";
import { makeAuthenticatedAction } from "@/lib/server-action-utils";

export const removeFavoriteBeach = makeAuthenticatedAction(
  async (user, supabase, userId: string, beachId: string) => {
    try {
      if (user.id !== userId) {
        throw new Error("Unauthorized access to favorite beaches");
      }
      const { error } = await supabase
        .from("favorite_beaches")
        .delete()
        .eq("user_id", user.id)
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
);

export const reorderFavoriteBeaches = makeAuthenticatedAction(
  async (user, supabase, beachIdsInOrder: string[]) => {
    if (!Array.isArray(beachIdsInOrder)) {
      throw new Error("beachIdsInOrder must be an array");
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("favorite_beaches")
      .select("beach_id, custom_spot_id, rank")
      .eq("user_id", user.id);
    if (fetchErr) throw fetchErr;

    const rows = existing ?? [];
    const curated = rows.filter((row) => row.beach_id !== null);
    const validSet = new Set(curated.map((row) => row.beach_id));
    if (
      beachIdsInOrder.length !== curated.length ||
      new Set(beachIdsInOrder).size !== curated.length ||
      beachIdsInOrder.some((id) => !validSet.has(id))
    ) {
      throw new Error("Invalid beach ids in ordering");
    }

    const ranks = curated.map((row) => row.rank);
    const customRanks = new Set(
      rows.filter((row) => row.custom_spot_id !== null).map((row) => row.rank),
    );
    if (
      ranks.some((rank) => rank === null || customRanks.has(rank)) ||
      new Set(ranks).size !== ranks.length
    ) {
      throw new Error("Favorite ranks must be distinct before reordering");
    }
    ranks.sort((a, b) => a! - b!);

    for (let i = 0; i < beachIdsInOrder.length; i++) {
      const beachId = beachIdsInOrder[i];
      const { error } = await supabase
        .from("favorite_beaches")
        .update({ rank: ranks[i] })
        .eq("user_id", user.id)
        .eq("beach_id", beachId);
      if (error) throw error;
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  }
);
