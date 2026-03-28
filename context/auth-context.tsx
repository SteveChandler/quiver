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
import * as Sentry from "@sentry/nextjs";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/lib/utils/safe-storage";
import { getExistingVisitorId, clearVisitorId } from "@/lib/utils/visitor-id";
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
        method: z.string().optional(),
        entrypoint: z.string().optional(),
        landing_path: z.string().optional(),
        referrer: z.string().optional(),
        utm: z
          .object({
            source: z.string().nullable().optional(),
            medium: z.string().nullable().optional(),
            campaign: z.string().nullable().optional(),
            content: z.string().nullable().optional(),
            term: z.string().nullable().optional(),
          })
          .optional(),
        tz: z.string().nullable().optional(),
        locale: z.string().nullable().optional(),
        device: z
          .object({
            kind: z.enum(["mobile", "desktop"]).optional(),
          })
          .optional(),
        captured_at: z.string().optional(),
      })
      .optional(),
    location_data: z
      .object({
        source: z.string().optional(),
        city: z.string().nullable().optional(),
        region: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    legal_consent: z
      .object({
        terms_accepted_at: z.string().optional(),
        terms_version: z.string().optional(),
        privacy_accepted_at: z.string().optional(),
      })
      .optional(),
  });

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
    returnTo?: string,
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
        let {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        // Clear timeout since we got a response
        clearTimeout(timeoutId);

        if (error && process.env.NODE_ENV === "development") {
          console.error("AuthContext: Error during initialization:", error);
        }

        // Force session refresh after OAuth redirect
        // iOS Safari may not fire onAuthStateChange if cookies were set
        // during cross-origin redirect. Detect via cookie presence.
        if (!session && typeof window !== "undefined") {
          const hasAuthCookies = document.cookie.includes("sb-");
          const justRedirected = sessionStorage.getItem(
            "pending_signup_metadata",
          );

          if (hasAuthCookies || justRedirected) {
            const {
              data: { session: refreshedSession },
            } = await supabase.auth.getSession();
            if (refreshedSession) {
              session = refreshedSession;
            }
          }
        }

        // Check if we just completed an OAuth callback
        // The auth callback route sets a short-lived marker cookie so the client
        // knows to force-refresh auth state (handles iOS Safari cookie race)
        if (typeof window !== "undefined") {
          const hasCallbackMarker = document.cookie.includes(
            "auth_callback_completed",
          );
          if (hasCallbackMarker && !session) {
            document.cookie =
              "auth_callback_completed=; max-age=0; path=/";
            const {
              data: { session: freshSession },
            } = await supabase.auth.getSession();
            if (freshSession) {
              session = freshSession;
            }
          }
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

                  // Send new-user alert to founder (fire and forget)
                  fetch("/api/admin/new-user-alert", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      method:
                        session.user.app_metadata?.provider || "unknown",
                      viewportWidth:
                        typeof window !== "undefined"
                          ? window.innerWidth
                          : undefined,
                      entryPage:
                        typeof window !== "undefined"
                          ? window.location.pathname // eslint-disable-line no-restricted-properties -- reading pathname for analytics, not navigating
                          : undefined,
                    }),
                    keepalive: true,
                  }).catch(() => {});
                }
              }

              // Link anonymous events to the newly authenticated user
              // Guard with session-scoped flag to prevent repeated calls on token refresh
              const linkKey = `events_linked_${session.user.id}`;
              const alreadyLinked = sessionStorage.getItem(linkKey);
              const visitorId = getExistingVisitorId();
              if (visitorId && !alreadyLinked) {
                sessionStorage.setItem(linkKey, "true");
                fetch('/api/events/link', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: visitorId }),
                })
                  .then((res) => {
                    if (res.ok) {
                      clearVisitorId();
                    }
                  })
                  .catch((err) => {
                    if (process.env.NODE_ENV === 'development') {
                      console.error('[AuthContext] Failed to link anonymous events:', err);
                    }
                  });
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
      initializingRef.current = false;
    };
  }, [supabase, updateAuthState]);

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    metadata?: Record<string, any>,
    returnTo?: string,
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      // Embed the returnTo path in the confirmation link so Supabase redirects
      // the user back to their beach page (or wherever they signed up from)
      // after clicking the email link. Falls back to "/" if not provided.
      const safeReturnTo =
        returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : "/";
      const emailRedirectTo = siteUrl
        ? `${siteUrl.replace(/\/$/, "")}/auth/confirm?next=${encodeURIComponent(safeReturnTo)}`
        : undefined;

      // Store returnTo in a cookie as fallback for email confirmation redirect.
      // Supabase may strip custom query params from emailRedirectTo, and
      // localStorage doesn't survive cross-device email opens.
      if (safeReturnTo && safeReturnTo !== "/") {
        document.cookie = `auth_return_to=${encodeURIComponent(safeReturnTo)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }

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
