"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";

export async function getBeaches() {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .order("name");

    if (error) {
      throw error;
    }

    return { success: true, data: data as Beach[] };
  } catch (error) {
    console.error("Error fetching beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getBeachById(id: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: data as Beach };
  } catch (error) {
    console.error("Error fetching beach:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
