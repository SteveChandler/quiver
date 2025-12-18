/**
 * ===========================
 * CANONICAL SUPABASE CLIENT
 * ===========================
 *
 * ✅ Use the canonical Supabase clients (single source of truth):
 *   - Server Actions / Server Components / API routes:
 *     `@/lib/supabase/server`
 *
 *   - Client Components (browser):
 *     `@/lib/supabase/client`
 *
 * ❌ Do NOT use legacy helpers or browser-only clients in new code.
 * Legacy usage should be migrated into server actions.
 *
 * Notes:
 * - This file intentionally exposes a small `createClient()` wrapper for client-side usage.
 * - Server-side code should never import this module.
 */

import { getClientBrowserClient } from "../supabase";

// Export a createClient function that returns the browser client
export const createClient = () => {
  return getClientBrowserClient();
};
