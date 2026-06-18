import { createClient } from "@/lib/supabase/client";

function withAuthHeader(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  accessToken: string | null
): RequestInit | undefined {
  if (!accessToken) return init;

  const headers = new Headers(
    init?.headers ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined)
  );
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return {
    ...init,
    headers,
  };
}

async function getAccessToken(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper that retries once on 401 after attempting a session refresh.
 * If refresh fails or the retry still returns 401, dispatches a `quiver:auth-expired`
 * event so the AuthContext can clear stale auth state.
 */
export async function fetchWithAuthRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const supabase = createClient();
  const accessToken = await getAccessToken(supabase);
  const response = await fetch(input, withAuthHeader(input, init, accessToken));

  if (response.status !== 401) {
    return response;
  }

  if (process.env.NEXT_PUBLIC_E2E_DISABLE_AUTH_REFRESH === "true") {
    return response;
  }

  // Attempt to refresh the session
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("quiver:auth-expired"));
    }
    return response;
  }

  // Retry the original request once
  const retryAccessToken = data.session?.access_token ?? (await getAccessToken(supabase));
  const retryResponse = await fetch(input, withAuthHeader(input, init, retryAccessToken));

  if (retryResponse.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("quiver:auth-expired"));
    }
  }

  return retryResponse;
}
