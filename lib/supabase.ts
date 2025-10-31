import { createClient } from "@supabase/supabase-js";
import {
  createBrowserClient as createSupabaseBrowserClient,
  createServerClient as createSupabaseServerClient,
} from "@supabase/ssr";

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
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Server: Supabase URL or Anon Key is missing");
  }

  // Try to get cookies from Next.js
  let cookieStore = null;
  try {
    // Dynamic import to avoid client-side errors
    if (typeof window === "undefined") {
      // This will only execute on the server
      const { cookies } = require("next/headers");
      cookieStore = cookies();
    }
  } catch (error) {
    // Running outside of Next.js middleware/route handler context
    console.warn("Could not access cookies, running outside Next.js context");
  }

  if (cookieStore) {
    return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          try {
            return cookieStore.get(name)?.value;
          } catch (error) {
            console.error("Error getting cookie:", error);
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
  }

  // Fallback if cookies are not available
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Create a server client with service role for admin operations
export const createServiceRoleClient = () => {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Server: Supabase URL or Service Key is missing");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
