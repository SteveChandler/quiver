import { createServerClient, createServiceRoleClient } from "../supabase";

// Export server client functions for server actions and components
export const createSupabaseServerClient = createServerClient;

export const createSupabaseServiceRoleClient = createServiceRoleClient;
