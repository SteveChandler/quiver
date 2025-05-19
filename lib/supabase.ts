import { createClient } from "@supabase/supabase-js";

// Create a single supabase client for the browser with enhanced session handling
export const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce", // Use PKCE auth flow for better security
      storageKey: "supabase.auth.token",
      storage: {
        getItem: (key) => {
          if (typeof window !== "undefined") {
            return window.localStorage.getItem(key);
          }
          return null;
        },
        setItem: (key, value) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, value);
            // Also store in sessionStorage as a backup strategy
            window.sessionStorage.setItem(key, value);
          }
        },
        removeItem: (key) => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(key);
            window.sessionStorage.removeItem(key);
          }
        },
      },
    },
    global: {
      fetch: (...args) => {
        return fetch(...args);
      },
    },
    // Add retry logic
    db: {
      schema: "public",
    },
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

// Create a server client (for server components and server actions)
export const createServerClient = () => {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Server: Supabase URL or Service Key is missing");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
