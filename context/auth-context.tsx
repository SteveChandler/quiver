"use client";

import type React from "react";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * AuthContext provides authentication state and methods throughout the application.
 *
 * Lifecycle:
 * 1. On mount (client-side only), initializes auth state from Supabase
 * 2. Sets up auth state change listener for real-time updates
 * 3. Manages session refresh and user account setup
 * 4. Cleans up subscriptions on unmount to prevent memory leaks
 *
 * Performance considerations:
 * - Uses refs to prevent race conditions during initialization
 * - Memoized to prevent unnecessary re-renders
 * - 8-second timeout for auth initialization to prevent blocking UI
 */

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use refs to prevent race conditions
  const initializingRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  // Centralized function to update auth state
  const setupUserAccount = useCallback(async (userId: string) => {
    if (setupCompleteRef.current) return;

    try {
      // Add any user setup logic here (create profile, etc.)
      setupCompleteRef.current = true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: User setup failed:", error);
      }
      // Don't fail auth if setup fails
    }
  }, []);

  const updateAuthState = useCallback(
    (newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      setIsAuthenticated(!!newSession);

      // Setup user account if needed
      if (newSession?.user && !setupCompleteRef.current) {
        setupUserAccount(newSession.user.id);
      }
    },
    [setupUserAccount]
  );

  // Simplified session refresh function
  const refreshSession = async (): Promise<void> => {
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setIsLoading(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        // Only log critical errors in development
        if (process.env.NODE_ENV === "development") {
          console.error("AuthContext: Error getting session:", error);
        }
        updateAuthState(null);
        return;
      }

      updateAuthState(session);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Exception during session refresh:", error);
      }
      updateAuthState(null);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
      setIsInitialized(true);
    }
  };

  // Simplified user setup function
  // Initialize auth state on mount - client-side only
  useEffect(() => {
    let mounted = true;
    let subscription: any = null;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      if (initializingRef.current || !mounted) return;

      initializingRef.current = true;
      setIsLoading(true);

      // Set a reasonable timeout for better UX - 8 seconds should be sufficient
      timeoutId = setTimeout(() => {
        if (mounted && initializingRef.current) {
          if (process.env.NODE_ENV === "development") {
            console.warn("AuthContext: Auth initialization timed out after 8s");
          }
          updateAuthState(null);
          setIsLoading(false);
          setIsInitialized(true);
          initializingRef.current = false;
        }
      }, 8000); // 8 second timeout for better UX

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        // Clear timeout since we got a response
        clearTimeout(timeoutId);

        if (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("AuthContext: Error during initialization:", error);
          }
          // Don't immediately clear auth state on error - session might still be valid
          updateAuthState(session);
        } else {
          updateAuthState(session);
        }

        // Set up auth state listener for real-time updates
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(
          (event: AuthChangeEvent, session: Session | null) => {
            if (!mounted) return;

            // Handle post-auth redirect when user signs in
            if (event === "SIGNED_IN" && session) {
              // Clear stored redirect path - components will re-render with new auth state
              // This prevents redirect loops caused by hard page reloads
              const storedPath = localStorage.getItem("auth_redirect_path");
              if (storedPath) {
                console.log(
                  "[AuthContext] Clearing redirect path (already on page):",
                  storedPath
                );
                localStorage.removeItem("auth_redirect_path");
              }
              // Note: We don't navigate here. The auth state update (below) will cause
              // React components to re-render and show authenticated content.
              // For cross-page redirects (OAuth, magic link), see app/auth/callback/route.ts
            }

            updateAuthState(session);
          }
        );

        subscription = authSubscription;
      } catch (error) {
        if (mounted) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "AuthContext: Exception during initialization:",
              error
            );
          }
          clearTimeout(timeoutId);
          // Only clear auth state on critical exceptions
          updateAuthState(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
          initializingRef.current = false;
        }
      }
    };

    // Only initialize on client side
    if (typeof window !== "undefined") {
      initializeAuth();
    } else {
      // Server side - set defaults immediately
      setIsLoading(false);
      setIsInitialized(true);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
      initializingRef.current = false;
    };
  }, [supabase, updateAuthState]);

  const signUp = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      const emailRedirectTo = siteUrl
        ? `${siteUrl.replace(/\/$/, "")}/auth/confirm?next=/`
        : undefined;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(fullName ? { data: { full_name: fullName } } : {}),
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });

      if (error) throw error;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Sign up error:", error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);

    try {
      // Reset state
      setupCompleteRef.current = false;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // The onAuthStateChange listener will handle updating the state
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Sign in error:", error);
      }
      updateAuthState(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      // Reset setup state
      setupCompleteRef.current = false;

      // The onAuthStateChange listener will handle clearing the state
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Sign out error:", error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
