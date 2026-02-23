/**
 * Supabase Cookie Detection Utilities
 *
 * Supabase uses chunked cookie format for auth tokens:
 * - sb-{project-ref}-auth-token.0
 * - sb-{project-ref}-auth-token.1 (if needed)
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

/**
 * Regex pattern to detect Supabase auth token cookies.
 * Matches: sb-<projectRef>-auth-token.<chunkNumber>
 */
const SUPABASE_AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=]+-auth-token\./;

/**
 * Check if Supabase auth cookie exists in browser cookies.
 * Safe for client-side use only (requires document.cookie access).
 *
 * @returns true if Supabase auth cookie is detected
 */
export function hasSupabaseAuthCookie(): boolean {
  try {
    return SUPABASE_AUTH_COOKIE_PATTERN.test(document.cookie);
  } catch {
    // Handle private browsing or cookie access errors
    return false;
  }
}
