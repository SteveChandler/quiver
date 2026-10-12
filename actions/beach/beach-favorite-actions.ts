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
