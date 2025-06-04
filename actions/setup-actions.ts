"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setupDatabaseFunctions() {
  const supabase = await createSupabaseServerClient();

  try {
    // Create increment function
    await supabase.rpc("create_increment_function", {});

    // Create decrement function
    await supabase.rpc("create_decrement_function", {});

    return { success: true };
  } catch (error) {
    console.error("Error setting up database functions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
