// Re-export Database type for compatibility
// This file exists to support the conventional import path @/types/supabase
// The actual Database type is defined in database.generated.ts

export type { Database, Json } from './database';

// Import server client functions for type extraction
import type {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

/**
 * Type of Supabase client returned by createSupabaseServerClient.
 * Used for server-side operations with Row Level Security (RLS) enabled.
 *
 * @example
 * ```typescript
 * import type { SupabaseServerClient } from '@/types/supabase';
 *
 * async function myAction(supabase: SupabaseServerClient) {
 *   const { data } = await supabase.from('beaches').select('*');
 * }
 * ```
 */
export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Type of Supabase client returned by createSupabaseServiceRoleClient.
 * Used for admin operations that bypass Row Level Security (RLS).
 *
 * ⚠️ Use with caution - this client has full database access.
 *
 * @example
 * ```typescript
 * import type { SupabaseServiceClient } from '@/types/supabase';
 *
 * async function adminAction(supabase: SupabaseServiceClient) {
 *   // Can access any data regardless of RLS policies
 *   const { data } = await supabase.from('profiles').select('*');
 * }
 * ```
 */
export type SupabaseServiceClient = Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>;
