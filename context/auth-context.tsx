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
import { z } from "zod";
import { isNativeApp } from "@/lib/mobile/platform";
import * as Sentry from "@sentry/nextjs";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/lib/utils/safe-storage";
import { AUTH_INIT_TIMEOUT_MS } from "@/lib/constants/ui";

/**
 * Zod schema for validating signup metadata from OAuth flows.
 * This ensures nested objects have proper structure and prevents
 * arbitrary data injection into user metadata.
 */
const signupMetadataSchema = z
  .object({
    signup_context: z
      .object({
        source: z.string().optional(),
        referrer: z.string().optional(),
        campaign: z.string().optional(),
        landing_page: z.string().optional(),
      })
      .strict()
      .optional(),
    location_data: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy_m: z.number().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
      })
      .strict()
      .optional(),
    legal_consent: z
      .object({
        terms_accepted: z.boolean(),
        privacy_accepted: z.boolean(),
        timestamp: z.string(),
        version: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

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
 * - 8-second timeout stops loading spinner if initialization is slow
 */

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    metadata?: Record<string, any>,
  ) => Promise<void>;
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
    [setupUserAccount],
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
        if (process.env.NODE_ENV === "development") {
          console.error("AuthContext: Error getting session:", error);
        }
        // Don't clear auth state — the session in cookies may still be valid
        return;
      }

      updateAuthState(session);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Exception during session refresh:", error);
      }
      // Don't clear auth state on transient errors — leave current state intact
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  };

  // Initialize auth state on mount - client-side only
  useEffect(() => {
    let mounted = true;
    let subscription: any = null;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      if (initializingRef.current || !mounted) return;

      initializingRef.current = true;
      setIsLoading(true);

      // Timeout: stop loading spinner if initialization is slow.
      // Auth initialization continues in background; onAuthStateChange will update state.
      timeoutId = setTimeout(() => {
        if (mounted && initializingRef.current) {
          if (process.env.NODE_ENV === "development") {
            console.warn("AuthContext: Auth initialization timed out after 8s");
          }
          setIsLoading(false);
          initializingRef.current = false;
        }
      }, AUTH_INIT_TIMEOUT_MS);

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        // Clear timeout since we got a response
        clearTimeout(timeoutId);

        if (error && process.env.NODE_ENV === "development") {
          console.error("AuthContext: Error during initialization:", error);
        }

        // Update auth state regardless of error - session might still be valid
        updateAuthState(session);

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
              const storedPath = safeGetItem("auth_redirect_path");
              if (storedPath) {
                console.log(
                  "[AuthContext] Clearing redirect path (already on page):",
                  storedPath,
                );
                safeRemoveItem("auth_redirect_path");
              }

              // Mark user as returning for future session recovery
              safeSetItem("quiver_returning_user", "true");

              // Handle pending signup metadata from OAuth flow
              // Only apply if this is a fresh signup (created within last 60 seconds)
              const pendingMetadata = sessionStorage.getItem(
                "pending_signup_metadata",
              );
              if (pendingMetadata && session.user.created_at) {
                const createdAt = new Date(session.user.created_at).getTime();
                const isNewUser = Date.now() - createdAt < 60_000;

                if (isNewUser) {
                  try {
                    const raw = JSON.parse(pendingMetadata);

                    // Validate metadata structure using Zod schema
                    // This ensures all nested objects have proper shape
                    const parseResult = signupMetadataSchema.safeParse(raw);

                    if (!parseResult.success) {
                      if (process.env.NODE_ENV === "development") {
                        console.warn(
                          "[AuthContext] Invalid signup metadata structure:",
                          parseResult.error.flatten(),
                        );
                      }
                      // Skip updating with invalid metadata
                      sessionStorage.removeItem("pending_signup_metadata");
                      return;
                    }

                    const metadata = parseResult.data;

                    // Reject if payload is too large (16KB limit)
                    if (JSON.stringify(metadata).length > 16_384) {
                      throw new Error("Metadata payload exceeds size limit");
                    }

                    supabase.auth
                      .updateUser({ data: metadata })
                      .then(({ error }: { error: unknown }) => {
                        if (error && process.env.NODE_ENV === "development") {
                          console.error(
                            "[AuthContext] Failed to update user metadata:",
                            error,
                          );
                        }
                      });
                  } catch (e) {
                    if (process.env.NODE_ENV === "development") {
                      console.error(
                        "[AuthContext] Error parsing pending signup metadata:",
                        e,
                      );
                    }
                  }
                }
                // Always remove regardless of whether we applied it
                sessionStorage.removeItem("pending_signup_metadata");
              }
              // Send immediate welcome email for new users
              // Check if this is a fresh signup (created within last 60 seconds)
              // and we haven't already triggered the welcome email in this session
              if (session.user.created_at) {
                const createdAt = new Date(session.user.created_at).getTime();
                const isNewUser = Date.now() - createdAt < 60_000;
                const welcomeEmailKey = `welcome_email_sent_${session.user.id}`;
                const alreadyTriggered =
                  sessionStorage.getItem(welcomeEmailKey);

                if (isNewUser && !alreadyTriggered) {
                  // Mark as triggered immediately to prevent duplicates
                  sessionStorage.setItem(welcomeEmailKey, "true");

                  // Fire and forget - don't block auth flow
                  fetch("/api/internal/send-welcome-email", {
                    method: "POST",
                  }).catch((err) => {
                    // Log to console in dev, track in Sentry for production
                    if (process.env.NODE_ENV === "development") {
                      console.error(
                        "[AuthContext] Failed to trigger welcome email:",
                        err,
                      );
                    }
                    // Track in Sentry for production monitoring
                    Sentry.captureException(err, {
                      tags: { context: "auth_welcome_email" },
                      extra: { userId: session.user.id },
                    });
                  });
                }
              }

              // Note: We don't navigate here. The auth state update (below) will cause
              // React components to re-render and show authenticated content.
              // For cross-page redirects (OAuth, magic link), see app/auth/callback/route.ts
            }

            updateAuthState(session);
          },
        );

        subscription = authSubscription;
      } catch (error) {
        if (mounted) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "AuthContext: Exception during initialization:",
              error,
            );
          }
          clearTimeout(timeoutId);
          // Don't clear auth state — leave current state intact
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
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
    }

    // Listen for auth-expired events from fetchWithAuthRetry
    const handleAuthExpired = () => {
      updateAuthState(null);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("quiver:auth-expired", handleAuthExpired);
    }

    // Proactively refresh session when app becomes visible after being hidden
    // This ensures users stay logged in after closing/reopening the browser tab
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !initializingRef.current) {
        try {
          // Use getSession which triggers automatic token refresh if needed
          const {
            data: { session: refreshedSession },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            if (process.env.NODE_ENV === "development") {
              console.error(
                "AuthContext: Error refreshing session on visibility change:",
                error,
              );
            }
            return; // Don't update state on error - leave current state intact
          }

          if (mounted) {
            updateAuthState(refreshedSession);
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "AuthContext: Exception refreshing session on visibility change:",
              error,
            );
          }
        }
      }
    };

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // For Capacitor native apps - handle app resume and initialize plugins
    let appStateListener: { remove: () => Promise<void> } | null = null;
    if (isNativeApp()) {
      // Initialize native Google Sign-In plugin (must complete before login calls).
      // Uses a shared promise so auth-utils.ts can await readiness.
      const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const iosClientId =
        process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || webClientId;
      if (process.env.NODE_ENV === "development") {
        console.log("[AuthContext] Native app detected. Google client IDs:", {
          webClientId: webClientId
            ? `${webClientId.substring(0, 10)}...`
            : "MISSING",
          iosClientId: iosClientId
            ? `${iosClientId.substring(0, 10)}...`
            : "MISSING",
        });
      }
      if (webClientId) {
        import("@/lib/mobile/social-login")
          .then(({ initializeSocialLogin }) => {
            if (!mounted) return;
            return initializeSocialLogin(webClientId, iosClientId);
          })
          .catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.error(
                "AuthContext: Failed to initialize SocialLogin:",
                err,
              );
            }
            Sentry.captureException(err, {
              tags: { context: "social_login_init" },
            });
          });
      } else {
        console.warn(
          "AuthContext: NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID not set, native Google Sign-In will not work",
        );
      }

      import("@capacitor/app").then(({ App }) => {
        if (!mounted) return; // Component unmounted during import

        // Handle app resume from background
        App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive && !initializingRef.current && mounted) {
            try {
              const {
                data: { session: resumedSession },
                error,
              } = await supabase.auth.getSession();

              if (error) {
                if (process.env.NODE_ENV === "development") {
                  console.error(
                    "AuthContext: Error refreshing session on app resume:",
                    error,
                  );
                }
                return;
              }

              if (mounted) {
                updateAuthState(resumedSession);
              }
            } catch (error) {
              if (process.env.NODE_ENV === "development") {
                console.error(
                  "AuthContext: Exception refreshing session on app resume:",
                  error,
                );
              }
            }
          }
        }).then((listener) => {
          if (mounted) {
            appStateListener = listener;
          } else {
            listener.remove();
          }
        });
      });
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
      if (typeof window !== "undefined") {
        window.removeEventListener("quiver:auth-expired", handleAuthExpired);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
      if (appStateListener) {
        appStateListener.remove();
      }
      initializingRef.current = false;
    };
  }, [supabase, updateAuthState]);

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    metadata?: Record<string, any>,
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      const emailRedirectTo = siteUrl
        ? `${siteUrl.replace(/\/$/, "")}/auth/confirm?next=/`
        : undefined;

      // Merge fullName into metadata if provided
      const userData = {
        ...(fullName ? { full_name: fullName } : {}),
        ...(metadata || {}),
      };

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(Object.keys(userData).length > 0 ? { data: userData } : {}),
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
      // Don't clear existing session — a failed sign-in attempt shouldn't log out a user
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
