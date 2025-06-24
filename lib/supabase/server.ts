import { createServerClient, createServiceRoleClient } from "../supabase";

// Export server client functions for server actions and components
export const createSupabaseServerClient = createServerClient;

export const createSupabaseServiceRoleClient = createServiceRoleClient;

// Export the new API server client utilities
export {
  createAPIServerClient,
  createAPIServerClientWithResponse,
  getAuthenticatedAPIClient,
  validateSupabaseConfig,
} from "./api-server-client";
