import { createClient } from "@supabase/supabase-js";
import {
  createBrowserClient as createSupabaseBrowserClient,
  createServerClient as createSupabaseServerClient,
} from "@supabase/ssr";

/**
 * Create a fetch wrapper that forces "no-store" semantics.
 *
 * Why: In Next.js (especially Edge runtime), fetch responses can be cached unless explicitly disabled.
 * Supabase JS uses fetch internally, so monitoring/cron reads can see stale data unless we force no-store.
 */
export function createNoStoreFetch(baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return (async (input: any, init?: any) => {
    // Preserve existing headers from init, or from Request input when present.
    const headers = new Headers(
      init?.headers ??
        (typeof Request !== "undefined" && input instanceof Request
          ? input.headers
          : undefined)
    );

    // Extra defense: set no-cache headers for intermediaries.
    // (Next's caching behavior is primarily driven by fetch's `cache` / `next` options.)
    if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
    if (!headers.has("pragma")) headers.set("pragma", "no-cache");

    return await baseFetch(input, {
      ...init,
      headers,
      cache: "no-store",
    });
  }) as any;
}

// Create a browser client using @supabase/ssr
const createBrowserClient = () => {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing");
    // Return a mock client to prevent crashes but still function
    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: () => Promise.reject(new Error("Supabase not configured")),
        signInWithPassword: () => Promise.reject(new Error("Supabase not configured")),
        signOut: () => Promise.reject(new Error("Supabase not configured")),
      }
    } as any;
  }

  return createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    global: {
      headers: {
        "x-application-name": "quiver-surf-app",
      },
    }
  });
};

// Create a singleton instance for client components
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export const getClientBrowserClient = () => {
  if (typeof window !== "undefined") {
    if (!browserClient) {
      browserClient = createBrowserClient();
    }
    return browserClient;
  }

  // Return a new instance for SSR to avoid sharing state
  return createBrowserClient();
};

// Create a server client for server components and server actions
export const createServerClient = () => {
  // Prefer NEXT_PUBLIC_ for client-side, fallback to server-only vars
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim();
  const supabaseAnonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();

  // CRITICAL: Fail fast if config is missing to prevent cryptic errors later
  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error(
      "Supabase configuration missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
    console.error("[createServerClient]", error.message);
    throw error;
  }

  // Try to get cookies from Next.js
  let cookieStore: any = null;
  try {
    // Dynamic import to avoid client-side errors
    if (typeof window === "undefined") {
      // This will only execute on the server
      const { cookies } = require("next/headers");
      cookieStore = cookies();
    }
  } catch (error) {
    // Running outside of Next.js middleware/route handler context
    // This is expected during build time or in certain edge cases
    // Fall through to create a basic client without cookies
  }

  // Validate cookieStore has the expected interface before using it
  if (cookieStore && typeof cookieStore.get === "function") {
    try {
      const noStoreFetch = createNoStoreFetch(globalThis.fetch);
      return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
        global: {
          fetch: noStoreFetch as any,
        },
        cookies: {
          get(name) {
            try {
              return cookieStore.get(name)?.value;
            } catch {
              // Cookie access failed - return undefined to use anon auth
              return undefined;
            }
          },
          set(_name, _value, _options) {
            // No-op in Server Components and server actions to avoid
            // Next.js "mutable cookies" errors during RSC refresh.
            // API routes should use createAPIServerClient* which supports writes.
            return;
          },
          remove(_name, _options) {
            // No-op in Server Components and server actions; see comment above.
            return;
          },
        },
      });
    } catch (error) {
      // If server client creation fails, fall through to basic client
      console.warn("[createServerClient] Failed to create SSR client, using basic client:", error);
    }
  }

  // Fallback if cookies are not available or SSR client creation failed
  const noStoreFetch = createNoStoreFetch(globalThis.fetch);
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: noStoreFetch as any,
    },
  });
};

// Create a server client with service role for admin operations
export const createServiceRoleClient = () => {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // CRITICAL: Fail fast if config is missing
  if (!supabaseUrl || !supabaseServiceKey) {
    const error = new Error(
      "Supabase service role configuration missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
    console.error("[createServiceRoleClient]", error.message);
    throw error;
  }

  const noStoreFetch = createNoStoreFetch(globalThis.fetch);
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: noStoreFetch as any,
    },
  });
};
