import { createServerClient, createServiceRoleClient, createPublicReadClient } from "../supabase";

// Export server client functions for server actions and components
export const createSupabaseServerClient = createServerClient;

export const createSupabaseServiceRoleClient = createServiceRoleClient;

// Cookie-free anon client for ISR pages — never calls cookies(), safe for static rendering.
export { createPublicReadClient };
