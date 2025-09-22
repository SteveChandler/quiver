"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import type { Beach } from "@/types/database";

export async function getBeaches() {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    try {
      return await supabase.from("beaches").select("*").order("name");
    } catch (err) {
      // Normalize non-Error throws to a standard shape
      return { data: null, error: { message: err instanceof Error ? err.message : "Unknown error" } } as any;
    }
  });
}

export async function getBeachById(id: string) {
  return withDatabaseOperation<Beach>(async (supabase) => {
    return supabase.from("beaches").select("*").eq("id", id).single();
  });
}

export async function getBeachBySlug(slug: string) {
  return withDatabaseOperation<Beach>(async (supabase) => {
    // Slugs are stored lowercase; enforce lowercase match
    const normalized = slug.trim().toLowerCase();
    return supabase
      .from("beaches")
      .select("*")
      .eq("slug", normalized)
      .single();
  });
}
