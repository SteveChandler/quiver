import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

/**
 * Creates a Supabase client authenticated with a Bearer JWT token.
 * Used for mobile app requests that send auth via Authorization header
 * instead of cookies.
 *
 * The returned client includes the JWT in all Supabase requests,
 * ensuring RLS policies are enforced for the authenticated user.
 */
export function createBearerTokenClient(jwt: string) {
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).trim();
  const supabaseAnonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  ).trim();

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
