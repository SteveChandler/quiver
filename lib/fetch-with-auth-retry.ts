import { createClient } from "@/lib/supabase/client";

/**
 * Fetch wrapper that retries once on 401 after attempting a session refresh.
 * If refresh fails or the retry still returns 401, dispatches a `quiver:auth-expired`
 * event so the AuthContext can clear stale auth state.
 */
export async function fetchWithAuthRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 401) {
    return response;
  }

  // Attempt to refresh the session
  const supabase = createClient();
  const { error } = await supabase.auth.refreshSession();

  if (error) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("quiver:auth-expired"));
    }
    return response;
  }

  // Retry the original request once
  const retryResponse = await fetch(input, init);

  if (retryResponse.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("quiver:auth-expired"));
    }
  }

  return retryResponse;
}
