'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase browser client for client-side authentication.
 *
 * Used primarily by `AuthGate` for OAuth flows.
 *
 * @deprecated
 * This browser-only Supabase client is deprecated.
 * Use the canonical clients instead:
 *
 * - Server Actions / Server Components:
 *   `import { createSupabaseServerClient } from "@/lib/supabase/server"`
 *
 * - Client Components:
 *   `import { createClient } from "@/lib/supabase/client"`
 *
 * This file remains temporarily for backwards compatibility only.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    }
  );
}

