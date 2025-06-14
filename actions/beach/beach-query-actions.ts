"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import type { Beach } from "@/types/database";

export async function getBeaches() {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    return supabase.from("beaches").select("*").order("name");
  });
}

export async function getBeachById(id: string) {
  return withDatabaseOperation<Beach>(async (supabase) => {
    return supabase.from("beaches").select("*").eq("id", id).single();
  });
}
